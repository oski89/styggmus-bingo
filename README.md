# Stygg Mus Bingo

Mobilvänlig 4×4-bingoapp med inline ölräknare, fem minigames och live party-sync
för Stygg Mus-helgen. Ren statisk vanilla JS — inga beroenden, ingen build.

Neonklubben-tema (hot pink / electric cyan / acid yellow). UI på svenska.

## Funktioner

### Bingo
- Unik 4×4-bricka per spelare (seedad shuffle, 16 rutor).
- Lösenord + spelarval innan brickan visas.
- Rollspecifika brickor: varje spelares egna promptgrupp filtreras bort.
- Markera/avmarkera rutor; bricka och markeringar sparas i `localStorage`.
- Bingo-detektering (rader, kolumner, diagonaler) med ljud + confetti.
- Bingo-reward: ett slumpat minigame avgör hur många klunkar vinnaren får dela ut.
- Grand-win vid 16/16: alla fem minigames i följd, klunkar summeras.
- Meny: ny bricka, nollställ markeringar, byt spelare, avsluta.

### Ölräknare & minigames
- Inline ölräknare (−/🍺/+) per spelare.
- Varje tillagd öl roterar igenom de fem spelen:
  1. **Reaktionskollen** — tryck när 🍺 dyker upp
  2. **Minnesluckatestet** — räkna 🍺 och 🐭
  3. **Fyllekollen** — led 🐭 till 🍺 i en timed maze
  4. **Spykollen** — undvik 🤮 med 🛋️
  5. **Pissepaus** — luta/sikta 🍆-strålen på 🚽
- Tre-nivåers verdict (Nykter / Salongsberusad / Full som ett ägg) med alarm eller firande.
- Testläge (`MGT`) startar varje minigame direkt utan bricka.

### Party & natt
- **Party-länk** — live-sync mellan telefoner via ntfy.sh (ölligan, bingo-flash, rekord, round-reset).
- **Rekord** — hall of fame per minigame och spelare.
- **Kvällens recap** — delbar neon-poster (1080×1350) med ölligan, bingo/klunkar och Kvällens Fyllo.
- **Kommentatorn** — sporadisk sportkommentar (nästan-bingo, ölmilstolpar, m.m.).
- Dold admin-återställning av hela omgången (långtryck på "Meny"-titeln).

### PWA & enhet
- Installerbar PWA (manifest + service worker, network-first med offline-fallback).
- Haptics (Vibration API + iOS switch-fallback), screen wake lock under dialoger, speech för verdicts.
- Tre easter eggs (title-klick, Konami, typed DDKO).

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

`demo/` och `dwarf/` är fristående forkar med isolerade storage-nycklar och
party-topic — de synkas **inte** automatiskt med root. Se `CLAUDE.md` för
skillnader och isoleringsregler.

## Filer

| Fil | Roll |
|-----|------|
| `index.html` | Markup, skärmar, dialoger |
| `styles.css` | Neonklubben-tema, mobil-först |
| `script.js` | All logik i en IIFE |
| `manifest.webmanifest` / `sw.js` / `icons/` | PWA |
| `art/neonklubben-bg.webp` | Bakgrundsillustration |
| `CLAUDE.md` | Arkitektur och agent-guide |
| `TODO.md` | Kort backlogg |
| `progress.md` | Utvecklingshistorik |
