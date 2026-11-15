# Bingo Arena — TODO (single source of truth for unfinished work)

Last updated: 2026-11-15
Status legend: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `DONE`
Priority legend: `P0` (blocks release) · `P1` (required scope) · `P2` (polish)

---

## 0. Milestone 0 — Repository audit and baseline

Status: **DONE** (see `docs/DONE.md` §2026-11-15 Audit)

Baseline findings are recorded in `docs/DONE.md` and in the Decision Log below.

---

## 1. Decision Log (binding unless the product owner overrides)

| id | decision | rationale | reversibility |
|----|----------|-----------|---------------|
| D1 | **No `GUIDE.md` exists in the repository.** The only project doc is `GameZone/readme.md` (a single `# GameZone` heading). The master prompt is therefore the sole product specification. | Repository inspection: `Get-ChildItem -Recurse *.md` returns only `readme.md`. | n/a — flag to owner |
| D2 | **Frontend stack = the stack actually present:** static ES-module web app (HTML + CSS + JS modules, no bundler, no build step). Expo / React Native / Expo Router / TypeScript-frontend do **not** exist in this repository, so there is nothing to "confirm" or preserve. | Master prompt §7 says *preserve the current stack* and Expo is required only *"where practical"*. Introducing Expo would mean creating a brand-new app plus a ~500 MB toolchain, and Android/iOS behaviour cannot be built or verified in this environment. The web app runs and is verifiable today. | Medium — UI layer is isolated in `app/views/*` and `app/components/*`; the rules engine is stack-agnostic. Migrating to Expo later would port these, not rewrite logic. |
| D3 | **Backend stack = the stack actually present:** Node.js 24 + TypeScript + Express 5 + Socket.IO 4 (already installed in `GameZone/backend`). Server also serves the static frontend, so dev is one origin (`http://localhost:3000`). | Dependencies are already installed; one origin removes CORS/config drift and keeps Docker to a single image. | Low |
| D4 | **Game rules engine = one canonical implementation** in `GameZone/shared/game-engine.js` (plain ES module, JSDoc-typed, plus `game-engine.d.ts`). Imported by both the backend (authoritative) and the browser (prediction/UX + unit tests). | Prevents client/server rule drift without a build step. | Low |
| D5 | **Win condition (default, configurable):** the match ends the moment a player completes **`linesToWin` lines** (default **1**). Supported configuration: 1–5 lines or `fullHouse` (all 25 marked). The active rule is displayed in the lobby and on the game screen, and asserted in tests. | Prompt §6 forbids shipping contradictory rules. A configurable engine + an explicit, visible default satisfies both the "line-based" and "five lines" mentions without guessing wrong. **Owner confirmation requested — see §7 Open Questions Q1.** | Low (config value) |
| D6 | **Turn order = fixed join order at match start**, no automatic calling, no host-as-permanent-caller (prompt §5). | Mandated. | n/a |
| D7 | **Disconnect policy V1 = pause, never reorder.** If the current caller disconnects, the server broadcasts `match.paused` with the reason and the match resumes with the *same* caller on reconnect. No skip, no timeout, no auto-call in V1. Policy text is shown in the lobby. | Prompt §5.9: turn order must never silently change, and any skip/timeout must be visible and documented. Pause is the only policy that cannot corrupt a competitive match. | Low — skipping can be added later as an explicit, visible feature |
| D8 | **Numbers 1–25, each exactly once, on a 5×5 board** (prompt §4.2 / §6). Called numbers come from the same 1–25 space, so a board is fully marked after 25 calls. | Mandated. | n/a |
| D9 | **Guest-first identity.** A nickname is required; a server-issued guest token (`HttpOnly`-free, localStorage-held opaque id) is optional and used only for reconnect/persistence. No Google/OAuth login anywhere. | Prompt §2 and §4.1. | Low |
| D10 | **Demo vs real is labelled in the UI.** After Milestone 5 there is real cross-device multiplayer over Socket.IO; before that, every room screen carries a "local demo" badge. After Milestone 5, no stat, rating, or player count is displayed unless it comes from the server. | Prompt §3 and §11 forbid inventing live-looking data. | n/a |
| D11 | **Test tooling = Node's built-in `node:test` + `node --test`**, no test framework added. Backend TS is run through `tsx`; the shared engine is plain JS and testable directly. | Zero new dependencies; runs on the installed Node 24. | Low |

---

## 2. Milestone 1 — Project foundation

Status: `NOT STARTED` · Priority `P0`

- [ ] **M1.1** `GameZone/package.json` with scripts (`dev`, `typecheck`, `test`) — NOT STARTED — P0
      Acceptance: `npm run dev` from `GameZone` starts the backend and the app is reachable at `http://localhost:3000`.
- [ ] **M1.2** Theme tokens (dark navy `#060b18`/`#0b1224`, electric purple `#8b5cf6`/`#a855f7`, accent cyan) as CSS custom properties, plus type scale and spacing tokens — NOT STARTED — P0
      Acceptance: no hard-coded hex values outside `app/theme/tokens.css` except in gradients defined by tokens.
- [ ] **M1.3** Reusable components: Button, Card, Input, Select, Modal, Badge, Spinner/Loading, EmptyState, Toast, Field error — NOT STARTED — P0
      Acceptance: each component is one module with typed JSDoc props, keyboard-accessible, and used by at least one view.
- [ ] **M1.4** Responsive layout: mobile (≤640), tablet (641–1024), desktop (≥1025) with a shell header/nav — NOT STARTED — P0
      Acceptance: no horizontal overflow at 360 px, 768 px, 1440 px.
- [ ] **M1.5** Guest-first entry (nickname capture, persisted in `localStorage`), no auth providers — NOT STARTED — P0
- [ ] **M1.6** Hash router + view lifecycle (mount/unmount, socket subscription cleanup) — NOT STARTED — P0
- [ ] **M1.7** Frontend typecheck gate (`tsc --noEmit` over TS backend + JSDoc `checkJs` over `app/` and `shared/`) — NOT STARTED — P1
- [ ] **M1.8** Update `readme.md` with real setup/architecture — NOT STARTED — P1

---

## 3. Milestone 2 — Landing page and navigation

Status: `NOT STARTED` · Priority `P0`

- [ ] **M2.1** Landing page: Bingo Arena identity, short explanation, guest profile chip, primary actions (Random Board, Create My Board, Discover Public Boards, Join by Code) — NOT STARTED — P0
- [ ] **M2.2** Public Arena preview on landing (live counts from server, honest empty/loading/error states) — NOT STARTED — P0
- [ ] **M2.3** Navigation for Home / Public Arena / Create / Rooms / Profile, keyboard navigable, active state — NOT STARTED — P0
- [ ] **M2.4** Responsive verification at 360 / 768 / 1440 px — NOT STARTED — P0

---

## 4. Milestone 3 — Board creation and game engine

Status: `NOT STARTED` · Priority `P0`

- [ ] **M3.1** `shared/game-engine.js`: `generateRandomBoard`, `validateBoard`, `createTurnOrder`, `applyCall`, `detectLines`, `evaluateWin` — NOT STARTED — P0
      Acceptance: pure functions, no I/O, deterministic under a seed, 100 % covered by `node --test`.
- [ ] **M3.2** Board creation UI: Random Board + Create My Board (drag/click arrangement), live validation of 25 unique values 1–25 — NOT STARTED — P0
- [ ] **M3.3** Preview / regenerate / reset / confirm — NOT STARTED — P0
- [ ] **M3.4** Unit tests: board validity, duplicate call rejection, out-of-range call rejection, out-of-turn call rejection, line detection (rows, columns, both diagonals), win evaluation — NOT STARTED — P0
- [ ] **M3.5** Turn-order module + tests (fixed order, wrap-around, advancement) — NOT STARTED — P1

---

## 5. Milestone 4 — Public and private room experience

Status: `NOT STARTED` · Priority `P0`

- [ ] **M4.1** Public Arena: room list with host, safe room id/code, player count/capacity, status, Join — NOT STARTED — P0
- [ ] **M4.2** Filters: all / waiting / in progress; disabled Join for full, closed, or ineligible rooms (server-enforced later) — NOT STARTED — P0
- [ ] **M4.3** Private room creation with unique code + copyable invite link — NOT STARTED — P0
- [ ] **M4.4** Join by code flow with clear invalid/expired/full errors — NOT STARTED — P0
- [ ] **M4.5** Lobby: participants, readiness, host badge, capacity, start controls, visible rule + disconnect policy text — NOT STARTED — P0

---

## 6. Milestone 5 — Backend and realtime multiplayer

Status: `NOT STARTED` · Priority `P0` · Depends on D3, D5, D7

- [ ] **M5.1** Backend config module (`PORT`, `CLIENT_ORIGIN`, `STATIC_DIR`, `ROOM_CAPACITY`, `LINES_TO_WIN`) with startup validation — NOT STARTED — P0
- [ ] **M5.2** `GET /api/health` returning version + uptime — NOT STARTED — P0
- [ ] **M5.3** Room service: create / join / leave / close, capacity, visibility (`public`/`private`), unique 6-char codes, lifecycle (`waiting` → `in_progress` → `finished`) — NOT STARTED — P0
- [ ] **M5.4** REST surface for room discovery and code join (`GET /api/rooms`, `GET /api/rooms/:code`, `POST /api/rooms`, `POST /api/rooms/:code/join`) — NOT STARTED — P0
- [ ] **M5.5** Socket.IO namespaces/events: `room.subscribe`, `room.state`, `match.start`, `match.call`, `match.called`, `match.paused`, `match.resumed`, `match.finished`, `error` — NOT STARTED — P0
- [ ] **M5.6** Server-authoritative turn ownership and call validation (integer 1–25, not already called, caller is current) — NOT STARTED — P0
- [ ] **M5.7** Broadcast accepted calls to every member; authoritative called-number history — NOT STARTED — P0
- [ ] **M5.8** Disconnect/reconnect (D7): pause on caller disconnect, resume on reconnect, membership reclaimed by token — NOT STARTED — P0
- [ ] **M5.9** Per-player board synchronization (only the owner receives their own board) — NOT STARTED — P0
- [ ] **M5.10** Realtime tests over a real Socket.IO client (two/three clients, out-of-turn, duplicate, win) — NOT STARTED — P0
- [ ] **M5.11** Frontend service modules (`app/lib/api.js`, `app/lib/socket.js`) + wire views to server state — NOT STARTED — P0
- [ ] **M5.12** Remove "local demo" badges where server data now backs the screen — NOT STARTED — P1

---

## 7. Milestone 6 — Persistence and guest identity

Status: `NOT STARTED` · Priority `P1`

- [ ] **M6.1** Choose and document the datastore (`node:sqlite` in Node 24 is the leading candidate — no new dependency) — NOT STARTED — P1
- [ ] **M6.2** Schema + migrations for `guests`, `matches`, `match_players`, `match_calls` — NOT STARTED — P1
- [ ] **M6.3** Server-issued guest token, presented over `Authorization`, validated server-side — NOT STARTED — P1
- [ ] **M6.4** Persist finished match results; results screen reads only persisted rows — NOT STARTED — P1
- [ ] **M6.5** Persistence tests (schema, token auth, result round-trip) — NOT STARTED — P1
- [ ] **M6.6** `.env.example` with placeholders; secrets never in client bundles — NOT STARTED — P1

---

## 8. Milestone 7 — Results, quality, deployment

Status: `NOT STARTED` · Priority `P1`

- [ ] **M7.1** Results screen from server-verified outcome only (no invented ratings) — NOT STARTED — P1
- [ ] **M7.2** Accessibility pass: contrast, focus rings, keyboard nav, ARIA live regions for called numbers — NOT STARTED — P1
- [ ] **M7.3** Responsive + performance pass (72 px touch targets on mobile, no layout shift) — NOT STARTED — P1
- [ ] **M7.4** Dockerfile (multi-stage, production `node` runtime) + `.dockerignore` — NOT STARTED — P1
- [ ] **M7.5** Docker build/run verification and documented commands — NOT STARTED — P1
- [ ] **M7.6** Deployment + secrets documentation in `readme.md` — NOT STARTED — P2

---

## 9. Open questions (product owner input needed)

- **Q1 — Win condition (P0, blocking full rule confidence).** Default implemented per D5: *first player to complete 1 line wins*, configurable to 1–5 lines or full house. Confirm whether the shipping rule should be **1 line**, **5 lines**, or **full house**.
- **Q2 — Called-number pool.** Boards use 1–25, so calls are naturally 1–25 (D8). Confirm no separate 1–75 style pool is intended.
- **Q3 — Late join during `in_progress`.** V1 blocks joining a running match (only `waiting` rooms accept joins). Confirm, or request a spectator/late-join mode.
- **Q4 — Stack.** D2/D3 keep the repository's actual web stack. Confirm this is acceptable instead of an Expo/React Native client.

---

## 10. Known limitations / technical debt

- The pre-existing `index.html`, `style.css`, `script.js` are a **different product** ("GameZone" game-discovery marketing page). They are replaced by the Bingo Arena app; the old content is preserved in Git history (`Untracked` at audit time — see DONE.md).
- No persistence before Milestone 6: rooms live in memory and are lost on restart.
- No automated browser E2E driver is installed; browser checks are manual + documented in `docs/TESTING.md`.
- No rate limiting / abuse protection yet.
- Single-process room store: horizontal scaling would need a Socket.IO adapter (Redis) — out of scope.
