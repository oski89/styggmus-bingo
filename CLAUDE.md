# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
# Password: AFC
```

## Deploy

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) deploys automatically to GitHub Pages. No build step required; the entire repo root is uploaded as-is.

## Architecture

Single-page vanilla JS app with no dependencies, no bundler, and no build step. Three files:

- `index.html` — static markup with two screens: `#access-screen` (password + player select) and `#app` (game board). Also contains two overlay dialogs (`#overlay` for bingo prizes, `#scoreboard-overlay`) and a `<canvas>` for confetti.
- `styles.css` — all styling, mobile-first with CSS custom properties and `safe-area-inset` support.
- `script.js` — entire app logic in one IIFE. Key sections (marked with `──` comments): Access flow, State, Scoreboard state, Scoreboard UI, Board, Player helpers, Easter eggs, Win detection, Celebrations, Confetti, Audio, Utilities, Storage.

### State model

Each player gets their own board stored under `styggmus-bingo-board-v2:<playerId>` in `localStorage`. The board is a 25-element array of prompt strings shuffled from a seeded PRNG (mulberry32 + djb2-style hash), with the fixed free cell at index 12. Checked indexes, awarded bingo lines, and grand-win status are persisted alongside the board. Scores (bingo line count, grand wins) live separately under `styggmus-bingo-scores-v1`. Auth is session-only (`sessionStorage`); player selection persists in `localStorage`.

### Player/prompt filtering

Each player has an `excludedGroup` that removes one group of 6 prompts from their pool before the board is generated. There are 5 prompt groups (one per person in the group) × 6 prompts = 30 total, minus 6 excluded = 24 available for the 24 non-free cells.

### Easter eggs

Three hidden triggers: 5 rapid title clicks → "STYGG MODE", Konami code → "KONAMI-KUBB!", typing "DDKO" → "DDKO REQUESTAD".
