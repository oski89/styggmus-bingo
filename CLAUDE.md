# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
# Password: SMB (live mode) or FLÖTET (demo / beta-test mode)
```

There is no build, install, lint, or test step — open the served page directly.

## Deploy

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys automatically to GitHub Pages. No build step required; the entire repo root is uploaded as-is (`path: "."`).

## Architecture

Single-page vanilla JS app with no dependencies, no bundler, and no build step. Three source files plus markdown docs:

- `index.html` — all static markup. One `#access-screen` (password + player select) and two `<main>` "screens": `#app` (the bingo board — the only screen a logged-in live/demo player sees) and `#test-screen` (mini-game launcher, `MGT` password only). Plus dialog overlays — `#overlay` (easter-egg messages), `#reward-overlay` (bingo mini-game intro + klunkar payout), `#menu-overlay` (byt spelare / avsluta, opened from the bingo top bar's ⋮ button), `#confirm-overlay` (styled `confirm()` replacement), and the four mini-game overlays — and a `<canvas id="confetti">`. SVG icons are defined once in a `<svg class="svg-sprite">` and referenced via `<use href="#…">` (inline `style` fills, not classes, so they survive `<use>` cloning in Firefox).
- `styles.css` — all styling, mobile-first with CSS custom properties and `safe-area-inset` support. A `body.demo-mode` class re-themes the UI for beta-test mode; `@media (prefers-reduced-motion: reduce)` disables animations.
- `script.js` — the entire app in one IIFE. Sections are marked with `── … ──` banner comments: DOM-refs, Event listeners, Access flow, State, Beer state, Beer UI, Board, Player helpers, Easter eggs, Fyllekollen (swipe maze), Reaktionskollen (reaction test), Minnesluckatestet (memory test), Spykollen (dodge game), Win detection, Celebrations, Confetti, Audio, Utilities, Storage.

UI language is Swedish.

### Screen flow

`renderAccessFlow()` (called once on load) decides the entry point:
password gate → player gate → **bingo** (`#app`) directly (or straight to
`#test-screen` in test mode) — bingo is the only screen a live/demo player ever
sees; there is no separate dashboard or app launcher. The bingo layout, top to
bottom: `.bingo-topbar` (a flat 3-item flex row — the ← back button, then the
title, then the ⋮ menu button at the opposite end, no longer grouped/stacked
together), `.stats` (the player name box — no visible "Spelare" label, just
`aria-label="Spelare"` on the `.stat` div for screen readers — and the compact
−/🍺/+ beer widget as its second item), then `.board-wrap`. The ← button (`topbar-back-btn`) is a no-confirm
shortcut straight to `showPlayerGate()` — the same action as the menu's "Byt
spelare", just one tap instead of opening the menu first; the title is sized
(`font-size: 0.82rem`) to reliably fit one line even at the narrowest
supported width now that it's flanked by two separate 38px buttons instead of
one stacked pair, with wrapping still allowed (not nowrap+ellipsis) as a
fallback for extreme cases like OS text-scaling, so it degrades to two lines
instead of clipping the trailing emoji off-screen. There is no Fält/Rader
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
`.overlay-card button` gold default) — no more `.primary-btn`/`.exit-btn`
visual distinction between them. `onExit()` defensively closes whatever
dialog is currently open before showing the exit confirmation.
`hideAllScreens()` + `…El.classList.remove("hidden")` is
the show/hide mechanism for the two top-level screens — there is no router.

### Auth & modes

Three passwords map to three modes (`PASSWORDS` in `script.js`): `SMB` → `live`,
`FLÖTET` → `demo`, `MGT` → `test`. **Test mode** skips the player gate and shows
`#test-screen`, a menu whose four tiles launch each mini-game
(`openFyllekollen`/`openReaktionskollen`/`openMinneslucka`/`openSpykollen`) directly for testing. Auth and the active mode are session-only
(`sessionStorage`: `styggmus-bingo-auth-v1`, `styggmus-bingo-mode-v1`); "Avsluta"
clears them and returns to the password gate. **Demo mode** uses placeholder
lorem-ipsum prompts and namespaces every persisted key with a `:demo`
suffix (`modeKey()`), so beta-test data never collides with live data.

### State model

Each player gets their own bingo board stored under
`styggmus-bingo-board-v2:<playerId>` (`:demo`-suffixed in demo mode) in
`localStorage`. The board is a 16-element array (`BOARD_SIZE` 4 × 4, `CELL_COUNT`
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
per real-life person × 6 prompts = 30 total. Each player has an `excludedGroup`
(typically their own) that is removed before the board is built, leaving 24
prompts; the first 16 of the shuffle fill the 16 cells. Demo mode swaps
`promptGroups` for the `demoPromptGroups` equivalent via `getActivePromptGroups()`.

### Win detection & bingo rewards

`getWinningLines()` checks 4 rows + 4 columns + 2 diagonals. New bingo lines (not
already in `bingoLinesAwarded`), instead of a fixed prize, launch a
**bingo reward** (`startBingoReward`): a random mini-game whose result
decides how many "klunkar" (sips) you get to hand out to everyone. Filling all 16
cells triggers `startGrandReward` once — all four games in a random row, klunkar
summed. A grand win supersedes the single-line reward for the same check (filling
the last cell also completes lines), so only one flow runs. Sound is synthesized
with the Web Audio API; confetti is canvas-drawn and skipped under
`prefers-reduced-motion`.

The reward flow lives in the **Bingo rewards** section. `rewardSession`
({ mode, queue, idx, total, breakdown, currentOverlay, resolved }) drives it; the
`REWARD_GAMES` registry maps each game id to its open-fn, overlay, close
button, and label. `showRewardIntro` opens the shared `#reward-overlay`
(intro → "Spela"/"Kör alla fyra"); `startCurrentRewardGame` opens the next game;
each game's terminal result calls `recordRewardResult(gameId, klunkar, verdict)`
(a no-op outside a session, so the beer-counter rotation and test menu are
unchanged), which rounds klunkar to nearest (≥ 0) and relabels the close button
to "Nästa spel"/"Klar". None of the four mini-games has a retry/"play again"
button (removed — closing and reopening is the only way to run another round).
Closing the
game (button/Escape/backdrop) runs `advanceRewardAfterGame` via `closeDialog`
(unfinished = 0); after the last game `showRewardPayout` reveals the breakdown +
total. Klunkar per game: Fyllekollen = `MAZE_KLUNK_MAX` × share of the clock left
at the goal, so max is `MAZE_KLUNK_MAX` (8) and timeout = 0;
Reaktionskollen = `(KLUNK_REAKTION_BASE_MS − ms) / KLUNK_REAKTION_DIV` capped at
`KLUNK_REAKTION_MAX` (10), false start = 0; Minnesluckatestet =
`KLUNK_MINNE_BASE − total deviation`;
Spykollen = `KLUNK_SPY[cls]` (Nykter 6 / Salongsberusad 4 / Full som ett ägg 2).

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

The four beer-counter mini-games rotate on a fixed `MINIGAME_CYCLE` (4) beat in
`countBeerPress`, keyed off the running count of beers added (`beerAddedTotal`,
session-only; only `+` presses count): **Reaktionskollen** on beers `1+4n` (`%4
=== 1`), **Minnesluckatestet** on `2+4n` (`%4 === 2`), **Fyllekollen** on `3+4n`
(`%4 === 3`), **Spykollen** on `4+4n` (`%4 === 0`). Exactly one fires per added
beer, so they never collide; none fires while another dialog is up. All four are
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

**Minnesluckatestet** (`#memory-overlay`), on beers `2+4n`: a 5s countdown, then
X 🍺 + Y 🐭 (each `MINNE_MIN`..`MINNE_MAX`, 1–10) flash shuffled for
`MINNE_FLASH_MS` (4000ms), then the player dials the two counts on iOS-style scroll
wheels (`.memory-wheel-scroll`, CSS `scroll-snap`; value read from `scrollTop /
MINNE_WHEEL_ITEM_H`) and submits. Accuracy (2/1/0 of the two counts correct) maps
to the same verdict tiers (2 → red "Nykter" + alarm, 1 → yellow, 0 → green
"Full som ett ägg" + celebration), shown with the facit. A `memoryPhase` state
machine drives it; its countdown/flash timers are cleared in `closeDialog`.

### Spykollen (dodge mini-game)

**Spykollen** (`#spy-canvas` in `#spykollen-overlay`), on beers `4+4n`: a
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
