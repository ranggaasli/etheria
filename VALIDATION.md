# Implementation validation — 3 November 2026

Environment: Windows, Node 22.23.1, Chromium headless shell (Playwright).

| Check | Result |
| --- | --- |
| ESLint | PASS |
| TypeScript client/server type checking | PASS |
| Vite production client + compiled Node server | PASS |
| Server/rule test suite | PASS — 10 tests, 0 failures |
| Runtime dependency audit (`npm audit --omit=dev`) | PASS — 0 reported vulnerabilities |
| Two isolated browser contexts | PASS — complete account-to-world-to-logout/continue journey |
| Desktop and narrow main menu | PASS |
| Live Supabase PostgreSQL/Auth | NOT RUN — account access/configuration required |
| Docker image build | NOT RUN — Docker unavailable in this workspace |
| GitHub Actions / Render deployment | NOT RUN — external account connections required |

## What the server tests actually verify

- Local email/password registration and login; salted password hashes; rejection of
  bad credentials and malformed input; logout invalidation and revoked room tickets.
- Two real Colyseus SDK clients connect to an isolated running Node service and see
  each other. Movement updates reach the other client. Oversized movement intent
  cannot teleport the character. Chat is delivered and HTML/control text is sanitized.
- Out-of-range merchant requests cannot spend gold. Rule tests cover cooldowns,
  combat range, collision, diagonal speed normalization and bounded elapsed time.
- Guild creation, leader invitation, acceptance, roster and membership durability.
- Party invitation/acceptance, two-member roster, party exit and shared dungeon entry.
- Two independent dungeon instances keep players and enemies isolated. Party members
  share the same instance and observe the same enemy health change after an attack.
- Premature chest rewards are rejected. Unique database reward receipts reject repeat
  claims. Tests validate transaction rollback and inventory ownership isolation.
- Inventory, appearance, guild and character records survive a real server restart.
- Planted/watered crop timestamps are persisted, the database is closed and reopened,
  growth is calculated from the elapsed timestamp, and harvesting saves its produce.
  This durability test uses an earlier planting timestamp instead of a real 45s wait.
- Furniture placement persists, and invalid/overlapping positions are rejected.
- Quest acceptance, objective gating and sequential chapter progression.

## Browser verification scope

The browser test creates separate accounts in separate browser contexts. It creates
customized Mage characters, checks two online players and nearby names, moves using
the keyboard, accepts/completes the first quest, exchanges chat, restores canvas focus
after chatting, opens inventory with I, logs out and returns to the saved character.
The menu check covers 1440×900 and 760×800; multiplayer contexts use 1100×760.

Browser QA found and fixed keyboard focus staying in chat after clicking the game,
and registration mode remaining selected after logout. Screenshots are generated in
`test-results/` and selected previews are copied to `../outputs/etheria/`.

Final browser run: **2 passed**, 0 failed. The multiplayer journey took 20.3 seconds;
the desktop/narrow menu check took 3.3 seconds (runner total 1.1 minutes including
startup). The final client uses Phaser Canvas, generates maps on first visit, and
caps rendering at 60 FPS. This resolved the severe software-WebGL slowdown seen in
earlier headless two-context runs. No uncaught page errors occurred in the journey.

## Limits of this evidence

Only **two simultaneous players** have been exercised. The room is configured with
eight slots and parties with four slots; this is not evidence of eight-player capacity.
No hosting throughput, latency, sustained load or multi-process test has been run.

The complete six-quest narrative and full boss-to-chest playthrough still need a
human playtest and balance pass. The automated multiplayer test verifies shared
combat and isolated instances, not a full four-player boss completion.

Local SQLite durability does not certify the PostgreSQL adapter or external Auth,
SMTP confirmation/recovery, HTTPS/WSS, production CSP, secrets configuration, RLS,
or deployment networking. Those require the live provider acceptance checks in
README.md. The production guard intentionally refuses local Auth/SQLite deployment.

Economic actions save transactionally. Movement and incidental HP changes have a
15-second checkpoint interval, so an abrupt process kill can lose that interval.
Parties and active dungeon encounters are temporary and reset after restart.
