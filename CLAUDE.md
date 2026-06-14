# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
# Password: AFC (live mode) or FLÖTET (demo / beta-test mode)
```

There is no build, install, lint, or test step — open the served page directly.

## Deploy

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys automatically to GitHub Pages. No build step required; the entire repo root is uploaded as-is (`path: "."`).

## Architecture

Single-page vanilla JS app with no dependencies, no bundler, and no build step. Three source files plus markdown docs:

- `index.html` — all static markup. One `#access-screen` (password + player select) and three `<main>` "screens": `#dashboard` (app launcher), `#app` (bingo board), and `#beer-app` (beer counter). Plus three dialog overlays — `#overlay` (bingo/easter-egg prizes), `#scoreboard-overlay`, `#confirm-overlay` (styled `confirm()` replacement) — and a `<canvas id="confetti">`. SVG icons are defined once in a `<svg class="svg-sprite">` and referenced via `<use href="#…">` (inline `style` fills, not classes, so they survive `<use>` cloning in Firefox).
- `styles.css` — all styling, mobile-first with CSS custom properties and `safe-area-inset` support. A `body.demo-mode` class re-themes the UI for beta-test mode; `@media (prefers-reduced-motion: reduce)` disables animations.
- `script.js` — the entire app in one IIFE. Sections are marked with `── … ──` banner comments: DOM-refs, Event listeners, Access flow, State, Scoreboard state, Beer state, Scoreboard UI, Beer UI, Board, Player helpers, Easter eggs, Fyllekollen (swipe maze), Reaktionskollen (reaction test), Minnesluckatestet (memory test), Win detection, Celebrations, Confetti, Audio, Utilities, Storage.

UI language is Swedish.

### Screen flow

`renderAccessFlow()` (called once on load) decides the entry point:
password gate → player gate → dashboard (or straight to `#test-screen` in test mode). From the dashboard the user
launches the **Bingo** app (`#app`) or the **Ölräknaren** beer counter
(`#beer-app`). `hideAllScreens()` + `…El.classList.remove("hidden")` is the
show/hide mechanism throughout — there is no router. The scoreboard is reachable
as an overlay from the dashboard, bingo, and beer screens.

### Auth & modes

Three passwords map to three modes (`PASSWORDS` in `script.js`): `AFC` → `live`,
`FLÖTET` → `demo`, `MGT` → `test`. **Test mode** skips the player gate and shows
`#test-screen`, a menu whose three tiles launch each mini-game
(`openFyllekollen`/`openReaktionskollen`/`openMinneslucka`) directly for testing. Auth and the active mode are session-only
(`sessionStorage`: `styggmus-bingo-auth-v1`, `styggmus-bingo-mode-v1`); "Avsluta"
clears them and returns to the password gate. **Demo mode** uses placeholder
lorem-ipsum prompts/prizes and namespaces every persisted key with a `:demo`
suffix (`modeKey()`), so beta-test data never collides with live data.

### State model

Each player gets their own bingo board stored under
`styggmus-bingo-board-v2:<playerId>` (`:demo`-suffixed in demo mode) in
`localStorage`. The board is a 25-element array of prompt strings shuffled from a
seeded PRNG (mulberry32 + djb2-style hash, seeded `<uuid>-<playerId>`), with the
fixed free cell at index 12 (`FREE_INDEX`). Checked indexes, awarded bingo lines,
and grand-win status are persisted alongside the board. Loaded state is validated
(`isValidState`) and normalized (free cell always checked) — anything invalid is
discarded for a fresh board.

Separate `localStorage` maps, keyed by player id:
- `styggmus-bingo-scores-v1` — `{ bingoLines, grandWins, lastBingoAt }` per player.
- `styggmus-bingo-beers-v1` — beer count per player (never below 0).

Player selection persists under `styggmus-bingo-player-v1`.

### Players & prompt filtering

There are 5 players (`players`) and 5 prompt groups (`promptGroups`), one group
per real-life person × 6 prompts = 30 total. Each player has an `excludedGroup`
(typically their own) that is removed before the board is built, leaving 24
prompts for the 24 non-free cells. Demo mode swaps `promptGroups`/`bingoPrizes`/
`grandPrize` for the `demo*` equivalents via `getActive*()` helpers.

### Win detection & celebrations

`getWinningLines()` checks 5 rows + 5 columns + 2 diagonals. New bingo lines (not
already in `bingoLinesAwarded`) trigger `celebrateBingo()` (sound + confetti +
random prize overlay) and increment the score. Filling all 25 cells triggers
`celebrateGrandWin()` once. Sound is synthesized with the Web Audio API; confetti
is canvas-drawn and skipped under `prefers-reduced-motion`.

### Dialogs

All overlays go through `openDialog()`/`closeDialog()`, which track
`activeDialog`, move focus into the dialog, trap Tab, close on Escape/backdrop,
and restore focus on close (`onKeyDown` routes keyboard events while a dialog is
open). `showConfirm()` is the styled stand-in for `window.confirm()` — its
`onConfirm` runs only on the accept button.

### Easter eggs

Three hidden triggers (handled in the Easter eggs section, suppressed while a
dialog is open or a text field is focused): 5 rapid `#game-title` clicks →
"STYGG MODE", Konami code → "KONAMI-KUBB!", typing "DDKO" → "DDKO REQUESTAD".
Each adds a temporary `body` class, plays a sound, and runs confetti.

### Fyllekollen (swipe maze mini-game)

The three beer-counter mini-games rotate on a fixed `MINIGAME_CYCLE` (3) beat in
`countBeerPress`, keyed off the running count of beers added (`beerAddedTotal`,
session-only; only `+` presses count): **Reaktionskollen** on beers `1+3n` (`%3
=== 1`), **Minnesluckatestet** on `2+3n` (`%3 === 2`), **Fyllekollen** on `3+3n`
(`%3 === 0`). Exactly one fires per added beer, so they never collide; none fires
while another dialog is up.

**Fyllekollen** is a perfect maze (recursive backtracker, `MAZE_COLS`×`MAZE_ROWS`)
rendered to `#maze-canvas` in the `#fyllekollen-overlay` dialog. Move the mouse
🐭 one cell per swipe (pointer events on the canvas, `touch-action: none`) or per
arrow key — arrow keys are routed in `onKeyDown` while that dialog is active. It
is **timed**: the limit is the shortest-path step count (`mazeDistance`, BFS) ×
`MAZE_MS_PER_STEP` (400ms), shown as a `#maze-timer` countdown that turns red in
the last third. Reaching 🎯 in time closes the maze and shows the gold success
overlay (confetti + sound); running out of time shows the shared overlay in its
`fail` tone (`showOverlay(…, "fail")` → red heading). The maze timer is cleared
on solve, time-out, and in `closeDialog`.

### Reaktionskollen (reaction-test mini-game)

**Reaktionskollen** (`#reaktion-overlay`): a 5-second countdown, then a blank
"waiting" phase for a random 1–5s, then a 🍺 appears and a `performance.now()`
clock starts. The first tap (pointerdown on `#reaktion-stage`, or Space) stops
it; tapping during "waiting" is a false start. The reaction time in ms maps to a
three-tier "how drunk are you" verdict (`reaktionLevel`): `< REAKTION_GREEN_MAX`
(350) → green "Nykter", `<= REAKTION_YELLOW_MAX` (550) → yellow "Salongsberusad",
else red "Full som ett ägg". A `reaktionPhase` state machine drives the round;
its two timers are cleared in `closeDialog` so a queued tick can't fire into a
closed dialog.

### Minnesluckatestet (memory / flash-count mini-game)

**Minnesluckatestet** (`#memory-overlay`), on beers `2+3n`: a 5s countdown, then
X 🍺 + Y 🐭 (each `MINNE_MIN`..`MINNE_MAX`, 1–10) flash shuffled for
`MINNE_FLASH_MS` (4000ms), then the player dials the two counts on iOS-style scroll
wheels (`.memory-wheel-scroll`, CSS `scroll-snap`; value read from `scrollTop /
MINNE_WHEEL_ITEM_H`) and submits. Accuracy (2/1/0 of the two counts correct) maps
to the same green/yellow/red verdict, shown with the facit. A `memoryPhase` state
machine drives it; its countdown/flash timers are cleared in `closeDialog`.

### Storage safety

Every Web Storage call is wrapped (`safeGet`/`safeSet`/`tryStorage`/`loadJSON`)
so private mode or quota errors degrade to a fallback instead of throwing. Use
these helpers rather than touching `localStorage`/`sessionStorage` directly.

## Conventions

- Plain ES (no modules/transpiler) inside one IIFE; keep the `── section ──`
  banner organization when adding code.
- Reference DOM nodes through the cached refs in the DOM-refs section.
- Persist through the storage helpers and `modeKey()` so live/demo stay isolated.
- Match the existing accessibility patterns (ARIA roles/labels, focus management)
  when adding interactive UI.
