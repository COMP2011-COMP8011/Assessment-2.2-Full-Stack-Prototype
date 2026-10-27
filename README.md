# TaskParty — Final Full-Stack Submission (Assessment 2.2)

COMP 8011 Full Stack Development · Group 18
Iftakhar Md Ruddro Hasan · Ali Rafsan Kabir · Saima Jannat Nova · Quazi Sabrina Sarwar

TaskParty is a collaborative, gamified task manager built on the MERN stack. Members of a
**party** share a board of **quests**; completing a quest adds its points to the party's XP bar
and levels the party up. Assessment 2.2 adds an Express + MongoDB backend to the Assessment 2.1
React app: the mock data is gone, every change is stored in MongoDB, and every member sees the
same board.

| Folder | What it is |
|---|---|
| `frontend/` | React 18 single-page app (Vite), the 2.1 milestone now talking to the API with `fetch` |
| `backend/` | REST API: Node.js, Express 5, Mongoose 9, JWT authentication, bcrypt password hashing |
| `package.json` | Root scripts: one command starts both servers (`concurrently`, npm workspaces) |

---

## Run it

You need **Node.js 20.19 or newer** (`node -v`).

```bash
cd ProjectGroup18
npm install        # installs the root, backend and frontend packages
npm run dev        # starts the API (port 4000) and the React app (port 5173) together
```

Open **http://localhost:5173** and sign in with a demo account (password `password123`):

| Email | Who | Notes |
|---|---|---|
| `ruddro@taskparty.app` | Ruddro Hasan | Owns *Team Rockets*; member of *Weekend Warriors* |
| `nova@taskparty.app` | Saima Nova | Owns *Weekend Warriors*; member of *Team Rockets* |
| `rafsan@taskparty.app` | Rafsan Kabir | Member of *Team Rockets* |
| `sabrina@taskparty.app` | Sabrina Sarwar | Member of *Weekend Warriors* |

**No database set-up is needed to try it.** When `backend/.env` has no `MONGODB_URI`, the API
starts a temporary in-memory MongoDB (a one-node replica set, so transactions work), loads the demo
data and prints the details in the terminal. The first start downloads MongoDB, which takes about a
minute. Demo-mode data resets whenever the API restarts.

### Using MongoDB Atlas (data that persists)

1. `cp backend/.env.example backend/.env`
2. In `backend/.env`, set `MONGODB_URI` to your Atlas connection string and `JWT_SECRET` to a long
   random string (the file shows a one-line command that generates one).
3. In Atlas → **Network Access**, allow your IP address (GitHub Codespaces needs `0.0.0.0/0`).
4. `npm run dev`. An empty database is seeded with the demo data automatically
   (`npm run seed:reset` wipes it and seeds again).

### In GitHub Codespaces

1. Open the project in a codespace. The included `.devcontainer` installs Node 22 and runs
   `npm install`; otherwise run `npm install` yourself.
2. Run `npm run dev`.
3. Open the **Ports** tab, right-click port **4000** → **Port Visibility** → **Public**
   (or run `gh codespace ports visibility 4000:public -c $CODESPACE_NAME`).
   The browser calls the API from the frontend's forwarded URL, which is a different origin;
   a private port answers those cross-origin requests with a GitHub sign-in redirect instead of
   the API's response.
4. Open the forwarded address for port **5173**.

Nothing needs editing for Codespaces. `frontend/vite.config.js` builds `VITE_API_URL` from the
`CODESPACE_NAME` and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` variables Codespaces provides,
and the API adds the forwarded frontend origin (`https://<codespace>-5173.app.github.dev`) to its
CORS allow-list on start-up. If the sign-in screen can't reach the API, it shows the URL it tried
and what to check.

### Root scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + frontend together, with colour-coded output (`concurrently`) |
| `npm test` | Backend integration tests (53) and frontend logic tests (11) |
| `npm run seed` | Load the demo data into an empty database (Atlas mode) |
| `npm run seed:reset` | Wipe users, parties and quests, then load the demo data again |
| `npm run build` | Production build of the frontend (`frontend/dist`) |

---

## Things to try (about five minutes)

1. Sign in as **ruddro@taskparty.app**. While data loads you'll see skeleton placeholders, and the
   sidebar's party cards show their three most recent members.
2. Open **Weekend Warriors** and press **Complete** on *Sunday long run*. The card moves to Done,
   the XP bar fills, the party levels up from 1 to 2 (1,960 + 40 ≥ 2,000) and the completion cue
   plays.
3. **Refresh the page.** Unlike 2.1, nothing resets: the XP and the completed quest come back from
   MongoDB.
4. Open a private window, sign in as **nova@taskparty.app**, open Weekend Warriors and complete
   *Meal prep for the week*. Within about 10 seconds Ruddro's board shows it, his XP bar moves,
   the cue plays and a message says who completed it. Saima's avatar shows the online dot.
5. In **Team Rockets** (Ruddro owns it), create a quest with some Markdown in the description
   (`**bold**`, `- lists`, `[links](https://…)`). The card appears straight away marked
   "Saving…" and settles when the server confirms. Edit it (points are locked after creation),
   start it, then delete it. Add `sabrina@taskparty.app` as a member.
6. On the dashboard, press **+ Create → New quest** to add a quest to any of your parties.
7. In Weekend Warriors, Ruddro has no buttons on *Meal prep* — it is Saima's quest, and only its
   assignees or the party owner may change it. The API enforces the same rule (403).
8. Open **Profile & settings** (bottom of the sidebar): change your display name — party cards and
   quest cards pick it up — turn on **High contrast**, refresh, and it stays on. **Log out** is
   there and in the sidebar.

---

## Project structure

```
ProjectGroup18/
├── package.json             root scripts (npm workspaces + concurrently)
├── .devcontainer/           GitHub Codespaces set-up (Node 22, ports 4000 and 5173)
├── backend/
│   ├── .env.example         every setting the API reads (copy to .env)
│   ├── src/
│   │   ├── server.js        connects MongoDB, seeds if empty, starts the HTTP server
│   │   ├── app.js           Express app: helmet, CORS, JSON parsing, routes, error handling
│   │   ├── config/          env.js (.env loading), db.js (Mongoose / in-memory demo DB), cors.js
│   │   ├── models/          User, Party and Task Mongoose schemas (Assessment 1 §3)
│   │   ├── routes/          URL → middleware → controller wiring
│   │   ├── controllers/     business logic for auth, users, parties, quests and health
│   │   ├── services/        shared party logic (XP award, member snapshots, assignees)
│   │   ├── middleware/      authMiddleware (JWT + party membership), validation, rate limit, errors
│   │   ├── validators/      zod request schemas
│   │   ├── utils/           ApiError, XP rules, JWT helpers, permissions, transactions
│   │   └── seed/            demoData.json (the 2.1 mock data, now in MongoDB) + seed scripts
│   └── tests/               node:test + supertest integration tests
└── frontend/
    ├── .env.example         optional VITE_API_URL override
    ├── vite.config.js       Codespaces-aware VITE_API_URL default, port 5173
    ├── src/
    │   ├── App.jsx          routing + orchestration (components never call fetch)
    │   ├── api/             client.js (fetch, VITE_API_URL, token, errors) + endpoints.js
    │   ├── hooks/           useSession (auth state), useTaskParty (server state), usePolling, useAudioCues
    │   ├── logic/           pure rules: XP, task helpers, permissions, Markdown subset
    │   ├── components/      presentational UI: skeletons, spinners, cards, dialogs
    │   └── pages/           Login, Register, Dashboard, Party and Profile screens
    └── tests/               node:test unit tests for /logic
```

More detail: [`backend/README.md`](backend/README.md) (API reference) and
[`frontend/README.md`](frontend/README.md) (state synchronisation).

---

## How the 2.2 brief is met

| Brief item | Where |
|---|---|
| **A. RESTful routing** — `/api/users` and the other resources | `backend/src/routes/`. Canonical base `/api/v1` (Assessment 1 §4); `/api` is an alias, so `/api/users/me` and `/api/v1/users/me` both work |
| **A. Complete CRUD for the main resource** | Quests: `POST`/`GET` `/parties/:partyId/tasks`, `GET`/`PATCH`/`DELETE` `/parties/:partyId/tasks/:taskId` — the routes from Assessment 1 §4 (see the note on "Echoes" below) |
| **A. Controllers + global error handler** | `controllers/*` hold the business logic; `middleware/errorHandler.js` maps validation, cast, duplicate-key, JSON, auth and unexpected errors to 400/401/403/404/409/413/429/500/503 with `{ "error": { status, code, message, details? } }` |
| **B. Mongoose schemas with validation** | `models/User.js`, `Party.js`, `Task.js`: required fields, lengths, enums, integer and range checks, email format, unique email, `immutable` points, no duplicate members/assignees — each with a readable message. Plus refs, the §3.9 indexes, `populate()` for members, an aggregation pipeline (`GET /parties/:id/stats`) and transactions for Scenarios A and B (§3.8) |
| **C. JWT** — register and log in to receive a token | `POST /auth/register` (201) and `POST /auth/login` (200) both return a signed JWT (24 h) |
| **C. bcrypt password hashing** | `models/User.js` pre-save hook, 12 salt rounds; the hash is never selected or returned |
| **C. authMiddleware for protected routes** | `middleware/authMiddleware.js`: `requireAuth` verifies the JWT; `requirePartyMember` checks the user belongs to the party before any task in it can be fetched, created, updated or deleted (403 otherwise); `requirePartyOwner` for owner-only actions. Assignee/creator rules in `utils/permissions.js` |
| **D. Data fetching** — no mock data, `fetch`, loading and error states | `frontend/src/api/client.js` (`fetch`); skeletons for parties, stats, recent quests, members, contributions and the board; spinners in buttons; inline form errors, error toasts, a retryable load-error panel, an offline notice and a connection check on the sign-in screen |
| **D. Auth state** | `hooks/useSession.js` keeps the JWT in `sessionStorage` and sends it only in the `Authorization` header; any 401 signs out with an explanation; the sidebar shows the user and **Log out**; **Profile & settings** shows and edits the profile |
| **D. Optimistic UI updates** | `hooks/useTaskParty.js`: creating, editing, starting, completing and deleting a quest update the board at once, then the server's copy replaces the guess; on failure the change is rolled back (and a failed create or edit reopens the dialog with what was typed) |
| **`.env` for MongoDB URI and JWT secret** | `backend/.env.example` → `backend/.env` (git-ignored, not in the zip) |
| **React uses an environment variable for the API URL** | `client.js` reads `import.meta.env.VITE_API_URL`; `vite.config.js` supplies it (localhost, or the Codespaces forwarded URL) |
| **CORS for the forwarded frontend port** | `backend/src/config/cors.js` + `config/env.js`: allow-list from `CLIENT_ORIGIN` plus the auto-detected Codespaces frontend URL; any other origin gets 403 |
| **One command for both servers** | Root `package.json`: `npm run dev` → `concurrently` |

### A note on "Echoes"

The 2.2 brief asks for `/api/echoes` and full CRUD on "Echoes". TaskParty has no resource with
that name; its central, user-created resource is the **quest** (the `Tasks` collection from
Assessment 1 §3.5), and part D of the brief refers to creating, updating and deleting Tasks. So
quests are where the complete Create, Read, Update and Delete operations live. If your marker
expects a literal `/echoes` path, the quest routes are the ones to assess.

---

## Design decisions

**Scenario B exactly as designed.** Completing a quest runs Assessment 1 §3.8 in one transaction:
mark the quest done (only if it isn't already, so two members pressing *Complete* together award the
points once and the second gets a clear 409), `$inc` the party's `currentXp` and `totalXpEarned`,
then — if the bar is full — level up, reset XP to 0 and raise the threshold to
`(level × 1000) + 1000`. The completer's own `totalXpEarned` is incremented in the same transaction.

**Optimistic updates, server wins.** The UI predicts the result with the same XP rule (a backend
test checks the frontend copy agrees), shows the change immediately with a "Saving…" marker, then
replaces it with the server's response. If the request fails, the board and the XP bar roll back
and the error is announced (`role="alert"`) with the error cue. The completion sound plays only
once the server has confirmed it, so the audio never reports something that didn't happen.

**Polling instead of WebSockets.** While a party is open the app re-reads it every 10 seconds, and
straight away when the tab regains focus or the network returns; the dashboard refreshes every 30
seconds. For a task board a few seconds' delay is acceptable, polling works through Codespaces port
forwarding without extra set-up, and unchanged responses are cheap (`Cache-Control: no-cache` lets
the browser revalidate with an ETag and receive `304 Not Modified`). A revision counter, plus a
count of changes still in flight, stops a slow poll from overwriting newer local state.

**Validation in two places.** zod schemas check every request at the edge (types, lengths, unknown
fields); Mongoose validators guard the data at the model. A client therefore can't set `currentXp`,
`role` or `createdBy` itself, and `{"$gt": ""}`-style operator injection is rejected with a 400.

---

## Differences from Assessment 1

Assessors can see the Assessment 1 design throughout: the three collections and their fields,
the denormalised caches and when they update, the indexes, Scenarios A and B, the API routes and
response shapes, the XP formula, the four screens, the landmarks and the audio cues. Where the build
differs, this is why:

| Assessment 1 said | The build does | Why |
|---|---|---|
| Refresh tokens in HttpOnly cookies for rotation; "credentials included" in CORS requests | The 24-hour access token only, kept in `sessionStorage` (cleared when the tab closes) and sent in the `Authorization` header; with no cookies, CORS doesn't need credentials | Rotation needs server-side storage and revocation of refresh tokens, which the three-collection schema doesn't include; 24 hours already covers a working session. The trade-off: script injected into the page could read the token, so the app never renders user content as HTML (React escapes it, and Markdown is built as elements) |
| bcrypt v4+ | `bcryptjs` 3 — the same bcrypt algorithm and hash format (`$2b$`, 12 rounds) in pure JavaScript | `npm install` never needs a C++ compiler on the marker's machine |
| `PATCH` body carries `completedBy` | Accepted, but the API records the signed-in user | Stops anyone recording a completion in someone else's name |
| Avatar is an image URL on a CDN or S3 | Avatar is one of six colours, shown as an initials badge | No image upload or storage in scope; each colour keeps white initials above 4.5:1 contrast |
| Completion checkbox on each quest card | A **Complete** button (as in 2.1) | Completing awards XP and can't be undone; a checkbox suggests it can be unticked |
| Teal `#00A6A6` text on white "exceeds 4.5:1" | Text and filled buttons use `#007A7A`; `#00A6A6` stays for the XP bar fill | `#00A6A6` on white measures 3.0:1, below the AA minimum the plan targets; `#007A7A` is 5.2:1 |
| Member "online status" | New `User.lastSeenAt`, updated (at most once a minute) by signed-in requests; online = active in the last 2 minutes | Presence without a real-time socket server |
| Descriptions "support Markdown" | A safe subset: paragraphs, line breaks, lists, bold, italic, code and http(s) links, rendered as React elements | Full Markdown would need an HTML sanitiser; the subset can't inject HTML |
| "More options": recurring quests, custom categories | Shown in the dialog as planned features (disabled) | Out of scope for this release |
| Base URL `/api/v1` | `/api/v1` kept, plus an `/api` alias | The 2.2 brief quotes `/api/users` |
| §3.5 table types `assignedToNames` as `Array<ObjectId>` | Stored as `[{ userId, displayName }]` | Matches the ER diagram and §3.7; the table had a typo |
| (not specified) | Completed quests can't be reopened | Keeps `totalXpEarned` monotonic, as §3.4 requires, and prevents XP farming |
| (not specified) | Extra routes: `GET /tasks`, `GET/PATCH /users/me`, `GET/PATCH/DELETE /parties/:id`, `DELETE /parties/:id/members/:userId`, `GET /parties/:id/stats`, `GET /health` | Needed by the dashboard, profile and settings, member management, the contributions panel and the connection check |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Sign-in screen says it can't reach the API | Check the `[api]` lines in the terminal. In Codespaces, set port 4000 to **Public**. |
| `Port 4000 is already in use` | Stop the other program, or set `PORT` in `backend/.env` and `VITE_API_URL` in `frontend/.env` to match. |
| `Port 5173 is already in use` | Stop the other Vite server; the port is fixed because the API's CORS allow-list expects it. |
| Atlas: `ECONNREFUSED`, `querySrv` or authentication errors | Check `MONGODB_URI` and the Atlas Network Access list. |
| Demo mode: download failed | The in-memory database needs internet access once; or set `MONGODB_URI`. |
| Demo data vanished | Expected in demo mode — it resets when the API restarts. Use Atlas to keep data. |
