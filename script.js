(function () {
  "use strict";

  const AUTH_KEY = "styggmus-bingo-auth-v1";
  const PLAYER_KEY = "styggmus-bingo-player-v1";
  const BOARD_STORAGE_PREFIX = "styggmus-bingo-board-v2";
  const SCORES_KEY = "styggmus-bingo-scores-v1";
  const PASSWORD = "AFC";
  const BOARD_SIZE = 5;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  const FREE_INDEX = Math.floor(CELL_COUNT / 2);
  const FREE_CELL_LABEL = "Stygg Mus 2026 är invigt";
  const KONAMI_SEQUENCE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];

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
    "Du får utse kvällens officiella pommesinspektör. Personen måste leverera en seriös recension av nästa laddning.",
    "Välj en person som måste hålla ett högtidligt tal till Stygg Mus innan nästa skål.",
    "Du får dela ut en obligatorisk resorb-ceremoni till valfri deltagare.",
    "Välj någon som måste argumentera mot AI i 60 sekunder, oavsett egen åsikt.",
    "Du får bestämma nästa låt, men den måste presenteras som om du vore festivalgeneral.",
    "Välj en person som måste säga 'det där är faktiskt laktosfritt' vid nästa dryckesbeställning.",
    "Du får införa en tillfällig regel som gäller tills nästa ruta kryssas.",
    "Välj någon som måste ge en alldeles för seriös taktisk genomgång av nästa lek.",
    "Du får begära en hedersskål för Täby, pommes eller Stygg Bitch-sparandet.",
    "Välj en person som måste leverera kvällens sämsta pappaskämt innan spelet fortsätter.",
  ];

  const grandPrize =
    "UTOPISK VINST: Du blir Stygg Mus-kejsare 2026. Du får först tjing på bästa sovplats, slipper nästa tråkiga syssla och alla måste skåla för din historiskt välkryssade bricka.";

  // ── DOM-refs ──────────────────────────────────────────────────────────────

  const appEl = document.getElementById("app");
  const accessScreenEl = document.getElementById("access-screen");
  const passwordForm = document.getElementById("password-form");
  const passwordInput = document.getElementById("password-input");
  const passwordFeedbackEl = document.getElementById("password-feedback");
  const playerSelectEl = document.getElementById("player-select");
  const playerButtons = document.querySelectorAll("[data-player-id]");
  const resetAllBtn = document.getElementById("reset-all-btn");
  const gameTitleEl = document.getElementById("game-title");
  const boardEl = document.getElementById("board");
  const currentPlayerEl = document.getElementById("current-player");
  const markedCountEl = document.getElementById("marked-count");
  const bingoCountEl = document.getElementById("bingo-count");
  const newBoardBtn = document.getElementById("new-board-btn");
  const resetBoardBtn = document.getElementById("reset-board-btn");
  const changePlayerBtn = document.getElementById("change-player-btn");
  const scoreboardBtn = document.getElementById("scoreboard-btn");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayTextEl = document.getElementById("overlay-text");
  const closeOverlayBtn = document.getElementById("close-overlay-btn");
  const scoreboardOverlayEl = document.getElementById("scoreboard-overlay");
  const scoreboardBodyEl = document.getElementById("scoreboard-body");
  const closeScoreboardBtn = document.getElementById("close-scoreboard-btn");
  const resetScoresBtn = document.getElementById("reset-scores-btn");
  const confettiCanvas = document.getElementById("confetti");

  let state = null;
  let activePlayerId = null;
  let audioCtx = null;
  let confettiAnimationFrame = null;
  let titleClickCount = 0;
  let titleClickTimer = null;
  let konamiIndex = 0;
  let typedBuffer = "";

  registerEventListeners();
  renderAccessFlow();

  // ── Event listeners ───────────────────────────────────────────────────────

  function registerEventListeners() {
    passwordForm.addEventListener("submit", onPasswordSubmit);

    playerButtons.forEach((button) => {
      button.addEventListener("click", () => {
        onChoosePlayer(button.dataset.playerId);
      });
    });

    boardEl.addEventListener("click", onBoardClick);
    newBoardBtn.addEventListener("click", onNewBoard);
    resetBoardBtn.addEventListener("click", onResetBoard);
    changePlayerBtn.addEventListener("click", showPlayerGate);
    resetAllBtn.addEventListener("click", onResetAll);
    scoreboardBtn.addEventListener("click", showScoreboard);
    closeScoreboardBtn.addEventListener("click", hideScoreboard);
    gameTitleEl.addEventListener("click", onGameTitleClick);
    closeOverlayBtn.addEventListener("click", hideOverlay);
    resetScoresBtn.addEventListener("click", onResetScores);

    scoreboardOverlayEl.addEventListener("click", (e) => {
      if (e.target === scoreboardOverlayEl) hideScoreboard();
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", resizeConfettiCanvas);
  }

  // ── Access flow ───────────────────────────────────────────────────────────

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

  function onResetAll() {
    const confirmed = window.confirm(
      "Nollställa alla sparade brickor, markeringar, poäng och spelarval?"
    );
    if (!confirmed) return;

    clearSavedBoards();
    safeRemove(PLAYER_KEY);
    safeRemove(SCORES_KEY);
    safeRemove("styggmus-bingo-theme-v1");
    safeRemoveSession(AUTH_KEY);
    state = null;
    activePlayerId = null;
    passwordInput.value = "";
    markedCountEl.textContent = `0/${CELL_COUNT}`;
    bingoCountEl.textContent = "0";
    currentPlayerEl.textContent = "-";
    boardEl.innerHTML = "";
    showPasswordGate();
  }

  function isAuthenticated() {
    return safeGetSession(AUTH_KEY) === "true";
  }

  // ── State ─────────────────────────────────────────────────────────────────

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

  // ── Scoreboard state ──────────────────────────────────────────────────────

  function loadScores() {
    try {
      const raw = safeGet(SCORES_KEY);
      if (!raw) return createEmptyScores();
      const parsed = JSON.parse(raw);
      return isValidScores(parsed) ? parsed : createEmptyScores();
    } catch {
      return createEmptyScores();
    }
  }

  function createEmptyScores() {
    const scores = {};
    players.forEach((p) => {
      scores[p.id] = { bingoLines: 0, grandWins: 0, lastBingoAt: null };
    });
    return scores;
  }

  function isValidScores(candidate) {
    return candidate && typeof candidate === "object" && !Array.isArray(candidate);
  }

  function saveScores(scores) {
    safeSet(SCORES_KEY, JSON.stringify(scores));
  }

  function recordBingoLines(playerId, newLinesCount) {
    const scores = loadScores();
    if (!scores[playerId]) {
      scores[playerId] = { bingoLines: 0, grandWins: 0, lastBingoAt: null };
    }
    scores[playerId].bingoLines += newLinesCount;
    scores[playerId].lastBingoAt = new Date().toISOString();
    saveScores(scores);
  }

  function recordGrandWin(playerId) {
    const scores = loadScores();
    if (!scores[playerId]) {
      scores[playerId] = { bingoLines: 0, grandWins: 0, lastBingoAt: null };
    }
    scores[playerId].grandWins += 1;
    scores[playerId].lastBingoAt = new Date().toISOString();
    saveScores(scores);
  }

  function onResetScores() {
    const confirmed = window.confirm(
      "Nollställa poängtavlan för alla spelare? Brickorna påverkas inte."
    );
    if (!confirmed) return;
    saveScores(createEmptyScores());
    renderScoreboardBody();
  }

  // ── Scoreboard UI ─────────────────────────────────────────────────────────

  function getCheckedCountForPlayer(playerId) {
    try {
      const raw = safeGet(getBoardStorageKey(playerId));
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.checked)) return 0;
      return parsed.checked.length;
    } catch {
      return 0;
    }
  }

  function showScoreboard() {
    renderScoreboardBody();
    scoreboardOverlayEl.classList.remove("hidden");
  }

  function hideScoreboard() {
    scoreboardOverlayEl.classList.add("hidden");
  }

  function renderScoreboardBody() {
    const scores = loadScores();

    const ranked = players
      .map((p) => {
        const checkedCount = getCheckedCountForPlayer(p.id);
        return {
          player: p,
          bingoLines: scores[p.id]?.bingoLines ?? 0,
          grandWins: scores[p.id]?.grandWins ?? 0,
          lastBingoAt: scores[p.id]?.lastBingoAt ?? null,
          checkedCount,
        };
      })
      .sort((a, b) => {
        if (b.grandWins !== a.grandWins) return b.grandWins - a.grandWins;
        return b.bingoLines - a.bingoLines;
      });

    const medals = ["🥇", "🥈", "🥉"];
    const hasAnyScore = ranked.some((r) => r.bingoLines > 0 || r.grandWins > 0);

    scoreboardBodyEl.innerHTML = "";

    ranked.forEach((entry, index) => {
      const isCurrentPlayer = entry.player.id === activePlayerId;
      const rank = index + 1;
      const medalOrRank = medals[index] ?? `${rank}.`;

      const row = document.createElement("div");
      row.className = "scoreboard-row" + (isCurrentPlayer ? " scoreboard-row--active" : "");

      const rankEl = document.createElement("span");
      rankEl.className = "scoreboard-rank";
      rankEl.textContent = hasAnyScore ? medalOrRank : `${rank}.`;

      const nameEl = document.createElement("span");
      nameEl.className = "scoreboard-name";
      nameEl.textContent = entry.player.label;
      if (isCurrentPlayer) {
        const youBadge = document.createElement("span");
        youBadge.className = "scoreboard-you";
        youBadge.textContent = "du";
        nameEl.appendChild(youBadge);
      }

      const statsEl = document.createElement("span");
      statsEl.className = "scoreboard-stats";

      const checkedStat = document.createElement("span");
      checkedStat.className = "scoreboard-stat";
      checkedStat.innerHTML = `<span class="scoreboard-stat-value scoreboard-stat-value--checked">${entry.checkedCount}<span class="scoreboard-stat-denom">/${CELL_COUNT}</span></span><span class="scoreboard-stat-label">fält</span>`;

      const linesStat = document.createElement("span");
      linesStat.className = "scoreboard-stat";
      linesStat.innerHTML = `<span class="scoreboard-stat-value">${entry.bingoLines}</span><span class="scoreboard-stat-label">bingo</span>`;

      const grandStat = document.createElement("span");
      grandStat.className = "scoreboard-stat";
      grandStat.innerHTML = `<span class="scoreboard-stat-value scoreboard-stat-value--grand">${entry.grandWins}</span><span class="scoreboard-stat-label">full bricka</span>`;

      statsEl.appendChild(checkedStat);
      statsEl.appendChild(linesStat);
      statsEl.appendChild(grandStat);

      row.appendChild(rankEl);
      row.appendChild(nameEl);
      row.appendChild(statsEl);
      scoreboardBodyEl.appendChild(row);
    });
  }

  // ── Board ─────────────────────────────────────────────────────────────────

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

  function onResetBoard() {
    if (!state) return;

    const confirmed = window.confirm(
      "Nollställa markeringarna på den här brickan? Rutorna ligger kvar."
    );
    if (!confirmed) return;

    state.checked = [FREE_INDEX];
    state.bingoLinesAwarded = [];
    state.grandWin = false;
    saveState();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
  }

  // ── Player helpers ────────────────────────────────────────────────────────

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

  // ── Easter eggs ───────────────────────────────────────────────────────────

  function onGameTitleClick() {
    titleClickCount += 1;
    window.clearTimeout(titleClickTimer);

    if (titleClickCount >= 5) {
      titleClickCount = 0;
      triggerEasterEgg(
        "STYGG MODE",
        "Titeln har talat. Alla måste skåla med fel hand tills nästa ruta kryssas.",
        "stygg-mode"
      );
      return;
    }

    titleClickTimer = window.setTimeout(() => {
      titleClickCount = 0;
    }, 1400);
  }

  function onKeyDown(event) {
    if (isTextInputTarget(event.target)) return;

    handleKonamiKey(event.key);
    handleTypedEasterEgg(event.key);
  }

  function handleKonamiKey(rawKey) {
    const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
    const expectedKey = KONAMI_SEQUENCE[konamiIndex];

    if (key === expectedKey) {
      konamiIndex += 1;
      if (konamiIndex === KONAMI_SEQUENCE.length) {
        konamiIndex = 0;
        triggerEasterEgg(
          "KONAMI-KUBB!",
          "Hemlig taktik upplåst: välj någon som måste coacha nästa aktivitet som en VM-final.",
          "konami-mode"
        );
      }
      return;
    }

    konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0;
  }

  function handleTypedEasterEgg(rawKey) {
    if (rawKey.length !== 1 || !/^[a-zåäö]$/i.test(rawKey)) return;

    typedBuffer = `${typedBuffer}${rawKey.toUpperCase()}`.slice(-8);
    if (typedBuffer.includes("DDKO")) {
      typedBuffer = "";
      triggerEasterEgg(
        "DDKO REQUESTAD",
        "Requesten är mottagen. Nästa låt måste presenteras med orimligt mycket självförtroende.",
        "ddko-mode"
      );
    }
  }

  function triggerEasterEgg(title, text, className) {
    document.body.classList.add(className);
    window.setTimeout(() => document.body.classList.remove(className), 5200);
    playWinSound(false);
    runConfetti(2200);
    showOverlay(title, text);
  }

  function isTextInputTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
  }

  // ── Win detection ─────────────────────────────────────────────────────────

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
        recordBingoLines(state.playerId, newLines.length);
        celebrateBingo();
      }

      if (marked === CELL_COUNT && !state.grandWin) {
        state.grandWin = true;
        saveState();
        recordGrandWin(state.playerId);
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

  // ── Celebrations ──────────────────────────────────────────────────────────

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

  // ── Confetti ──────────────────────────────────────────────────────────────

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

  // ── Audio ─────────────────────────────────────────────────────────────────

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

  // ── Utilities ─────────────────────────────────────────────────────────────

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

  // ── Storage ───────────────────────────────────────────────────────────────

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

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }

  function clearSavedBoards() {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`${BOARD_STORAGE_PREFIX}:`)) localStorage.removeItem(key);
      });
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

  function safeRemoveSession(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }
})();
