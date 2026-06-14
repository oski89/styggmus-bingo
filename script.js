(function () {
  "use strict";

  const AUTH_KEY = "styggmus-bingo-auth-v1";
  const MODE_KEY = "styggmus-bingo-mode-v1";
  const PLAYER_KEY = "styggmus-bingo-player-v1";
  const BOARD_STORAGE_PREFIX = "styggmus-bingo-board-v2";
  const SCORES_KEY = "styggmus-bingo-scores-v1";
  const BEERS_KEY = "styggmus-bingo-beers-v1";
  const MODE_LIVE = "live";
  const MODE_DEMO = "demo";
  const VALID_MODES = [MODE_LIVE, MODE_DEMO];
  const PASSWORDS = {
    AFC: MODE_LIVE,
    GRINDER: MODE_DEMO,
  };
  const BOARD_SIZE = 5;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  const FREE_INDEX = Math.floor(CELL_COUNT / 2);
  const FREE_CELL_LABEL = "Stygg Mus 2026 är invigt";
  // Fyllekollen (the "drunk check" mini-game): a swipe maze that pops up every
  // FYLLEKOLLEN_TRIGGER beers added on the beer counter.
  const FYLLEKOLLEN_TRIGGER = 5;
  const MAZE_COLS = 7;
  const MAZE_ROWS = 9;
  const MAZE_SWIPE_THRESHOLD = 18;
  // Reaktionskollen (reaction test): pops up every REAKTION_TRIGGER beers added.
  // Reaction time (ms) maps to a "how drunk are you" verdict in three tiers.
  const REAKTION_TRIGGER = 2;
  const REAKTION_GREEN_MAX = 350; // < this → "Nykter"
  const REAKTION_YELLOW_MAX = 550; // <= this → "Salongsberusad"; above → "Full som ett ägg"
  // Minnesluckatestet (memory / flash-count test): flashes X 🍺 + Y 🐭 for a blink,
  // then the player dials in the counts. Fires on beers where (total % MINNE_PERIOD
  // === MINNE_OFFSET), i.e. 3, 13, 23 … — always odd and never a multiple of 5, so
  // it can never land on a Reaktionskollen (every 2) or Fyllekollen (every 5) beer.
  const MINNE_PERIOD = 10;
  const MINNE_OFFSET = 3;
  const MINNE_FLASH_MS = 100;
  const MINNE_MIN = 1;
  const MINNE_MAX = 10;
  const MINNE_WHEEL_ITEM_H = 40; // px per wheel row; matches .memory-wheel-opt height
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
      label: "🐭 Stygg mus president",
      excludedGroup: "lagget",
    },
    {
      id: "mouse-trap-pukie",
      label: "🤮 Mouse trap pukie",
      excludedGroup: "ks",
    },
    {
      id: "pommesansvarig",
      label: "👨🏿 Pommesansvarig",
      excludedGroup: "marcus",
    },
    {
      id: "afc-master",
      label: "⚽ AFC master",
      excludedGroup: "oski",
    },
    {
      id: "prospect",
      label: "🌱 Prospect",
      excludedGroup: "per",
    },
  ];

  const demoPromptGroups = [
    {
      id: "lagget",
      prompts: [
        "Lorem ipsum dolor sit amet",
        "Consectetur adipiscing elit",
        "Sed do eiusmod tempor incididunt",
        "Ut labore et dolore magna",
        "Aliqua ut enim ad minim",
        "Veniam quis nostrud exercitation",
      ],
    },
    {
      id: "ks",
      prompts: [
        "Ullamco laboris nisi ut aliquip",
        "Ex ea commodo consequat",
        "Duis aute irure dolor",
        "Reprehenderit in voluptate velit",
        "Esse cillum dolore eu fugiat",
        "Nulla pariatur excepteur sint",
      ],
    },
    {
      id: "marcus",
      prompts: [
        "Occaecat cupidatat non proident",
        "Sunt in culpa qui officia",
        "Deserunt mollit anim id est",
        "Laborum sed ut perspiciatis",
        "Unde omnis iste natus error",
        "Sit voluptatem accusantium doloremque",
      ],
    },
    {
      id: "oski",
      prompts: [
        "Laudantium totam rem aperiam",
        "Eaque ipsa quae ab illo",
        "Inventore veritatis et quasi",
        "Architecto beatae vitae dicta sunt",
        "Explicabo nemo enim ipsam",
        "Voluptatem quia voluptas sit",
      ],
    },
    {
      id: "per",
      prompts: [
        "Aspernatur aut odit aut fugit",
        "Sed quia consequuntur magni",
        "Dolores eos qui ratione",
        "Voluptatem sequi nesciunt",
        "Neque porro quisquam est qui",
        "Dolorem ipsum quia dolor",
      ],
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

  const demoBingoPrizes = [
    "Demo-pris 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Demo-pris 2: Sed do eiusmod tempor incididunt ut labore et dolore magna.",
    "Demo-pris 3: Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
    "Demo-pris 4: Duis aute irure dolor in reprehenderit in voluptate velit.",
    "Demo-pris 5: Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
    "Demo-pris 6: Sed ut perspiciatis unde omnis iste natus error sit voluptatem.",
    "Demo-pris 7: Nemo enim ipsam voluptatem quia voluptas sit aspernatur.",
    "Demo-pris 8: Neque porro quisquam est qui dolorem ipsum quia dolor sit.",
    "Demo-pris 9: At vero eos et accusamus et iusto odio dignissimos ducimus.",
    "Demo-pris 10: Et harum quidem rerum facilis est et expedita distinctio.",
  ];

  const demoGrandPrize =
    "DEMO GRAND-PRIS: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Du har testat hela brickan i beta-läget.";

  // ── DOM-refs ──────────────────────────────────────────────────────────────

  const appEl = document.getElementById("app");
  const accessScreenEl = document.getElementById("access-screen");
  const dashboardEl = document.getElementById("dashboard");
  const beerAppEl = document.getElementById("beer-app");

  const passwordForm = document.getElementById("password-form");
  const passwordInput = document.getElementById("password-input");
  const passwordFeedbackEl = document.getElementById("password-feedback");
  const playerSelectEl = document.getElementById("player-select");
  const playerButtons = document.querySelectorAll("[data-player-id]");
  const resetAllBtn = document.getElementById("reset-all-btn");
  const exitButtons = document.querySelectorAll(".exit-btn");

  const dashboardPlayerNameEl = document.getElementById("dashboard-player-name");
  const dashboardChangePlayerBtn = document.getElementById("dashboard-change-player-btn");
  const bingoTileBtn = document.getElementById("bingo-tile");
  const beerTileBtn = document.getElementById("beer-tile");
  const dashboardScoreboardBtn = document.getElementById("dashboard-scoreboard-btn");

  const gameTitleEl = document.getElementById("game-title");
  const boardEl = document.getElementById("board");
  const currentPlayerEl = document.getElementById("current-player");
  const markedCountEl = document.getElementById("marked-count");
  const bingoCountEl = document.getElementById("bingo-count");
  const newBoardBtn = document.getElementById("new-board-btn");
  const resetBoardBtn = document.getElementById("reset-board-btn");
  const changePlayerBtn = document.getElementById("change-player-btn");
  const scoreboardBtn = document.getElementById("scoreboard-btn");

  const beerBackBtn = document.getElementById("beer-back-btn");
  const beerScoreboardBtn = document.getElementById("beer-scoreboard-btn");
  const beerMinusBtn = document.getElementById("beer-minus-btn");
  const beerPlusBtn = document.getElementById("beer-plus-btn");
  const beerCountDisplay = document.getElementById("beer-count-display");
  const beerPlayerLabelEl = document.getElementById("beer-player-label");
  const beerLeaderboardBodyEl = document.getElementById("beer-leaderboard-body");

  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayTextEl = document.getElementById("overlay-text");
  const closeOverlayBtn = document.getElementById("close-overlay-btn");
  const scoreboardOverlayEl = document.getElementById("scoreboard-overlay");
  const scoreboardBodyEl = document.getElementById("scoreboard-body");
  const closeScoreboardBtn = document.getElementById("close-scoreboard-btn");
  const confirmOverlayEl = document.getElementById("confirm-overlay");
  const confirmTitleEl = document.getElementById("confirm-title");
  const confirmTextEl = document.getElementById("confirm-text");
  const confirmAcceptBtn = document.getElementById("confirm-accept-btn");
  const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
  const confettiCanvas = document.getElementById("confetti");
  const fyllekollenOverlayEl = document.getElementById("fyllekollen-overlay");
  const mazeCanvas = document.getElementById("maze-canvas");
  const mazeRestartBtn = document.getElementById("maze-restart-btn");
  const fyllekollenCloseBtn = document.getElementById("fyllekollen-close-btn");

  const reaktionOverlayEl = document.getElementById("reaktion-overlay");
  const reaktionInstructionEl = document.getElementById("reaktion-instruction");
  const reaktionStageEl = document.getElementById("reaktion-stage");
  const reaktionCountdownEl = document.getElementById("reaktion-countdown");
  const reaktionTargetEl = document.getElementById("reaktion-target");
  const reaktionResultEl = document.getElementById("reaktion-result");
  const reaktionRetryBtn = document.getElementById("reaktion-retry-btn");
  const reaktionCloseBtn = document.getElementById("reaktion-close-btn");

  const memoryOverlayEl = document.getElementById("memory-overlay");
  const memoryInstructionEl = document.getElementById("memory-instruction");
  const memoryStageEl = document.getElementById("memory-stage");
  const memoryCountdownEl = document.getElementById("memory-countdown");
  const memoryFlashEl = document.getElementById("memory-flash");
  const memoryAnswerEl = document.getElementById("memory-answer");
  const memoryWheelBeerEl = document.getElementById("memory-wheel-beer");
  const memoryWheelMouseEl = document.getElementById("memory-wheel-mouse");
  const memorySubmitBtn = document.getElementById("memory-submit-btn");
  const memoryResultEl = document.getElementById("memory-result");
  const memoryRetryBtn = document.getElementById("memory-retry-btn");
  const memoryCloseBtn = document.getElementById("memory-close-btn");

  let state = null;
  let activePlayerId = null;
  let currentMode = null;
  let activeDialog = null;
  let dialogReturnFocus = null;
  let pendingConfirmAction = null;
  let audioCtx = null;
  let confettiAnimationFrame = null;
  let titleClickCount = 0;
  let titleClickTimer = null;
  let konamiIndex = 0;
  let typedBuffer = "";
  let beerPressCount = 0;
  let mazeState = null;
  let mazePointerStart = null;
  let reaktionPressCount = 0;
  let reaktionPhase = "idle";
  let reaktionShownAt = 0;
  let reaktionCountdownTimer = null;
  let reaktionAppearTimer = null;
  let beerAddedTotal = 0;
  let memoryPhase = "idle";
  let memoryAnswer = { beer: 0, mouse: 0 };
  let memoryCountdownTimer = null;
  let memoryFlashTimer = null;

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

    resetAllBtn.addEventListener("click", onBackFromPlayerSelect);
    exitButtons.forEach((button) => button.addEventListener("click", onExit));

    dashboardChangePlayerBtn.addEventListener("click", showPlayerGate);
    dashboardScoreboardBtn.addEventListener("click", showScoreboard);
    bingoTileBtn.addEventListener("click", startBingoGame);
    beerTileBtn.addEventListener("click", showBeerApp);

    boardEl.addEventListener("click", onBoardClick);
    newBoardBtn.addEventListener("click", onNewBoard);
    resetBoardBtn.addEventListener("click", onResetBoard);
    changePlayerBtn.addEventListener("click", showDashboard);
    scoreboardBtn.addEventListener("click", showScoreboard);
    gameTitleEl.addEventListener("click", onGameTitleClick);

    beerBackBtn.addEventListener("click", showDashboard);
    beerScoreboardBtn.addEventListener("click", showScoreboard);
    beerMinusBtn.addEventListener("click", () => adjustBeerForPlayer(activePlayerId, -1));
    beerPlusBtn.addEventListener("click", () => adjustBeerForPlayer(activePlayerId, 1));

    closeOverlayBtn.addEventListener("click", hideOverlay);
    closeScoreboardBtn.addEventListener("click", hideScoreboard);

    scoreboardOverlayEl.addEventListener("click", (e) => {
      if (e.target === scoreboardOverlayEl) hideScoreboard();
    });

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) hideOverlay();
    });

    confirmAcceptBtn.addEventListener("click", onConfirmAccept);
    confirmCancelBtn.addEventListener("click", () => closeDialog(confirmOverlayEl));
    confirmOverlayEl.addEventListener("click", (e) => {
      if (e.target === confirmOverlayEl) closeDialog(confirmOverlayEl);
    });

    mazeRestartBtn.addEventListener("click", buildNewMaze);
    fyllekollenCloseBtn.addEventListener("click", () => closeDialog(fyllekollenOverlayEl));
    fyllekollenOverlayEl.addEventListener("click", (e) => {
      if (e.target === fyllekollenOverlayEl) closeDialog(fyllekollenOverlayEl);
    });
    mazeCanvas.addEventListener("pointerdown", onMazePointerDown);
    mazeCanvas.addEventListener("pointerup", onMazePointerUp);

    reaktionStageEl.addEventListener("pointerdown", onReaktionTap);
    reaktionRetryBtn.addEventListener("click", startReaktionRound);
    reaktionCloseBtn.addEventListener("click", () => closeDialog(reaktionOverlayEl));
    reaktionOverlayEl.addEventListener("click", (e) => {
      if (e.target === reaktionOverlayEl) closeDialog(reaktionOverlayEl);
    });

    memorySubmitBtn.addEventListener("click", submitMemoryAnswer);
    memoryRetryBtn.addEventListener("click", startMemoryRound);
    memoryCloseBtn.addEventListener("click", () => closeDialog(memoryOverlayEl));
    memoryOverlayEl.addEventListener("click", (e) => {
      if (e.target === memoryOverlayEl) closeDialog(memoryOverlayEl);
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", resizeConfettiCanvas);
    window.addEventListener("resize", () => {
      if (mazeState && activeDialog === fyllekollenOverlayEl) drawMaze();
    });
  }

  // ── Access flow ───────────────────────────────────────────────────────────

  function renderAccessFlow() {
    if (!isAuthenticated()) {
      currentMode = null;
      applyModeToUI();
      showPasswordGate();
      return;
    }

    currentMode = safeGetSession(MODE_KEY);
    applyModeToUI();

    const savedPlayerId = safeGet(getPlayerKey());
    if (!isValidPlayerId(savedPlayerId)) {
      showPlayerGate();
      return;
    }

    activePlayerId = savedPlayerId;
    showDashboard();
  }

  function showPasswordGate() {
    hideAllScreens();
    accessScreenEl.classList.remove("hidden");
    passwordForm.classList.remove("hidden");
    playerSelectEl.classList.add("hidden");
    passwordFeedbackEl.textContent = "";
    window.setTimeout(() => passwordInput.focus(), 0);
  }

  function showPlayerGate() {
    hideAllScreens();
    accessScreenEl.classList.remove("hidden");
    passwordForm.classList.add("hidden");
    playerSelectEl.classList.remove("hidden");
    passwordFeedbackEl.textContent = "";
  }

  function showDashboard() {
    hideAllScreens();
    dashboardEl.classList.remove("hidden");
    const player = getPlayer(activePlayerId);
    dashboardPlayerNameEl.textContent = player ? player.label : "-";
  }

  function hideAllScreens() {
    accessScreenEl.classList.add("hidden");
    dashboardEl.classList.add("hidden");
    appEl.classList.add("hidden");
    beerAppEl.classList.add("hidden");
  }

  function onPasswordSubmit(event) {
    event.preventDefault();

    const entered = passwordInput.value.trim().toUpperCase();
    const mode = PASSWORDS[entered];

    if (!mode) {
      passwordFeedbackEl.textContent = "Fel lösenord. Testa igen.";
      passwordInput.select();
      return;
    }

    currentMode = mode;
    safeSetSession(AUTH_KEY, "true");
    safeSetSession(MODE_KEY, mode);
    applyModeToUI();
    showPlayerGate();
  }

  function onChoosePlayer(playerId) {
    if (!isValidPlayerId(playerId)) return;
    activePlayerId = playerId;
    safeSet(getPlayerKey(), playerId);
    showDashboard();
  }

  function startBingoGame() {
    if (!activePlayerId) return;
    state = loadOrCreateState(activePlayerId);
    hideAllScreens();
    appEl.classList.remove("hidden");
    currentPlayerEl.textContent = getPlayer(activePlayerId).label;
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
  }

  function showBeerApp() {
    if (!activePlayerId) return;
    hideAllScreens();
    beerAppEl.classList.remove("hidden");
    const player = getPlayer(activePlayerId);
    beerPlayerLabelEl.textContent = player ? player.label : "-";
    renderBeerCounter();
    renderBeerLeaderboard();
  }

  function onBackFromPlayerSelect() {
    // Back to the dashboard if a player is already chosen, otherwise to the
    // password gate (the player-select screen is the first stop on fresh login).
    if (isValidPlayerId(activePlayerId)) {
      showDashboard();
    } else {
      showPasswordGate();
    }
  }

  // Ends the session and returns to the password gate. Saved boards, scores, and
  // beers stay in localStorage — only the session auth is cleared.
  function onExit() {
    showConfirm({
      title: "Avsluta?",
      message: "Avsluta och återgå till lösenordsskärmen?",
      confirmLabel: "Avsluta",
      onConfirm: () => {
        safeRemoveSession(AUTH_KEY);
        safeRemoveSession(MODE_KEY);
        currentMode = null;
        state = null;
        applyModeToUI();
        passwordInput.value = "";
        showPasswordGate();
      },
    });
  }

  function isAuthenticated() {
    return (
      safeGetSession(AUTH_KEY) === "true" &&
      VALID_MODES.includes(safeGetSession(MODE_KEY))
    );
  }

  function applyModeToUI() {
    const isDemo = currentMode === MODE_DEMO;
    document.body.classList.toggle("demo-mode", isDemo);
  }

  function getActivePromptGroups() {
    return currentMode === MODE_DEMO ? demoPromptGroups : promptGroups;
  }

  function getActiveBingoPrizes() {
    return currentMode === MODE_DEMO ? demoBingoPrizes : bingoPrizes;
  }

  function getActiveGrandPrize() {
    return currentMode === MODE_DEMO ? demoGrandPrize : grandPrize;
  }

  // Demo mode namespaces every stored key with a ":demo" suffix so live and
  // beta-test data never collide.
  function modeKey(baseKey) {
    return currentMode === MODE_DEMO ? `${baseKey}:demo` : baseKey;
  }

  function getPlayerKey() {
    return modeKey(PLAYER_KEY);
  }

  function getScoresKey() {
    return modeKey(SCORES_KEY);
  }

  function getBeerKey() {
    return modeKey(BEERS_KEY);
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
    return loadJSON(getScoresKey(), createEmptyScores, isPlainObject);
  }

  function createEmptyScores() {
    return buildPlayerMap(emptyScoreEntry);
  }

  function emptyScoreEntry() {
    return { bingoLines: 0, grandWins: 0, lastBingoAt: null };
  }

  function saveScores(scores) {
    safeSet(getScoresKey(), JSON.stringify(scores));
  }

  // Loads the score map, applies `mutate` to the player's entry (creating it if
  // missing), stamps the time, and persists.
  function updatePlayerScore(playerId, mutate) {
    const scores = loadScores();
    const entry = scores[playerId] || (scores[playerId] = emptyScoreEntry());
    mutate(entry);
    entry.lastBingoAt = new Date().toISOString();
    saveScores(scores);
  }

  function recordBingoLines(playerId, newLinesCount) {
    updatePlayerScore(playerId, (entry) => {
      entry.bingoLines += newLinesCount;
    });
  }

  function recordGrandWin(playerId) {
    updatePlayerScore(playerId, (entry) => {
      entry.grandWins += 1;
    });
  }

  // ── Beer state ────────────────────────────────────────────────────────────

  function loadBeers() {
    return loadJSON(getBeerKey(), createEmptyBeers, isPlainObject);
  }

  function createEmptyBeers() {
    return buildPlayerMap(() => 0);
  }

  function saveBeers(beers) {
    safeSet(getBeerKey(), JSON.stringify(beers));
  }

  function adjustBeerForPlayer(playerId, delta) {
    if (!playerId) return;
    const beers = loadBeers();
    beers[playerId] = Math.max(0, beerCountOf(beers, playerId) + delta);
    saveBeers(beers);
    renderBeerCounter();
    renderBeerLeaderboard();
    if (delta > 0) countBeerPress();
  }

  // Beers added drive the three beer-counter mini-games: Reaktionskollen every
  // REAKTION_TRIGGER, Fyllekollen every FYLLEKOLLEN_TRIGGER, and Minnesluckatestet
  // on beers where total % MINNE_PERIOD === MINNE_OFFSET (so it never coincides
  // with the other two). Only counts increments — removing a beer doesn't count.
  // Counters are session-only and wrap, so the checks keep coming back through the
  // night. Nothing fires while a dialog is already open; on the (impossible for
  // Minnet) chance two are due, Minnet > Reaktion > Fyllekollen.
  function countBeerPress() {
    beerAddedTotal += 1;
    beerPressCount += 1;
    reaktionPressCount += 1;

    let dueFyllekollen = false;
    let dueReaktion = false;
    if (beerPressCount >= FYLLEKOLLEN_TRIGGER) {
      beerPressCount = 0;
      dueFyllekollen = true;
    }
    if (reaktionPressCount >= REAKTION_TRIGGER) {
      reaktionPressCount = 0;
      dueReaktion = true;
    }
    const dueMinne = beerAddedTotal % MINNE_PERIOD === MINNE_OFFSET;

    if (activeDialog) return;
    if (dueMinne) openMinneslucka();
    else if (dueReaktion) openReaktionskollen();
    else if (dueFyllekollen) openFyllekollen();
  }

  function beerCountOf(beers, playerId) {
    return typeof beers[playerId] === "number" ? beers[playerId] : 0;
  }

  // ── Scoreboard UI ─────────────────────────────────────────────────────────

  function getCheckedCountForPlayer(playerId) {
    try {
      const raw = safeGet(getBoardStorageKey(playerId));
      if (!raw) return 1;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.checked)) return 1;
      return Math.max(1, parsed.checked.length);
    } catch {
      return 1;
    }
  }

  function showScoreboard() {
    renderScoreboardBody();
    openDialog(scoreboardOverlayEl);
  }

  function hideScoreboard() {
    closeDialog(scoreboardOverlayEl);
  }

  // Builds one `.scoreboard-stat` column. `valueHTML` may contain markup (e.g.
  // the "/25" denominator); `valueModifier` is an optional value-span class.
  function makeStat(valueHTML, label, valueModifier) {
    const stat = document.createElement("span");
    stat.className = "scoreboard-stat";
    const modifier = valueModifier ? ` ${valueModifier}` : "";
    stat.innerHTML =
      `<span class="scoreboard-stat-value${modifier}">${valueHTML}</span>` +
      `<span class="scoreboard-stat-label">${label}</span>`;
    return stat;
  }

  function makeYouBadge() {
    const badge = document.createElement("span");
    badge.className = "scoreboard-you";
    badge.textContent = "du";
    return badge;
  }

  function renderScoreboardBody() {
    const scores = loadScores();
    const beers = loadBeers();

    const ranked = players
      .map((p) => {
        const checkedCount = getCheckedCountForPlayer(p.id);
        return {
          player: p,
          bingoLines: scores[p.id]?.bingoLines ?? 0,
          grandWins: scores[p.id]?.grandWins ?? 0,
          lastBingoAt: scores[p.id]?.lastBingoAt ?? null,
          checkedCount,
          beerCount: beerCountOf(beers, p.id),
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
      if (isCurrentPlayer) nameEl.appendChild(makeYouBadge());

      const statsEl = document.createElement("span");
      statsEl.className = "scoreboard-stats";
      statsEl.appendChild(
        makeStat(
          `${entry.checkedCount}<span class="scoreboard-stat-denom">/${CELL_COUNT}</span>`,
          "fält",
          "scoreboard-stat-value--checked"
        )
      );
      statsEl.appendChild(makeStat(entry.bingoLines, "bingo"));
      statsEl.appendChild(makeStat(entry.grandWins, "full", "scoreboard-stat-value--grand"));
      statsEl.appendChild(makeStat(entry.beerCount, "🍺 öl", "scoreboard-stat-value--beer"));

      row.appendChild(rankEl);
      row.appendChild(nameEl);
      row.appendChild(statsEl);
      scoreboardBodyEl.appendChild(row);
    });
  }

  // ── Beer UI ───────────────────────────────────────────────────────────────

  function renderBeerCounter() {
    const beers = loadBeers();
    beerCountDisplay.textContent = String(beerCountOf(beers, activePlayerId));
  }

  function renderBeerLeaderboard() {
    const beers = loadBeers();
    const sorted = [...players]
      .map((p) => ({
        player: p,
        count: beerCountOf(beers, p.id),
      }))
      .sort((a, b) => b.count - a.count);

    beerLeaderboardBodyEl.innerHTML = "";
    sorted.forEach((entry) => {
      const isActive = entry.player.id === activePlayerId;

      const row = document.createElement("div");
      row.className = "beer-leaderboard-row" + (isActive ? " beer-leaderboard-row--active" : "");

      const nameEl = document.createElement("span");
      nameEl.className = "beer-leaderboard-name";
      nameEl.textContent = entry.player.label;
      if (isActive) nameEl.appendChild(makeYouBadge());

      const countEl = document.createElement("span");
      countEl.className = "beer-leaderboard-count";
      countEl.textContent = `${entry.count} 🍺`;

      row.appendChild(nameEl);
      row.appendChild(countEl);
      beerLeaderboardBodyEl.appendChild(row);
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
    const willCheck = !checkedSet.has(index);

    if (willCheck) {
      checkedSet.add(index);
    } else {
      checkedSet.delete(index);
    }

    checkedSet.add(FREE_INDEX);
    state.checked = [...checkedSet].sort((a, b) => a - b);
    saveState();

    // Toggle just the clicked cell in place rather than rebuilding the whole
    // board — a full re-render would drop keyboard focus back to page start.
    target.classList.toggle("checked", willCheck);
    target.ariaPressed = willCheck ? "true" : "false";

    updateStatsAndWinState({ triggerEffects: true });
  }

  function onNewBoard() {
    if (!activePlayerId) return;

    showConfirm({
      title: "Ny bricka?",
      message: "Skapa en helt ny bricka? Din nuvarande markering nollställs.",
      confirmLabel: "Ny bricka",
      onConfirm: () => {
        state = createFreshState(activePlayerId);
        saveState();
        renderBoard();
        updateStatsAndWinState({ triggerEffects: false });
      },
    });
  }

  function onResetBoard() {
    if (!state) return;

    showConfirm({
      title: "Nollställ bricka?",
      message: "Nollställa markeringarna på den här brickan? Rutorna ligger kvar.",
      confirmLabel: "Nollställ",
      onConfirm: () => {
        state.checked = [FREE_INDEX];
        state.bingoLinesAwarded = [];
        state.grandWin = false;
        saveState();
        renderBoard();
        updateStatsAndWinState({ triggerEffects: false });
      },
    });
  }

  // ── Player helpers ────────────────────────────────────────────────────────

  function getAvailablePrompts(playerId) {
    const player = getPlayer(playerId);
    return getActivePromptGroups()
      .filter((group) => group.id !== player.excludedGroup)
      .flatMap((group) => group.prompts);
  }

  function getExcludedPrompts(playerId) {
    const player = getPlayer(playerId);
    const group = getActivePromptGroups().find((item) => item.id === player.excludedGroup);
    return group ? group.prompts : [];
  }

  function getPlayer(playerId) {
    return players.find((player) => player.id === playerId);
  }

  function isValidPlayerId(playerId) {
    return players.some((player) => player.id === playerId);
  }

  function getBoardStorageKey(playerId) {
    return `${modeKey(BOARD_STORAGE_PREFIX)}:${playerId}`;
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
    // While a dialog is open it owns the keyboard: Escape closes it, Tab is
    // trapped, and other keys are swallowed so easter eggs don't fire behind it.
    if (activeDialog) {
      const mazeDir = activeDialog === fyllekollenOverlayEl ? arrowKeyToDir(event.key) : null;
      const reaktionTap =
        activeDialog === reaktionOverlayEl &&
        (event.key === " " || event.key === "Spacebar") &&
        (reaktionPhase === "waiting" || reaktionPhase === "active");
      if (mazeDir) {
        event.preventDefault();
        moveMaze(mazeDir);
      } else if (reaktionTap) {
        event.preventDefault();
        registerReaktion();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeDialog(activeDialog);
      } else if (event.key === "Tab") {
        trapTabKey(event, activeDialog);
      }
      return;
    }

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

  // ── Fyllekollen (swipe maze) ──────────────────────────────────────────────

  function openFyllekollen() {
    openDialog(fyllekollenOverlayEl);
    buildNewMaze();
    playWinSound(false);
  }

  function buildNewMaze() {
    mazeState = createMaze(MAZE_COLS, MAZE_ROWS);
    drawMaze();
  }

  // Carves a perfect maze with an iterative recursive-backtracker. Each cell
  // tracks its four walls; knocking down a wall also clears the matching wall on
  // the neighbour. Player starts top-left, goal sits bottom-right.
  function createMaze(cols, rows) {
    const total = cols * rows;
    const cells = Array.from({ length: total }, () => ({ n: true, e: true, s: true, w: true }));
    const visited = new Array(total).fill(false);
    const opposite = { n: "s", s: "n", e: "w", w: "e" };
    const stack = [];

    let current = 0;
    visited[0] = true;
    let visitedCount = 1;

    while (visitedCount < total) {
      const c = current % cols;
      const r = Math.floor(current / cols);
      const neighbors = [];
      if (r > 0 && !visited[current - cols]) neighbors.push(["n", current - cols]);
      if (c < cols - 1 && !visited[current + 1]) neighbors.push(["e", current + 1]);
      if (r < rows - 1 && !visited[current + cols]) neighbors.push(["s", current + cols]);
      if (c > 0 && !visited[current - 1]) neighbors.push(["w", current - 1]);

      if (neighbors.length === 0) {
        current = stack.pop();
        continue;
      }

      const [dir, next] = randomItem(neighbors);
      cells[current][dir] = false;
      cells[next][opposite[dir]] = false;
      stack.push(current);
      visited[next] = true;
      visitedCount += 1;
      current = next;
    }

    return {
      cols,
      rows,
      cells,
      player: { c: 0, r: 0 },
      goal: { c: cols - 1, r: rows - 1 },
      solved: false,
    };
  }

  function drawMaze() {
    if (!mazeState || !(mazeCanvas instanceof HTMLCanvasElement)) return;
    const ctx = mazeCanvas.getContext("2d");
    if (!ctx) return;

    const { cols, rows, cells, player, goal } = mazeState;
    const available = (mazeCanvas.parentElement && mazeCanvas.parentElement.clientWidth) || 300;
    const cell = Math.max(20, Math.floor(available / cols));
    const cssW = cell * cols;
    const cssH = cell * rows;
    const ratio = window.devicePixelRatio || 1;

    mazeCanvas.width = Math.floor(cssW * ratio);
    mazeCanvas.height = Math.floor(cssH * ratio);
    mazeCanvas.style.width = `${cssW}px`;
    mazeCanvas.style.height = `${cssH}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    ctx.strokeStyle = "rgba(255, 248, 232, 0.72)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const data = cells[r * cols + c];
        const x = c * cell;
        const y = r * cell;
        ctx.beginPath();
        if (data.n) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (data.e) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
        if (data.s) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (data.w) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        ctx.stroke();
      }
    }

    const glyph = Math.floor(cell * 0.64);
    ctx.font = `${glyph}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎯", goal.c * cell + cell / 2, goal.r * cell + cell / 2);
    ctx.fillText("🐭", player.c * cell + cell / 2, player.r * cell + cell / 2);
  }

  // Steps the mouse one cell in `dir` when no wall blocks it; reaching the goal
  // ends the round.
  function moveMaze(dir) {
    if (!mazeState || mazeState.solved) return;
    const { cols, cells, player, goal } = mazeState;
    const data = cells[player.r * cols + player.c];
    if (data[dir]) return;

    if (dir === "n") player.r -= 1;
    else if (dir === "s") player.r += 1;
    else if (dir === "e") player.c += 1;
    else if (dir === "w") player.c -= 1;

    drawMaze();
    if (player.c === goal.c && player.r === goal.r) onMazeSolved();
  }

  function onMazeSolved() {
    mazeState.solved = true;
    closeDialog(fyllekollenOverlayEl);
    playWinSound(true);
    runConfetti(2600);
    showOverlay(
      "Godkänd fyllekoll!",
      "Stadig på handen — labyrinten besegrad. Du får utse nästa rundas officiella vattenchef."
    );
  }

  function arrowKeyToDir(key) {
    switch (key) {
      case "ArrowUp":
        return "n";
      case "ArrowRight":
        return "e";
      case "ArrowDown":
        return "s";
      case "ArrowLeft":
        return "w";
      default:
        return null;
    }
  }

  function onMazePointerDown(event) {
    mazePointerStart = { x: event.clientX, y: event.clientY };
    // Capture so the matching pointerup still lands here if the finger lifts
    // just outside the canvas mid-swipe.
    if (typeof mazeCanvas.setPointerCapture === "function") {
      tryStorage(() => mazeCanvas.setPointerCapture(event.pointerId));
    }
  }

  function onMazePointerUp(event) {
    if (!mazePointerStart) return;
    const dx = event.clientX - mazePointerStart.x;
    const dy = event.clientY - mazePointerStart.y;
    mazePointerStart = null;

    if (Math.abs(dx) < MAZE_SWIPE_THRESHOLD && Math.abs(dy) < MAZE_SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      moveMaze(dx > 0 ? "e" : "w");
    } else {
      moveMaze(dy > 0 ? "s" : "n");
    }
  }

  // ── Reaktionskollen (reaction mini-game) ──────────────────────────────────

  // Flow: 5s countdown → blank "waiting" for a random 1–5s → 🍺 appears and the
  // clock starts → first tap stops it. Tapping during "waiting" is a false start.
  function openReaktionskollen() {
    openDialog(reaktionOverlayEl);
    startReaktionRound();
  }

  function startReaktionRound() {
    clearReaktionTimers();
    reaktionPhase = "countdown";
    reaktionStageEl.dataset.state = "countdown";
    reaktionTargetEl.classList.add("hidden");
    reaktionResultEl.classList.add("hidden");
    reaktionRetryBtn.classList.add("hidden");
    reaktionCountdownEl.classList.remove("hidden");
    reaktionInstructionEl.textContent = "Gör dig redo…";

    let n = 5;
    reaktionCountdownEl.textContent = String(n);
    reaktionCountdownTimer = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        reaktionCountdownEl.textContent = String(n);
      } else {
        window.clearInterval(reaktionCountdownTimer);
        reaktionCountdownTimer = null;
        beginReaktionWaiting();
      }
    }, 1000);
  }

  function beginReaktionWaiting() {
    reaktionPhase = "waiting";
    reaktionStageEl.dataset.state = "waiting";
    reaktionCountdownEl.classList.add("hidden");
    reaktionInstructionEl.textContent = "Vänta på ölen…";
    const delay = 1000 + Math.random() * 4000;
    reaktionAppearTimer = window.setTimeout(showReaktionTarget, delay);
  }

  function showReaktionTarget() {
    reaktionAppearTimer = null;
    reaktionPhase = "active";
    reaktionShownAt = performance.now();
    reaktionStageEl.dataset.state = "active";
    reaktionInstructionEl.textContent = "TRYCK!";
    reaktionTargetEl.style.left = `${15 + Math.random() * 70}%`;
    reaktionTargetEl.style.top = `${20 + Math.random() * 60}%`;
    reaktionTargetEl.classList.remove("hidden");
  }

  // Handles a tap/Space on the stage. A false start during "waiting", a timed
  // hit during "active", ignored otherwise (countdown / showing a result).
  function registerReaktion() {
    if (reaktionPhase === "waiting") {
      clearReaktionTimers();
      showReaktionResult("För tidigt!", "Du tryckte innan ölen dök upp. Försök igen.", "early", "");
    } else if (reaktionPhase === "active") {
      const ms = Math.round(performance.now() - reaktionShownAt);
      const level = reaktionLevel(ms);
      showReaktionResult(`${ms} ms`, level.message, level.cls, level.label);
    }
  }

  function onReaktionTap(event) {
    event.preventDefault();
    registerReaktion();
  }

  function reaktionLevel(ms) {
    if (ms < REAKTION_GREEN_MAX) {
      return { cls: "green", label: "Nykter", message: "Du behöver öka takten. Fortsätt dricka." };
    }
    if (ms <= REAKTION_YELLOW_MAX) {
      return { cls: "yellow", label: "Salongsberusad", message: "Du är på god väg. Fortsätt dricka." };
    }
    return { cls: "red", label: "Full som ett ägg", message: "Ser bra ut. Fortsätt dricka." };
  }

  function showReaktionResult(msText, message, cls, label) {
    reaktionPhase = "done";
    reaktionStageEl.dataset.state = "done";
    reaktionTargetEl.classList.add("hidden");
    reaktionCountdownEl.classList.add("hidden");
    reaktionInstructionEl.textContent = cls === "early" ? "Falskstart" : "Din reaktionstid";

    reaktionResultEl.dataset.level = cls;
    reaktionResultEl.innerHTML =
      `<span class="reaktion-ms">${msText}</span>` +
      (label ? `<span class="reaktion-level">${label}</span>` : "") +
      `<span class="reaktion-msg">${message}</span>`;
    reaktionResultEl.classList.remove("hidden");
    reaktionRetryBtn.classList.remove("hidden");

    if (cls !== "early") playWinSound(false);
  }

  function clearReaktionTimers() {
    if (reaktionCountdownTimer) {
      window.clearInterval(reaktionCountdownTimer);
      reaktionCountdownTimer = null;
    }
    if (reaktionAppearTimer) {
      window.clearTimeout(reaktionAppearTimer);
      reaktionAppearTimer = null;
    }
  }

  // ── Minnesluckatestet (memory / flash-count test) ─────────────────────────

  // Flow: 5s countdown → a cluster of X 🍺 + Y 🐭 flashes for MINNE_FLASH_MS →
  // the player dials the two counts on the scroll wheels and submits. Accuracy
  // (2/1/0 correct) maps to the same three-tier drunkenness verdict.
  function openMinneslucka() {
    populateMemoryWheel(memoryWheelBeerEl);
    populateMemoryWheel(memoryWheelMouseEl);
    openDialog(memoryOverlayEl);
    startMemoryRound();
  }

  function startMemoryRound() {
    clearMemoryTimers();
    memoryPhase = "countdown";
    memoryStageEl.dataset.state = "countdown";
    memoryFlashEl.classList.add("hidden");
    memoryAnswerEl.classList.add("hidden");
    memoryResultEl.classList.add("hidden");
    memoryRetryBtn.classList.add("hidden");
    memoryCountdownEl.classList.remove("hidden");
    memoryInstructionEl.textContent = "Gör dig redo…";

    memoryAnswer = { beer: randomCount(), mouse: randomCount() };

    let n = 5;
    memoryCountdownEl.textContent = String(n);
    memoryCountdownTimer = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        memoryCountdownEl.textContent = String(n);
      } else {
        window.clearInterval(memoryCountdownTimer);
        memoryCountdownTimer = null;
        flashMemory();
      }
    }, 1000);
  }

  function randomCount() {
    return MINNE_MIN + Math.floor(Math.random() * (MINNE_MAX - MINNE_MIN + 1));
  }

  function flashMemory() {
    memoryPhase = "flash";
    memoryStageEl.dataset.state = "flash";
    memoryCountdownEl.classList.add("hidden");
    memoryInstructionEl.textContent = "Håll koll!";

    const items = [];
    for (let i = 0; i < memoryAnswer.beer; i++) items.push("🍺");
    for (let i = 0; i < memoryAnswer.mouse; i++) items.push("🐭");
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    memoryFlashEl.innerHTML = items.map((emoji) => `<span>${emoji}</span>`).join("");
    memoryFlashEl.classList.remove("hidden");

    memoryFlashTimer = window.setTimeout(() => {
      memoryFlashTimer = null;
      showMemoryAnswer();
    }, MINNE_FLASH_MS);
  }

  function showMemoryAnswer() {
    memoryPhase = "answer";
    memoryStageEl.dataset.state = "answer";
    memoryFlashEl.classList.add("hidden");
    memoryFlashEl.innerHTML = "";
    memoryInstructionEl.textContent = "Hur många 🍺 och 🐭 såg du?";
    memoryAnswerEl.classList.remove("hidden");
    // Default both wheels to a neutral middle value (must run while visible so
    // scrollTop takes effect).
    setMemoryWheel(memoryWheelBeerEl, 5);
    setMemoryWheel(memoryWheelMouseEl, 5);
  }

  function submitMemoryAnswer() {
    if (memoryPhase !== "answer") return;
    const guessBeer = readMemoryWheel(memoryWheelBeerEl);
    const guessMouse = readMemoryWheel(memoryWheelMouseEl);
    const correct =
      (guessBeer === memoryAnswer.beer ? 1 : 0) + (guessMouse === memoryAnswer.mouse ? 1 : 0);
    const level = memoryLevel(correct);

    memoryPhase = "done";
    memoryStageEl.dataset.state = "done";
    memoryAnswerEl.classList.add("hidden");
    memoryInstructionEl.textContent = "Facit";

    memoryResultEl.dataset.level = level.cls;
    memoryResultEl.innerHTML =
      `<span class="memory-result-headline">${level.label}</span>` +
      `<span class="memory-facit">Rätt: ${memoryAnswer.beer} 🍺 · ${memoryAnswer.mouse} 🐭</span>` +
      `<span class="memory-msg">Du gissade ${guessBeer} 🍺 · ${guessMouse} 🐭. ${level.message}</span>`;
    memoryResultEl.classList.remove("hidden");
    memoryRetryBtn.classList.remove("hidden");
    playWinSound(false);
  }

  function memoryLevel(correctCount) {
    if (correctCount === 2) {
      return { cls: "green", label: "Nykter", message: "Skärpt blick! Du behöver öka takten. Fortsätt dricka." };
    }
    if (correctCount === 1) {
      return { cls: "yellow", label: "Salongsberusad", message: "Du är på god väg. Fortsätt dricka." };
    }
    return { cls: "red", label: "Full som ett ägg", message: "Ser bra ut. Fortsätt dricka." };
  }

  // The scroll wheels: a padded list of MINNE_MIN..MINNE_MAX with a spacer top and
  // bottom so the first/last value can snap to the centre band.
  function populateMemoryWheel(el) {
    let html = '<div class="memory-wheel-spacer"></div>';
    for (let value = MINNE_MIN; value <= MINNE_MAX; value++) {
      html += `<div class="memory-wheel-opt">${value}</div>`;
    }
    html += '<div class="memory-wheel-spacer"></div>';
    el.innerHTML = html;
  }

  function setMemoryWheel(el, value) {
    el.scrollTop = (value - MINNE_MIN) * MINNE_WHEEL_ITEM_H;
  }

  function readMemoryWheel(el) {
    const index = Math.round(el.scrollTop / MINNE_WHEEL_ITEM_H);
    return Math.min(MINNE_MAX, Math.max(MINNE_MIN, index + MINNE_MIN));
  }

  function clearMemoryTimers() {
    if (memoryCountdownTimer) {
      window.clearInterval(memoryCountdownTimer);
      memoryCountdownTimer = null;
    }
    if (memoryFlashTimer) {
      window.clearTimeout(memoryFlashTimer);
      memoryFlashTimer = null;
    }
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
    showOverlay("BINGO!", randomItem(getActiveBingoPrizes()));
  }

  function celebrateGrandWin() {
    playWinSound(true);
    runConfetti(3400);
    document.body.classList.add("champion");
    setTimeout(() => document.body.classList.remove("champion"), 5600);
    showOverlay("HELA BRICKAN KLAR!", getActiveGrandPrize());
  }

  function showOverlay(title, text) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    openDialog(overlayEl);
  }

  function hideOverlay() {
    closeDialog(overlayEl);
  }

  // ── Dialog helpers ────────────────────────────────────────────────────────

  // Opening a dialog records the element that had focus, reveals the overlay,
  // and moves focus to the first focusable control inside it. Closing restores
  // focus to wherever it was. Escape / Tab handling lives in onKeyDown, keyed
  // off `activeDialog`.
  function openDialog(dialogEl) {
    dialogReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeDialog = dialogEl;
    dialogEl.classList.remove("hidden");
    const focusable = getFocusable(dialogEl);
    if (focusable.length) focusable[0].focus();
  }

  function closeDialog(dialogEl) {
    dialogEl.classList.add("hidden");
    if (activeDialog === dialogEl) activeDialog = null;
    // A confirm that's dismissed any way other than its accept button (cancel,
    // Escape, backdrop) is a "no" — drop the pending action.
    if (dialogEl === confirmOverlayEl) pendingConfirmAction = null;
    // Closing Reaktionskollen any way (button, Escape, backdrop) must stop its
    // pending timers so a queued countdown/appear can't fire into a closed dialog.
    if (dialogEl === reaktionOverlayEl) {
      clearReaktionTimers();
      reaktionPhase = "idle";
    }
    if (dialogEl === memoryOverlayEl) {
      clearMemoryTimers();
      memoryPhase = "idle";
    }
    if (dialogReturnFocus && document.contains(dialogReturnFocus)) {
      dialogReturnFocus.focus();
    }
    dialogReturnFocus = null;
  }

  // Styled stand-in for window.confirm(): shows the confirm overlay and runs
  // `onConfirm` only if the user presses the accept button.
  function showConfirm({ title, message, confirmLabel, onConfirm }) {
    confirmTitleEl.textContent = title;
    confirmTextEl.textContent = message;
    confirmAcceptBtn.textContent = confirmLabel || "OK";
    pendingConfirmAction = typeof onConfirm === "function" ? onConfirm : null;
    openDialog(confirmOverlayEl);
  }

  function onConfirmAccept() {
    const action = pendingConfirmAction;
    pendingConfirmAction = null;
    closeDialog(confirmOverlayEl);
    if (action) action();
  }

  function getFocusable(container) {
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter(
      (el) => !el.disabled && el.offsetParent !== null
    );
  }

  // Keeps Tab focus cycling inside the open dialog instead of escaping to the
  // page behind it.
  function trapTabKey(event, container) {
    const focusable = getFocusable(container);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !container.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !container.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  // ── Confetti ──────────────────────────────────────────────────────────────

  function runConfetti(durationMs) {
    if (!(confettiCanvas instanceof HTMLCanvasElement)) return;
    if (prefersReducedMotion()) return;
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

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  // Builds a `{ [playerId]: valueFactory() }` map over every player — used for
  // the empty score and beer maps.
  function buildPlayerMap(valueFactory) {
    const map = {};
    players.forEach((player) => {
      map[player.id] = valueFactory();
    });
    return map;
  }

  function generateSeed() {
    if (window.crypto && "randomUUID" in window.crypto) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  // All Web Storage access is wrapped so a disabled or full store (private mode,
  // quota exceeded) degrades to the fallback instead of throwing. The store is
  // touched inside the try so even property access can't escape.
  function tryStorage(operation, fallback) {
    try {
      return operation();
    } catch (error) {
      return fallback;
    }
  }

  function safeGet(key) {
    return tryStorage(() => localStorage.getItem(key), null);
  }

  function safeSet(key, value) {
    tryStorage(() => localStorage.setItem(key, value));
  }

  function safeGetSession(key) {
    return tryStorage(() => sessionStorage.getItem(key), null);
  }

  function safeSetSession(key, value) {
    tryStorage(() => sessionStorage.setItem(key, value));
  }

  function safeRemoveSession(key) {
    tryStorage(() => sessionStorage.removeItem(key));
  }

  // Reads and parses JSON at `key`, returning `fallback()` when the slot is
  // empty, unparseable, or fails the `isValid` check.
  function loadJSON(key, fallback, isValid) {
    try {
      const raw = safeGet(key);
      if (!raw) return fallback();
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : fallback();
    } catch (error) {
      return fallback();
    }
  }
})();
