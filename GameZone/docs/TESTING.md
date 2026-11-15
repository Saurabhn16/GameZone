# Bingo Arena — TESTING (test plan and real results)

> Rule: a test is only marked `PASS` when the command was executed in this repo and
> passed. Nothing here is aspirational. Statuses: `NOT RUN` · `PASS` · `FAIL` · `BLOCKED`.

Last updated: 2026-11-15

---

## 1. How to run things

Run every command from the `GameZone/` repository root.

| Purpose | Command | Notes |
|---------|---------|-------|
| Install deps | `npm install` (root), `npm --prefix backend install` | Root deps are the dev tooling; backend deps already present at audit time |
| Dev server (app + API + sockets on one origin) | `npm run dev` | Serves `http://localhost:3000` |
| Production start | `npm start` | Node 24 runs the TypeScript backend directly |
| Typecheck | `npm run typecheck` | TS backend + JSDoc `checkJs` over `app/` and `shared/` |
| Unit tests (engine + rules) | `npm test` | `node --test` over `shared/` and `backend/test/` |
| Single test file | `node --test GameZone/shared/game-engine.test.js` | From repo root; adjust path |

**Test tooling actually present:** Node's built-in test runner (`node:test` +
`node:assert/strict`). No Jest/Vitest/Playwright/Mocha is installed, and none will be
added without a stated reason (see `docs/TODO.md` D11).

**Automated browser E2E:** not installed. Browser verification is manual and is
recorded per-run in §9 with the viewport sizes actually used.

---

## 2. Strategy by layer

| Layer | Tool | What it proves |
|-------|------|----------------|
| Game engine (`shared/game-engine.js`) | `node --test` | Pure rules: board validity, call validation, line/win detection, turn order |
| Turn/room rules (`backend/src/game/*`) | `node --test` via `tsx` | Illegal call rejection, capacity, visibility, lifecycle transitions |
| HTTP API | `node --test` + `fetch` against a started server | Status codes, payload shapes, error paths |
| Realtime | `node --test` + real `socket.io-client` | Authoritative state, broadcast fidelity, disconnect/reconnect |
| Frontend | Manual + browser | Renders, navigation, validation messages, responsive layout |
| Container | Manual | `docker build` / `docker run` / health check |

---

## 3. Critical edge cases that must be covered before MVP sign-off

Duplicate numbers on a board · number outside 1–25 · non-integer call ·
call by a non-current player · duplicate call · call after match finished ·
full room join · private room join without code · repeated join by the same guest ·
current caller disconnects · non-caller disconnects · host disconnects ·
two simultaneous calls from different clients · win detection on row/column/diagonal ·
win on the last remaining number · result payload integrity.

---

## 4. Test cases

Status of every case is `NOT RUN` until the execution log (§9) records otherwise.

### 4.1 Game engine (unit) — `shared/game-engine.test.js`

| ID | Scenario | Steps | Expected | Status |
|----|----------|-------|----------|--------|
| GE-01 | Random board is a permutation of 1–25 | `generateRandomBoard()` × 200 iterations | 25 cells, all unique, all in 1..25 | NOT RUN |
| GE-02 | Random board is deterministic with a seed | Same seed twice | Identical boards | NOT RUN |
| GE-03 | Different seeds differ | 50 seeds | At least 49 distinct boards | NOT RUN |
| GE-04 | Valid manual board accepted | 25 unique values 1–25 | `validateBoard` → ok | NOT RUN |
| GE-05 | Duplicate value rejected | Board with two `7`s | `{ok:false, code:"duplicate_number"}` | NOT RUN |
| GE-06 | Out-of-range value rejected | Board containing `26` and `0` | error code `value_out_of_range` naming the value | NOT RUN |
| GE-07 | Wrong cell count rejected | 24 or 26 typed values | error code `board_incomplete` / `board_overfull` | NOT RUN |
| GE-08 | Non-integer / empty cell rejected | `""`, `1.5`, `"abc"` | error code `value_not_integer` | NOT RUN |
| GE-09 | Valid call accepted | 1–25, not called, correct caller | call recorded, `nextTurn` advances | NOT RUN |
| GE-10 | Duplicate call rejected | Call 5 twice | `{ok:false, code:"number_already_called"}` | NOT RUN |
| GE-11 | Out-of-range call rejected | `0`, `26`, `-1`, `1.5` | `{ok:false, code:"number_out_of_range"}` | NOT RUN |
| GE-12 | Out-of-turn call rejected | Player B calls while A is current | `{ok:false, code:"not_your_turn"}` | NOT RUN |
| GE-13 | Call in a finished match rejected | Finish, then call | `{ok:false, code:"match_finished"}` | NOT RUN |
| GE-14 | Row line detected | Mark a full row | `lines` includes that row, `count:1` | NOT RUN |
| GE-15 | Column line detected | Mark a full column | column line detected | NOT RUN |
| GE-16 | Main diagonal detected | Mark (0,0)(1,1)(2,2)(3,3)(4,4) | diagonal line detected | NOT RUN |
| GE-17 | Anti-diagonal detected | Mark (0,4)(1,3)(2,2)(3,1)(4,0) | anti-diagonal detected | NOT RUN |
| GE-18 | Four cells in a row is not a line | Mark 4 of 5 | no line | NOT RUN |
| GE-19 | `linesToWin:1` — first line wins | One player completes one line | match finished, that player is winner | NOT RUN |
| GE-20 | `linesToWin:5` — 5 lines needed | Player completes 1–4 lines then the 5th | match only finishes on line 5 | NOT RUN |
| GE-21 | Full house mode | Mark all 25 | finish only at 25 marked | NOT RUN |
| GE-22 | Simultaneous winners | Last call completes lines for two players | deterministic outcome: earliest submit wins, ties flagged | NOT RUN |
| GE-23 | Turn order is fixed and wraps | 4 players, 9 calls | 1,2,3,4,1,2,3,4,1 | NOT RUN |
| GE-24 | Turn order ignores disconnect reorder | Remove non-current player mid-match | remaining order unchanged | NOT RUN |

### 4.2 Rooms (unit)

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| RM-01 | Create public room | 6-char unique code, status `waiting`, visibility `public` | NOT RUN |
| RM-02 | Create private room | Visibility `private`, code required to join | NOT RUN |
| RM-03 | Code collision retried | Uniqueness guaranteed across 10 000 creations | NOT RUN |
| RM-04 | Join public room | Member added, host is first member | NOT RUN |
| RM-05 | Join private room with wrong code | Rejected `invalid_room_code` | NOT RUN |
| RM-06 | Join full room (capacity) | Rejected `room_full` | NOT RUN |
| RM-07 | Join closed/finished room | Rejected `room_closed` | NOT RUN |
| RM-08 | Repeated join by same guest | Idempotent — one membership, no duplicate | NOT RUN |
| RM-09 | Non-host cannot start match | Rejected `not_host` | NOT RUN |
| RM-10 | Host start with < 2 players | Rejected `not_enough_players` | NOT RUN |
| RM-11 | Leave before start | Membership removed, host reassigned if host left | NOT RUN |

### 4.3 HTTP API

| ID | Request | Expected | Status |
|----|---------|----------|--------|
| API-01 | `GET /api/health` | 200 `{status:"ok",version,uptime}` | NOT RUN |
| API-02 | `GET /api/rooms` | 200 list of public rooms only | NOT RUN |
| API-03 | `GET /api/rooms?status=waiting` | Filtered list | NOT RUN |
| API-04 | `GET /api/rooms/ABC123` (public) | 200 room summary, no private boards | NOT RUN |
| API-05 | `GET /api/rooms/<private-code>` without join token | 403/404 — no leak of membership | NOT RUN |
| API-06 | `POST /api/rooms` invalid body | 400 with field errors | NOT RUN |
| API-07 | `POST /api/rooms/:code/join` full room | 409 `room_full` | NOT RUN |
| API-08 | Malformed JSON body | 400, server stays up | NOT RUN |
| API-09 | Unknown route | 404 JSON (not HTML) | NOT RUN |

### 4.4 Realtime (Socket.IO, real clients)

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| RT-01 | Two clients join same room | Both receive identical `room.state` | NOT RUN |
| RT-02 | Host starts match | All clients get `match.started` with same turn order | NOT RUN |
| RT-03 | Current caller calls 7 | All clients get `match.called {number:7, by, seq}` | NOT RUN |
| RT-04 | Out-of-turn call | Caller gets `error not_your_turn`, no broadcast | NOT RUN |
| RT-05 | Duplicate call | `error number_already_called`, history unchanged | NOT RUN |
| RT-06 | Board privacy | Client only ever receives its own board | NOT RUN |
| RT-07 | Current caller disconnects | All clients get `match.paused` with reason `caller_disconnected` | NOT RUN |
| RT-08 | Paused caller reconnects | `match.resumed`, same caller still current | NOT RUN |
| RT-09 | Non-caller disconnects | No pause; player marked `disconnected` | NOT RUN |
| RT-10 | Host disconnects pre-match | Documented host-transfer behaviour fires, room survives | NOT RUN |
| RT-11 | Two simultaneous calls | Exactly one accepted, one rejected, history has one entry | NOT RUN |
| RT-12 | Win broadcast | All clients get `match.finished` with same winner id | NOT RUN |
| RT-13 | Join a private room via socket without code | Rejected | NOT RUN |
| RT-14 | Socket joins unknown room | `error room_not_found` | NOT RUN |

### 4.5 Frontend (manual browser)

| ID | View | Check | Status |
|----|------|-------|--------|
| UI-01 | Landing | Identity, explanation, guest chip, 4 primary actions render | NOT RUN |
| UI-02 | Landing | Loads with no console errors | NOT RUN |
| UI-03 | Board create | Random board generates 25 unique numbers | NOT RUN |
| UI-04 | Board create | Manual board blocks duplicates with inline errors | NOT RUN |
| UI-05 | Board create | Regenerate/reset/confirm all work | NOT RUN |
| UI-06 | Public Arena | Rooms list real server data; empty state when none | NOT RUN |
| UI-07 | Public Arena | Full room Join is disabled with a reason | NOT RUN |
| UI-08 | Join by code | Wrong code shows error, never implies success | NOT RUN |
| UI-09 | Lobby | Shows players, host badge, capacity, rule, disconnect policy | NOT RUN |
| UI-10 | Game | Only current caller can call; others see disabled state | NOT RUN |
| UI-11 | Game | Called history, current caller, turn order visible | NOT RUN |
| UI-12 | Game | Marking is allowed for called numbers only | NOT RUN |
| UI-13 | Results | Winner + per-player results, no invented ratings | NOT RUN |
| UI-14 | All | Responsive at 360 / 768 / 1440 px, no horizontal overflow | NOT RUN |
| UI-15 | All | Keyboard-only navigation works; focus visible | NOT RUN |
| UI-16 | All | Contrast checked on dark navy; text ≥ 4.5:1 | NOT RUN |

### 4.6 Persistence (Milestone 6)

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| DB-01 | Guest token survives restart | Same guest id resolved after server restart | NOT RUN |
| DB-02 | Match result persisted | Finished match row + player rows + call history | NOT RUN |
| DB-03 | Results API returns persisted data | Matches DB rows exactly | NOT RUN |
| DB-04 | Invalid/forged token | 401, no data leak | NOT RUN |

### 4.7 Container (Milestone 7)

| ID | Command | Expected | Status |
|----|---------|----------|--------|
| DOCKER-01 | `docker build -t bingo-arena .` | Build succeeds | NOT RUN |
| DOCKER-02 | `docker run -p 3000:3000 bingo-arena` | App serves; `GET /api/health` 200 | NOT RUN |

---

## 5. Baseline checks from the audit (Milestone 0)

| Check | Command | Result |
|-------|---------|--------|
| Git state | `git -C GameZone status --short` | All files untracked; no commits — **BLOCKED** for any "built on existing code" claim |
| `GUIDE.md` present | `Get-ChildItem -Recurse -Filter *.md` | Absent — **BLOCKED** (see D1) |
| Backend typecheck | `tsc --noEmit` in `backend/` | **NOT RUNNABLE** — no input files exist, so nothing is typechecked |
| Backend tests | `npm test` in `backend/` | **FAIL by design** — npm's default stub exits 1 |
| Frontend build | n/a | No build system exists |

---

## 6. Execution log

| Date | Scope | Commands | Outcome |
|------|-------|----------|---------|
| 2026-11-15 | Audit baseline | `git status --short`, `git branch --show-current`, `node -v`, `npm -v`, `tsc --version`, directory listings | All ran. No typecheck/test coverage possible (no source, no test files). Documented in `docs/DONE.md`. |

---

## 7. Known gaps

- No automated browser/visual regression tooling.
- No load or soak testing.
- No cross-browser matrix beyond the browsers actually opened during manual checks.
- Socket.IO tests require a bound port; they will run against an ephemeral port to avoid clashes.
