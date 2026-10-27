# TaskParty frontend

React 18 single-page app built with Vite. In Assessment 2.1 it ran on local state seeded from
`mockData.json`; in 2.2 the mock data is gone (the same records now live in MongoDB, loaded by
`backend/src/seed`) and every screen reads and writes through the REST API with `fetch`.
Start it from the project root with `npm run dev`, which also starts the API.

## Where the API is

`src/api/client.js` sends every request to `import.meta.env.VITE_API_URL`. You normally don't set
it: `vite.config.js` uses `http://localhost:4000/api/v1`, or in GitHub Codespaces builds the
forwarded URL of port 4000 from `CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`.
To point at another API, set `VITE_API_URL` in `frontend/.env` (see `.env.example`).

## Structure

| Folder | Role |
|---|---|
| `src/api/` | `client.js` (fetch wrapper: base URL, bearer token, timeout, `ApiError`) and `endpoints.js` (one function per route) |
| `src/hooks/` | `useSession` (sign-in state, token, 401 handling), `useTaskParty` (server state and optimistic changes), `usePolling`, `useApiHealth`, `useAudioCues` |
| `src/logic/` | Pure functions: XP rules, task helpers, permission checks (mirrors of the API's rules), the Markdown subset |
| `src/components/` | Presentational components — props in, callbacks out, no API calls. Includes `Skeleton`, `Spinner` and `BusyButton` |
| `src/pages/` | Login, Register, Dashboard, Party and Profile screens (Assessment 1 screens 1–3; the quest dialog is screen 4) |
| `App.jsx` | Chooses the screen, connects hooks to pages, shows messages |

## Loading and error states

| Where | Loading | Errors |
|---|---|---|
| Sign in / register | Spinner in the button; a connection check before you start | Inline field errors (`role="alert"`), the API's message, and what to check if the API can't be reached |
| First load after sign-in | Skeleton party cards, stats and quest rows | A panel with **Try again** |
| Opening a party | Skeleton member avatars, contributions and (if no quests are cached yet) the board | A panel with **Try again**; losing access returns you to the dashboard |
| Saving | "Saving…" on the affected card; spinners on buttons that wait (Add member, Create party, Save profile) | Error toast with the error cue; the change is rolled back |
| Connection drops | — | A notice that the last loaded data is shown; it clears when the API is back |

## How the UI stays in sync with the database

| Situation | What happens |
|---|---|
| Sign in / refresh | Token kept in `sessionStorage`; parties and quests load from the API, and the profile is re-read |
| Create a quest | The card appears at once marked "Saving…"; the server's copy (real id, assignee names) replaces it. If the server refuses, the card goes and the dialog reopens with what you typed and why it failed |
| Edit a quest | The new values show at once; on failure the old version comes back and the dialog reopens |
| Start / Move back / Complete / Delete | Same optimistic pattern with rollback. Complete also moves the XP bar, predicted with `logic/xp.js`, then corrected by the API's `partyUpdate` |
| Teammates' changes | The open party is re-read every 10 s and whenever the tab regains focus; the dashboard every 30 s. Completions by others play the cue (if "Alert me…" is on) |
| Stale responses | A revision counter and a count of changes in flight drop poll results that would overwrite newer local state |
| Token expired or revoked | Any 401 signs you out with an explanation |
| Profile change | The API updates the name/avatar cached on parties and quests; the app reloads them |

## Accessibility (Assessment 1 §2)

Semantic landmarks (`nav`, `main`, the Quick Stats `aside`, the XP Progress live region), labelled
form fields, `role="alert"` for errors, assertive live regions for action results, visible focus,
high-contrast mode saved to the account, audio cues synthesised with the Web Audio API (completion,
deletion, error, navigation and dialog transitions) with a master switch, text labels on every
button, skeletons hidden from screen readers with one spoken "Loading…" status instead, reduced
motion respected, and a layout that works at phone width. Text and filled buttons use `#007A7A`
(5.2:1 on white) because the design's `#00A6A6` is 3.0:1.

## Tests

`npm test` runs `tests/logic.test.js` (Node's built-in test runner, 11 tests): XP prediction,
permissions, task helpers, optimistic list updates and the Markdown parser (including unsafe links
and HTML being left as text).
