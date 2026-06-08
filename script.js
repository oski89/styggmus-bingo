(function () {
  "use strict";

  const AUTH_KEY = "styggmus-bingo-auth-v1";
  const PLAYER_KEY = "styggmus-bingo-player-v1";
  const BOARD_STORAGE_PREFIX = "styggmus-bingo-board-v2";
  const THEME_KEY = "styggmus-bingo-theme-v1";
  const PASSWORD = "AFC";
  const BOARD_SIZE = 5;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  const FREE_INDEX = Math.floor(CELL_COUNT / 2);
  const FREE_CELL_LABEL = "Stygg Mus 2026 är invigt";

  const promptGroups = [
    {
      id: "lagget",
      prompts: [
        "Lagget drar sin patenterade trumpetsnytning",
        "Lagget klagar på pollen",
        "Lagget hittar ett minimalt sår",
        "Lagget måste lämna rummet p.g.a. fislukt",
        "Lagget fryser",
        "Lagget frågar om det är laktosfritt",
      ],
    },
    {
      id: "ks",
      prompts: [
        "KS drar en Hasse & Tage-referens",
        "KS skrattar och skakar på huvudet för sig själv",
        "KS kommenterar att vi har alldeles för mycket mat",
        "KS vill sjunga en snapsvisa",
        "KS tar upp Stygg Bitch-sparandet på Avanza",
        "KS höjer rösten för att någon är trögfattad",
      ],
    },
    {
      id: "marcus",
      prompts: [
        "Marcus blir obekväm av Pers närmanden",
        "Marcus levererar pommes",
        "Marcus prisar Täby",
        "Marcus klankar ner på sossarna",
        "Marcus drar en anekdot om Ludde eller Henke",
        "Marcus blandar en ambitiös cocktail",
      ],
    },
    {
      id: "oski",
      prompts: [
        "Oski knäpper en boga",
        "Oski pratar spanska",
        "Oski nyttjar sin överrörlighet",
        "Oski drar fram resorben",
        "Oski blir övertaggad",
        "Oski drar ett pappaskämt",
      ],
    },
    {
      id: "per",
      prompts: [
        "Per släpper väder med särade skinkor",
        "Per hänger ut drulen",
        "Per har objektivt fel i en argumentation men fortsätter ändå driva sin tes",
        "Per spontanköper något på fyllan",
        "Per uttrycker sin skepsis mot AI",
        "Per requestar DDKO",
      ],
    },
  ];

  const players = [
    {
      id: "stygg-mus-president",
      label: "Stygg mus president",
      excludedGroup: "lagget",
    },
    {
      id: "mouse-trap-pukie",
      label: "Mouse trap pukie",
      excludedGroup: "ks",
    },
    {
      id: "pommesansvarig",
      label: "Pommesansvarig",
      excludedGroup: "marcus",
    },
    {
      id: "afc-master",
      label: "AFC master",
      excludedGroup: "oski",
    },
    {
      id: "prospect",
      label: "Prospect",
      excludedGroup: "per",
    },
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

  const appEl = document.getElementById("app");
  const accessScreenEl = document.getElementById("access-screen");
  const passwordForm = document.getElementById("password-form");
  const passwordInput = document.getElementById("password-input");
  const passwordFeedbackEl = document.getElementById("password-feedback");
  const playerSelectEl = document.getElementById("player-select");
  const playerButtons = document.querySelectorAll("[data-player-id]");
  const boardEl = document.getElementById("board");
  const currentPlayerEl = document.getElementById("current-player");
  const markedCountEl = document.getElementById("marked-count");
  const bingoCountEl = document.getElementById("bingo-count");
  const newBoardBtn = document.getElementById("new-board-btn");
  const changePlayerBtn = document.getElementById("change-player-btn");
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

  let state = null;
  let activePlayerId = null;
  let audioCtx = null;
  let confettiAnimationFrame = null;

  applyTheme(loadTheme());
  registerEventListeners();
  renderAccessFlow();

  function registerEventListeners() {
    passwordForm.addEventListener("submit", onPasswordSubmit);

    playerButtons.forEach((button) => {
      button.addEventListener("click", () => {
        onChoosePlayer(button.dataset.playerId);
      });
    });

    boardEl.addEventListener("click", onBoardClick);
    newBoardBtn.addEventListener("click", onNewBoard);
    changePlayerBtn.addEventListener("click", showPlayerGate);
    themeToggleBtn.addEventListener("click", onThemeToggle);
    closeOverlayBtn.addEventListener("click", hideOverlay);

    Object.values(themeInputs).forEach((input) => {
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

  function renderAccessFlow() {
    if (!isAuthenticated()) {
      showPasswordGate();
      return;
    }

    const savedPlayerId = safeGet(PLAYER_KEY);
    if (!isValidPlayerId(savedPlayerId)) {
      showPlayerGate();
      return;
    }

    startGame(savedPlayerId);
  }

  function showPasswordGate() {
    appEl.classList.add("hidden");
    accessScreenEl.classList.remove("hidden");
    passwordForm.classList.remove("hidden");
    playerSelectEl.classList.add("hidden");
    passwordFeedbackEl.textContent = "";
    window.setTimeout(() => passwordInput.focus(), 0);
  }

  function showPlayerGate() {
    appEl.classList.add("hidden");
    accessScreenEl.classList.remove("hidden");
    passwordForm.classList.add("hidden");
    playerSelectEl.classList.remove("hidden");
    passwordFeedbackEl.textContent = "";
  }

  function onPasswordSubmit(event) {
    event.preventDefault();

    if (passwordInput.value.trim().toUpperCase() !== PASSWORD) {
      passwordFeedbackEl.textContent = "Fel lösenord. Testa igen.";
      passwordInput.select();
      return;
    }

    safeSetSession(AUTH_KEY, "true");
    showPlayerGate();
  }

  function onChoosePlayer(playerId) {
    if (!isValidPlayerId(playerId)) return;
    safeSet(PLAYER_KEY, playerId);
    startGame(playerId);
  }

  function startGame(playerId) {
    activePlayerId = playerId;
    state = loadOrCreateState(playerId);
    accessScreenEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    currentPlayerEl.textContent = getPlayer(playerId).label;
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
  }

  function isAuthenticated() {
    return safeGetSession(AUTH_KEY) === "true";
  }

  function loadOrCreateState(playerId) {
    const raw = safeGet(getBoardStorageKey(playerId));
    if (!raw) return createFreshState(playerId);

    try {
      const parsed = JSON.parse(raw);
      if (!isValidState(parsed, playerId)) return createFreshState(playerId);
      return normalizeState(parsed, playerId);
    } catch (error) {
      return createFreshState(playerId);
    }
  }

  function createFreshState(playerId) {
    const seed = generateSeed();
    const boardItems = shuffleWithSeed(getAvailablePrompts(playerId), `${seed}-${playerId}`).slice(
      0,
      CELL_COUNT - 1
    );
    const board = [];

    for (let index = 0; index < CELL_COUNT; index++) {
      board.push(index === FREE_INDEX ? FREE_CELL_LABEL : boardItems.shift());
    }

    return {
      id: seed,
      playerId,
      createdAt: new Date().toISOString(),
      board,
      checked: [FREE_INDEX],
      bingoLinesAwarded: [],
      grandWin: false,
    };
  }

  function isValidState(candidate, playerId) {
    if (
      !candidate ||
      candidate.playerId !== playerId ||
      !Array.isArray(candidate.board) ||
      candidate.board.length !== CELL_COUNT ||
      candidate.board[FREE_INDEX] !== FREE_CELL_LABEL ||
      !Array.isArray(candidate.checked) ||
      !Array.isArray(candidate.bingoLinesAwarded)
    ) {
      return false;
    }

    const forbiddenPrompts = new Set(getExcludedPrompts(playerId));
    return candidate.board.every((label) => typeof label === "string" && !forbiddenPrompts.has(label));
  }

  function normalizeState(candidate, playerId) {
    const checked = new Set(
      candidate.checked.filter((index) => Number.isInteger(index) && index >= 0 && index < CELL_COUNT)
    );
    checked.add(FREE_INDEX);

    return {
      ...candidate,
      playerId,
      checked: [...checked].sort((a, b) => a - b),
    };
  }

  function saveState() {
    if (!state) return;
    safeSet(getBoardStorageKey(state.playerId), JSON.stringify(state));
  }

  function renderBoard() {
    if (!state) return;
    boardEl.innerHTML = "";

    state.board.forEach((label, index) => {
      const button = document.createElement("button");
      const isChecked = state.checked.includes(index);

      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(index);
      button.role = "gridcell";
      button.ariaLabel = index === FREE_INDEX ? `${label}, förmarkerad` : label;
      button.ariaPressed = isChecked ? "true" : "false";
      button.textContent = label;

      if (isChecked) button.classList.add("checked");
      if (index === FREE_INDEX) {
        button.classList.add("free-cell");
        button.disabled = true;
      }

      boardEl.appendChild(button);
    });
  }

  function onBoardClick(event) {
    if (!state) return;

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("cell")) return;

    const index = Number(target.dataset.index);
    if (index === FREE_INDEX) return;

    const checkedSet = new Set(state.checked);

    if (checkedSet.has(index)) {
      checkedSet.delete(index);
    } else {
      checkedSet.add(index);
    }

    checkedSet.add(FREE_INDEX);
    state.checked = [...checkedSet].sort((a, b) => a - b);
    saveState();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: true });
  }

  function onNewBoard() {
    if (!activePlayerId) return;

    const confirmed = window.confirm(
      "Skapa en helt ny bricka? Din nuvarande markering nollställs."
    );
    if (!confirmed) return;

    state = createFreshState(activePlayerId);
    saveState();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
  }

  function onThemeToggle() {
    themePanel.classList.toggle("hidden");
  }

  function getAvailablePrompts(playerId) {
    const player = getPlayer(playerId);
    return promptGroups
      .filter((group) => group.id !== player.excludedGroup)
      .flatMap((group) => group.prompts);
  }

  function getExcludedPrompts(playerId) {
    const player = getPlayer(playerId);
    const group = promptGroups.find((item) => item.id === player.excludedGroup);
    return group ? group.prompts : [];
  }

  function getPlayer(playerId) {
    return players.find((player) => player.id === playerId);
  }

  function isValidPlayerId(playerId) {
    return players.some((player) => player.id === playerId);
  }

  function getBoardStorageKey(playerId) {
    return `${BOARD_STORAGE_PREFIX}:${playerId}`;
  }

  function updateStatsAndWinState({ triggerEffects }) {
    if (!state) return;

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

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  function safeGetSession(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSetSession(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      return;
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
    safeSet(THEME_KEY, JSON.stringify(theme));
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
