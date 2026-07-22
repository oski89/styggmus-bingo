# Stygg Mus Bingo

Mobilvänlig 4×4-bingoapp med inline ölräknare, mulligan-läge, fem minigames och live party-sync för Stygg Mus-helgen. Ren statisk vanilla JS — inga beroenden, ingen build.

Neonklubben-tema (`Orbitron` typography, hot pink / electric cyan / acid yellow, 3D glassmorphism, constellation particles). UI på svenska.

## Funktioner

### Bingo & Mulligan
- **Unik 4×4-bricka per spelare:** Seedad shuffle med 16 rutor. Rollspecifik filtrering (varje spelares egna promptgrupp exkluderas).
- **Mulligan-läge (Byt rutor):** Byt ut upp till 3 ocheckade rutor per bricka via 3-punktsmenyn. Räknaren spåras per bricka i `localStorage` (`1 / 3 vaskade`, `2 / 3 vaskade`, `3 / 3 vaskade`).
- **Enhetlig Statsbar:** Spelarnamn och kompakt ölräknare i samma pill-formade glass capsule bar.
- **Markera & Spara:** Markeringar och brickstater sparas i `localStorage`.
- **Bingo-detektering:** Rader, kolumner och diagonaler utlöser vinstljud + confetti + minigame-reward.
- **Bingo-reward:** Ett slumpat minigame avgör hur många klunkar vinnaren får dela ut till sällskapet.
- **Grand Win (16/16):** Alla fem minigames i följd med summerade klunkar.
- **Meny:** Mulligan, ny bricka, nollställ markeringar, rekord, kvällens recap, byt spelare och avsluta.

### Spelare
1. `🐭 Stygg mus president 👑`
2. `🤮 Mouse trap pukie 👴🏻`
3. `👨🏿 Pommesansvarig 🍟`
4. `💨 AFC master TBD`
5. `🛋️ Prospect TBD`

### Ölräknare, Promille & Minigames
- Inline ölräknare (−/🍺/+) per spelare.
- **Promillekalkylator (Realistic BAC):** Beräknar reell promille (`0.00 ‰`) via MiniWebtool BAC Calculator API baserat på antal öl, spelarens vikt (kg) och tid sedan första ölen. Rate-limited vid öl-taps och heltimmar med lokal Widmark-formel som fallback.
- Varje tillagd öl roterar igenom de fem spelen:
  1. **Reaktionskollen** — tryck när 🍺 dyker upp
  2. **Minnesluckatestet** — räkna 🍺 och 🐭
  3. **Fyllekollen** — led 🐭 till 🍺 i en timed maze
  4. **Spykollen** — undvik 🤮 med 🛋️
  5. **Pissepaus** — luta/sikta 🍆-strålen på 🚽
- Tre-nivåers verdict (Nykter / Salongsberusad / Full som ett ägg) med alarm eller firande.
- Testläge (`MGT`) startar varje minigame direkt utan bricka.

### Party-länk & Rekord
- **Toppbar Party-kontroll:** Snabbåtkomst direkt på bingoskärmens toppbar via nätverksglob (`🌐`) + Apple iOS-toggle switch.
- **Offlie som standard:** Party-länk är avstängt vid start tills du aktivt slår på det.
- **Ölligans Roster:** Visar vem som är online med LED-statusindikatorer, promillehalt (`‰`), neon-cyan markering för din spelare (`(du)`), och strikt filtrering för färska anslutningar.
- **Utmaning & Duel-läge (1v1 Duels):** Utmana en polare i Ölligan-rostern på ett live minispel. Båda spelarna battlar på sina egna skärmar, poäng synkas i realtid, och förloraren tvingas dricka 5 straffklunkar med skärm-takeover!
- **Automatisk synk:** Lokalt satta rekord och ölräknare sänds automatiskt till alla anslutna telefoner när Party-länk aktiveras.
- **Party Takeover:** Inkommande bingos från andra telefoner tar över skärmen live med fanfare, vibration och svensk röst.
- **Rekord (Hall of Fame):** Sparar bästa resultat per minigame och spelare (fungerar både offline och online).
- **Kvällens recap:** Delbar neon-poster (1080×1350) med ölligans öllinjediagram, promillehalter (`‰`), bingo/klunkar och Kvällens Fyllo.
- **Kvällens statistik (Night Analytics):** Interaktiv statistik-sida i menyn med öl-övertids-diagram per spelare, ledande promille, totalt utdelade klunkar och mest checkade rutor.
- **Kommentatorn:** Sporadisk sportkommentar vid nästan-bingo, ölmilstolpar m.m.
- **Dold Admin Reset:** Nollställ hela omgången genom 3 sekunders långtryck på "Meny"-titeln (låst till endast `💨 AFC master TBD`).

### PWA & Enhetsstöd
- Installerbar PWA (manifest + service worker, network-first med offline-fallback).
- Haptics (Vibration API + iOS switch-fallback), screen wake lock under dialoger, speech för verdicts.
- Easter eggs: Gyllene Musen (5 taps på 🍆 eller Konami-kod `↑ ↑ ↓ ↓ ← → ← → B A` för 3D-guldbricka & 8-bit glitterfanfar), Mouse Trap Slime Explosion (3 taps på spelarnamnet som Pukie för slem-explosion & +1 bonus-mulligan).

## Kör lokalt

```bash
python3 -m http.server 4173
# öppna http://localhost:4173
# Lösenord: SMB (live) eller MGT (test)
```

Ingen install, lint eller teststeg — öppna sidan direkt.

## Publicera via GitHub Pages

Workflow: `.github/workflows/deploy-pages.yml`.

1. Pusha till `main`.
2. GitHub → `Settings` → `Pages` → Source: **GitHub Actions**.
3. Vänta på workflow `Deploy Stygg Mus Bingo`.
4. Live: `https://<github-anvandare>.github.io/<repo-namn>/`

Hela repo-roten laddas upp as-is (ingen build).

## Kopior

| Sökväg | Syfte | Lösenord |
|--------|--------|----------|
| `/` (root) | Riktiga spelet | `SMB` / `MGT` |
| `demo/` | Anonymiserad testkopia för vänner | `TEST` |
| `dwarf/` | Kontorsbingo (forge-tema) | `DWARF` |

`demo/` och `dwarf/` är fristående forkar med isolerade storage-nycklar och party-topic — de synkas **inte** automatiskt med root. Se `CLAUDE.md` för skillnader och isoleringsregler.

## Filer

| Fil | Roll |
|-----|------|
| `index.html` | Markup, skärmar, dialoger, toppbar med party-switch |
| `styles.css` | Neonklubben-tema, 3D glassmorphism, Apple sliders, mobil-först |
| `script.js` | All logik i en IIFE (bingo, mulligan, 5 minigames, party-länk, rekord, recap) |
| `manifest.webmanifest` / `sw.js` / `icons/` | PWA |
| `art/neonklubben-bg.webp` | Bakgrundsillustration |
| `CLAUDE.md` | Arkitektur och agent-guide |
| `TODO.md` | Backlogg och idébank |
| `progress.md` | Utvecklingshistorik |
