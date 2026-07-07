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

## Architecture

Single-page vanilla JS app with no dependencies, no bundler, and no build step. Three source files plus PWA assets and markdown docs:

- `index.html` — all static markup. One `#access-screen` (password + player select) and two `<main>` "screens": `#app` (the bingo board — the only screen a logged-in player sees) and `#test-screen` (mini-game launcher, `MGT` password only). Plus dialog overlays — `#overlay` (easter-egg messages), `#reward-overlay` (bingo mini-game intro + klunkar payout), `#menu-overlay` (byt spelare / avsluta, opened from the bingo top bar's ⋮ button), `#confirm-overlay` (styled `confirm()` replacement), and the five mini-game overlays — and a `<canvas id="confetti">`. SVG icons are defined once in a `<svg class="svg-sprite">` and referenced via `<use href="#…">` (inline `style` fills, not classes, so they survive `<use>` cloning in Firefox). The `<head>` also carries an inline SVG data-URI favicon (🐭) so `/favicon.ico` doesn't 404 on a plain static server, plus the PWA wiring: `theme-color`, the `apple-mobile-web-app-*` metas, `<link rel="manifest">`, and an `apple-touch-icon`.
- `styles.css` — all styling, mobile-first with CSS custom properties and `safe-area-inset` support; `@media (prefers-reduced-motion: reduce)` disables animations.
- `script.js` — the entire app in one IIFE. Sections are marked with `── … ──` banner comments: DOM-refs, Event listeners, Access flow, State, Beer state, Beer UI, Board, Player helpers, Easter eggs, Fyllekollen (swipe maze), Reaktionskollen (reaction test), Minnesluckatestet (memory test), Spykollen (dodge game), Pissepaus (tilt-aiming), Win detection, Celebrations, Confetti, Audio, Utilities, Storage.
- `manifest.webmanifest`, `sw.js`, `icons/` — the PWA layer (see PWA & device feedback below).

UI language is Swedish.

### Visual identity ("Neonklubben")

The theme is a neon night-club take on the naughty-mouse premise: deep-purple
grounds (`--bg #05010c` up to `--card #1f0b3a`), **hot pink** `#ff2d78` as the
primary accent (`--accent`), **electric cyan** `#2de2ff` as the secondary
(`--checked-light`), and **acid yellow** `#faff2d` reserved for the beer
counter. Verdict colors (red `#f7706d` / yellow `#ffcf5a` / green `#3fd99b`)
are semantic and deliberately kept out of the theme palette. Confetti uses the
neon set in `runConfetti`.

The big titles (login `h1`, board `.bingo-topbar-title`) get a **neon-tube**
treatment — a white-hot core (`-webkit-text-stroke` + tight white shadow)
wrapped in layered pink halos, plus a faulty-tube `neon-title-flicker`
keyframe (behind `prefers-reduced-motion`). The **board cells** are dimensional
glass: a top highlight, a purple body, and a magenta under-glow so unlit cells
read as lit glass rather than flat black. A **checked** cell becomes hot-pink
glass with a glowing cyan tube rim and a 🐭 paw emblem stamped in the corner
(`::after`). `.board-wrap` is a bright pink→cyan→yellow neon-tube edge. Ambient
**embers** (`#embers` canvas inside `.page-bg`, driven by `startEmbers`) drift
slow neon motes above the art and behind content; the rAF loop is skipped
entirely under reduced motion.

**Tactile feedback (all behind `prefers-reduced-motion`):** marking a cell adds
a transient `.stamp` class (re-triggered via reflow in `onBoardClick`, cleared
after 460ms) that runs a scale-pop (`cell-stamp`), an expanding cyan spark ring
(`cell-spark` on `::before`), and the emblem slamming down (`emblem-slam` on
`::after`); unmarking is quiet. A **winning** cell runs the acid-yellow
`cell-win-pulse`, staggered into a travelling marquee wave by a negative
`animation-delay` keyed off `--win-order` (set per-cell along the line in
`highlightWinningCells`); reduced-motion gets a static bright variant. Confetti
(`runConfetti`) tumbles casino shapes — neon chips (rect/circle) plus card-suit
and 🍺/🎲 glyphs — with per-piece glow.

`.page-bg` carries the **neon wall art**: `art/neonklubben-bg.webp`, a full
illustration of the mouse in cap and leather jacket at the casino table
(BINGO/SLOTS/STYGG MUSS signs, neon cards, dice, chips). It renders through
`img.page-bg-img` — `object-fit: cover` center for wide screens, dimmed
(`opacity` ≈ 0.55) with a vertical vignette `mask-image` so content stays
legible. On phones (`max-width: 680px`) the wide crop would bury the mouse's
face behind the board/login panel, so the image is instead bottom-anchored and
slid down (`bottom: -42%; height: 112%`) to park the grin in the free band
under the board, with a top-fade mask hiding the image's upper seam. The image
is part of the service-worker shell (`sw.js` SHELL list — keep in sync, bump
`CACHE_NAME` when it changes). The `.stat` and `.beer-widget` backgrounds are
near-opaque on purpose — art must not bleed through and read as stray borders.

### Screen flow

`renderAccessFlow()` (called once on load) decides the entry point:
password gate → player gate → **bingo** (`#app`) directly (or straight to
`#test-screen` in test mode) — bingo is the only screen a live player ever
sees; there is no separate dashboard or app launcher. The bingo layout, top to
bottom: `.bingo-topbar` (a flat 3-item flex row — the ← back button, then the
title, then the ⋮ menu button at the opposite end, no longer grouped/stacked
together), `.stats` (the player name box — no visible "Spelare" label, just
`aria-label="Spelare"` on the `.stat` div for screen readers — and the compact
−/🍺/+ beer widget as its second item), then `.board-wrap`. The ← button (`topbar-back-btn`) is a no-confirm
shortcut straight to `showPlayerGate()` — the same action as the menu's "Byt
spelare", just one tap instead of opening the menu first; the title is sized
(`font-size: 1.05rem`) to fit one line down to ~375px even flanked by two
separate 38px buttons, with wrapping still allowed (not nowrap+ellipsis) as a
fallback at narrower widths (e.g. 320px) instead of clipping the trailing
emoji off-screen. There is no Fält/Rader
marked-count or bingo-line-count display — `updateStatsAndWinState` still
computes them internally (for win/reward detection) but doesn't render them
anywhere. Beer counting lives inline in that widget (`beer-widget-*` →
`adjustBeerForPlayer`, so the `+` still drives the mini-game rotation; there is
no standalone beer-counter screen or cross-player leaderboard). "Ny bricka",
"Nollställ bricka", switching player, and logging out all live behind the ⋮
**menu button** in the
top bar (`menu-btn` → opens `#menu-overlay`, `.menu-actions` in that order):
"Ny bricka" closes the menu and calls `onNewBoard()` (still confirms — it wipes
the current marks and reshuffles a new board); "Nollställ bricka" closes the
menu and calls `onResetBoard()` (confirms, then clears `state.checked` /
`bingoLinesAwarded` / `grandWin` on the *same* board — prompts don't change);
"Byt spelare" closes the menu and calls `showPlayerGate()`. "Avsluta" in the
menu (`menuExitBtn`) is wired straight to `onExit()`, same as `#test-screen`'s
own Avsluta button (auto-wired via the generic `exitButtons` NodeList,
selector `.exit-btn` — the menu's Avsluta isn't styled `.exit-btn` itself, so
it needs its own explicit listener but shares the same confirm-then-
`performExit()` flow). All four menu buttons share plain `.secondary-btn`
styling (`.menu-actions .secondary-btn` re-asserts it over the generic
`.overlay-card button` neon-pink default) — no more `.primary-btn`/`.exit-btn`
visual distinction between them. The menu header (`.menu-header`) also has a
← `back-btn` next to the "Meny" title (`menu-back-btn` → `closeDialog`, no
confirm — identical to backdrop/Escape, just a visible way to do it); its own
`.menu-header .back-btn` rule re-asserts the neutral circular look over the
same neon-pink `.overlay-card button` default for the same reason. `onExit()`
defensively closes whatever dialog is currently open before showing the exit
confirmation.
`hideAllScreens()` + `…El.classList.remove("hidden")` is
the show/hide mechanism for the two top-level screens — there is no router.

### Auth & modes

Two passwords map to two modes (`PASSWORDS` in `script.js`): `SMB` → `live`,
`MGT` → `test`. **Test mode** skips the player gate and shows
`#test-screen`, a menu whose five tiles launch each mini-game
(`openFyllekollen`/`openReaktionskollen`/`openMinneslucka`/`openSpykollen`/
`openPissepaus`) directly for testing, with no descriptive text under each tile — just icon
and name (see Win detection & bingo rewards for where the emoji descriptions
now live). Auth and the active mode are session-only
(`sessionStorage`: `styggmus-bingo-auth-v1`, `styggmus-bingo-mode-v1`); "Avsluta"
clears them and returns to the password gate.

### State model

Each player gets their own bingo board stored under
`styggmus-bingo-board-v2:<playerId>` in `localStorage`. The board is a 16-element array (`BOARD_SIZE` 4 × 4, `CELL_COUNT`
16) of prompt strings shuffled from a seeded PRNG (mulberry32 + djb2-style hash,
seeded `<uuid>-<playerId>`) — no free cell, nothing pre-checked. Checked indexes,
awarded bingo lines, and grand-win status are persisted alongside the board.
Loaded state is validated (`isValidState`); a stored board whose length or prompts
no longer match (e.g. an old 5×5 board) is discarded for a fresh one.

Beer counts are a separate `localStorage` map, keyed by player id:
`styggmus-bingo-beers-v1` (never below 0).

Player selection persists under `styggmus-bingo-player-v1`.

### Players & prompt filtering

There are 5 players (`players`) and 5 prompt groups (`promptGroups`), one group
per real-life person × 8 prompts = 40 total. Each player has an `excludedGroup`
(typically their own) that is removed before the board is built, leaving 32
prompts; the first 16 of the shuffle fill the 16 cells.

### Win detection & bingo rewards

`getWinningLines()` checks 4 rows + 4 columns + 2 diagonals. New bingo lines (not
already in `bingoLinesAwarded`), instead of a fixed prize, launch a
**bingo reward** (`startBingoReward`): a random mini-game whose result
decides how many "klunkar" (sips) you get to hand out to everyone. Filling all 16
cells triggers `startGrandReward` once — all five games in a random row, klunkar
summed. A grand win supersedes the single-line reward for the same check (filling
the last cell also completes lines), so only one flow runs. Sound is synthesized
with the Web Audio API; confetti is canvas-drawn and skipped under
`prefers-reduced-motion`.

The reward flow lives in the **Bingo rewards** section. `rewardSession`
({ mode, queue, idx, total, breakdown, currentOverlay, resolved }) drives it; the
`REWARD_GAMES` registry maps each game id to its open-fn, overlay, close
button, label, and a short `blurb` (a one-line emoji description, e.g.
"Led 🐭 till 🍺" — this used to live only on the test-screen tiles as
`.app-tile-desc`; it's now the live-mode player's preview instead). `showRewardIntro`
opens the shared `#reward-overlay` and renders that preview before the player
commits: for a single line it names the one game they're about to get
(`.reward-game-preview`); for a grand win it lists all five, in the session's
actual play order (`.reward-game-list`) (intro → "Spela"/"Kör alla fyra"). The
same blurb text also sits as a permanent, always-visible line inside each
mini-game's own overlay (`.minigame-blurb`, shared by Reaktionskollen/
Minnesluckatestet/Spykollen/Pissepaus; Fyllekollen already has an equivalent standing
line via `.fyllekollen-text` — `.minigame-blurb` matches its size, both
inheriting the plain `.overlay-card p` look rather than a small muted
caption), so it's visible no matter how the game was opened — reward flow,
beer-counter cadence, or the test menu — not just from the reward intro.
Each game's `*-instruction` element only carries phase-specific status text
now ("Vänta på ölen…", "TRYCK!", "Håll koll!", "Undvik spyorna!", …) — the
redundant lead-in/result captions that used to sit there ("Gör dig redo…",
"Din reaktionstid", "Facit", "Nedspydd!") were dropped since the blurb and
the result headline already cover that ground; it goes empty (not removed —
`min-height` on the element keeps the layout stable) during the countdown and
on the result screen. Every verdict `message` across all the games line-breaks
before its trailing "Fortsätt dricka." (via a literal `<br>` in the string,
rendered through `innerHTML`) so it reads as its own line under the
verdict-specific sentence. `startCurrentRewardGame` opens the next game;
each game's terminal result calls `recordRewardResult(gameId, klunkar, verdict)`
(a no-op outside a session, so the beer-counter rotation and test menu are
unchanged), which rounds klunkar to nearest (≥ 0) and relabels the close button
to "Nästa spel"/"Klar". None of the mini-games has a retry/"play again"
button (removed — closing and reopening is the only way to run another round).
Closing the
game (button/Escape/backdrop) runs `advanceRewardAfterGame` via `closeDialog`
(unfinished = 0); after the last game `showRewardPayout` reveals the breakdown +
total. Klunkar per game: Fyllekollen = `MAZE_KLUNK_MAX` × share of the clock left
at the goal, so max is `MAZE_KLUNK_MAX` (8) and timeout = 0;
Reaktionskollen = `(KLUNK_REAKTION_BASE_MS − ms) / KLUNK_REAKTION_DIV` capped at
`KLUNK_REAKTION_MAX` (10), false start = 0; Minnesluckatestet =
`KLUNK_MINNE_BASE − total deviation`;
Spykollen = `KLUNK_SPY[cls]` (Nykter 6 / Salongsberusad 4 / Full som ett ägg 2);
Pissepaus = toilets hit, capped at `KLUNK_PISS_MAX` (10).

### Dialogs

All overlays go through `openDialog()`/`closeDialog()`, which track
`activeDialog`, move focus into the dialog, trap Tab, close on Escape/backdrop,
and restore focus on close (`onKeyDown` routes keyboard events while a dialog is
open). `showConfirm()` is the styled stand-in for `window.confirm()` — its
`onConfirm` runs only on the accept button; an optional `onCancel` runs instead
for any other dismissal (Avbryt, Escape, backdrop). `closeDialog()` detects a
genuine cancel by checking whether `pendingConfirmAction` is still set when it
runs (`onConfirmAccept()` already nulls it before calling `closeDialog()`, so a
non-null value there means the accept button wasn't the trigger), and invokes
the saved `pendingCancelAction` only as the very last step — after this
dialog's own teardown/focus-restore — so a cancel handler that opens another
dialog (e.g. the menu's Ny bricka/Nollställ bricka/Avsluta confirms all pass
`onCancel: () => openDialog(menuOverlayEl)`, returning you to the menu instead
of the bare board) gets a clean, uncontested focus capture.

### Easter eggs

Three hidden triggers (handled in the Easter eggs section, suppressed while a
dialog is open or a text field is focused): 5 rapid `#game-title` clicks →
"STYGG MODE", Konami code → "KONAMI-KUBB!", typing "DDKO" → "DDKO REQUESTAD".
Each adds a temporary `body` class, plays a sound, and runs confetti.

### Fyllekollen (swipe maze mini-game)

The five beer-counter mini-games rotate on a fixed `MINIGAME_CYCLE` (5) beat in
`countBeerPress`, keyed off the running count of beers added (`beerAddedTotal`,
session-only; only `+` presses count): **Reaktionskollen** on beers `1+5n`,
**Minnesluckatestet** on `2+5n`, **Fyllekollen** on `3+5n`, **Spykollen** on
`4+5n`, **Pissepaus** on `5+5n` (`%5 === 0`). Exactly one fires per added
beer, so they never collide; none fires while another dialog is up. All five are
also launchable directly from the test-mode menu (`#test-screen`).

**Fyllekollen** is a perfect maze (recursive backtracker, `MAZE_COLS`×`MAZE_ROWS`)
rendered to `#maze-canvas` in the `#fyllekollen-overlay` dialog. Move the mouse
🐭 one cell per swipe (pointer events on the canvas, `touch-action: none`) or per
arrow key — arrow keys are routed in `onKeyDown` while that dialog is active. It
is **timed**: the limit is the shortest-path step count (`mazeDistance`, BFS) ×
`MAZE_MS_PER_STEP` (800ms), shown as a `#maze-timer` countdown that turns red in
the last third. The round ends in the same three-tier verdict as the other
mini-games, shown inline in the `#maze-result` panel (`showMazeResult`): reaching
🍺 maps by the share of the clock still left (`mazeLevel`) — `>=
MAZE_SOBER_MIN_FRACTION` (0.35) → red "Nykter" + `signalSoberAlarm`, below → yellow
"Salongsberusad" — while *running out of time* is the goal of a drinking game, so
`onMazeTimeout` gives green "Full som ett ägg" + `signalDrunkCelebration`. A
fresh maze is built each time the dialog opens (`buildNewMaze`, which clears the
verdict effects and hides the result) — there is no in-dialog restart button.
The maze timer is cleared on solve, time-out, and in `closeDialog`;
`stopVerdictEffects` runs on restart and in `closeDialog`.

### Reaktionskollen (reaction-test mini-game)

**Reaktionskollen** (`#reaktion-overlay`): a 5-second countdown, then a blank
"waiting" phase for a random 100ms–5s, then a 🍺 appears and a `performance.now()`
clock starts. The first tap (pointerdown on `#reaktion-stage`, or Space) stops
it; tapping during "waiting" is a false start. The reaction time in ms maps to a
three-tier "how drunk are you" verdict (`reaktionLevel`): `< REAKTION_GREEN_MAX`
(350) → red "Nykter", `<= REAKTION_YELLOW_MAX` (550) → yellow "Salongsberusad",
else green "Full som ett ägg". Because this is a drinking game, the two extreme
tiers swap the usual emphasis and are shared by all three mini-games. *Sober is
the bad result*: the "Nykter" tier carries `alarm: true` → `signalSoberAlarm()`
(a flashing red `.sober-alarm` overlay class plus a `playAlarmSound()` klaxon).
*Properly drunk is the goal*: the "Full som ett ägg" tier carries `celebrate:
true` → `signalDrunkCelebration()` (a flashing green `.drunk-celebrate` overlay
class, `runConfetti` lifted in front via `.confetti--front`, and a
`playPartySound()` fanfare). Both replace the normal win chime and are torn down
by `stopVerdictEffects()` (→ `stopSoberAlarm()` + `stopDrunkCelebration()`) on
round restart and in `closeDialog`. A `reaktionPhase` state machine drives the
round; its two timers are cleared in `closeDialog` so a queued tick can't fire
into a closed dialog.

### Minnesluckatestet (memory / flash-count mini-game)

**Minnesluckatestet** (`#memory-overlay`), on beers `2+5n`: a 5s countdown, then
X 🍺 + Y 🐭 (each `MINNE_MIN`..`MINNE_MAX`, 1–10) flash shuffled for
`MINNE_FLASH_MS` (4000ms), then the player dials the two counts on iOS-style scroll
wheels (`.memory-wheel-scroll`, CSS `scroll-snap`; value read from `scrollTop /
MINNE_WHEEL_ITEM_H`) and submits. Accuracy (2/1/0 of the two counts correct) maps
to the same verdict tiers (2 → red "Nykter" + alarm, 1 → yellow, 0 → green
"Full som ett ägg" + celebration), shown with the facit. A `memoryPhase` state
machine drives it; its countdown/flash timers are cleared in `closeDialog`.

### Spykollen (dodge mini-game)

**Spykollen** (`#spy-canvas` in `#spykollen-overlay`), on beers `4+5n`: a
`requestAnimationFrame` arcade game. A row of 🤢 along the top
drop 🤮 in bursts of 1–`SPY_MAX_BURST` (3) from distinct columns (never all, so a
dodge gap always exists); the player steers a canvas-drawn couch (footprint =
hitbox exactly, clamped fully on-stage; `drawCouch`/`roundRectPath`) with
on-screen ◀ ▶ buttons (held; `pointerdown`/`pointerup` set `spyMoveDir`) or arrow
keys (routed in `onKeyDown` + a `keyup` handler). Difficulty ramps each second (faster fall via
`SPY_BASE_FALL`/`SPY_FALL_RAMP`, tighter spawns via `SPY_BASE_SPAWN_MS`/
`SPY_SPAWN_RAMP`) so a round lands ~10–30s; one hit ends it. Dodged count maps to
the verdict (`spyLevel`: ≥`SPY_GREEN_MIN` 15 → red "Nykter" + alarm /
≥`SPY_YELLOW_MIN` 6 → yellow / below → green "Full som ett ägg" + celebration).
A `spyPhase` state machine drives it; the rAF + countdown timer are
cancelled in `stopSpyGame`, called from `closeDialog`. Collisions use a
crossing test at the couch line to avoid tunnelling at high speeds.

### Pissepaus (tilt-aiming mini-game)

**Pissepaus** (`#piss-canvas` in `#pissepaus-overlay`), on beers `5+5n`: aim
the pee stream from the 🍆 at the bottom onto the 🚽 that spawns one at a time
(each hit respawns the next — never two at once; `spawnPissToilet` also
resamples so a fresh toilet never lands right on the stream tip). Steering is
**device tilt**: `gamma` ±`PISS_TILT_MAX_DEG` (30°) sweeps left/right across
the full width, `beta` maps device-upright (90°) → shortest stream and
device-flat (0°) → longest, so the whole stage is reachable. Pointer-drag on
the canvas and arrow keys (routed in `onKeyDown`) are the sensor-less
fallbacks. The steered value is a *target*: the tip glides toward it at
`PISS_AIM_SPEED` (0.8 stage-heights/s) rather than teleporting — this is what
stops tap-the-toilet cheesing via the pointer fallback and gives each respawn
a travel-time cooldown (a frame-perfect chaser maxes out around ~17 hits).
The round is `PISS_ROUND_MS` (10s) with a tenth-second countdown and 🚽
counter in the `.piss-hud` row. It starts from an explicit **"Starta" button**
because iOS only grants `deviceorientation` access via
`DeviceOrientationEvent.requestPermission()` from inside a user gesture
(`onPissStart`; denied/absent sensors just leave the fallbacks). Hits map to
the verdict (`pissLevel`: ≥`PISS_NYKTER_MIN` 8 → red "Nykter" + alarm /
≥`PISS_SALONG_MIN` 4 → yellow / below → green "Full som ett ägg" +
celebration); reward klunkar = hits capped at `KLUNK_PISS_MAX` (10). A
`pissPhase` state machine drives it; `stopPissGame` (also called from
`closeDialog`) cancels the rAF + countdown and removes the `deviceorientation`
listener. The canvas exposes `data-state` and `data-toilet-x/y` for the
Playwright suite — one-toilet-at-a-time makes a single coordinate pair the
full spawn state.

### Party-länk (live sync between phones)

Every phone in live mode auto-joins one shared pub/sub topic on **ntfy.sh**
(free public relay, no account/library — see the `PARTY_*` constants; the
topic is public-by-obscurity, fine for a party game, never send anything
sensitive). The whole transport lives in the **Party-länk** section of
script.js so it can be swapped (e.g. for Firebase) in one place: publishing is
fire-and-forget `fetch` POSTs, receiving is one auto-reconnecting
`EventSource` on `/sse?since=45m` — the `since` replay warms the roster for
late joiners, and a rate-limited (60s) hello ping-pong covers joins beyond
that window. Own events are ignored via a per-session `partyDeviceId`.

Three event types: `hello` (presence + beer count; sent on connect and as
ping-pong answers), `beer` (rapid ± taps debounce into one publish with the
final count from `adjustBeerForPlayer`), and `bingo` (published in
`showRewardPayout` where the klunkar total exists). Incoming beer/hello events
feed `partyPlayers`, rendered as the "Ölligan" roster in `#party-overlay`
(menu → Party-länk: status dot, per-player beer counts, on/off toggle stored
under `styggmus-bingo-party-v1`, default on). An incoming **bingo** takes over
the receiving phone via `#party-flash` — deliberately NOT a dialog (it must
appear over any open dialog without fighting the focus-trap/close routing;
plain fixed layer at z 50, tap or `PARTY_FLASH_MS` to dismiss) — with
fanfare, vibration, lifted confetti, and `speakVerdict`. Replayed events
older than `PARTY_FRESH_MS` never flash; a player's own win never flashes on
their own phone. `connectParty()` runs from `startBingoGame` (idempotent),
`disconnectParty()` from `performExit`. Everything degrades silently offline
(EventSource retries; publishes are catch-and-drop). The sandbox CI network
blocks ntfy.sh, so the Playwright suite stubs the transport
(EventSource/fetch bridged over a BroadcastChannel with localStorage-backed
replay) — live end-to-end needs real devices.

### Rekord (Hall of Fame), Kvällens recap & Kommentatorn

**Rekord**: all-time per-player mini-game records under `styggmus-bingo-stats-v1`
(`stats[playerId][gameId] = { v, at }`; direction per game in `REKORD_META` —
reaktion lower-is-better, the rest higher). Every game's terminal result calls
`recordStat`; a first-ever result seeds silently, a genuine improvement fires
the **NYTT REKORD takeover** (reuses `showPartyFlash`, delayed 1.4s so the
round's verdict effects land first) and broadcasts a party `rekord` event.
`applyRemoteRecord` stores incoming records if better, converging every
phone's list; menu → Rekord (`#rekord-overlay`) shows best-per-game + holder.
Records apply only in live mode with a chosen player — test mode never records.

**Kvällens recap**: menu → Kvällens recap renders a shareable 1080×1350 neon
poster on `#recap-canvas` (`renderRecap`): Ölligan beer bars (own count local,
others from the party roster), tonight's bingo/grand/klunkar totals, and
"Kvällens Fyllo". Tonight's tallies live under `styggmus-bingo-night-v1`,
bumped in `showRewardPayout` (own) and from party `bingo` events (others),
deduped by a shared event id (own device id changes on reload, so the payout
publishes an `id` that both the local bump and every receiver key on); the
night resets after `NIGHT_RESET_MS` (18h) of quiet. "Dela bilden" uses
`navigator.share({ files })` with an `<a download>` fallback.

**Kommentatorn**: a sportscaster voice (`sayCommentary`) with deliberately few,
deterministic triggers — a line one-cell-from-bingo (unawarded 3/4 line),
15/16 marked, beer milestones every 5th (`kommentatorBeerLine`), and
Reaktionskollen false starts. Global `KOMMENTATOR_COOLDOWN_MS` (20s), never
speaks over ongoing speech (verdict shouts always win), live mode only.
Line pools live in `KOMMENTATOR`; `getAllBoardLines()` (also feeding
`getWinningLines`) powers the near-bingo detection.

### PWA & device feedback

The app is an installable PWA: `manifest.webmanifest` (standalone, portrait,
`start_url: "./"` — everything relative so the GitHub Pages subpath works) and
`sw.js`, an app-shell service worker registered at the end of the IIFE init.
The worker is **network-first with cache fallback** so a fresh deploy reaches
players on next load but the app still opens fully offline; it pre-caches the
shell (HTML/CSS/JS/manifest/icons) on install and runtime-caches successful
same-origin GETs. Bump `CACHE_NAME` in `sw.js` if the shell file list changes.
Icons live in `icons/` (192/512 PNG + `apple-touch-icon.png`), generated from a
canvas drawing of 🐭 in a glowing pink neon ring on the purple app background —
regenerate at the same sizes if rebranding.

Three device-feedback layers, all guarded no-ops where unsupported:

- **Haptics** — the `vibrate(pattern)` helper (Utilities). Call sites: cell
  mark/unmark (18/8ms) in `onBoardClick`, the 🍺 appearing in
  `showReaktionTarget` (35ms), the hit jolt in `onSpyHit` (90ms — the red/green
  verdict signals replace it, yellow keeps it), bingo/grand-win reward starts,
  and strong patterns in `signalSoberAlarm`/`signalDrunkCelebration`.
- **Screen wake lock** — `acquireWakeLock()` in `openDialog`,
  `releaseWakeLock()` at the very end of `closeDialog` (only when no dialog
  remains — reward routing may already have opened the next one). The browser
  force-releases on tab hide, so a `visibilitychange` listener re-acquires
  while a dialog is up.
- **Speech** — `speakVerdict(text)` (Audio section) shouts "Nykter!" /
  "Full som ett ägg!" with a `sv-SE` voice from the two verdict signal
  functions; `stopVerdictEffects()` cancels any ongoing utterance so a closed
  dialog can't keep talking.

### Storage safety

Every Web Storage call is wrapped (`safeGet`/`safeSet`/`tryStorage`/`loadJSON`)
so private mode or quota errors degrade to a fallback instead of throwing. Use
these helpers rather than touching `localStorage`/`sessionStorage` directly.

## Conventions

- Plain ES (no modules/transpiler) inside one IIFE; keep the `── section ──`
  banner organization when adding code.
- Reference DOM nodes through the cached refs in the DOM-refs section.
- Persist through the storage helpers (`safeGet`/`safeSet`/`loadJSON`, etc.).
- Match the existing accessibility patterns (ARIA roles/labels, focus management)
  when adding interactive UI.
