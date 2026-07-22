# Progress

Original prompt: Gör en bingo-app för vår årliga tradition med grabbhäng som vi kallar
"Stygg Mus". Stygg Mus är en ordlek av ordet "Stugmys" och vi är 5 grabbar som
dricker öl, grillar, badar och hänger under en hel helg på sommaren. Det brukar
bli diverse lekar, quiz, etc. Jag vill att appen ska se bra ut i mobilen (iOS
och Android) och vara tillgänglig via min public github.

## 2026-05-25 — Första versionen

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
  - Funktionstest för check/uncheck, bingo-overlay, grand-win, persistens.
  - Inga JS-konsolfel i testkörning.

## Senare — Bingo-vy, öl & minigames

- Brickan är 4×4 (`BOARD_SIZE = 4`) med 16 rutor.
- Förenklad bingo-vy: toppmeny (⋮), ← byt spelare, inline ölräknare (−/🍺/+).
- Fem minigames (roterar på varje tillagd öl + testläge `MGT`):
  - **Reaktionskollen** — reaktionstid när 🍺 dyker upp
  - **Minnesluckatestet** — räkna flashade 🍺/🐭
  - **Fyllekollen** — swipe-maze, timed
  - **Spykollen** — dodge-spel (soffa vs 🤮)
  - **Pissepaus** — tilt/sikta-stream mot 🚽
- Bingo-rewards styrs av minigame-resultat i klunkar; full bricka spelar alla
  fem i följd och summerar.
- Delade verdict-nivåer: Nykter (alarm) / Salongsberusad / Full som ett ägg
  (firande).

## Senare — Party, rekord, recap, PWA

- **Party-länk** via ntfy.sh: ölligan, bingo-flash på andras telefoner, rekord-
  sync, round-reset.
- **Rekord** (hall of fame) per spelare och minigame.
- **Kvällens recap** — delbar neon-poster med nattens tallies.
- **Kommentatorn** — sporadisk `sv-SE`-röst vid nästan-bingo, ölmilstolpar m.m.
- Dold admin "Ny omgång" (långtryck på Meny-titeln).
- PWA: manifest, service worker (network-first), ikoner, haptics, wake lock,
  speech.
- Neonklubben-visuell identitet + bakgrundskonst (`art/neonklubben-bg.webp`).

## Kopior

- `demo/` — anonymiserad, isolerad testkopia (lösenord `TEST`).
- `dwarf/` — kontorsbingo med forge-tema (lösenord `DWARF`).

## Docs

- 2026-07-21: `README.md` och denna fil synkade mot nuvarande app (fem
  minigames, party/rekord/recap, demo/dwarf). `CLAUDE.md` är fortfarande den
  detaljerade arkitekturguiden.

## 2026-07-22 — Nya Features & Easter Eggs

- **Mulligan-läge (Byt rutor):** Vaska upp till 3 ocheckade rutor per bricka via menyn.
- **Party-länk Quick Widget:** Flyttad till toppbaren med `🌐` glob + Apple iOS toggle slider.
- **Utmaning & Duel-läge (1v1 Duels):** Utmana party-medlemmar live i slumpade minispel via ntfy.sh SSE stream.
- **Kvällens Statistik & Öldiagram (Night Analytics):** Interaktiv statistik-modal (`#analytics-overlay`) med canvas-baserat linjediagram för alla spelares ölkonsumtion över tid.
- **Real-tids BAC Promillekalkylator:** Exakt promillekalkylator baserad på Widmark-formeln, spelarvikt i kg (President 85kg, Pukie 78kg, Pommesansvarig 90kg, AFC Master 70kg, Prospect 75kg), antal öl och realtidstimmar. Integration mot MiniWebtool API.
- **Gyllene Musen (Secret Konami Code):** 5 snabba taps på `🍆` i titeln eller Konami-koden (`↑ ↑ ↓ ↓ ← → ← → B A`) togglar 3D guld-spegelkort (`.gyllene-musen-active`), guldglitterregn och 8-bit retro-fanfar. Toggle igen återställer med nollställningsgrafik & ljud.
- **Mouse Trap Slime Explosion:** 3 snabba taps på spelarnamnet som `Mouse Trap Pukie 👴🏻` utlöser en fullskärms neon-slemexplosion (`#slime-overlay`), slem-ljud och belönar Pukie med +1 bonus-mulligan.
