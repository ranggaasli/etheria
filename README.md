# ETHERIA: Chronicles of the Fallen Kingdom

A playable original browser RPG vertical slice. Phaser 4.2.1 renders the world;
React, TypeScript, Tailwind 4, and Vite supply the interface; Colyseus core 0.18.25 supplies
real WebSocket rooms. The same Node service serves the production client and
multiplayer endpoint. Indonesian dialogue tells a six-quest first chapter.

The original code-drawn world uses Phaser's Canvas renderer, capped at 60 FPS,
with maps generated on first visit to reduce startup work and memory consumption.

## Start locally

Requires Node **22.13 or newer** (tested with 22.23.1).

```sh
npm ci
cp .env.example .env
npm run dev
```

PowerShell: replace the copy line with `Copy-Item .env.example .env`.
Open **http://localhost:3000**. Create an email/password account and character.
Local accounts are real, salted scrypt accounts in `data/etheria.sqlite`, with
seven-day HttpOnly cookies. No credentials or authoritative progress go into
localStorage. Local reset email is explicitly unavailable; it requires Supabase.
Use an incognito window or a different browser profile for a second player.
Only one active connection per character is allowed.

For the built client without development middleware:

```sh
npm run build
```

PowerShell: `$env:SERVE_BUILD='1'; npm start`.
POSIX: `SERVE_BUILD=1 npm start`.
`NODE_ENV=production` intentionally refuses to start without Supabase and PostgreSQL.

## What is playable

- Register, login, logout, persistent sessions, character creation and continued play.
- Four hair styles, hair/skin/outfit colors, eye styles, unique nickname, three classes.
- Shared village, collision, authoritative normalized movement, remote interpolation,
  nicknames, emotes, sanitized global chat, mute and stored moderation reports.
- Knight melee, Mage spell range, Ranger fast arrows; basic attack plus two
  cooldown abilities, healing, potions, XP, levels, equipment bonuses and drops.
- Forest with Embun Liar, Arwah Lumut and elite Rusa Retak; renewable herbs and clues.
- Persistent inventory, stack limits, gold and merchant buy/sell transactions.
- Owned private farm; wheat, carrot, potato and moonflower; plant, water, offline
  timestamp growth, harvest, sell, and one purchasable farm expansion.
- Private enterable house, five original furniture objects and validated placement.
- Persistent guilds, leader invitations, acceptance, roster, leaving and succession.
- Temporary parties, invitations, health display, four-player cap, shared dungeon entry.
- Dungeon instances isolated by party; three connected spaces, four encounters
  including Penjaga Sumpah, chest and persistent duplicate-reward prevention.
- Six sequential quests, objective tracking, original Indonesian dialogue, gold/XP
  rewards and the first chapter's revelation. Accept each quest before its objectives.
- Main menu, creator, loading, HUD, minimap, hotbar, bags, journal, farming, housing,
  social, merchant and settings; synthesized effects and day/night tint.

**Controls:** WASD/arrows move; E interacts with the nearest object; 1/Space attacks;
2 casts an area ability; 3 heals; 4 uses a potion; I opens bags; J opens the journal;
Esc opens settings. Mouse interacts with nearby objects. Panels pause movement
input, but the online world and enemies continue running.

## First journey

1. Approach Aruna at (740,550), press E, accept and complete *Pengembara Baru*.
2. Accept *Tanah Harapan*. Use the village's southwest portal (250,1040).
3. Approach plot 1 at (540,520), press E, plant, water, wait 45 seconds, harvest.
4. The house door is at (800,285); the house tool opens its placement panel.
5. Return to Aruna to claim and accept the next mission. Visit Banyu at (470,750)
   to sell crops, replenish seeds, or buy potions.
6. Enter the forest through (1460,650); defeat three creatures after accepting the
   forest quest. Return for the next mission, then inspect the altar at (1370,300).
7. Accept the brotherhood quest at Mira (1080,570). Use Social to invite friends.
8. Accept the final quest at Aruna. All party members stand at the crypt portal
   (1180,220); the leader presses E. Solo entry also works.
9. Move through the western room, around the first wall's southern end, then
   around the second wall's northern end. Defeat all enemies and open the northeast
   chest. Return via the southwest exit and claim the final quest from Aruna.

## Source layout

```text
client/          React interface, Phaser world, original procedural art
shared/          Typed protocol, locations, collision, items, classes and quests
server/          Auth, typed SQL repository, authoritative realm and game rules
migrations/      PostgreSQL/SQLite schema and Supabase RLS hardening
tests/           Unit, durability, real two-client multiplayer and browser tests
.github/         CI (lint, types, tests, production build, Playwright)
render.yaml      Single Render Node service with automatic deployment
Dockerfile       Optional two-stage production container
```

## Persistence and security

The typed repository supports PostgreSQL (`pg`, Supabase's session pooler) and
SQLite (`node:sqlite`, development only). Migrations are idempotent. Character
appearance, progression, equipment and house ownership are a typed JSON aggregate
in `characters.data`; inventories, plots, furniture, quest status, guild membership,
and reward receipts have separate constrained relational tables. This is a vertical
slice schema rather than a fully normalized item/catalog/equipment schema.

Gameplay updates clone the owned character and atomically save the resulting
aggregate and child rows before publishing rewards. No user-supplied gold, damage,
XP or inventory totals are accepted. Movement intent expires after 250ms and the
server applies speed, elapsed-time and collision limits. Combat checks range,
line-of-sight and cooldowns. Inventory has nonnegative bounded integer stacks.
Furniture cannot overlap. Guild acceptance validates leader authorization and
requires a live invitation. A unique `(character_id, instance_id)` receipt prevents
repeat chest rewards. Private farm/house snapshots are sent only to their owner.

Production uses Supabase Auth server-side validation and refresh. Provider tokens
stay in server-side sessions; browsers receive opaque HttpOnly SameSite cookies.
Room joins use short-lived, one-use tickets. Auth and API requests have limits;
WebSocket messages have payload and per-action limits. Chat is rendered as text.
Sessions are invalidated on logout. Keep database backups and restrict DB network
access in production. The migration enables RLS and revokes public table access.
The Node service uses an owner database connection and authorizes all game actions.

Economic and interaction changes save immediately. Movement/HP save every 15s,
on disconnect and graceful shutdown. An abrupt crash can lose the last 15s of
movement/HP. Dungeon and party state are temporary; rejoining after restart returns
characters from the crypt safely to the village. Crops retain planting timestamps.

## Supabase setup

1. Create a Supabase project. Enable email/password Auth. Configure SMTP and
   email confirmation to suit your project; the UI handles confirmation-required signup.
2. Copy the project URL and **anon/publishable API key** into server environment
   variables. The service-role API key is not needed.
3. Set `DATABASE_URL` to the PostgreSQL **session pooler** URI with your database
   password. Use TLS verification; optionally supply your provider CA via `PG_CA_FILE`.
   Do not use an IPv6-only direct endpoint on an IPv4-only host.
4. Set `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PUBLIC_URL`.
5. Run `npm run db:migrate` locally, or `node dist/server/migrate.js` after a build.
   This applies the base schema and Supabase RLS/revokes. The Render pre-deploy hook
   does this automatically. Inspect successful migration logs before accepting users.
6. In Auth URL Configuration set Site URL and Redirect URLs to your actual HTTPS
   origin, plus `https://YOUR-HOST/?recovery=1`. Recovery links update passwords
   through the server; this flow must be verified against your configured email provider.

## Public deployment

**No public deployment is claimed.** GitHub, Render and Supabase account access is
required. Source and configuration are ready for those services. This game requires
a long-running Node WebSocket service; static hosting/Worker-only Sites cannot run
the Colyseus process.

1. Create an empty GitHub repository and push this directory (never `.env` or `data/`).
2. Create a Render Blueprint from the repository using `render.yaml`, or create a
   Node Web Service with these equivalent commands:
   - Build: `npm ci --include=dev && npm run build`
   - Pre-deploy: `node dist/server/migrate.js`
   - Start: `npm start`
3. Supply the four provider/public URL variables and `DATABASE_URL` in Render's
   secret environment settings. `PUBLIC_URL` must equal the service's full HTTPS
   origin. `PORT` is supplied by Render; the server binds to `0.0.0.0`.
4. Use one instance. A paid always-on service avoids free-instance sleep disrupting
   game sessions; provisioning can incur hosting costs.
5. Add the HTTPS origin to Supabase Auth redirect URLs. Verify `/health` reports
   `supabase` and `postgres`; verify actual signup, email confirmation/recovery,
   two browser sessions, movement/chat, a crop/logout/restart cycle, guild and dungeon.
6. The browser automatically derives HTTPS/WSS from its own origin; no separate
   WebSocket URL or frontend secrets need configuring. Pushes trigger deployments;
   GitHub Actions validates the source independently. Gate production releases on CI.

Connect the GitHub, Render and Supabase integrations in Codex to continue automated
resource creation/deployment, or perform the steps above in your own dashboards.
Never paste a database password into chat or commit it.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm test` launches an isolated real server/database. It covers auth, input rejection,
real two-client visibility/movement/chat, guild invitations, parties, separate solo
dungeon instances and server restart, plus rule and transactional durability tests.
Playwright creates separate browser contexts and verifies registration/customization,
HUD, nearby player visibility, keyboard movement, chat, the first quest and logout/login.
Browser screenshots and failure traces go into ignored `test-results/`.
See `VALIDATION.md` for results recorded during implementation.

## Known limits / next milestones

- A small playable first chapter, not a production MMORPG or content-complete launch.
- Eight connection slots configured, but capacity is only claimed to the extent
  recorded in VALIDATION.md. No large-scale load, latency or soak test yet.
- PostgreSQL/Supabase provider integration needs live credentials for end-to-end
  verification. Local authentication/durability tests do not certify provider flows.
- Movement has interpolation but no client prediction, lag compensation, navigation
  mesh or enemy pathfinding. Enemies may get stuck behind walls; players can circle
  them. Dungeon state is isolated within the realm process, not separate Colyseus rooms.
- Procedural pixel-inspired art and simple code animations; no hand-drawn sprite
  production, ambient soundtrack, trading, crafting or extended endgame content.
- One character per account, one shared village process, one farm expansion, fixed
  initial furniture set, and no guild bank/officer hierarchy or persistent parties.
- Mute lasts for the current connection; reports are stored for operator review.
  There is no moderation dashboard, automated banning or account deletion UI.
- Keyboard/desktop-first. Narrow layouts adapt, but there are no touch movement controls.
- Account/session expiry cleanup, invitation pruning, PostgreSQL migration version
  tracking, operational metrics and backup restore drills should precede public growth.

Recommended next: verify the live Supabase/Render deployment, test four-player boss
completion under latency, add server pathfinding and client prediction, commission
animated sprite sheets, then extend content and operational moderation.

Official version references used: https://phaser.io/download/phaser4,
https://docs.colyseus.io/server, https://docs.colyseus.io/room,
https://docs.colyseus.io/state/schema,
https://supabase.com/docs/guides/auth/server-side,
https://render.com/docs/deploy-node-express-app.
