# UI/UX-förbättringar — att göra

Förslag på förbättringar för Stygg Mus 2026, grupperade efter hur mycket de
påverkar känslan i appen. Referenser pekar på `fil:rad` i nuvarande kod.

## Hög prioritet — friktion & tillgänglighet

- [ ] **Stäng overlays med Escape och bakgrundsklick.** Prisrutan (`#overlay`)
  går bara att stänga via knappen — varken Escape eller klick utanför funkar
  (`script.js:302`, `script.js:1038`). Poängtavlan stängs på bakgrundsklick men
  inte med Escape (`script.js:305`). Lägg till en gemensam `keydown`-lyssnare för
  Escape och bakgrundsklick på båda.
- [ ] **Fokushantering för dialoger.** När en overlay öppnas flyttas inte fokus
  in i den, och vid stängning återställs det inte till knappen som öppnade
  (`script.js:636`, `script.js:1038`). Tangentbords- och skärmläsaranvändare
  tappar helt platsen. Flytta fokus till dialogen, fånga Tab inom den, och
  återlämna fokus vid stängning.
- [ ] **Brädet tappar tangentbordsfokus vid varje klick.** `onBoardClick` kör
  `renderBoard()` som river hela `innerHTML` och bygger 25 nya knappar
  (`script.js:813`, `script.js:767`). En tangentbordsanvändare som kryssar en
  ruta kastas tillbaka till sidans början. Växla i stället bara `.checked`-klass
  och aria-attribut på den klickade cellen.
- [ ] **Respektera `prefers-reduced-motion`.** Konfetti, champion-glow,
  stygg-wobble, konami-flash och pop-in körs alltid (`styles.css:825-893`,
  `script.js:1050`). Lägg en media-query som dämpar/animationsstoppar och hoppa
  över konfetti för användare som valt minskad rörelse.
- [ ] **Ersätt `window.confirm()` med stilren dialog.** Tre native-confirms
  (Ny bricka, Nollställ, Avsluta) bryter mot den polerade looken och ser
  ostyled ut på mobil (`script.js:425`, `script.js:820`, `script.js:834`).
  Återanvänd overlay-komponenten för bekräftelser.

## Medel — mobilkänsla & feedback

- [ ] **`touch-action: manipulation` på celler och knappar.** Snabb upprepad
  tryckning kan trigga dubbeltryck-zoom och 300 ms-fördröjning på mobil. Sätt
  `touch-action: manipulation` på `.cell`/`button` (`styles.css:374`,
  `styles.css:503`).
- [ ] **Haptisk feedback vid markering och bingo.** Ett kort
  `navigator.vibrate()` när en ruta kryssas och en längre puls vid bingo/full
  bricka skulle förstärka känslan på mobil (`script.js:793`, `script.js:1024`).
- [ ] **Visuell progress-mätare.** "Markerade fält" visas bara som text
  `0/25` (`index.html:146`, `script.js:958`). En tunn progress-bar under
  statistiken gör läget avläsbart på en blick.
- [ ] **Läsbarhet i celler vid små skärmar.** Långa prompts (t.ex. "Per har
  objektivt fel i en argumentation men fortsätter ändå driva sin tes") trängs i
  78 px-celler på 0.62 rem (`styles.css:1333`, `script.js:85`). Överväg
  `clamp()`-typografi, något högre celler, eller en knapp för att läsa full text.
- [ ] **Synligare aktiv-läge på celler vid touch.** `:hover`/`:focus-visible`
  finns men touch saknar hover; `:active`-feedbacken är subtil
  (`styles.css:537`). Lägg en tydligare tryck-state för touch.

## Lägre — finputs & robusthet

- [ ] **Webbläsarens bakåtknapp.** Appen är en SPA utan history-states, så
  "bakåt" lämnar sidan helt i stället för att gå ett steg bakåt mellan
  dashboard/bingo/öl (`script.js:353-411`). Överväg `history.pushState` per
  skärm.
- [ ] **Kontrast på dämpad text.** `--muted`-toner och `version-line` på
  `rgba(255,248,232,0.48)` kan ligga under WCAG AA mot den mörka bakgrunden
  (`styles.css:287`, `styles.css:9`). Verifiera och höj vid behov.
- [ ] **Tydligare felmeddelande-plats för lösenord.** Feedback-raden reserverar
  redan höjd (`styles.css:205`), men ett litet skak-/färg-cue vid fel lösenord
  skulle göra det tydligare (`script.js:374`).
- [ ] **Ångra senaste öl.** Minus-knappen finns, men en kort "ångra"-bekräftelse
  efter feltryck (eller long-press för att nollställa) vore smidigt
  (`script.js:609`).
- [ ] **Skärmläsar-annonsering vid bingo.** Overlayn har `aria-live="assertive"`
  (`index.html:200`) men konfetti/ljud annonseras inte; säkerställ att vinsttext
  faktiskt läses upp och att titeln (`HELA BRICKAN KLAR!`) hinner annonseras.
- [ ] **Konsekvent ikon i stället för emoji-spelarnamn.** Spelaretiketter blandar
  emoji + text (`script.js:92-118`); på vissa plattformar renderas
  hudtons-emojin (`👨🏿`) olika. Kontrollera fallback.
