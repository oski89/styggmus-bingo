(function () {
  "use strict";

  const STORAGE_KEY = "styggmus-bingo-v1";
  const THEME_KEY = "styggmus-bingo-theme-v1";
  const BOARD_SIZE = 5;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

  const prompts = [
    "Någon säger \"en sista öl\"",
    "Någon glömmer handduk",
    "Spontant nattbad",
    "Grillmästaren skryter",
    "En quizfråga leder till bråk",
    "Någon tappar något i vattnet",
    "Påbörjad men ej avslutad armhävningstävling",
    "Någon säger \"vi tar en promenad\"",
    "Diskussion om gamla minnen spårar ur",
    "Någon kör barfota hela kvällen",
    "Någon blandar en tveksam grogg",
    "En låt spelas om minst tre gånger",
    "Någon säger \"det här blir lugnt\"",
    "Vinnarskalle i kubb eller kortspel",
    "Någon tappar bort sin mobil tillfälligt",
    "Någon börjar prata dialekt",
    "Någon somnar i soffan först",
    "Någon föreslår ett dopp till",
    "Någon spiller öl på sig själv",
    "Någon blir grillad i quiz",
    "Någon ropar \"SKÅL\" från ingenstans",
    "Någon lagar något med endast smörkniv",
    "Dagens ord blir \"styggt\"",
    "Någon glömmer vilken dag det är",
    "Någon försöker prata engelska med måsen",
    "Någon säger \"det här går i historieböckerna\"",
    "En ny intern regel uppfinns",
    "Någon säger \"bara fem minuter\"",
    "Någon spelar luftgitarr",
    "Någon förklarar en dålig ordvits",
    "Någon vägrar erkänna förlust",
    "Någon startar en skål med fel glas",
    "Någon glömmer vart hen la kapsylöppnaren",
    "Någon går all in i ett random sidobet",
    "Någon uppfinner en egen lek",
    "Någon säger \"vi behöver mer kol\"",
    "Någon överanvänder ordet \"legendariskt\"",
    "Någon gör en dramatisk entré",
    "Någon föreslår aftermovie",
    "Någon snackar strategi inför nästa år",
  ];

  const bingoPrizes = [
    "Dela ut 10 klunkar till valfria deltagare.",
    "Bjud närmsta polare på en grogg.",
    "Ät nästa måltid med endast sked.",
    "Bestäm kvällens första skål-låt.",
    "Du får ge någon ett smeknamn för resten av kvällen.",
    "Du får välja vem som diskar nästa omgång glas.",
    "Dela ut en spontan high-five-runda till alla.",
    "Välj en person som måste tala som sportkommentator i 2 minuter.",
  ];

  const grandPrize =
    "UTOPISK VINST: Du blir Stygg Mus-kejsare. Du slipper all disk resten av helgen, får först tjing på bästa sovplats och alla måste skåla för dig vid nästa måltid.";

  const boardEl = document.getElementById("board");
  const markedCountEl = document.getElementById("marked-count");
  const bingoCountEl = document.getElementById("bingo-count");
  const newBoardBtn = document.getElementById("new-board-btn");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themePanel = document.getElementById("theme-panel");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayTextEl = document.getElementById("overlay-text");
  const closeOverlayBtn = document.getElementById("close-overlay-btn");
  const confettiCanvas = document.getElementById("confetti");

  const themeInputs = {
    accent: document.getElementById("accent-color"),
    bg: document.getElementById("bg-color"),
    card: document.getElementById("card-color"),
    text: document.getElementById("text-color"),
    font: document.getElementById("font-family"),
  };

  let state = loadOrCreateState();
  let audioCtx = null;
  let confettiAnimationFrame = null;

  applyTheme(loadTheme());
  renderBoard();
  updateStatsAndWinState({ triggerEffects: false });
  registerEventListeners();

  function registerEventListeners() {
    boardEl.addEventListener("click", onBoardClick);
    newBoardBtn.addEventListener("click", onNewBoard);
    themeToggleBtn.addEventListener("click", onThemeToggle);
    closeOverlayBtn.addEventListener("click", hideOverlay);

    Object.entries(themeInputs).forEach(([key, input]) => {
      input.addEventListener("input", () => {
        const nextTheme = {
          accent: themeInputs.accent.value,
          bg: themeInputs.bg.value,
          card: themeInputs.card.value,
          text: themeInputs.text.value,
          font: themeInputs.font.value,
        };
        applyTheme(nextTheme);
        saveTheme(nextTheme);
      });
    });

    window.addEventListener("resize", resizeConfettiCanvas);
  }

  function loadOrCreateState() {
    const raw = safeGet(STORAGE_KEY);
    if (!raw) return createFreshState();

    try {
      const parsed = JSON.parse(raw);
      if (!isValidState(parsed)) return createFreshState();
      return parsed;
    } catch (error) {
      return createFreshState();
    }
  }

  function createFreshState() {
    const seed = generateSeed();
    const boardItems = shuffleWithSeed(prompts, seed).slice(0, CELL_COUNT);
    return {
      id: seed,
      createdAt: new Date().toISOString(),
      board: boardItems,
      checked: [],
      bingoLinesAwarded: [],
      grandWin: false,
    };
  }

  function isValidState(candidate) {
    return (
      candidate &&
      Array.isArray(candidate.board) &&
      candidate.board.length === CELL_COUNT &&
      Array.isArray(candidate.checked) &&
      Array.isArray(candidate.bingoLinesAwarded)
    );
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function renderBoard() {
    boardEl.innerHTML = "";

    state.board.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(index);
      button.role = "gridcell";
      button.ariaLabel = label;
      button.textContent = label;
      if (state.checked.includes(index)) button.classList.add("checked");
      boardEl.appendChild(button);
    });
  }

  function onBoardClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("cell")) return;

    const index = Number(target.dataset.index);
    const checkedSet = new Set(state.checked);

    if (checkedSet.has(index)) {
      checkedSet.delete(index);
    } else {
      checkedSet.add(index);
    }

    state.checked = [...checkedSet].sort((a, b) => a - b);
    saveState();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: true });
  }

  function onNewBoard() {
    const confirmed = window.confirm(
      "Skapa en helt ny bricka? Din nuvarande markering nollställs."
    );
    if (!confirmed) return;

    state = createFreshState();
    saveState();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
  }

  function onThemeToggle() {
    themePanel.classList.toggle("hidden");
  }

  function updateStatsAndWinState({ triggerEffects }) {
    const marked = state.checked.length;
    const lines = getWinningLines(state.checked);
    const lineKeys = lines.map((line) => line.join("-"));

    markedCountEl.textContent = `${marked}/${CELL_COUNT}`;
    bingoCountEl.textContent = String(lineKeys.length);
    highlightWinningCells(lines);

    if (triggerEffects) {
      const newLines = lineKeys.filter((line) => !state.bingoLinesAwarded.includes(line));
      if (newLines.length > 0) {
        state.bingoLinesAwarded = [...state.bingoLinesAwarded, ...newLines];
        saveState();
        celebrateBingo();
      }

      if (marked === CELL_COUNT && !state.grandWin) {
        state.grandWin = true;
        saveState();
        celebrateGrandWin();
      } else if (marked < CELL_COUNT && state.grandWin) {
        state.grandWin = false;
        saveState();
      }
    }
  }

  function highlightWinningCells(lines) {
    const winningIndexes = new Set(lines.flat());
    boardEl.querySelectorAll(".cell").forEach((cell, idx) => {
      if (winningIndexes.has(idx)) {
        cell.dataset.winning = "true";
      } else {
        cell.dataset.winning = "false";
      }
    });
  }

  function getWinningLines(checked) {
    const checkedSet = new Set(checked);
    const lines = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
      const rowLine = [];
      for (let col = 0; col < BOARD_SIZE; col++) rowLine.push(row * BOARD_SIZE + col);
      if (rowLine.every((i) => checkedSet.has(i))) lines.push(rowLine);
    }

    for (let col = 0; col < BOARD_SIZE; col++) {
      const colLine = [];
      for (let row = 0; row < BOARD_SIZE; row++) colLine.push(row * BOARD_SIZE + col);
      if (colLine.every((i) => checkedSet.has(i))) lines.push(colLine);
    }

    const diagOne = [];
    const diagTwo = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      diagOne.push(i * BOARD_SIZE + i);
      diagTwo.push(i * BOARD_SIZE + (BOARD_SIZE - 1 - i));
    }
    if (diagOne.every((i) => checkedSet.has(i))) lines.push(diagOne);
    if (diagTwo.every((i) => checkedSet.has(i))) lines.push(diagTwo);

    return lines;
  }

  function celebrateBingo() {
    playWinSound(false);
    runConfetti(1800);
    showOverlay("BINGO!", randomItem(bingoPrizes));
  }

  function celebrateGrandWin() {
    playWinSound(true);
    runConfetti(3400);
    document.body.classList.add("champion");
    setTimeout(() => document.body.classList.remove("champion"), 5600);
    showOverlay("HELA BRICKAN KLAR!", grandPrize);
  }

  function showOverlay(title, text) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    overlayEl.classList.remove("hidden");
  }

  function hideOverlay() {
    overlayEl.classList.add("hidden");
  }

  function runConfetti(durationMs) {
    if (!(confettiCanvas instanceof HTMLCanvasElement)) return;
    resizeConfettiCanvas();

    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) return;

    if (confettiAnimationFrame) cancelAnimationFrame(confettiAnimationFrame);

    const colors = ["#ff8f00", "#2dba81", "#f7fbff", "#f25f5c", "#66d9ff"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * confettiCanvas.height * 0.4,
      size: 4 + Math.random() * 8,
      color: randomItem(colors),
      speedY: 2 + Math.random() * 5,
      speedX: -2 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: -0.18 + Math.random() * 0.36,
    }));

    const endAt = performance.now() + durationMs;
    animate();

    function animate() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

      pieces.forEach((piece) => {
        piece.x += piece.speedX;
        piece.y += piece.speedY;
        piece.rotation += piece.rotationSpeed;

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        ctx.restore();

        if (piece.y > confettiCanvas.height + 20) {
          piece.y = -20;
          piece.x = Math.random() * confettiCanvas.width;
        }
      });

      if (performance.now() < endAt) {
        confettiAnimationFrame = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
  }

  function resizeConfettiCanvas() {
    const ratio = window.devicePixelRatio || 1;
    confettiCanvas.width = Math.floor(window.innerWidth * ratio);
    confettiCanvas.height = Math.floor(window.innerHeight * ratio);
    confettiCanvas.style.width = `${window.innerWidth}px`;
    confettiCanvas.style.height = `${window.innerHeight}px`;
    const ctx = confettiCanvas.getContext("2d");
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function playWinSound(isGrandWin) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime + 0.02;
    const notes = isGrandWin
      ? [392, 523.25, 659.25, 783.99, 1046.5]
      : [523.25, 659.25, 783.99];

    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.18);
    });
  }

  function shuffleWithSeed(items, seedString) {
    const copy = [...items];
    const random = mulberry32(hashToNumber(seedString));
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function hashToNumber(text) {
    let hash = 1779033703 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function generateSeed() {
    if (window.crypto && "randomUUID" in window.crypto) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function loadTheme() {
    const fallback = {
      accent: "#ff8f00",
      bg: "#102a43",
      card: "#16324f",
      text: "#f7fbff",
      font: "'Trebuchet MS', 'Avenir Next', sans-serif",
    };
    const raw = safeGet(THEME_KEY);
    if (!raw) {
      syncThemeInputs(fallback);
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      const merged = { ...fallback, ...parsed };
      syncThemeInputs(merged);
      return merged;
    } catch (error) {
      syncThemeInputs(fallback);
      return fallback;
    }
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }

  function syncThemeInputs(theme) {
    themeInputs.accent.value = theme.accent;
    themeInputs.bg.value = theme.bg;
    themeInputs.card.value = theme.card;
    themeInputs.text.value = theme.text;
    themeInputs.font.value = theme.font;
  }

  function applyTheme(theme) {
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--bg", theme.bg);
    document.documentElement.style.setProperty("--card", theme.card);
    document.documentElement.style.setProperty("--text", theme.text);
    document.documentElement.style.setProperty("--font-main", theme.font);
  }
})();
