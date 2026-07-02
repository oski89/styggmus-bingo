# Stygg Mus Bingo

Mobilvänlig 4x4-bingoapp med ölräknare och minigames för Stygg Mus-helgen.

## Funktioner

- Unik 4x4-bingobricka per användare.
- Lösenordsskydd med spelarval innan brickan visas.
- Rollspecifika brickor som filtrerar bort rätt personfält.
- Dashboard med Bingo, Ölräknaren och poängtavla.
- Nollställning av aktuell brickas markeringar utan att byta rutor.
- Tre gömda easter eggs.
- Diskret årsrad för Stygg Mus 2026.
- Interaktiv check/uncheck av rutor.
- Brickan och markeringar sparas lokalt mellan sid-refresh.
- Bingo-detektering med vinstljud + confetti-animation.
- Bingo-reward via ett slumpat minigame som avgör hur många klunkar vinnaren får dela ut.
- Grand-win vid 16/16 rutor med alla fyra minigames i följd.
- Ölräknare per spelare med roterande minigames.

## Kör lokalt

Enklast är att köra en liten statisk server i projektmappen:

```bash
python3 -m http.server 4173
```

Öppna sedan:

- [http://localhost:4173](http://localhost:4173)

## Publicera via GitHub Pages

Workflow finns i `.github/workflows/deploy-pages.yml`.

1. Pusha till `main`.
2. Gå till GitHub-repot -> `Settings` -> `Pages`.
3. Under `Build and deployment`, välj `Source: GitHub Actions`.
4. Vänta tills workflow `Deploy Stygg Mus Bingo` är klart.
5. Din live-sida blir normalt:
   - `https://<github-anvandare>.github.io/<repo-namn>/`

## Filer

- `index.html`
- `styles.css`
- `script.js`
- `TODO.md`
