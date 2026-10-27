// Unit tests for the frontend's pure logic (no browser needed): `npm test --workspace frontend`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canDeleteTask, canModifyTask, isPartyOwner } from '../src/logic/permissions.js';
import { markdownToText, parseInline, parseMarkdown } from '../src/logic/markdown.js';
import { completedThisWeek, fromDateInputValue, groupByStatus, isOverdue, toDateInputValue, upsertTask } from '../src/logic/tasks.js';
import { applyXp, nextThreshold, xpPercent } from '../src/logic/xp.js';

describe('XP prediction', () => {
  it('adds points and levels up exactly like the API', () => {
    const party = { currentLevel: 3, currentXp: 3990, xpLevelThreshold: nextThreshold(3), totalXpEarned: 9000 };
    assert.deepEqual(applyXp(party, 5).party, { ...party, currentXp: 3995, totalXpEarned: 9005 });
    const up = applyXp(party, 10);
    assert.equal(up.levelledUp, true);
    assert.deepEqual(up.party, { ...party, currentLevel: 4, currentXp: 0, xpLevelThreshold: 5000, totalXpEarned: 9010 });
  });

  it('caps the progress bar at 100%', () => {
    assert.equal(xpPercent({ currentXp: 500, xpLevelThreshold: 2000 }), 25);
    assert.equal(xpPercent({ currentXp: 9999, xpLevelThreshold: 2000 }), 100);
  });
});

describe('Permissions (mirror of the API rules)', () => {
  const party = { createdBy: 'owner' };
  it('lets assignees and the owner modify a quest', () => {
    const task = { assignedTo: ['alice'], createdBy: 'bob' };
    assert.equal(canModifyTask(party, task, 'alice'), true);
    assert.equal(canModifyTask(party, task, 'owner'), true);
    assert.equal(canModifyTask(party, task, 'bob'), false);
    assert.equal(canModifyTask(party, { assignedTo: [], createdBy: 'bob' }, 'carol'), true);
  });
  it('lets the creator or owner delete', () => {
    const task = { assignedTo: ['alice'], createdBy: 'bob' };
    assert.equal(canDeleteTask(party, task, 'bob'), true);
    assert.equal(canDeleteTask(party, task, 'owner'), true);
    assert.equal(canDeleteTask(party, task, 'alice'), false);
    assert.equal(isPartyOwner(party, 'owner'), true);
  });
});

describe('Task helpers', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  const tasks = [
    { status: 'todo', dueDate: '2026-10-01T00:00:00Z' },
    { status: 'in_progress', dueDate: null },
    { status: 'done', completedAt: '2026-10-05T00:00:00Z', dueDate: '2026-10-01T00:00:00Z' },
    { status: 'done', completedAt: '2026-09-01T00:00:00Z' },
  ];
  it('groups by Kanban column and finds this week\'s completions', () => {
    const grouped = groupByStatus(tasks);
    assert.deepEqual([grouped.todo.length, grouped.in_progress.length, grouped.done.length], [1, 1, 2]);
    assert.equal(completedThisWeek(tasks, now).length, 1);
  });
  it('flags overdue quests unless they are done', () => {
    assert.equal(isOverdue(tasks[0], now), true);
    assert.equal(Boolean(isOverdue(tasks[2], now)), false);
  });
  it('round-trips due dates through the date input', () => {
    assert.equal(toDateInputValue(fromDateInputValue('2026-10-12')), '2026-10-12');
    assert.equal(fromDateInputValue(''), null);
  });
});

describe('Optimistic list updates', () => {
  it('swaps a placeholder for the saved task without duplicates', () => {
    const list = [{ _id: 'temp-1', title: 'Draft' }, { _id: 'a', title: 'A' }];
    assert.deepEqual(upsertTask(list, { _id: 'b', title: 'Saved' }, 'temp-1'), [{ _id: 'b', title: 'Saved' }, { _id: 'a', title: 'A' }]);
    // A refresh already added the saved copy: the placeholder is replaced and the duplicate removed.
    const raced = [{ _id: 'temp-1' }, { _id: 'b', title: 'From refresh' }];
    assert.deepEqual(upsertTask(raced, { _id: 'b', title: 'Saved' }, 'temp-1'), [{ _id: 'b', title: 'Saved' }]);
    assert.deepEqual(upsertTask([], { _id: 'c' }), [{ _id: 'c' }]);
  });
});

describe('Markdown subset', () => {
  it('parses paragraphs, lists and inline formatting', () => {
    const blocks = parseMarkdown('Read **this** and *that*\nsee `code`\n\n- one\n- [two](https://example.com)');
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].type, 'p');
    assert.deepEqual(blocks[0].lines[0].map((t) => t.type), ['text', 'strong', 'text', 'em']);
    assert.deepEqual(blocks[0].lines[1].map((t) => t.type), ['text', 'code']);
    assert.equal(blocks[1].type, 'ul');
    assert.equal(blocks[1].items[1][0].href, 'https://example.com');
  });

  it('never creates unsafe links or HTML', () => {
    assert.deepEqual(parseInline('[x](javascript:alert(1))').map((t) => t.type), ['text']);
    assert.deepEqual(parseInline('<img src=x onerror=alert(1)>'), [{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });

  it('flattens to plain text', () => {
    assert.equal(markdownToText('**Lab** report\n- part _one_'), 'Lab report • part one');
  });
});
