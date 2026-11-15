BINGO ARENA
A responsive, cross-platform Bingo game frontend built with Expo, Expo Router, React Native and TypeScript. The project is designed around one shared application codebase for the web, Android and iOS.
Current scope: frontend prototype with local demo state. Google authentication has intentionally been removed from this first release. Players enter as guests. Real online multiplayer, persistent guest accounts and server-authoritative ratings are planned backend work and are not represented as working features yet.

Contents
- Product overview
- Current features
- Screens and navigation
- Technology stack
- Project structure
- Requirements
- Run locally
- Run with Docker
- Run on Android and iOS
- Game rules and demo behavior
- Architecture and future backend
- Planned database model
- Security and fairness
- Environment configuration
- Troubleshooting
- Roadmap
- Contributing
Product overview
Bingo Arena is a social, competitive Bingo experience. The visual direction is modern and playful, using a dark navy interface with electric purple accents, bright status colors, rounded cards and responsive layouts.

The initial game format is a 5×5 board. The longer-term product direction includes private rooms, public matchmaking, friends, chat and reactions, ranked games, leagues, achievements and global leaderboards.
Product principles
1. Easy to enter: start as a guest without an account setup flow.
2. Fast to play: create a room or enter a room code.
3. Readable on every screen: responsive desktop, tablet and mobile layouts.
4. Fair competition: the backend—not a player's browser—will own official game state and rating changes.
5. One product: share game rules, types and as much UI as practical across web and native apps.
Current features
The current repository is a frontend prototype. These interactions run locally in the app and use sample data:
- Dark navy and purple Bingo Arena branding.
- Responsive desktop sidebar and mobile bottom navigation.
- Home dashboard with a sample rating, league progress, stats and quick actions.
- Guest-first profile presentation; no Google sign-in UI or OAuth dependency.
- Create-room dialog with private/public visibility, player limit and casual/ranked selection.
- Join-room dialog with room-code validation.
- Friends and rooms screen with sample online players and invite feedback.
- Classic randomized 5×5 board containing numbers 1–25.
- Simulated number calling and called-number history.
- Marking validation: a number cannot be marked until it has been called.
- Demo match completion and sample rating feedback.
- Leaderboard, profile, achievements and settings presentation.
- Toast feedback for prototype actions.
Prototype limitations
The current frontend does not yet include:
- Real user accounts or persistent guest identity.
- Real room creation or joining across devices.
- Real-time multiplayer synchronization.
- A backend number caller or authoritative game state.
- Server-side win validation or anti-cheat protection.
- Persistent rating, game history, friends, chat or achievements.
- Push notifications or production matchmaking.
Sample player names, online counts, ratings and game events are illustrative. A room code shown by the prototype is not a live server room.
Screens and navigation
Screen	Purpose	Current state
Home	Quick play, create room, join by code, rating and stats	Interactive demo
Rank	Leaderboard and sample player rankings	Sample data
Friends	Online friends, room actions and invitations	Sample data
Profile	Guest profile, stats, achievements and settings	Local demo
Game	5×5 board, number calling, player list and called numbers	Local demo
Create room	Visibility, player limit and game mode	Local modal
Join room	Enter and validate a room code	Local modal


Technology stack
Technology	Responsibility
Expo SDK 54	Cross-platform application tooling
React 19	Component model
React Native 0.81	Native UI primitives
React Native Web	Render shared React Native UI in a browser
Expo Router 6	File-based navigation entry point
TypeScript	Static typing
Nginx	Production static web hosting in Docker
Docker Compose	Repeatable local container workflows


Project structure
bingo-arena/
├── app/
│   ├── _layout.tsx       # Expo Router root layout
│   └── index.tsx          # Current responsive UI and local demo interactions
├── src/                   # Reserved for extracted shared modules
├── assets/                # Reserved for app icons, splash and static assets
├── Dockerfile             # Development and production image stages
├── docker-compose.yml     # Production web service + optional dev service
├── nginx.conf             # Static web hosting and SPA fallback
├── .dockerignore
├── app.json               # Expo application configuration
├── babel.config.js
├── package.json
├── tsconfig.json
└── README.md
As the app grows, move game rules, rating calculations and reusable UI out of app/index.tsx into focused modules under src/ or shared workspace packages.
Requirements
For local development:
- Node.js 20.19 or newer (Node 22 LTS recommended).
- npm.
- Git (recommended).
- Docker Engine + Docker Compose plugin for container workflows.
- Android Studio for a local Android emulator, or a compatible device.
- Xcode on macOS for local iOS simulator builds.
Check versions:
node --version
npm --version
docker --version
docker compose version
Run locally
1. Clone or extract this repository.
2. Open a terminal in the bingo-arena project directory.
3. Install dependencies and start the web app:
npm install
npx expo install --fix
npm run web
Open the URL printed by Expo (normally http://localhost:8081).
Other development commands
# Start Expo's development server
npm start

# Start web development server
npm run web

# Start Android (requires Android tooling/device)
npm run android

# Start iOS (requires macOS and Xcode)
npm run ios

# TypeScript check
npm run typecheck

# Export a static web build to ./dist
npm run build:web
Run with Docker
Docker is currently used to build and serve the web version of Bingo Arena. It does not build Android APKs or iOS applications. Native builds use Expo/EAS workflows described later.
Option A: Production-style container (recommended)
Build the Expo web export and serve it with Nginx:
docker compose up --build -d
Open:
http://localhost:8080
Useful commands:
# View container status
docker compose ps

# Follow logs
docker compose logs -f bingo-arena

# Stop the app
docker compose down

# Rebuild after source or dependency changes
docker compose up --build -d

# Stop and remove containers and the named development volume
docker compose down --volumes
The production image uses a multi-stage build:
1. Node installs the project dependencies.
2. Expo exports the web app into dist/.
3. Nginx serves the static export on port 80 inside the container.
The host port is 8080 by default. Change the left side of 8080:80 in docker-compose.yml if that port is already in use.
Option B: Docker development server with hot reload
Use the optional dev Compose profile:
docker compose --profile dev up --build bingo-arena-dev
Open:
http://localhost:8081
The project directory is mounted into the container, so source edits are reflected by the Expo development server. Stop it with Ctrl+C, or run:
docker compose --profile dev down
If Metro cannot reach the browser/device through Docker networking, use the normal local workflow (npm install && npm run web) or configure the Expo/Metro network mode for your environment.
Build the production image directly
docker build --target production -t bingo-arena:latest .
docker run --rm -p 8080:80 --name bingo-arena bingo-arena:latest
Docker notes
- .dockerignore excludes node_modules, Expo cache, local environment files and build output.
- The Nginx config falls back to index.html for client-side routes.
- Static assets receive cache headers; HTML is not given the same long-lived immutable cache policy.
- A container health check requests /.
- No database or backend service is included yet. Do not mistake the frontend container for a multiplayer server.
Run on Android and iOS
The Expo project targets native platforms as well as web.
npm install
npx expo install --fix

# Android
a npm run android

# iOS (macOS only)
npm run ios
If copying the commands, remove the accidental leading a in the Android command above; the correct command is:
npm run android
For device builds and store distribution, use Expo Application Services (EAS). EAS configuration, signing credentials, store metadata and production app identifiers still need to be set up before release.
Game rules and demo behavior
Board
- Board dimensions: 5 columns × 5 rows.
- Values: 1 through 25, shuffled for each new board.
- A player can mark a number only after it has been called.
- A new demo game generates a fresh shuffled board and resets called/marked state.
Intended winning rules
The initial classic mode is intended to support five completed lines:
- Horizontal rows.
- Vertical columns.
- Main diagonal.
- Opposite diagonal.
The current UI is a prototype and should not be treated as a final competitive rules engine. Before ranked multiplayer launches, define whether the game ends at one completed line, a specified number of lines, or a full house, and implement those rules in tested shared game logic plus server validation.
Guest-first account decision
For this first milestone, the app starts as a guest-style experience. There is no Google authentication button, OAuth flow or Google configuration. In the current prototype, guest profile information is not backed by a database and may reset when the app reloads.

When a backend is introduced, create an anonymous guest session and store a stable player ID. Account linking (including Google) can be considered later without changing the initial guest onboarding flow.
Architecture and future backend
The frontend is intentionally separated from the future multiplayer service. A suggested production architecture is:
Web browser / Android / iOS
           |
           v
     Expo application
           |
           v
   Auth + room/game API
           |
     +-----+------+
     |            |
     v            v
  Database    Realtime layer
     |            |
     +-----+------+
           |
           v
   Authoritative game service
           |
           v
  Results + rating + leaderboard
A managed backend such as Supabase is a reasonable next step because it can provide Postgres, anonymous authentication, realtime presence/broadcast and server-side functions. Alternatives include a custom Node.js API with WebSockets and PostgreSQL.
Suggested implementation boundaries
- game-engine: board creation, number validation, line detection and deterministic rule tests.
- rating-engine: Elo expected-score and rating-delta calculations.
- rooms: room creation, join permissions, host controls and player readiness.
- realtime: room presence and game event delivery.
- profiles: guest identity, nickname, avatar and statistics.
- results: final standings, rating updates and achievement grants.
Keep the game engine and rating engine free of UI dependencies so they can be tested and reused by the server.
Planned database model
The following is a design proposal, not a migration already present in this repository.
Table	Example fields	Purpose
profiles	id, nickname, avatar, created_at	Guest/player profile
rooms	id, code, host_id, visibility, status, settings	Room lifecycle and rules
room_players	room_id, player_id, board, ready_at, joined_at	Room membership and player board
games	id, room_id, status, started_at, finished_at	Match lifecycle
called_numbers	game_id, number, sequence, called_at	Authoritative call history
game_results	game_id, player_id, placement, result	Final match outcome
player_ratings	player_id, rating, league, updated_at	Current competitive rating
rating_history	game_id, player_id, before_rating, delta, after_rating	Auditable rating changes
friendships	requester_id, addressee_id, status	Friend relationships


Use database constraints and indexes for unique room codes, one membership per player per room, unique called numbers per game and efficient leaderboard ordering.
Security and fairness
Before enabling ranked play:
- The server must generate or verify each board; clients must not submit arbitrary winning boards.
- Only the room host or authorized game service can call a number, depending on the selected mode.
- Called numbers must be unique and belong to the configured number range.
- The server must validate marked cells and winning lines against the stored board and call history.
- The server must finish a game exactly once and calculate rating changes transactionally.
- Clients must never directly write their own rating, placement, XP or achievement awards.
- Private room access must be checked on the server.
- Rate-limit room creation, join attempts, chat and other public endpoints.
- Validate and sanitize nicknames and chat messages.
- Do not expose service-role keys or private secrets in a mobile/web bundle.
For guest accounts, protect against easy identity spoofing and duplicate rating abuse. Ranked play may require stronger account verification, device/session limits or other abuse controls. Casual guest rooms can remain low-friction.
Environment configuration
The current frontend prototype does not require environment variables or external API keys.

When a backend is added, use a local .env file (never commit it) for public client configuration, for example:
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
Only public client keys belong in EXPO_PUBLIC_* variables. Server secrets must live in server-side environment configuration or a secrets manager, never in Expo client variables.
Troubleshooting
Expo reports a dependency version mismatch
Run:
npx expo install --fix
Web page does not open
- Confirm the Expo server started successfully.
- Check the URL and port printed in the terminal.
- If port 8081 is busy, stop the other process or use Expo's port option.
Docker says port 8080 is already allocated
Change the host port in docker-compose.yml, for example 8090:80, then run:
docker compose up --build -d
Docker build is using stale files
docker compose build --no-cache
docker compose up -d
Native app cannot connect to the development server
A physical device must be able to reach the development machine over the network. Try the Expo tunnel option or use the local Expo CLI outside Docker.
TypeScript check
npm run typecheck
Resolve reported errors before adding backend integration. The UI is a prototype and may need additional platform-specific testing on actual devices.
Roadmap
Milestone 1 — Frontend prototype
- [x] Dark gaming design system.
- [x] Responsive web/mobile navigation.
- [x] Home, rank, friends, profile and game views.
- [x] Guest-first UI; Google sign-in removed from this milestone.
- [x] Demo board, number calling and local interactions.
- [x] Docker-based static web hosting.
Milestone 2 — Guest identity and persistence
- [ ] Anonymous guest session.
- [ ] Stable guest player ID and nickname/avatar persistence.
- [ ] Persistent game history and profile stats.
Milestone 3 — Real multiplayer
- [ ] Create/join rooms through backend.
- [ ] Room presence and ready state.
- [ ] Shared number calls and synchronized boards.
- [ ] Reconnection and host-disconnect handling.
- [ ] Server-side game state and win validation.
Milestone 4 — Competitive layer
- [ ] Elo rating service and rating history.
- [ ] Global/friends/weekly leaderboards.
- [ ] Ranked matchmaking and league progression.
- [ ] Achievements and daily challenges.
Milestone 5 — Social and release
- [ ] Friends and invitations.
- [ ] Chat and quick reactions with moderation controls.
- [ ] Notifications.
- [ ] Accessibility, performance and security review.
- [ ] EAS builds and store publishing.
Contributing
1. Create a feature branch.
2. Keep game rules in testable modules rather than embedding them in screen components.
3. Use TypeScript types for API payloads and game events.
4. Run npm run typecheck before opening a pull request.
5. Test web layouts at narrow mobile, tablet and desktop widths.
6. Never commit .env, credentials, signing keys or generated build output.
License
No license has been selected yet. Add a LICENSE file before distributing this project as open source or granting reuse rights.