# TODO

Aktuell backlogg och idébank för Stygg Mus Bingo.

## 🔄 Nyss genomfört (Completed Features)

- **Mulligan-läge (Byt rutor):** Tillåter spelare att byta ut upp till 3 ocheckade rutor per bricka via 3-punktsmenyn. Räknaren spåras per bricka i `localStorage` och visar totalt valda/vaskade rutor (t.ex. `1 / 3 vaskade`).
- **Flyttad Party-länk:** Party-länk har flyttats från 3-punktsmenyn till bingoskärmens toppbar som en `🌐` nätverksglob + Apple iOS-toggle slider bredvid 3-punktsmenyn.
- **Förbättrad Party-status & Modal UI:**
  - Party-länk är avstängd (`off`) som standard vid start.
  - Apple iOS-slider i övre högra hörnet i Party-modalen och tillbaka-knapp (`←`) i övre vänstra hörnet.
  - Varje spelare i Ölligans roster visar en lysande grön/grå statusprick bredvid sitt namn (`on` / `off`).
  - Din egen spelare (`(du)`) har en unik neon-cyan highlight med kant-glow och bakgrundsskuggning (`.party-self`).
  - Spelare markeras bara som online om de faktiskt är anslutna och skickar färska pings.
  - Automatisk synk av lokalt satta mini-game-rekord vid anslutning.
- **Spelaremojis uppdaterade:** Spelarna har uppdaterade emojis (`🐭 👑`, `🤮 👴🏻`, `👨🏿 🍟`, `💨 TBD`, `🛋️ TBD`).
- **AFC Master Admin Reset Guard:** Långtryck (3 sekunder) på "Meny"-titeln för dold admin-reset ("Ny omgång") är nu låst till endast `💨 AFC master TBD`.
- **Promillekalkylator & Fyllemätare:** Real-tids promillekalkylator (`0.0 ‰`) och 5-stegs berusningsmätare (*Nykter → Salongs → Slirig → Kalasfull → Överfull*) integrerad i statsbaren med färg/glow-indikationer och röst-pitch-shifts.
- **Utmaning & Duel-läge (1v1 Duels):** Klicka på "⚔️ Utmana" bredvid en online-spelare i Ölligan-rostern för att utmana dem i ett slumpat minispel. Båda spelarna battles live, poäng jämförs via ntfy.sh SSE stream (`duel_score`), och förloraren drabbas av en skärm-takeover med 5 straffklunkar (eller 2 klunkar vid fegis/decline).
- **Kvällens Statistik & Öldiagram (Night Analytics):** Interaktiv statistik-sida (`#analytics-overlay`) i menyn med canvas-baserat linjediagram för alla spelares ölkonsumtion över tid, öl-ledare & promille, totalt utdelade klunkar och topp 3 mest checkade rutor ikväll.
- **Gyllene Musen (Secret Konami Code):** 5 snabba taps på `🍆` i titeln eller Konami-koden `↑ ↑ ↓ ↓ ← → ← → B A` togglar 3D guld-spegelkort, guldglitterregn och 8-bit retro-fanfar. Toggle igen återställer brickan med nollställningsgrafik & ljud.
- **Mouse Trap Slime Explosion:** 3 snabba taps på spelarnamnet som `Mouse Trap Pukie 👴🏻` utlöser en neongrön slem-explosion (`#slime-overlay`), slem-ljud och belönar Pukie med +1 bonus-mulligan.
- **Topbar visual refresh:** Tillbaka-pilen borttagen från bingo-toppbaren, titeln "Stygg Mus Bingo" förstorad med neon-effekt (`Orbitron`), och meny-alternativen logiskt sorterade.

---

## 🚀 Planerade Större Features (Major Enhancements)

- [x] **🍻 Promillekalkylator & Fyllemätare (Dynamic Drunk Meter)**
  - Real-tidspromille och berusningsnivå (*Nykter → Salongs → Slirig → Kalasfull → Överfull*) i statsbaren baserat på ölräknaren.
  - Dynamiska effekter vid höga nivåer: skärm-wobble (`stygg-wobble`), rainbow text glow och röst-pitch-shifts.
- [x] **⚔️ Utmaning & Duel-läge (1v1 Mini-Game Duels in Party-länk)**
  - Klicka på en spelare i Ölligan-rostern för att utmana dem i ett slumpmässigt minispel (*Spykollen*, *Pissepaus*, etc.).
  - Förloraren får en skärm-takeover som tvingar dem att dricka X klunkar.
- [x] **📊 Kvällens Graf & Statistik-sida (Night Analytics)**
  - Interaktiv statistik-sida i menyn med öl-övertids-diagram, bingo-hastighet, mest checkade rutor och totalt utdelade klunkar per spelare.
- [ ] **✏️ Redigerbar lista med egna bingo-frågor i UI:**
  - Möjlighet att lägga till/redigera egna frågor direkt i appen.
- [ ] **🔗 Dela min bricka:**
  - Generera en delbar länk eller kod för att dela en specifik bingobricka.

---

## 🥚 Planerade Easter Eggs

- [x] **🐭 Gyllene Musen (Secret Konami Code)**
  - Klicka på 🍆 i "Stygg Mus Bingo 🍆🐭🎲" 5 gånger i snabb följd (eller slå Konami-koden `↑ ↑ ↓ ↓ ← → ← → B A`).
  - Förvandlar hela brickan till 3D guld-spegelkort (`.gyllene-musen-active`), guld-glitterregn och 8-bit retro arcade-fanfar!
- [x] **🤮 Mouse Trap Slime Explosion:**
  - Klicka på ditt eget spelarnamn 3 gånger som `Mouse Trap Pukie 👴🏻`.
  - Utlöser grön neon-slime animation på skärmen, slem-ljudeffekt och belönar Pukie med +1 bonus-mulligan!
- [ ] **🌙 Efterfest / Night Shift Mode (Midnight / 00:00):**
  - Automatisk natt-transformeringsläge efter midnatt (kl 00:00) med lila nebula-partiklar och busiga natt-citat.

---

## 🎆 Planerade Grafiska Uppgraderingar (Visual Upgrades)

- [ ] **🌌 Hyper-Realistisk 3D Tilt Fysik för Bingorutor:**
  - Gyro/touch orientation på bingorutor (`perspective(1000px) rotateX/Y`) så reflektioner och metallic light sweeps rör sig med telefonens lutning.
- [ ] **⚡ Plasma Arc & Laser-linjer vid Bingo:**
  - Animerade glowing plasma-lasrar som förbinder rutorna i en vinnande bingo-rad innan partikel-fyrverkerier exploderar.
- [ ] **💥 Vatten/Partikel Shockwave Engine:**
  - Interaktiv ring-chockvåg på bakgrundskanvasen vid touch på bingorutor som fysiskt knuffar bort partiklar.
