Original prompt: Gör en bingo-app för vår årliga tradition med grabbhäng som vi kallar "Stygg Mus". Stygg Mus är en ordlek av ordet "Stugmys" och vi är 5 grabbar som dricker öl, grillar, badar och hänger under en hel helg på sommaren. Det brukar bli diverese lekar, quiz, etc. Jag vill att appen ska se bra ut i mobilen (iOS och Andriod) och vara tillgänglig via min public github.

## 2026-05-25
- Skapade komplett statisk app med:
  - 5x5 interaktiv bingobricka
  - Unik bricka per användare via seedad shuffle
  - Check/uncheck av rutor
  - Persistens i localStorage (bricka + checkade rutor)
  - Ny-bricka-knapp som nollställer state
  - Bingo-detektering (rader, kolumner, diagonaler)
  - Confetti-animation och vinstljud via Web Audio API
  - Pris-popup för bingo
  - Grand-win popup för 25/25 med utopiskt pris
  - Tema-anpassning (färger + typsnitt) med persistens
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

TODO / nästa förbättringar:
- Eventuellt lägga till en redigerbar lista med egna bingo-frågor direkt i UI.
- Eventuellt lägga till "dela min bricka"-funktion med delbar kod/URL.
