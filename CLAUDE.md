# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
# Password: SMB (live mode) or MGT (test mode)
```

There is no build, install, lint, or test step — open the served page directly.

## Deploy

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys automatically to GitHub Pages. No build step required; the entire repo root is uploaded as-is (`path: "."`).

## `demo/` — anonymized test copy

`demo/` is a **self-contained, standalone copy** of the whole app (its own
`index.html`/`styles.css`/`script.js`/`sw.js`/`manifest`/`art`/`icons`) served
at `…/styggmus-bingo/demo/`, for letting friends try the game without the real
names or inside jokes. It is a deliberate fork — **not kept in sync** with the
root; changes to the real game do not propagate. What differs from root: the
password is `TEST` (→ live mode; `PASSWORDS = { TEST: MODE_LIVE }`), five
made-up casino-mouse players (`kasinomusen`/`tarningsmastaren`/`olbaronen`/
`jackpott-jonny`/`ostkungen`, mirrored in the `#player-select` buttons in its
`index.html`), five name-free politically-correct prompt groups
(`kasino`/`spel`/`dryck`/`musik`/`snack`), the DDKO typed easter egg swapped for
`JACKPOT`, and the Spykollen blurb's "hommage till Per" dropped. Crucially it is
**isolated**: every storage key is `:demo`-suffixed (localStorage is per-origin,
so the demo shares an origin with root and would otherwise clobber real boards)
and `PARTY_TOPIC`/`CACHE_NAME` are demo-specific so test games never leak into a
real party or cache. When touching the demo, keep those isolations intact.

## `dwarf/` — "Dwarf Bingo" office-themed copy

`dwarf/` is another **self-contained standalone fork** (same isolation rules as
`demo/`) served at `…/styggmus-bingo/dwarf/` — an office-bingo reskin with a
**forge/gold/stone visual theme** instead of the neon casino. Differences from
root: password `DWARF`; **four** players (`trixxers-oski` 🏑 / `flusshuss` 🤒 /
`p1er` 🍺 / `andon` 🚨, mirrored in the `#player-select` buttons); four
office-humour prompt groups (`oski`/`huss`/`p1er`/`andon`, Swedish, e.g. "Oski
hämtar kaffe"); the title/brand/favicon are "Dwarf Bingo" / "DB" / ⛏️, the
checked-cell corner emblem is ⛏️, and the `GULD` typed easter egg replaces DDKO.
The **retheme is CSS-only**: the neon palette was remapped in `styles.css` (hot
pink → forge gold `#e0a838`/`#ffcf5a`, cyan → ember orange `#ff7a2d`, acid
yellow → gold, deep purples → warm stone/oak; verdict red/yellow/green kept),
embers + confetti recolored to fire tones in `script.js`, and there is **no
illustration** — `.page-bg` is a CSS forge glow (so the casino `art/` webp is not
copied and is removed from the SW SHELL). Isolation: `:dwarf`-suffixed storage
keys, `PARTY_TOPIC = "dwarf-bingo-forge-v1"`, `CACHE_NAME = "dwarf-bingo-v1"`.

## Architecture

Single-page vanilla JS app with no dependencies, no bundler, and no build step. Three source files plus PWA assets and markdown docs:

- `index.html` — all static markup. One `#access-screen` (password + player select) and two `<main>` "screens": `#app` (the bingo board — the only screen a logged-in player sees) and `#test-screen` (mini-game launcher, `MGT` password only). Plus dialog overlays — `#overlay` (easter-egg messages), `#reward-overlay` (bingo mini-game intro + klunkar payout), `#menu-overlay` (Mulligan / ny bricka / nollställ / rekord / recap / byt spelare / avsluta, opened from the bingo top bar's ⋮ button), `#party-overlay` (Ölligan roster + top Apple toggle switch), `#mulligan-bar` & `#mulligan-actions` (Mulligan field replacement UI), `#rekord-overlay`, `#recap-overlay`, `#confirm-overlay` (styled `confirm()` replacement), the five mini-game overlays, plus non-dialog layers `#party-flash` and `<canvas id="confetti">`. SVG icons are defined once in a `<svg class="svg-sprite">` and referenced via `<use href="#…">` (inline `style` fills, not classes, so they survive `<use>` cloning in Firefox). The `<head>` also loads Google Fonts (`Orbitron`, `Outfit`, `Plus Jakarta Sans`), carries an inline SVG data-URI favicon (🐭), plus PWA wiring: `theme-color`, `apple-mobile-web-app-*` metas, `<link rel="manifest">`, and an `apple-touch-icon`.
- `styles.css` — all styling, mobile-first with CSS custom properties, 3D glassmorphism, glowing titles, Apple switch sliders, and `safe-area-inset` support; `@media (prefers-reduced-motion: reduce)` disables animations.
- `script.js` — the entire app in one IIFE. Sections are marked with `── … ──` banner comments: DOM-refs, Event listeners, Access flow, State, Beer state, Board, Player helpers, Mulligan, Easter eggs, Fyllekollen (swipe maze), Reaktionskollen (reaction test), Minnesluckatestet (memory test), Spykollen (dodge game), Pissepaus (tilt-aiming), Win detection, Bingo rewards, Party-länk, Admin, Rekord, Kvällens recap, Kommentatorn, Celebrations, Dialog helpers, Ambient constellation particles, Confetti, Audio, Utilities, Storage.
- `manifest.webmanifest`, `sw.js`, `icons/` — the PWA layer (see PWA & device feedback below).

UI language is Swedish (`sv-SE`).

### Visual identity ("Neonklubben")

The theme is a neon night-club take on the naughty-mouse premise: deep-purple
grounds (`--bg #05010c` up to `--card #1f0b3a`), **hot pink** `#ff2d78` as the
primary accent (`--accent`), **electric cyan** `#2de2ff` as the secondary
(`--checked-light`), and **acid yellow** `#faff2d` reserved for the beer
counter. Verdict colors (red `#f7706d` / yellow `#ffcf5a` / green `#3fd99b`)
are semantic and deliberately kept out of the theme palette. Confetti uses the
neon set in `runConfetti`.

The big titles (login `h1`, board `.bingo-topbar-title`) get a **neon-tube**
treatment — styled in `Orbitron` with a white-hot core (`-webkit-text-stroke` + tight white shadow)
wrapped in layered pink halos, plus a faulty-tube `neon-title-flicker`
keyframe (behind `prefers-reduced-motion`). The **board cells** are 3D dimensional
glass featuring **interactive device-orientation (gyroscope) or pointer tracking tilt physics**: they rotate up to 25 degrees, shifting parallax reflections. A top highlight, a purple body, and a magenta under-glow make unlit cells
read as lit glass rather than flat black. A **checked** cell becomes hot-pink
glass with a glowing cyan tube rim and a 🐭 paw emblem stamped in the corner
(`::after`). `.board-wrap` is a bright pink→cyan→yellow neon-tube edge. Ambient
**constellation particles** (`#embers` canvas inside `.page-bg`, driven by `startEmbers`) drift
neon motes with dynamic touch/mouse cursor repulsion, energy filaments, and an interactive **water/particle shockwave engine** (clicking a cell expands a ring that applies physical velocity vectors pushing motes away). At midnight, an automatic **Night Shift Mode** kicks in, tinting the background purple and introducing cheeky night-themed quotes.

**Tactile feedback (all behind `prefers-reduced-motion`):** marking a cell adds
a transient `.stamp` class (re-triggered via reflow in `onBoardClick`, cleared
after 460ms) that runs a scale-pop (`cell-stamp`), an expanding cyan spark ring
(`cell-spark` on `::before`), and the emblem slamming down (`emblem-slam` on
`::after`); unmarking is quiet. A **winning** cell runs the acid-yellow
`cell-win-pulse`, staggered into a travelling marquee wave by a negative
wave by a negative `animation-delay` keyed off `--win-order`. A glowing neon-white **plasma laser line** with magenta/cyan drop shadows animates across the exact centers of the winning cells for 600ms before triggering the win sequence. Confetti (`runConfetti`) tumbles casino shapes — neon chips (rect/circle) plus card-suit
and 🍺/🎲 glyphs — with per-piece glow.

### Screen flow

`renderAccessFlow()` (called once on load) decides the entry point:
password gate → player gate → **bingo** (`#app`) directly (or straight to
`#test-screen` in test mode) — bingo is the only screen a logged-in player sees. The bingo layout, top to
bottom: `.bingo-topbar` (header containing title `Stygg Mus Bingo 🍆🐭🎲` in `Orbitron` neon bold, flanked on the right by `.topbar-controls` with the `🌐` Party-länk network button + Apple switch slider, and the ⋮ menu button), `.stats` (a continuous pill-shaped glass capsule bar containing `#current-player` on the left, `#drunk-meter-widget` in the center with live BAC `0.0 ‰` and status badge, and the compact −/🍺/+ beer widget `#beer-widget` on the right), `#mulligan-bar` (when Mulligan mode is active), then `.board-wrap`.

The player select screen (`#player-select`) "Vem är du?" contains player choice buttons and a `← Tillbaka` button that returns to the password login gate.

The ⋮ **menu button** in the top bar (`menu-btn` → opens `#menu-overlay`, `.menu-actions` grouped logically):
1. **Board Actions:** `🔄 Mulligan (byt rutor)`, `🎲 Ny bricka`, `🧹 Nollställ bricka`
2. **Social & Stats:** `🏆 Rekord`, `🖼️ Kvällens recap`, `📊 Kvällens statistik`
3. **Session:** `👤 Byt spelare`, `🚪 Avsluta`
4. **Admin (hidden):** `⚠️ Ny omgång (nollställ allt)` (unlocked only by `💨 AFC master TBD` holding "Meny" for 3 seconds).

### Auth & modes

Two passwords map to two modes (`PASSWORDS` in `script.js`): `SMB` → `live`,
`MGT` → `test`. **Test mode** skips the player gate and shows
`#test-screen`, a menu whose six tiles launch each mini-game
(`openFyllekollen`/`openReaktionskollen`/`openMinneslucka`/`openSpykollen`/
`openPissepaus`/`openSluddraru`) directly for testing. Auth and the active mode are session-only
(`sessionStorage`: `styggmus-bingo-auth-v1`, `styggmus-bingo-mode-v1`); "Avsluta"
clears them and returns to the password gate.

### State model

Each player gets their own bingo board stored under
`styggmus-bingo-board-v2:<playerId>` in `localStorage`. The board is a 16-element array (`BOARD_SIZE` 4 × 4, `CELL_COUNT`
16) of prompt strings shuffled from a seeded PRNG (mulberry32 + djb2-style hash,
seeded `<uuid>-<playerId>`). State schema:
```json
{
  "id": "<uuid>",
  "playerId": "<playerId>",
  "createdAt": "<iso-timestamp>",
  "board": ["prompt1", "prompt2", ...],
  "checked": [0, 2, 5],
  "bingoLinesAwarded": [0],
  "grandWin": false,
  "mulligansUsed": 1
}
```

Beer counts are stored under `styggmus-bingo-beers-v1` in `localStorage`.
Player selection persists under `styggmus-bingo-player-v1`.

### Players & prompt filtering

There are 5 players (`players`) and 5 prompt groups (`promptGroups`), one group
per real-life person × 8 prompts = 40 total. Player labels, emojis & weights:
- `stygg-mus-president`: `🐭 Stygg mus president 👑` (80 kg)
- `mouse-trap-pukie`: `🤮 Mouse trap pukie 👴🏻` (80 kg)
- `pommesansvarig`: `👨🏿 Pommesansvarig 🍟` (90 kg)
- `afc-master`: `💨 AFC master 🥷` (70 kg)
- `prospect`: `🛋️ Prospect 🌱` (70 kg)

The bingo top bar uses `compactLabel` acronyms (e.g. `🐭 SMP 👑`, `🤮 MTP 👴🏻`, `👨🏿 PA+FK+BP 🍟`, `💨 AFC 🥷`, `🛋️ PtP+DA 🌱`) on screens < 360px to guarantee everything fits without overflow.

Each player has an `excludedGroup` that is removed before the board is built.

### Promillekalkylator & BAC API

Calculates real-time Blood Alcohol Content (`0.00 ‰`) using the MiniWebtool BAC Calculator API (`https://api.miniwebtool.com/v1/tools/bac-calculator/run`).
- Inputs: beer count, player weight (`weightKg`), elapsed drinking duration (tracked via `styggmus-bingo-session-start-v1:<playerId>`).
- Rate limiting: API calls execute when a beer is tapped and on top of each full hour (`:00` minutes).
- Widmark formula fallback: computes local BAC if offline or API is unreachable.

### Mulligan Mode (Byt rutor)

Allows players to replace up to 3 unchecked bingo fields per board:
- Accessed via `🔄 Mulligan (byt rutor)` in the menu.
- Displays remaining budget in menu, e.g. **`🔄 Mulligan (3 kvar)`** (disabled when 0).
- Activates top `#mulligan-bar` banner & bottom `#mulligan-actions` control bar (`Byt X rutor` / `Avbryt`).
- Unchecked cells toggle purple neon selection glow (`.mulligan-selected`).
- Checked cells are disabled (`.mulligan-disabled` with `cursor: not-allowed`).
- Badge counter tracks total vaskade out of 3: `1 / 3 vaskade`, `2 / 3 vaskade`, `3 / 3 vaskade`.
- Confirming replaces selected prompts with fresh valid prompts from the player pool and increments `state.mulligansUsed`.

### Win detection & bingo rewards

`getWinningLines()` checks 4 rows + 4 columns + 2 diagonals. New bingo lines launch a random mini-game from `REWARD_GAMES`. Filling all 16 cells triggers `startGrandReward` once (all five games in sequence). Sound is synthesized with Web Audio API; confetti is canvas-drawn.

### Party-länk (live sync between phones)

Every phone in live mode joins one shared pub/sub topic on **ntfy.sh** (`PARTY_SERVER` = `https://ntfy.sh`, `PARTY_TOPIC` = `styggmus-bingo-neonklubben-v1`).
- **Toggle Control:** Accessible directly on the bingo top bar (`.party-quick-widget` with `🌐` network globe button + Apple switch slider) and inside `#party-overlay` header (with back button `←` on top-left and Apple switch slider on top-right).
- **Default State:** Offline by default (`isPartyEnabled()` returns `safeGet(PARTY_KEY) === "on"`).
- **Roster LED Status & BAC:** Each player row in `#party-roster` has a status light (`.party-status-dot`) and displays their beer count plus calculated BAC Promille (`5 🍺 (1.25 ‰)`).
- **Self & Remote Filtering:** Active player (`(du)`) has a distinct neon-cyan highlight (`.party-self`). Remote players are highlighted (`data-seen="true"`) ONLY when online and sending fresh active pings (`<= PARTY_FRESH_MS`, 2 minutes). Replayed messages from ancient history (`since`) do not mark offline players active.
- **Offline Record Syncing:** When turning Party-länk ON (`connectParty()`), `publishPartyHello()` automatically broadcasts local mini-game records (`loadStats()`) to update all connected devices' Hall of Fame.
- **1v1 Duels:** Tap "⚔️ Utmana" on any online player row in `#party-roster` to challenge them. Uses SSE event types `duel_invite`, `duel_accept`, `duel_decline`, and `duel_score`. Both players play the assigned mini-game, scores are compared, and the loser receives a 5-klunk penalty screen takeover!

### Rekord (Hall of Fame), Kvällens recap & Kommentatorn

- **Rekord**: All-time per-player mini-game records under `styggmus-bingo-stats-v1`. Works offline locally; broadcasts via party `rekord` events when online.
- **Kvällens recap**: Menu → Kvällens recap renders a shareable 1080×1350 poster on `#recap-canvas` (`renderRecap`) displaying beer counts and BAC Promille (`5 🍺 (1.25 ‰)`).
- **Kvällens statistik (Night Analytics)**: Menu → Kvällens statistik renders an interactive timeline line chart on `#analytics-chart-canvas` tracking beer consumption over time for all 5 players, plus summary metrics for lead BAC player, total klunkar handed out, and top 3 checked prompts.
- **Kommentatorn**: Sportscaster voice (`sayCommentary`) for 1-cell-from-bingo, 15/16 marked, beer milestones every 5th, and false starts.

### Admin: reset the round

Restricted exclusively to **`💨 AFC master TBD`** (`activePlayerId === "afc-master"`). Revealed by a **3-second long-press on the "Meny" title** (`registerAdminUnlock`). Pressing `#menu-admin-btn` opens a confirmation modal and executes `performRoundReset()`.

### Easter Eggs

- **Gyllene Musen**: 5 quick taps on 🍆 in title (`#kenta-egg-trigger`) or Konami sequence (`↑ ↑ ↓ ↓ ← → ← → B A`) toggles `.gyllene-musen-active` (3D gold mirror cards), gold glitter rain, and 8-bit retro arcade fanfare.
- **Mouse Trap Slime Explosion**: 3 quick taps on `#current-player` as `Mouse Trap Pukie 👴🏻` triggers a green neon slime explosion overlay (`#slime-overlay`), squelch sound effect, and awards +1 bonus mulligan.

### PWA & device feedback

Installable PWA (`manifest.webmanifest`, `sw.js`). Includes Web Haptics (`vibrate()`, with iOS `<input switch id="haptic-tick">` fallback), Screen Wake Lock (`acquireWakeLock()`), and Web Speech Synthesis (`speakVerdict()`).

### Storage safety

All storage operations use safety wrappers (`safeGet`, `safeSet`, `loadJSON`).

## Conventions

- Plain ES (no modules/transpiler) inside one IIFE; keep `── section ──` banner comments.
- Reference DOM nodes through cached refs in DOM-refs section.
- Persist through storage helpers (`safeGet`/`safeSet`/`loadJSON`).
