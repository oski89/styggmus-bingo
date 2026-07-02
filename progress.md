Original prompt: Gör en bingo-app för vår årliga tradition med grabbhäng som vi kallar "Stygg Mus". Stygg Mus är en ordlek av ordet "Stugmys" och vi är 5 grabbar som dricker öl, grillar, badar och hänger under en hel helg på sommaren. Det brukar bli diverese lekar, quiz, etc. Jag vill att appen ska se bra ut i mobilen (iOS och Andriod) och vara tillgänglig via min public github.

## 2026-05-25
- Skapade komplett statisk app med:
  - Interaktiv bingobricka
  - Unik bricka per användare via seedad shuffle
  - Check/uncheck av rutor
  - Persistens i localStorage (bricka + checkade rutor)
  - Ny-bricka-knapp som nollställer state
  - Bingo-detektering (rader, kolumner, diagonaler)
  - Confetti-animation och vinstljud via Web Audio API
  - Bingo-popup
  - Grand-win popup för full bricka
  - Mobilanpassad styling med färger och typsnitt för Stygg Mus-temat
- Appen designad mobil-först med stora touchytor och safe-area-stöd.
- Lade till GitHub Pages workflow i `.github/workflows/deploy-pages.yml`.
- Uppdaterade README med lokalkörning och publiceringssteg.
- Verifierade appen:
  - Mobil- och desktop-screenshot via Playwright.
  - Funktionstest för:
    - check/uncheck
    - bingo-overlay
    - grand-win-overlay
    - persistens över refresh
  - Inga JS-konsolfel i testkörning.

## Senare uppdateringar
- Brickan är nu 4x4 (`BOARD_SIZE = 4`) med 16 rutor.
- Appen har förenklad bingo-vy, inline ölräknare, toppmeny och fyra minigames.
- Bingo-rewards styrs av minigame-resultat i klunkar; full bricka spelar alla fyra minigames i följd.
