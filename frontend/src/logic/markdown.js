// A small, safe Markdown subset for quest and party descriptions (Assessment 1 §3.4–3.5 and
// Screen 4: descriptions "support Markdown").
//
// Supported: paragraphs, line breaks, "- " / "* " bullet lists, **bold**, *italic* or _italic_,
// `code` and [links](https://…). The parser returns plain data; components/Markdown.jsx turns
// it into React elements, so user text is never inserted as HTML and links can only use
// http(s) or mailto. Anything else is shown as typed.

const INLINE = /(`[^`\n]+`)|\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
const BULLET = /^\s*[-*]\s+(.*)$/;

/** Inline text → [{ type: 'text'|'code'|'strong'|'em'|'link', ... }] */
export function parseInline(text) {
  const tokens = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) });
    const [whole, code, linkText, href, strong, em1, em2] = match;
    if (code) tokens.push({ type: 'code', text: code.slice(1, -1) });
    else if (linkText) tokens.push({ type: 'link', href, children: parseInline(linkText) });
    else if (strong) tokens.push({ type: 'strong', children: parseInline(strong) });
    else tokens.push({ type: 'em', children: parseInline(em1 ?? em2) });
    last = match.index + whole.length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

/** Text → [{ type: 'p', lines: [inline[]] } | { type: 'ul', items: [inline[]] }] */
export function parseMarkdown(source = '') {
  const blocks = [];
  let current = null;
  for (const raw of String(source).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      current = null;
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      if (current?.type !== 'ul') blocks.push((current = { type: 'ul', items: [] }));
      current.items.push(parseInline(bullet[1]));
    } else {
      if (current?.type !== 'p') blocks.push((current = { type: 'p', lines: [] }));
      current.lines.push(parseInline(line.trim()));
    }
  }
  return blocks;
}

/** Plain-text version (for previews and accessible names). */
export function markdownToText(source = '') {
  const flatten = (tokens) => tokens.map((t) => (t.children ? flatten(t.children) : t.text)).join('');
  return parseMarkdown(source)
    .map((b) => (b.type === 'ul' ? b.items.map((i) => `• ${flatten(i)}`).join(' ') : b.lines.map(flatten).join(' ')))
    .join(' ');
}
