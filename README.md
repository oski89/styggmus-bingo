# Stygg Mus Bingo

Mobilvänlig 5x5-bingoapp för Stygg Mus-helgen.

## Funktioner

- Unik bingobricka per användare.
- Interaktiv check/uncheck av rutor.
- Brickan och markeringar sparas lokalt mellan sid-refresh.
- Bingo-detektering med vinstljud + confetti-animation.
- Pris-popup vid bingo.
- Grand-win vid 25/25 rutor med särskilt pris.
- Anpassningsbart tema (färger + typsnitt).

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
