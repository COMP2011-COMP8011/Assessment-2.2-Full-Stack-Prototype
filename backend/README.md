# TaskParty API (backend)

Express 5 + Mongoose 9 REST API for TaskParty. Run it from the project root with `npm run dev`
(starts the frontend too), or on its own with `npm run dev --workspace backend`.

## Configuration

Copy `.env.example` to `.env`. Every value has a safe default for local development:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port (4000 avoids macOS AirPlay on 5000) |
| `MONGODB_URI` | *(empty)* | MongoDB / Atlas connection string. Empty → in-memory demo database |
| `MONGODB_DB` | `taskparty` | Database name |
| `JWT_SECRET` | *(random per run)* | Signs login tokens. **Required** when `NODE_ENV=production` |
| `JWT_EXPIRES_IN` | `24h` | Token lifetime (Assessment 1 §4) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Browser origins allowed by CORS (comma-separated). The Codespaces frontend URL is added automatically |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (minimum 10) |
| `SEED_ON_EMPTY` | `true` | Load the demo data when the database has no users |
| `AUTH_RATE_LIMIT` | `50` | Sign-in/registration attempts per IP per 15 minutes |

`.env` is git-ignored and not part of the submission zip.

## Scripts

| Script | |
|---|---|
| `npm run dev` | Start with `node --watch` (restarts on code changes) |
| `npm start` | Start without watching |
| `npm test` | Integration tests (`node:test` + `supertest`) against an in-memory MongoDB replica set. Set `TEST_MONGODB_URI` to use another server |
| `npm run seed` / `npm run seed:reset` | Seed an empty database / wipe and reseed (needs `MONGODB_URI`) |

## Request flow

`middleware/authMiddleware.js` is the brief's "authMiddleware": `requireAuth` verifies the JWT,
`requirePartyMember` checks the signed-in user belongs to the party before anything in it — its
tasks included — can be fetched, created, updated or deleted, and `requirePartyOwner` guards
owner-only actions. Passwords are hashed with bcrypt (`bcryptjs`, 12 rounds) in the User model.


```
request → helmet → cors (allow-list) → express.json → route
        → requireAuth (JWT → req.user) → validate params → requirePartyMember (403/404) [→ requirePartyOwner]
        → validate body/query (zod → req.valid) → controller (business logic, transactions) → JSON response
errors anywhere → errorHandler → { "error": { "status", "code", "message", "details"? } }
```

## API reference

Base URL: `/api/v1` (also served at `/api`). All bodies are JSON. Routes marked 🔒 need
`Authorization: Bearer <token>`.

### Health and auth

| Method | Path | | Success | Notes |
|---|---|---|---|---|
| GET | `/health` | | 200 | `{ status, database, databaseMode, transactions }`; 503 if the database is down |
| POST | `/auth/register` | | 201 | Body `{ email, password (8+), displayName, avatar? }` → `{ userId, user, token, expiresIn }`. 409 if the email exists |
| POST | `/auth/login` | | 200 | Body `{ email, password }` → `{ userId, user, token, expiresIn: 86400 }`. 401 with one message for any wrong email/password |

### Users

| Method | Path | | Success | Notes |
|---|---|---|---|---|
| GET | `/users/me` | 🔒 | 200 | Profile and settings (never the password hash) |
| PATCH | `/users/me` | 🔒 | 200 | `{ displayName?, avatar?, settings?: { audioEnabled?, notificationsEnabled?, highContrastMode? } }`. A new name/avatar is copied into `Party.recentMembers` and `Task.assignedToNames` in the same transaction |

### Parties

| Method | Path | | Success | Notes |
|---|---|---|---|---|
| GET | `/parties` | 🔒 | 200 | Parties you belong to (uses the denormalised `memberCount`/`recentMembers`) |
| POST | `/parties` | 🔒 | 201 | `{ name, description? }` → the new party (`{ _id, name, createdBy, currentLevel: 1, … }`, as in Assessment 1 §4). You become owner and first member (transaction) |
| GET | `/parties/:partyId` | 🔒 member | 200 | Party plus `members` (populated, with `online`) |
| PATCH | `/parties/:partyId` | 🔒 owner | 200 | `{ name?, description?, settings? }` — XP fields can't be written by clients |
| DELETE | `/parties/:partyId` | 🔒 owner | 204 | Deletes the party, its quests and every member's link to it (transaction) |
| POST | `/parties/:partyId/members` | 🔒 member | 200 | `{ email }` or `{ userId }` — Assessment 1 Scenario A (transaction). 404 unknown email, 409 already a member |
| DELETE | `/parties/:partyId/members/:userId` | 🔒 self or owner | 200 | Leave, or (owner) remove someone; their assignments in the party are cleared. The owner can't leave (400) |
| GET | `/parties/:partyId/stats` | 🔒 member | 200 | Aggregation pipeline: XP and quest count per contributor, counts per status, completed this week |

### Quests (tasks) — full CRUD

| Method | Path | | Success | Notes |
|---|---|---|---|---|
| GET | `/tasks` | 🔒 | 200 | Quests across all your parties. Query: `status`, `sortBy` (`createdAt`, `dueDate`, `pointValue`, `title`, `completedAt`), `order` (`asc`/`desc`), `limit` (1–200) |
| GET | `/parties/:partyId/tasks` | 🔒 member | 200 | The party's board; same query options (Assessment 1: `?status=todo&sortBy=dueDate&limit=50`) |
| POST | `/parties/:partyId/tasks` | 🔒 member | 201 | `{ title, pointValue (1–50 whole), description?, priority?, dueDate?, assignedTo?: [userId] }` → the new task (`{ _id, title, status: "todo", createdAt, … }`). Assignees must be party members |
| GET | `/parties/:partyId/tasks/:taskId` | 🔒 member | 200 | One quest |
| PATCH | `/parties/:partyId/tasks/:taskId` | 🔒 assignee or owner* | 200 | `{ title?, description?, priority?, dueDate?, assignedTo?, status?, completedBy? }` → `{ message: "Task updated", task }`. `status: "done"` runs Scenario B and adds `partyUpdate: { currentLevel, currentXp, xpLevelThreshold, totalXpEarned, levelledUp }` and `userUpdate`. `completedBy` is accepted but the signed-in user is recorded. `pointValue` can't change (400); completed quests can't be reopened (409) |
| DELETE | `/parties/:partyId/tasks/:taskId` | 🔒 creator or owner | 204 | XP already earned is kept |

\* Quests with no assignees can be updated by any member of the party.

### Error format and status codes

```json
{ "error": { "status": 400, "code": "VALIDATION_ERROR", "message": "Points must be between 1 and 50.",
             "details": [{ "field": "pointValue", "message": "Points must be between 1 and 50." }] } }
```

| Status | When |
|---|---|
| 400 | Validation failure, malformed JSON, malformed id, owner trying to leave |
| 401 | Missing, invalid or expired token; wrong credentials |
| 403 | Not a member, not the owner, not an assignee/creator, or a blocked CORS origin |
| 404 | Unknown route, party, quest or user |
| 409 | Duplicate email, already a member, quest already completed / reopening a completed quest |
| 413 | Body over 100 kB |
| 429 | Too many sign-in attempts |
| 500 | Unexpected error (generic message; details only in the server log) |
| 503 | Database unavailable |

## Data model

The three collections follow Assessment 1 §3 field for field — see `src/models/`, where every field
has its validation rule and message. Completing a quest follows §3.8 Scenario B in one transaction:
the quest is marked done, the party's `currentXp` and `totalXpEarned` are increased with `$inc`, and a
level-up (next level, XP back to 0, threshold `(level × 1000) + 1000`) is applied when the bar fills.
Indexes:
`users.email` (unique), `users.partyIds`, `parties.memberIds`, `parties.createdBy`,
`tasks.{partyId, status}` (compound), `tasks.dueDate`, `tasks.assignedTo`.
The denormalised caches (`memberCount`, `recentMembers`, `assignedToNames`) are updated in the
same transaction as the data they copy.

## Tests

`tests/` holds 53 integration tests that call the real Express app with `supertest` against a real
MongoDB: registration and login (hashing, duplicates, injection, expired tokens), profile updates and
cache sync, party membership (Scenario A, caps, leaving, owner rules), quest CRUD, validation and
permissions, completion and level-up (Scenario B), simultaneous completions of the same quest and
of different quests, CORS, the 404/400/500 handlers and the shared XP rules. They also pass against a
standalone `mongod`, where the API falls back to atomic single-document updates because transactions
need a replica set.
