(function () {
  "use strict";

  const AUTH_KEY = "styggmus-bingo-auth-v1";
  const MODE_KEY = "styggmus-bingo-mode-v1";
  const PLAYER_KEY = "styggmus-bingo-player-v1";
  const BOARD_STORAGE_PREFIX = "styggmus-bingo-board-v2";
  const BEERS_KEY = "styggmus-bingo-beers-v1";
  const MODE_LIVE = "live";
  const MODE_TEST = "test";
  const VALID_MODES = [MODE_LIVE, MODE_TEST];
  const PASSWORDS = {
    SMB: MODE_LIVE,
    MGT: MODE_TEST,
  };
  const BOARD_SIZE = 4;
  const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
  // The five beer-counter mini-games rotate on a MINIGAME_CYCLE-beer cycle keyed
  // off the running count of beers added (beerAddedTotal): Reaktionskollen on
  // 1+5n, Minnesluckatestet on 2+5n, Fyllekollen on 3+5n, Spykollen on 4+5n,
  // Pissepaus on 5+5n. Every added beer fires exactly one, so they never collide.
  const MINIGAME_CYCLE = 5;
  // Fyllekollen (swipe maze). Time limit = shortest-path step count × MAZE_MS_PER_STEP.
  const MAZE_COLS = 7;
  const MAZE_ROWS = 9;
  const MAZE_SWIPE_THRESHOLD = 18;
  // Time budget per shortest-path step. The whole maze is visible so a sharp
  // player can plan the route; 800ms/step keeps a median (~30-step) maze ~24s and
  // makes finishing feasible after the inevitable wrong turns.
  const MAZE_MS_PER_STEP = 800;
  // Solving the maze maps to a three-tier verdict by the share of the clock still
  // left at the finish: ≥ this fraction → "Nykter" (too sober — alarm), below it →
  // "Salongsberusad". Running out of time → "Full som ett ägg" (drunk — celebrate).
  // 0.35 → Nykter needs solving in <65% of the budget (~520ms/shortest-step),
  // brisk but humanly reachable; widening this window without inflating the cap.
  const MAZE_SOBER_MIN_FRACTION = 0.35;
  // Bingo-reward klunkar for Fyllekollen scale with the share of the clock left at
  // the goal, so the most you can ever hand out is MAZE_KLUNK_MAX (instant solve);
  // running out of time gives 0. Keeps it in line with the other mini-games.
  const MAZE_KLUNK_MAX = 8;
  // Reaktionskollen (reaction test): reaction time (ms) → three-tier verdict.
  const REAKTION_GREEN_MAX = 350; // < this → "Nykter"
  const REAKTION_YELLOW_MAX = 550; // <= this → "Salongsberusad"; above → "Full som ett ägg"
  // Minnesluckatestet (memory / flash-count test): flashes X 🍺 + Y 🐭 for a blink,
  // then the player dials in the counts (each MINNE_MIN..MINNE_MAX).
  const MINNE_FLASH_MS = 4000;
  const MINNE_MIN = 1;
  const MINNE_MAX = 10;
  const MINNE_WHEEL_ITEM_H = 40; // px per wheel row; matches .memory-wheel-opt height
  // Spykollen (dodge game): steer a couch to dodge falling vomit. Difficulty ramps
  // (faster fall + tighter spawns) so a round lands ~10–30s; one hit ends it.
  // Avoided count → three-tier verdict (more dodged = more sober).
  const SPY_COUNTDOWN = 3; // "get ready" 3-2-1 before play
  const SPY_BASE_FALL = 0.45; // fraction of stage height per second at t=0
  const SPY_FALL_RAMP = 0.13; // fall speed grows by this fraction per elapsed second
  const SPY_BASE_SPAWN_MS = 950; // gap between drops at t=0
  const SPY_MIN_SPAWN_MS = 300; // hardest spawn gap
  const SPY_SPAWN_RAMP = 38; // ms shaved off the gap per elapsed second
  const SPY_COUCH_SPEED = 1.25; // couch travel in stage-widths per second
  const SPY_GREEN_MIN = 15; // dodged ≥ this → "Nykter"
  const SPY_YELLOW_MIN = 6; // dodged ≥ this → "Salongsberusad"; below → "Full som ett ägg"
  const SPY_MAX_BURST = 3; // most vomits that can drop at once (never all 6)
  // Pissepaus (tilt-aiming): steer the pee stream from the 🍆 onto the 🚽 that
  // spawns one at a time — each hit respawns the next, never two at once.
  // Steering: device tilt (gamma ±PISS_TILT_MAX_DEG = left/right; beta upright
  // = shortest stream, flat = longest, so the whole stage is reachable), with
  // pointer-drag and arrow keys as sensor-less fallbacks.
  const PISS_ROUND_MS = 10000;
  const PISS_COUNTDOWN = 3; // "get ready" 3-2-1 before play
  const PISS_TILT_MAX_DEG = 30;
  // The stream tip glides toward the steered target at a capped speed (stage
  // heights per second) instead of teleporting — tilt input is continuous
  // anyway, and this stops tap-the-toilet cheesing via the pointer fallback
  // while giving each respawn a natural travel-time cooldown. Together with
  // the minimum spawn distance in spawnPissToilet this caps a perfect player
  // at roughly 2 hits/second, so the 8-hit "Nykter" bar takes real aim.
  const PISS_AIM_SPEED = 0.8;
  const PISS_NYKTER_MIN = 8; // hits ≥ this → "Nykter"
  const PISS_SALONG_MIN = 4; // hits ≥ this → "Salongsberusad"; below → "Full som ett ägg"
  // Bingo rewards: a bingo launches a random mini-game whose result decides how
  // many "klunkar" (sips) you get to hand out to everyone. A grand win plays all
  // five in a row and sums them. Results round to nearest, clamped to ≥ 0.
  // Fyllekollen = seconds left at the goal; Reaktionskollen = (BASE − ms) / DIV;
  // Minnesluckatestet = MINNE_BASE − total deviation; Spykollen = fixed per
  // tier; Pissepaus = toilets hit (capped).
  const KLUNK_REAKTION_BASE_MS = 400;
  const KLUNK_REAKTION_DIV = 10;
  const KLUNK_REAKTION_MAX = 10; // cap so a very fast reaction can't dwarf the others
  const KLUNK_MINNE_BASE = 7;
  const KLUNK_SPY = { red: 6, yellow: 4, green: 2 }; // Nykter / Salongsberusad / Full
  const KLUNK_PISS_MAX = 10; // klunkar = toilets hit, capped like Reaktionskollen
  // Party-länk: live sync between the phones at the table via ntfy.sh, a free
  // public pub/sub relay — plain fetch POSTs to publish and an EventSource to
  // subscribe, no account and no library. Everyone shares one (obscure) topic;
  // the transport is contained in the Party-länk section so it can be swapped
  // for e.g. Firebase later. Note: the topic is public-by-obscurity, fine for
  // a party game — don't send anything sensitive over it.
  const PARTY_SERVER = "https://ntfy.sh";
  const PARTY_TOPIC = "styggmus-bingo-neonklubben-v1";
  const PARTY_KEY = "styggmus-bingo-party-v1"; // localStorage: "off" disables
  const PARTY_BEER_DEBOUNCE_MS = 1200; // batch rapid +/- taps into one publish
  const PARTY_FLASH_MS = 6000; // how long an incoming bingo takeover stays up
  const PARTY_SINCE = "45m"; // replay window that warms the roster on connect
  const PARTY_FRESH_MS = 2 * 60 * 1000; // only replayed events newer than this flash
  // Rekord (Hall of Fame): all-time per-player mini-game records, persisted in
  // localStorage and converged across phones via party `rekord` events. The
  // first result in a game seeds silently; only genuine improvements explode.
  const STATS_KEY = "styggmus-bingo-stats-v1";
  // Kvällens recap: tonight's bingo/klunkar tallies (own via showRewardPayout,
  // others via party bingo events). "Tonight" rolls over after inactivity.
  const NIGHT_KEY = "styggmus-bingo-night-v1";
  const NIGHT_RESET_MS = 18 * 60 * 60 * 1000;
  // Kommentatorn: deliberately few, deterministic triggers with a global
  // cooldown so the voice stays a running gag instead of a nuisance.
  const KOMMENTATOR_COOLDOWN_MS = 20000;
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
        "Lagget trummar så fingrarna glöder",
        "Lagget försöker minnas händelser från tidigare Stygg Mus",
      ],
    },
    {
      id: "ks",
      prompts: [
        "KS drar en Hasse & Tage-referens",
        "KS skrattar och skakar på huvudet för sig själv",
        "KS kommenterar att vi har alldeles för mycket mat",
        "KS vill sjunga en snapsvisa",
        "KS pratar om det ljuva 70-talet",
        "KS höjer rösten för att någon är trögfattad",
        "KS blundar och njuter av solen",
        "KS hör en bra låt och går loss",
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
        "Marcus drar en anekdot om folk ur sitt Täby-gäng",
        "Marcus uttrycker att han är ”genuint glad” över att KS ska bli farsa",
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
        "Oski uttrycker sig nazistiskt",
        "Oski är varm och behöver svalka sig",
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
        "Per går och lägger sig innan kl. 22:00",
        "Per surrar om RT (Round Table)",
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

  // ── DOM-refs ──────────────────────────────────────────────────────────────

  const appEl = document.getElementById("app");
  const accessScreenEl = document.getElementById("access-screen");
  const testScreenEl = document.getElementById("test-screen");
  const testFyllekollenBtn = document.getElementById("test-fyllekollen-btn");
  const testReaktionBtn = document.getElementById("test-reaktion-btn");
  const testMinneBtn = document.getElementById("test-minne-btn");

  const passwordForm = document.getElementById("password-form");
  const passwordInput = document.getElementById("password-input");
  const passwordFeedbackEl = document.getElementById("password-feedback");
  const playerSelectEl = document.getElementById("player-select");
  const playerButtons = document.querySelectorAll("[data-player-id]");
  const resetAllBtn = document.getElementById("reset-all-btn");
  // Currently just #test-screen's own Avsluta button — the menu's Avsluta is
  // wired to onExit() directly below instead, since it isn't styled .exit-btn.
  const exitButtons = document.querySelectorAll(".exit-btn");

  const gameTitleEl = document.getElementById("game-title");
  const boardEl = document.getElementById("board");
  const currentPlayerEl = document.getElementById("current-player");
  const newBoardBtn = document.getElementById("new-board-btn");
  const resetBoardBtn = document.getElementById("reset-board-btn");
  const menuBtn = document.getElementById("menu-btn");
  const topbarBackBtn = document.getElementById("topbar-back-btn");
  const beerWidgetCountEl = document.getElementById("beer-widget-count");
  const beerWidgetPlusBtn = document.getElementById("beer-widget-plus");
  const beerWidgetMinusBtn = document.getElementById("beer-widget-minus");

  const menuOverlayEl = document.getElementById("menu-overlay");
  const menuBackBtn = document.getElementById("menu-back-btn");
  const menuPartyBtn = document.getElementById("menu-party-btn");
  const menuChangePlayerBtn = document.getElementById("menu-change-player-btn");
  const menuExitBtn = document.getElementById("menu-exit-btn");

  const partyOverlayEl = document.getElementById("party-overlay");
  const partyBackBtn = document.getElementById("party-back-btn");
  const partyStatusDotEl = document.getElementById("party-status-dot");
  const partyStatusTextEl = document.getElementById("party-status-text");
  const partyRosterEl = document.getElementById("party-roster");
  const partyToggleBtn = document.getElementById("party-toggle-btn");
  const partyFlashEl = document.getElementById("party-flash");
  const partyFlashTitleEl = document.getElementById("party-flash-title");
  const partyFlashTextEl = document.getElementById("party-flash-text");

  const menuRekordBtn = document.getElementById("menu-rekord-btn");
  const rekordOverlayEl = document.getElementById("rekord-overlay");
  const rekordBackBtn = document.getElementById("rekord-back-btn");
  const rekordListEl = document.getElementById("rekord-list");
  const menuRecapBtn = document.getElementById("menu-recap-btn");
  const recapOverlayEl = document.getElementById("recap-overlay");
  const recapBackBtn = document.getElementById("recap-back-btn");
  const recapCanvas = document.getElementById("recap-canvas");
  const recapShareBtn = document.getElementById("recap-share-btn");

  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayTextEl = document.getElementById("overlay-text");
  const closeOverlayBtn = document.getElementById("close-overlay-btn");
  const confirmOverlayEl = document.getElementById("confirm-overlay");
  const confirmTitleEl = document.getElementById("confirm-title");
  const confirmTextEl = document.getElementById("confirm-text");
  const confirmAcceptBtn = document.getElementById("confirm-accept-btn");
  const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
  const confettiCanvas = document.getElementById("confetti");
  const hapticTickEl = document.getElementById("haptic-tick");
  const fyllekollenOverlayEl = document.getElementById("fyllekollen-overlay");
  const mazeCanvas = document.getElementById("maze-canvas");
  const mazeTimerEl = document.getElementById("maze-timer");
  const mazeResultEl = document.getElementById("maze-result");
  const fyllekollenCloseBtn = document.getElementById("fyllekollen-close-btn");

  const reaktionOverlayEl = document.getElementById("reaktion-overlay");
  const reaktionInstructionEl = document.getElementById("reaktion-instruction");
  const reaktionStageEl = document.getElementById("reaktion-stage");
  const reaktionCountdownEl = document.getElementById("reaktion-countdown");
  const reaktionTargetEl = document.getElementById("reaktion-target");
  const reaktionResultEl = document.getElementById("reaktion-result");
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
  const memoryCloseBtn = document.getElementById("memory-close-btn");

  const spykollenOverlayEl = document.getElementById("spykollen-overlay");
  const spykollenInstructionEl = document.getElementById("spykollen-instruction");
  const spyCanvas = document.getElementById("spy-canvas");
  const spyCountdownEl = document.getElementById("spy-countdown");
  const spyResultEl = document.getElementById("spy-result");
  const spyScoreEl = document.getElementById("spy-score");
  const spyLeftBtn = document.getElementById("spy-left-btn");
  const spyRightBtn = document.getElementById("spy-right-btn");
  const spyCloseBtn = document.getElementById("spy-close-btn");
  const testSpykollenBtn = document.getElementById("test-spykollen-btn");

  const pissepausOverlayEl = document.getElementById("pissepaus-overlay");
  const pissepausInstructionEl = document.getElementById("pissepaus-instruction");
  const pissCanvas = document.getElementById("piss-canvas");
  const pissCountdownEl = document.getElementById("piss-countdown");
  const pissStartBtn = document.getElementById("piss-start-btn");
  const pissTimerEl = document.getElementById("piss-timer");
  const pissScoreEl = document.getElementById("piss-score");
  const pissResultEl = document.getElementById("piss-result");
  const pissCloseBtn = document.getElementById("piss-close-btn");
  const testPissepausBtn = document.getElementById("test-pissepaus-btn");

  const rewardOverlayEl = document.getElementById("reward-overlay");
  const rewardTitleEl = document.getElementById("reward-title");
  const rewardBodyEl = document.getElementById("reward-body");
  const rewardActionBtn = document.getElementById("reward-action-btn");

  let state = null;
  let activePlayerId = null;
  let currentMode = null;
  let activeDialog = null;
  let dialogReturnFocus = null;
  let pendingConfirmAction = null;
  let pendingCancelAction = null;
  let audioCtx = null;
  let confettiAnimationFrame = null;
  let titleClickCount = 0;
  let titleClickTimer = null;
  let konamiIndex = 0;
  let typedBuffer = "";
  let mazeState = null;
  let mazePointerStart = null;
  let mazeDeadline = 0;
  let mazeLimitMs = 0;
  let mazeTimerInterval = null;
  let reaktionPhase = "idle";
  let reaktionShownAt = 0;
  let reaktionCountdownTimer = null;
  let reaktionAppearTimer = null;
  let beerAddedTotal = 0;
  let memoryPhase = "idle";
  let memoryAnswer = { beer: 0, mouse: 0 };
  let memoryCountdownTimer = null;
  let memoryFlashTimer = null;
  let spyPhase = "idle";
  let spyGame = null;
  let spyMoveDir = 0;
  let spyCountdownTimer = null;
  let spyRaf = null;
  let pissPhase = "idle";
  let pissGame = null;
  let pissCountdownTimer = null;
  let pissRaf = null;
  let partyEs = null;
  let partyStatus = "off"; // "off" | "connecting" | "on"
  let partyPlayers = {}; // playerId → { count, at } — the live Ölligan roster
  let partyBeerTimer = null;
  let partyFlashTimer = null;
  let partyLastHelloAt = 0; // rate-limits the hello ping-pong below
  let kommentatorLastAt = 0;
  const partyDeviceId = generateSeed(); // session identity; own events are ignored
  let soberAlarmTimer = null;
  let soberAlarmEl = null;
  let drunkPartyTimer = null;
  let drunkPartyEl = null;
  let rewardSession = null;
  let rewardTransitioning = false;
  let rewardActionHandler = null;
  let wakeLock = null;

  registerEventListeners();
  renderAccessFlow();
  startEmbers();

  // PWA: register the app-shell service worker (relative path so it works under
  // the GitHub Pages subpath). Guarded — file:// and old browsers just skip it.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function registerEventListeners() {
    passwordForm.addEventListener("submit", onPasswordSubmit);

    playerButtons.forEach((button) => {
      button.addEventListener("click", () => {
        onChoosePlayer(button.dataset.playerId);
      });
    });

    resetAllBtn.addEventListener("click", onBackFromPlayerSelect);
    exitButtons.forEach((button) => button.addEventListener("click", () => onExit()));

    testFyllekollenBtn.addEventListener("click", openFyllekollen);
    testReaktionBtn.addEventListener("click", openReaktionskollen);
    testMinneBtn.addEventListener("click", openMinneslucka);

    boardEl.addEventListener("click", onBoardClick);
    gameTitleEl.addEventListener("click", onGameTitleClick);
    beerWidgetPlusBtn.addEventListener("click", () => adjustBeerForPlayer(activePlayerId, 1));
    beerWidgetMinusBtn.addEventListener("click", () => adjustBeerForPlayer(activePlayerId, -1));

    menuBtn.addEventListener("click", () => openDialog(menuOverlayEl));
    // Same as backdrop/Escape — just closes the menu, no confirm.
    menuBackBtn.addEventListener("click", () => closeDialog(menuOverlayEl));
    menuPartyBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      openPartyOverlay();
    });
    partyBackBtn.addEventListener("click", () => closeDialog(partyOverlayEl));
    partyOverlayEl.addEventListener("click", (e) => {
      if (e.target === partyOverlayEl) closeDialog(partyOverlayEl);
    });
    partyToggleBtn.addEventListener("click", onPartyToggle);
    partyFlashEl.addEventListener("click", hidePartyFlash);

    menuRekordBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      renderRekordList();
      openDialog(rekordOverlayEl);
    });
    rekordBackBtn.addEventListener("click", () => closeDialog(rekordOverlayEl));
    rekordOverlayEl.addEventListener("click", (e) => {
      if (e.target === rekordOverlayEl) closeDialog(rekordOverlayEl);
    });
    menuRecapBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      renderRecap();
      openDialog(recapOverlayEl);
    });
    recapBackBtn.addEventListener("click", () => closeDialog(recapOverlayEl));
    recapOverlayEl.addEventListener("click", (e) => {
      if (e.target === recapOverlayEl) closeDialog(recapOverlayEl);
    });
    recapShareBtn.addEventListener("click", shareRecap);
    // Quick-access shortcut to "Byt spelare" — same action as the menu entry,
    // no confirm (switching player was never a confirmed action).
    topbarBackBtn.addEventListener("click", showPlayerGate);
    newBoardBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      onNewBoard();
    });
    resetBoardBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      onResetBoard();
    });
    menuChangePlayerBtn.addEventListener("click", () => {
      closeDialog(menuOverlayEl);
      showPlayerGate();
    });
    // onExit() closes the menu itself (it defensively closes whatever dialog
    // is open) before showing the exit confirmation; onCancel reopens the
    // menu if Avsluta is declined (Avbryt, Escape, or backdrop).
    menuExitBtn.addEventListener("click", () => onExit(() => openDialog(menuOverlayEl)));
    menuOverlayEl.addEventListener("click", (e) => {
      if (e.target === menuOverlayEl) closeDialog(menuOverlayEl);
    });

    closeOverlayBtn.addEventListener("click", hideOverlay);

    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) hideOverlay();
    });

    confirmAcceptBtn.addEventListener("click", onConfirmAccept);
    confirmCancelBtn.addEventListener("click", () => closeDialog(confirmOverlayEl));
    confirmOverlayEl.addEventListener("click", (e) => {
      if (e.target === confirmOverlayEl) closeDialog(confirmOverlayEl);
    });

    fyllekollenCloseBtn.addEventListener("click", () => closeDialog(fyllekollenOverlayEl));
    fyllekollenOverlayEl.addEventListener("click", (e) => {
      if (e.target === fyllekollenOverlayEl) closeDialog(fyllekollenOverlayEl);
    });
    mazeCanvas.addEventListener("pointerdown", onMazePointerDown);
    mazeCanvas.addEventListener("pointerup", onMazePointerUp);

    reaktionStageEl.addEventListener("pointerdown", onReaktionTap);
    reaktionCloseBtn.addEventListener("click", () => closeDialog(reaktionOverlayEl));
    reaktionOverlayEl.addEventListener("click", (e) => {
      if (e.target === reaktionOverlayEl) closeDialog(reaktionOverlayEl);
    });

    memorySubmitBtn.addEventListener("click", submitMemoryAnswer);
    memoryCloseBtn.addEventListener("click", () => closeDialog(memoryOverlayEl));
    memoryOverlayEl.addEventListener("click", (e) => {
      if (e.target === memoryOverlayEl) closeDialog(memoryOverlayEl);
    });

    testSpykollenBtn.addEventListener("click", openSpykollen);
    spyCloseBtn.addEventListener("click", () => closeDialog(spykollenOverlayEl));
    spykollenOverlayEl.addEventListener("click", (e) => {
      if (e.target === spykollenOverlayEl) closeDialog(spykollenOverlayEl);
    });
    spyLeftBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); spyMoveDir = -1; });
    spyRightBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); spyMoveDir = 1; });
    window.addEventListener("pointerup", () => { spyMoveDir = 0; });
    window.addEventListener("keyup", onSpyKeyUp);

    testPissepausBtn.addEventListener("click", openPissepaus);
    pissStartBtn.addEventListener("click", onPissStart);
    pissCloseBtn.addEventListener("click", () => closeDialog(pissepausOverlayEl));
    pissepausOverlayEl.addEventListener("click", (e) => {
      if (e.target === pissepausOverlayEl) closeDialog(pissepausOverlayEl);
    });
    // Sensor-less steering: dragging (or just moving the mouse) over the stage
    // aims the stream directly.
    pissCanvas.addEventListener("pointerdown", onPissPointer);
    pissCanvas.addEventListener("pointermove", onPissPointer);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", resizeConfettiCanvas);
    window.addEventListener("resize", () => {
      if (mazeState && activeDialog === fyllekollenOverlayEl) drawMaze();
    });
    // The browser force-releases the screen wake lock when the tab is hidden;
    // grab it back if a mini-game/dialog is still up when the player returns.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && activeDialog) acquireWakeLock();
    });

    rewardActionBtn.addEventListener("click", () => {
      if (rewardActionHandler) rewardActionHandler();
    });
    rewardOverlayEl.addEventListener("click", (e) => {
      if (e.target === rewardOverlayEl) closeDialog(rewardOverlayEl);
    });
  }

  // ── Access flow ───────────────────────────────────────────────────────────

  function renderAccessFlow() {
    if (!isAuthenticated()) {
      currentMode = null;
      showPasswordGate();
      return;
    }

    currentMode = safeGetSession(MODE_KEY);

    if (currentMode === MODE_TEST) {
      showTestScreen();
      return;
    }

    const savedPlayerId = safeGet(PLAYER_KEY);
    if (!isValidPlayerId(savedPlayerId)) {
      showPlayerGate();
      return;
    }

    activePlayerId = savedPlayerId;
    startBingoGame();
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

  function showTestScreen() {
    hideAllScreens();
    testScreenEl.classList.remove("hidden");
  }

  function hideAllScreens() {
    accessScreenEl.classList.add("hidden");
    appEl.classList.add("hidden");
    testScreenEl.classList.add("hidden");
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

    if (mode === MODE_TEST) {
      showTestScreen();
    } else {
      showPlayerGate();
    }
  }

  function onChoosePlayer(playerId) {
    if (!isValidPlayerId(playerId)) return;
    activePlayerId = playerId;
    safeSet(PLAYER_KEY, playerId);
    startBingoGame();
  }

  function startBingoGame() {
    if (!activePlayerId) return;
    state = loadOrCreateState(activePlayerId);
    hideAllScreens();
    appEl.classList.remove("hidden");
    currentPlayerEl.textContent = getPlayer(activePlayerId).label;
    renderBeerWidget();
    renderBoard();
    updateStatsAndWinState({ triggerEffects: false });
    connectParty();
  }

  function onBackFromPlayerSelect() {
    // Back to the existing board if a player is already chosen, otherwise to the
    // password gate (the player-select screen is the first stop on fresh login).
    if (isValidPlayerId(activePlayerId)) {
      startBingoGame();
    } else {
      showPasswordGate();
    }
  }

  // Clears the session and returns to the password gate. Saved boards and beers
  // stay in localStorage — only the session auth is cleared.
  function performExit() {
    disconnectParty();
    safeRemoveSession(AUTH_KEY);
    safeRemoveSession(MODE_KEY);
    currentMode = null;
    state = null;
    passwordInput.value = "";
    showPasswordGate();
  }

  // Confirms before exiting. Used by both the generic `.exit-btn` wiring (e.g.
  // test mode's Avsluta button, no onCancel — there's no menu to return to)
  // and the menu's Avsluta (passes onCancel to reopen the menu). Defensively
  // closes any dialog it might be called from (e.g. the menu overlay) so the
  // confirm dialog it opens doesn't stack on top of one left showing
  // underneath.
  function onExit(onCancel) {
    if (activeDialog) closeDialog(activeDialog);
    showConfirm({
      title: "Avsluta?",
      message: "Avsluta och återgå till lösenordsskärmen?",
      confirmLabel: "Avsluta",
      onConfirm: performExit,
      onCancel,
    });
  }

  function isAuthenticated() {
    return (
      safeGetSession(AUTH_KEY) === "true" &&
      VALID_MODES.includes(safeGetSession(MODE_KEY))
    );
  }


  // ── State ─────────────────────────────────────────────────────────────────

  function loadOrCreateState(playerId) {
    const raw = safeGet(getBoardStorageKey(playerId));
    if (!raw) return createFreshState(playerId);

    try {
      const parsed = JSON.parse(raw);
      if (!isValidState(parsed, playerId)) return createFreshState(playerId);
      return normalizeState(parsed, playerId);
    } catch {
      return createFreshState(playerId);
    }
  }

  function createFreshState(playerId) {
    const seed = generateSeed();
    const board = shuffleWithSeed(getAvailablePrompts(playerId), `${seed}-${playerId}`).slice(
      0,
      CELL_COUNT
    );

    return {
      id: seed,
      playerId,
      createdAt: new Date().toISOString(),
      board,
      checked: [],
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

  // ── Beer state ────────────────────────────────────────────────────────────

  function loadBeers() {
    return loadJSON(BEERS_KEY, createEmptyBeers, isPlainObject);
  }

  function createEmptyBeers() {
    return buildPlayerMap(() => 0);
  }

  function saveBeers(beers) {
    safeSet(BEERS_KEY, JSON.stringify(beers));
  }

  function adjustBeerForPlayer(playerId, delta) {
    if (!playerId) return;
    const beers = loadBeers();
    beers[playerId] = Math.max(0, beerCountOf(beers, playerId) + delta);
    saveBeers(beers);
    renderBeerWidget();
    // Pop the counter (CSS beer-pop; the class flip re-triggers per press).
    const valueEl = beerWidgetCountEl && beerWidgetCountEl.parentElement;
    if (valueEl) {
      valueEl.classList.remove("pop");
      void valueEl.offsetWidth;
      valueEl.classList.add("pop");
    }
    schedulePartyBeerPublish(playerId);
    if (delta > 0) countBeerPress();
  }

  // The compact beer counter in the bingo top bar.
  function renderBeerWidget() {
    if (!beerWidgetCountEl) return;
    const beers = loadBeers();
    beerWidgetCountEl.textContent = String(beerCountOf(beers, activePlayerId));
  }

  // Each added beer launches one of the five mini-games on a rotating
  // MINIGAME_CYCLE-beer cycle: Reaktionskollen on 1+5n, Minnesluckatestet on
  // 2+5n, Fyllekollen on 3+5n, Spykollen on 4+5n, Pissepaus on 5+5n. Exactly
  // one fires per beer, so they never collide. Only increments count — removing
  // a beer doesn't. The counter is session-only; nothing fires while a dialog
  // is already open.
  function countBeerPress() {
    beerAddedTotal += 1;
    const count = beerCountOf(loadBeers(), activePlayerId);
    if (count > 0 && count % 5 === 0) {
      sayCommentary(kommentatorBeerLine(count, spokenName(activePlayerId)));
    }
    if (activeDialog) return;
    const slot = beerAddedTotal % MINIGAME_CYCLE;
    if (slot === 1) openReaktionskollen();
    else if (slot === 2) openMinneslucka();
    else if (slot === 3) openFyllekollen();
    else if (slot === 4) openSpykollen();
    else openPissepaus();
  }

  function beerCountOf(beers, playerId) {
    return typeof beers[playerId] === "number" ? beers[playerId] : 0;
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
      button.ariaLabel = label;
      button.ariaPressed = isChecked ? "true" : "false";
      button.textContent = label;

      if (isChecked) button.classList.add("checked");
      // Stagger index for the deal-in cascade (CSS cell-enter).
      button.style.setProperty("--cell-i", String(index));

      boardEl.appendChild(button);
    });

    // Run the deal-in once per render; the class is removed after the cascade
    // finishes so later .stamp/.win animations never fight it.
    boardEl.classList.remove("deal");
    void boardEl.offsetWidth;
    boardEl.classList.add("deal");
    window.setTimeout(() => boardEl.classList.remove("deal"), 1100);
  }

  function onBoardClick(event) {
    if (!state) return;

    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("cell")) return;

    const index = Number(target.dataset.index);

    const checkedSet = new Set(state.checked);
    const willCheck = !checkedSet.has(index);

    if (willCheck) {
      checkedSet.add(index);
    } else {
      checkedSet.delete(index);
    }

    state.checked = [...checkedSet].sort((a, b) => a - b);
    saveState();

    // Toggle just the clicked cell in place rather than rebuilding the whole
    // board — a full re-render would drop keyboard focus back to page start.
    target.classList.toggle("checked", willCheck);
    target.ariaPressed = willCheck ? "true" : "false";
    vibrate(willCheck ? 18 : 8);

    // Tactile stamp: a one-shot scale-pop + spark ring + emblem slam, retriggered
    // by removing/re-adding the class across a reflow. Marking only (unmarking
    // is quiet). No-op visual under reduced motion (the keyframes are gated).
    if (willCheck) {
      target.classList.remove("stamp");
      void target.offsetWidth;
      target.classList.add("stamp");
      window.setTimeout(() => target.classList.remove("stamp"), 460);
    }

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
      onCancel: () => openDialog(menuOverlayEl),
    });
  }

  // Clears the marks on the current board (same prompts, same board) instead
  // of generating a new one.
  function onResetBoard() {
    if (!state) return;

    showConfirm({
      title: "Nollställ bricka?",
      message: "Nollställa markeringarna på den här brickan? Rutorna ligger kvar.",
      confirmLabel: "Nollställ",
      onConfirm: () => {
        state.checked = [];
        state.bingoLinesAwarded = [];
        state.grandWin = false;
        saveState();
        renderBoard();
        updateStatsAndWinState({ triggerEffects: false });
      },
      onCancel: () => openDialog(menuOverlayEl),
    });
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
    // While a dialog is open it owns the keyboard: Escape closes it, Tab is
    // trapped, and other keys are swallowed so easter eggs don't fire behind it.
    if (activeDialog) {
      const mazeDir = activeDialog === fyllekollenOverlayEl ? arrowKeyToDir(event.key) : null;
      const reaktionTap =
        activeDialog === reaktionOverlayEl &&
        (event.key === " " || event.key === "Spacebar") &&
        (reaktionPhase === "waiting" || reaktionPhase === "active");
      const spyDir =
        activeDialog === spykollenOverlayEl && spyPhase === "playing"
          ? horizontalArrowToDir(event.key)
          : 0;
      const pissDir =
        activeDialog === pissepausOverlayEl && pissPhase === "playing"
          ? arrowKeyToDir(event.key)
          : null;
      if (mazeDir) {
        event.preventDefault();
        moveMaze(mazeDir);
      } else if (reaktionTap) {
        event.preventDefault();
        registerReaktion();
      } else if (spyDir !== 0) {
        event.preventDefault();
        spyMoveDir = spyDir;
      } else if (pissDir) {
        event.preventDefault();
        nudgePissAim(pissDir);
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
    fyllekollenCloseBtn.textContent = "Avbryt";
    buildNewMaze();
    playWinSound(false);
  }

  function buildNewMaze() {
    stopVerdictEffects();
    mazeResultEl.classList.add("hidden");
    mazeState = createMaze(MAZE_COLS, MAZE_ROWS);
    drawMaze();
    startMazeTimer();
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
      stepsNeeded: mazeDistance(cells, cols, rows, 0, total - 1),
    };
  }

  // BFS over the carved passages — in a perfect maze this unique path length is
  // the number of steps strictly needed to reach the goal.
  function mazeDistance(cells, cols, rows, startIdx, goalIdx) {
    const dist = new Array(cols * rows).fill(-1);
    dist[startIdx] = 0;
    const queue = [startIdx];

    while (queue.length) {
      const cur = queue.shift();
      if (cur === goalIdx) return dist[cur];
      const c = cur % cols;
      const r = Math.floor(cur / cols);
      const cell = cells[cur];
      if (!cell.n && r > 0 && dist[cur - cols] < 0) { dist[cur - cols] = dist[cur] + 1; queue.push(cur - cols); }
      if (!cell.e && c < cols - 1 && dist[cur + 1] < 0) { dist[cur + 1] = dist[cur] + 1; queue.push(cur + 1); }
      if (!cell.s && r < rows - 1 && dist[cur + cols] < 0) { dist[cur + cols] = dist[cur] + 1; queue.push(cur + cols); }
      if (!cell.w && c > 0 && dist[cur - 1] < 0) { dist[cur - 1] = dist[cur] + 1; queue.push(cur - 1); }
    }
    return dist[goalIdx];
  }

  // Starts (or restarts) the countdown clock for the current maze. The player
  // gets stepsNeeded × MAZE_MS_PER_STEP to reach the goal.
  function startMazeTimer() {
    clearMazeTimer();
    if (!mazeState) return;
    mazeLimitMs = Math.max(1, mazeState.stepsNeeded) * MAZE_MS_PER_STEP;
    mazeDeadline = performance.now() + mazeLimitMs;
    renderMazeTimer();
    mazeTimerInterval = window.setInterval(renderMazeTimer, 100);
  }

  function renderMazeTimer() {
    const remaining = Math.max(0, mazeDeadline - performance.now());
    mazeTimerEl.textContent = `${(remaining / 1000).toFixed(1)} s`;
    mazeTimerEl.dataset.urgent = remaining <= mazeLimitMs * 0.34 ? "true" : "false";
    if (remaining <= 0) onMazeTimeout();
  }

  function clearMazeTimer() {
    if (mazeTimerInterval) {
      window.clearInterval(mazeTimerInterval);
      mazeTimerInterval = null;
    }
  }

  // Time ran out before the goal — the goal of a drinking game. That's the
  // "Full som ett ägg" (properly drunk) tier, with the green celebration.
  function onMazeTimeout() {
    if (!mazeState || mazeState.solved) return;
    mazeState.solved = true; // lock movement
    clearMazeTimer();
    showMazeResult("Tiden ute!", {
      cls: "green",
      label: "Full som ett ägg",
      message: "För långsam — labyrinten besegrade dig. Ser bra ut.<br>Fortsätt dricka.",
      celebrate: true,
    });
    recordRewardResult("fyllekollen", 0, "Tiden ute"); // never reached the goal → 0
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

    // Soft glow pads under the goal and the mouse so they read as the maze's
    // two beacons (drawn first, everything else on top).
    const pad = (cx, cy, color) => {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.9);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - cell, cy - cell, cell * 2, cell * 2);
    };
    pad(goal.c * cell + cell / 2, goal.r * cell + cell / 2, "rgba(250, 255, 45, 0.28)");
    pad(player.c * cell + cell / 2, player.r * cell + cell / 2, "rgba(255, 45, 120, 0.3)");

    // Neon-tube walls: cyan strokes with a glow. One shadowBlur pass is cheap
    // here — the maze only redraws on moves, not per animation frame.
    ctx.strokeStyle = "rgba(120, 235, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(45, 226, 255, 0.8)";
    ctx.shadowBlur = 6;

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
    ctx.shadowBlur = 0;

    const glyph = Math.floor(cell * 0.64);
    ctx.font = `${glyph}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍺", goal.c * cell + cell / 2, goal.r * cell + cell / 2);
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
    const remaining = Math.max(0, mazeDeadline - performance.now());
    clearMazeTimer();
    const fraction = mazeLimitMs > 0 ? remaining / mazeLimitMs : 0;
    const level = mazeLevel(fraction);
    showMazeResult(`${(remaining / 1000).toFixed(1)} s kvar`, level);
    recordRewardResult("fyllekollen", fraction * MAZE_KLUNK_MAX, level.label); // scaled so max = MAZE_KLUNK_MAX
    recordStat("fylle", Math.round(remaining / 100) / 10);
  }

  // Solving maps to a verdict by how much of the clock was left. Sober logic is
  // inverted (this is a drinking game): finishing with time to spare is the *bad*
  // result. Running out of time is handled separately in onMazeTimeout (green).
  function mazeLevel(fraction) {
    if (fraction >= MAZE_SOBER_MIN_FRACTION) {
      return { cls: "red", label: "Nykter", message: "Stadig på handen och gott om tid kvar. Du behöver öka takten.<br>Fortsätt dricka.", alarm: true };
    }
    return { cls: "yellow", label: "Salongsberusad", message: "Du klarade det på upploppet. Du är på god väg.<br>Fortsätt dricka." };
  }

  // Shows the verdict panel over the maze and fires the matching effect (alarm /
  // celebration / neutral chime), mirroring the other mini-games' result screens.
  function showMazeResult(detailText, level) {
    mazeResultEl.dataset.level = level.cls;
    mazeResultEl.innerHTML =
      `<span class="maze-result-headline">${level.label}</span>` +
      `<span class="maze-result-detail">${detailText}</span>` +
      `<span class="maze-result-msg">${level.message}</span>`;
    mazeResultEl.classList.remove("hidden");
    if (level.alarm) signalSoberAlarm(fyllekollenOverlayEl);
    else if (level.celebrate) signalDrunkCelebration(fyllekollenOverlayEl);
    else playWinSound(false);
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
    reaktionCloseBtn.textContent = "Stäng";
    startReaktionRound();
  }

  function startReaktionRound() {
    clearReaktionTimers();
    stopVerdictEffects();
    reaktionPhase = "countdown";
    reaktionStageEl.dataset.state = "countdown";
    reaktionTargetEl.classList.add("hidden");
    reaktionResultEl.classList.add("hidden");
    reaktionCountdownEl.classList.remove("hidden");
    reaktionInstructionEl.textContent = "";

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
    const delay = 100 + Math.random() * 4900;
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
    vibrate(35);
  }

  // Handles a tap/Space on the stage. A false start during "waiting", a timed
  // hit during "active", ignored otherwise (countdown / showing a result).
  function registerReaktion() {
    if (reaktionPhase === "waiting") {
      clearReaktionTimers();
      showReaktionResult("För tidigt!", "Du tryckte innan ölen dök upp. Försök igen.", "early", "");
      recordRewardResult("reaktion", 0, "Falskstart"); // false start → 0
      sayCommentary(randomItem(KOMMENTATOR.falskstart));
    } else if (reaktionPhase === "active") {
      const ms = Math.round(performance.now() - reaktionShownAt);
      const level = reaktionLevel(ms);
      showReaktionResult(`${ms} ms`, level.message, level.cls, level.label, level.alarm, level.celebrate);
      recordRewardResult("reaktion", Math.min(KLUNK_REAKTION_MAX, (KLUNK_REAKTION_BASE_MS - ms) / KLUNK_REAKTION_DIV), level.label);
      recordStat("reaktion", ms);
    }
  }

  function onReaktionTap(event) {
    event.preventDefault();
    registerReaktion();
  }

  function reaktionLevel(ms) {
    if (ms < REAKTION_GREEN_MAX) {
      return { cls: "red", label: "Nykter", message: "Du behöver öka takten.<br>Fortsätt dricka.", alarm: true };
    }
    if (ms <= REAKTION_YELLOW_MAX) {
      return { cls: "yellow", label: "Salongsberusad", message: "Du är på god väg.<br>Fortsätt dricka." };
    }
    return { cls: "green", label: "Full som ett ägg", message: "Ser bra ut.<br>Fortsätt dricka.", celebrate: true };
  }

  function showReaktionResult(msText, message, cls, label, alarm, celebrate) {
    reaktionPhase = "done";
    reaktionStageEl.dataset.state = "done";
    reaktionTargetEl.classList.add("hidden");
    reaktionCountdownEl.classList.add("hidden");
    reaktionInstructionEl.textContent = "";

    reaktionResultEl.dataset.level = cls;
    reaktionResultEl.innerHTML =
      `<span class="reaktion-ms">${msText}</span>` +
      (label ? `<span class="reaktion-level">${label}</span>` : "") +
      `<span class="reaktion-msg">${message}</span>`;
    reaktionResultEl.classList.remove("hidden");

    if (alarm) {
      signalSoberAlarm(reaktionOverlayEl);
    } else if (celebrate) {
      signalDrunkCelebration(reaktionOverlayEl);
    } else if (cls !== "early") {
      playWinSound(false);
    }
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
    memoryCloseBtn.textContent = "Stäng";
    startMemoryRound();
  }

  function startMemoryRound() {
    clearMemoryTimers();
    stopVerdictEffects();
    memoryPhase = "countdown";
    memoryStageEl.dataset.state = "countdown";
    memoryFlashEl.classList.add("hidden");
    memoryAnswerEl.classList.add("hidden");
    memoryResultEl.classList.add("hidden");
    memoryCountdownEl.classList.remove("hidden");
    memoryInstructionEl.textContent = "";

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
    memoryInstructionEl.textContent = "";

    memoryResultEl.dataset.level = level.cls;
    memoryResultEl.innerHTML =
      `<span class="memory-result-headline">${level.label}</span>` +
      `<span class="memory-facit">Rätt: ${memoryAnswer.beer} 🍺 · ${memoryAnswer.mouse} 🐭</span>` +
      `<span class="memory-msg">Du gissade ${guessBeer} 🍺 · ${guessMouse} 🐭. ${level.message}</span>`;
    memoryResultEl.classList.remove("hidden");
    if (level.alarm) signalSoberAlarm(memoryOverlayEl);
    else if (level.celebrate) signalDrunkCelebration(memoryOverlayEl);
    else playWinSound(false);

    const deviation = Math.abs(guessBeer - memoryAnswer.beer) + Math.abs(guessMouse - memoryAnswer.mouse);
    recordRewardResult("minne", KLUNK_MINNE_BASE - deviation, level.label);
    recordStat("minne", correct);
  }

  function memoryLevel(correctCount) {
    if (correctCount === 2) {
      return { cls: "red", label: "Nykter", message: "Skärpt blick! Du behöver öka takten.<br>Fortsätt dricka.", alarm: true };
    }
    if (correctCount === 1) {
      return { cls: "yellow", label: "Salongsberusad", message: "Du är på god väg.<br>Fortsätt dricka." };
    }
    return { cls: "green", label: "Full som ett ägg", message: "Ser bra ut.<br>Fortsätt dricka.", celebrate: true };
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

  // ── Spykollen (dodge mini-game) ───────────────────────────────────────────

  // Flow: 3-2-1 countdown → a row of 🤢 along the top drop 🤮 one at a time
  // (random emoji, spaced by a shrinking spawn gap so it stays dodgeable) → steer
  // the 🛋️ couch left/right to dodge. Difficulty ramps; one hit ends the round.
  function openSpykollen() {
    openDialog(spykollenOverlayEl);
    spyCloseBtn.textContent = "Stäng";
    startSpyRound();
  }

  function startSpyRound() {
    stopSpyGame();
    stopVerdictEffects();
    spyResultEl.classList.add("hidden");
    spyCountdownEl.classList.remove("hidden");
    spyScoreEl.textContent = "0";
    spykollenInstructionEl.textContent = "";

    setupSpyGame();
    drawSpy();

    spyPhase = "countdown";
    let n = SPY_COUNTDOWN;
    spyCountdownEl.textContent = String(n);
    spyCountdownTimer = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        spyCountdownEl.textContent = String(n);
      } else {
        window.clearInterval(spyCountdownTimer);
        spyCountdownTimer = null;
        beginSpyPlay();
      }
    }, 700);
  }

  // Sizes the canvas to the wrapper and lays out the couch + nausea row.
  function setupSpyGame() {
    const available = (spyCanvas.parentElement && spyCanvas.parentElement.clientWidth) || 300;
    const w = available;
    const h = Math.round(w * 1.4);
    const ratio = window.devicePixelRatio || 1;
    spyCanvas.width = Math.floor(w * ratio);
    spyCanvas.height = Math.floor(h * ratio);
    spyCanvas.style.height = `${h}px`;
    const ctx = spyCanvas.getContext("2d");
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const couchW = w * 0.3;
    const couchH = couchW * 0.46;
    const nauseaSize = w * 0.11;
    const nauseaCount = 6;
    const nauseaX = [];
    for (let i = 0; i < nauseaCount; i++) nauseaX.push(((i + 0.5) / nauseaCount) * w);

    spyGame = {
      w,
      h,
      couchW,
      couchH,
      couchX: w / 2,
      couchCenterY: h - couchH * 0.5 - 8,
      vomitSize: w * 0.11,
      nauseaSize,
      nauseaY: nauseaSize * 0.75 + 4,
      nauseaX,
      vomits: [],
      avoided: 0,
      startAt: 0,
      lastFrame: 0,
      lastSpawnAt: 0,
    };
    spyMoveDir = 0;
  }

  function beginSpyPlay() {
    if (!spyGame) return;
    spyPhase = "playing";
    spyCountdownEl.classList.add("hidden");
    spykollenInstructionEl.textContent = "Undvik spyorna!";
    const now = performance.now();
    spyGame.startAt = now;
    spyGame.lastFrame = now;
    spyGame.lastSpawnAt = now;
    spyMoveDir = 0;
    spyRaf = window.requestAnimationFrame(spyLoop);
  }

  function spyLoop(now) {
    if (spyPhase !== "playing" || !spyGame) return;
    spyStep(now);
    if (spyPhase !== "playing") return; // a hit ended it inside the step
    drawSpy();
    spyRaf = window.requestAnimationFrame(spyLoop);
  }

  function spyStep(now) {
    const g = spyGame;
    const dt = Math.min(0.05, (now - g.lastFrame) / 1000);
    g.lastFrame = now;
    const elapsed = (now - g.startAt) / 1000;

    // Move the couch, clamped so the whole couch stays on the stage.
    g.couchX += spyMoveDir * SPY_COUCH_SPEED * g.w * dt;
    g.couchX = Math.max(g.couchW * 0.5, Math.min(g.w - g.couchW * 0.5, g.couchX));

    // Drop a burst of vomit from distinct nausea emojis — usually 1, more often
    // 2–3 as the round ramps, but never all of them so a dodge gap always exists.
    const gap = Math.max(SPY_MIN_SPAWN_MS, SPY_BASE_SPAWN_MS - elapsed * SPY_SPAWN_RAMP);
    if (now - g.lastSpawnAt >= gap) {
      spawnSpyBurst(elapsed);
      g.lastSpawnAt = now;
    }

    // Fall + resolve at the couch line (crossing test avoids tunnelling). The
    // hitbox is exactly the drawn couch width plus a little of the splat radius.
    const fall = SPY_BASE_FALL * g.h * (1 + elapsed * SPY_FALL_RAMP);
    const couchTopY = g.couchCenterY - g.couchH * 0.5;
    const half = g.couchW * 0.5;
    for (const v of g.vomits) {
      const prevY = v.y;
      v.y += fall * dt;
      if (!v.resolved && prevY < couchTopY && v.y >= couchTopY) {
        v.resolved = true;
        if (Math.abs(v.x - g.couchX) <= half + g.vomitSize * 0.3) {
          onSpyHit();
          return;
        }
        g.avoided += 1;
        spyScoreEl.textContent = String(g.avoided);
      }
    }
    g.vomits = g.vomits.filter((v) => v.y < g.h + g.vomitSize);
  }

  // Drops `burst` vomits from distinct random columns at once. Two adjacent
  // columns are always reserved vomit-free (couchW ≈ 2 column widths), so a
  // burst can never block every gap the couch could fit through. Burst grows
  // with elapsed time but is capped at SPY_MAX_BURST.
  function spawnSpyBurst(elapsed) {
    const g = spyGame;
    const cols = g.nauseaX.length;
    const gapStart = Math.floor(Math.random() * (cols - 1));
    const available = [];
    for (let i = 0; i < cols; i++) {
      if (i !== gapStart && i !== gapStart + 1) available.push(i);
    }

    const maxBurst = Math.min(SPY_MAX_BURST, available.length);
    let burst = 1;
    const p = Math.min(0.65, elapsed * 0.035);
    while (burst < maxBurst && Math.random() < p) burst += 1;

    for (let i = 0; i < burst; i++) {
      const j = i + Math.floor(Math.random() * (available.length - i));
      [available[i], available[j]] = [available[j], available[i]];
      g.vomits.push({ x: g.nauseaX[available[i]], y: g.nauseaY + g.nauseaSize * 0.5, resolved: false });
    }
  }

  // Synthwave floor shared by the arcade stages (Spykollen, Pissepaus): a pink
  // perspective grid fading toward a horizon line. Cheap enough for rAF loops
  // (~16 strokes per frame).
  function drawNeonFloor(ctx, w, h) {
    const horizon = h * 0.42;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 45, 120, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 45, 120, 0.14)";
    ctx.lineWidth = 1;
    // Horizontal lines: spacing grows quadratically toward the bottom edge.
    for (let i = 1; i <= 7; i++) {
      const t = i / 7;
      const y = horizon + t * t * (h - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Verticals fanning out from a vanishing point on the horizon.
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * (w / 24), horizon);
      ctx.lineTo(w / 2 + i * (w / 3.2), h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSpy() {
    if (!spyGame) return;
    const ctx = spyCanvas.getContext("2d");
    if (!ctx) return;
    const g = spyGame;
    ctx.clearRect(0, 0, g.w, g.h);
    drawNeonFloor(ctx, g.w, g.h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `${g.nauseaSize}px serif`;
    for (const nx of g.nauseaX) ctx.fillText("🤢", nx, g.nauseaY);

    ctx.font = `${g.vomitSize}px serif`;
    for (const v of g.vomits) ctx.fillText("🤮", v.x, v.y);

    // A cool blue rim glow so the couch pops off the dark floor.
    ctx.save();
    ctx.shadowColor = "rgba(91, 149, 223, 0.9)";
    ctx.shadowBlur = 14;
    drawCouch(ctx, g.couchX, g.couchCenterY, g.couchW, g.couchH);
    ctx.restore();
  }

  // Draws a simple couch whose footprint is exactly couchW × couchH (so it lines
  // up with the hitbox) — no stray lamp like the 🛋️ emoji carries.
  function drawCouch(ctx, cx, cy, cw, ch) {
    const left = cx - cw / 2;
    const top = cy - ch / 2;
    const r = ch * 0.22;
    // backrest
    ctx.fillStyle = "#3f78c2";
    roundRectPath(ctx, left, top, cw, ch * 0.62, r);
    ctx.fill();
    // armrests
    ctx.fillStyle = "#4a86d6";
    roundRectPath(ctx, left, top + ch * 0.28, cw * 0.16, ch * 0.72, r * 0.7);
    ctx.fill();
    roundRectPath(ctx, left + cw * 0.84, top + ch * 0.28, cw * 0.16, ch * 0.72, r * 0.7);
    ctx.fill();
    // seat base
    ctx.fillStyle = "#345f97";
    roundRectPath(ctx, left, top + ch * 0.5, cw, ch * 0.5, r * 0.8);
    ctx.fill();
    // cushions
    ctx.fillStyle = "#5b95df";
    roundRectPath(ctx, left + cw * 0.2, top + ch * 0.1, cw * 0.28, ch * 0.42, r * 0.6);
    ctx.fill();
    roundRectPath(ctx, left + cw * 0.52, top + ch * 0.1, cw * 0.28, ch * 0.42, r * 0.6);
    ctx.fill();
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function onSpyHit() {
    spyPhase = "done";
    if (spyRaf) {
      window.cancelAnimationFrame(spyRaf);
      spyRaf = null;
    }
    const avoided = spyGame ? spyGame.avoided : 0;
    const level = spyLevel(avoided);
    // The physical "you got hit" jolt; the red/green verdict signals right
    // below replace it with their own stronger patterns, yellow keeps it.
    vibrate(90);
    spykollenInstructionEl.textContent = "";
    spyResultEl.dataset.level = level.cls;
    spyResultEl.innerHTML =
      `<span class="spy-result-headline">${level.label}</span>` +
      `<span class="spy-result-score">${avoided} undvikna</span>` +
      `<span class="spy-result-msg">${level.message}</span>`;
    spyResultEl.classList.remove("hidden");
    if (level.alarm) signalSoberAlarm(spykollenOverlayEl);
    else if (level.celebrate) signalDrunkCelebration(spykollenOverlayEl);
    else playWinSound(false);
    recordRewardResult("spy", KLUNK_SPY[level.cls], level.label);
    recordStat("spy", avoided);
  }

  function spyLevel(avoided) {
    if (avoided >= SPY_GREEN_MIN) {
      return { cls: "red", label: "Nykter", message: "Stadig hand och skärpt blick! Du behöver öka takten.<br>Fortsätt dricka.", alarm: true };
    }
    if (avoided >= SPY_YELLOW_MIN) {
      return { cls: "yellow", label: "Salongsberusad", message: "Hyfsade reflexer. Du är på god väg.<br>Fortsätt dricka." };
    }
    return { cls: "green", label: "Full som ett ägg", message: "Soffan blev nedspydd direkt. Ser bra ut.<br>Fortsätt dricka.", celebrate: true };
  }

  function horizontalArrowToDir(key) {
    if (key === "ArrowLeft") return -1;
    if (key === "ArrowRight") return 1;
    return 0;
  }

  function onSpyKeyUp(event) {
    if (spyPhase !== "playing") return;
    const dir = horizontalArrowToDir(event.key);
    if (dir !== 0 && spyMoveDir === dir) spyMoveDir = 0;
  }

  function stopSpyGame() {
    if (spyRaf) {
      window.cancelAnimationFrame(spyRaf);
      spyRaf = null;
    }
    if (spyCountdownTimer) {
      window.clearInterval(spyCountdownTimer);
      spyCountdownTimer = null;
    }
    spyPhase = "idle";
    spyMoveDir = 0;
  }

  // ── Pissepaus (tilt-aiming mini-game) ─────────────────────────────────────

  // Aim the pee stream from the 🍆 at the bottom onto the 🚽 that spawns one
  // at a time; each hit respawns the next, never two at once. A 10s round,
  // hits map to the shared three-tier verdict (steady aim = too sober).
  // The round starts from an explicit "Starta" button because iOS only grants
  // tilt-sensor access from inside a user gesture.
  function openPissepaus() {
    openDialog(pissepausOverlayEl);
    pissCloseBtn.textContent = "Stäng";
    stopPissGame();
    stopVerdictEffects();
    pissResultEl.classList.add("hidden");
    pissCountdownEl.classList.add("hidden");
    pissStartBtn.classList.remove("hidden");
    pissepausInstructionEl.textContent = "";
    setupPissGame();
    drawPiss();
    updatePissHud(PISS_ROUND_MS);
    pissPhase = "ready";
    pissCanvas.dataset.state = "ready";
  }

  // Sizes the canvas to the wrapper and lays out the 🍆 origin + first 🚽.
  function setupPissGame() {
    const available = (pissCanvas.parentElement && pissCanvas.parentElement.clientWidth) || 300;
    const w = available;
    const h = Math.round(w * 1.4);
    const ratio = window.devicePixelRatio || 1;
    pissCanvas.width = Math.floor(w * ratio);
    pissCanvas.height = Math.floor(h * ratio);
    pissCanvas.style.height = `${h}px`;
    const ctx = pissCanvas.getContext("2d");
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    pissGame = {
      w,
      h,
      originX: w / 2,
      originY: h - 26,
      toiletSize: w * 0.15,
      toilet: { x: w / 2, y: h * 0.3 },
      hits: 0,
      aimX: w / 2,
      aimY: h * 0.45,
      targetX: w / 2,
      targetY: h * 0.45,
      lastFrame: 0,
      endAt: 0,
    };
    spawnPissToilet();
  }

  function spawnPissToilet() {
    const g = pissGame;
    const m = g.toiletSize * 0.7;
    // Anywhere on the stage except the 🍆 zone along the bottom — but never
    // right on the stream tip (a free hit); demand a third of the stage away,
    // giving up after a bounded number of tries.
    let x = g.w / 2;
    let y = g.h * 0.3;
    for (let i = 0; i < 20; i++) {
      x = m + Math.random() * (g.w - 2 * m);
      y = m + Math.random() * (g.h * 0.72 - m);
      if (Math.hypot(x - g.aimX, y - g.aimY) > g.h * 0.33) break;
    }
    g.toilet = { x, y };
    // Exposed for the Playwright suite: one-toilet-at-a-time is an invariant,
    // so a single coordinate pair is always the full spawn state.
    pissCanvas.dataset.toiletX = String(Math.round(g.toilet.x));
    pissCanvas.dataset.toiletY = String(Math.round(g.toilet.y));
  }

  function onPissStart() {
    if (pissPhase !== "ready") return;
    pissStartBtn.classList.add("hidden");
    // iOS gates orientation events behind a permission prompt that must be
    // requested from a user gesture — this click is that gesture. A denied or
    // absent sensor just leaves the pointer/arrow-key steering.
    const D = window.DeviceOrientationEvent;
    const permission =
      D && typeof D.requestPermission === "function"
        ? D.requestPermission().catch(() => "denied")
        : Promise.resolve("granted");
    const proceed = () => {
      if (pissPhase !== "ready") return; // dialog closed while the prompt was up
      window.addEventListener("deviceorientation", onPissOrientation);
      startPissCountdown();
    };
    permission.then(proceed, proceed);
  }

  function startPissCountdown() {
    pissPhase = "countdown";
    pissCanvas.dataset.state = "countdown";
    pissCountdownEl.classList.remove("hidden");
    let n = PISS_COUNTDOWN;
    pissCountdownEl.textContent = String(n);
    pissCountdownTimer = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        pissCountdownEl.textContent = String(n);
      } else {
        window.clearInterval(pissCountdownTimer);
        pissCountdownTimer = null;
        beginPissPlay();
      }
    }, 700);
  }

  function beginPissPlay() {
    if (!pissGame) return;
    pissPhase = "playing";
    pissCanvas.dataset.state = "playing";
    pissCountdownEl.classList.add("hidden");
    pissepausInstructionEl.textContent = "Sikta på toaletten!";
    const now = performance.now();
    pissGame.lastFrame = now;
    pissGame.endAt = now + PISS_ROUND_MS;
    pissRaf = window.requestAnimationFrame(pissLoop);
  }

  // Tilt steering: gamma (lean left/right, ±PISS_TILT_MAX_DEG) sweeps the aim
  // across the full width; beta maps device-upright (90°) to the shortest
  // stream and device-flat (0°) to the longest, so every spot is reachable.
  function onPissOrientation(event) {
    if (pissPhase !== "playing" || !pissGame) return;
    if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
    const g = pissGame;
    const gamma = Math.max(-PISS_TILT_MAX_DEG, Math.min(PISS_TILT_MAX_DEG, event.gamma));
    const beta = Math.max(0, Math.min(90, event.beta));
    g.targetX = g.w / 2 + (gamma / PISS_TILT_MAX_DEG) * (g.w / 2 - 8);
    g.targetY = 12 + (beta / 90) * (g.originY - 60 - 12);
  }

  function onPissPointer(event) {
    if (pissPhase !== "playing" || !pissGame) return;
    event.preventDefault();
    const rect = pissCanvas.getBoundingClientRect();
    const g = pissGame;
    g.targetX = Math.max(0, Math.min(g.w, ((event.clientX - rect.left) / rect.width) * g.w));
    g.targetY = Math.max(12, Math.min(g.originY - 60, ((event.clientY - rect.top) / rect.height) * g.h));
  }

  function nudgePissAim(dir) {
    const g = pissGame;
    if (!g) return;
    const step = 22;
    if (dir === "w") g.targetX -= step;
    else if (dir === "e") g.targetX += step;
    else if (dir === "n") g.targetY -= step;
    else if (dir === "s") g.targetY += step;
    g.targetX = Math.max(0, Math.min(g.w, g.targetX));
    g.targetY = Math.max(12, Math.min(g.originY - 60, g.targetY));
  }

  function pissLoop(now) {
    if (pissPhase !== "playing" || !pissGame) return;
    const g = pissGame;
    const remaining = g.endAt - now;
    if (remaining <= 0) {
      endPissRound();
      return;
    }

    // Glide the tip toward the steered target at the capped speed.
    const dt = Math.min(0.05, (now - g.lastFrame) / 1000);
    g.lastFrame = now;
    const dxT = g.targetX - g.aimX;
    const dyT = g.targetY - g.aimY;
    const dist = Math.hypot(dxT, dyT);
    const maxStep = PISS_AIM_SPEED * g.h * dt;
    if (dist <= maxStep) {
      g.aimX = g.targetX;
      g.aimY = g.targetY;
    } else if (dist > 0) {
      g.aimX += (dxT / dist) * maxStep;
      g.aimY += (dyT / dist) * maxStep;
    }

    // The stream tip is the hitbox: close enough to the bowl counts.
    if (Math.hypot(g.aimX - g.toilet.x, g.aimY - g.toilet.y) < g.toiletSize * 0.55) {
      g.hits += 1;
      vibrate(20);
      spawnPissToilet();
    }

    updatePissHud(remaining);
    drawPiss(now);
    pissRaf = window.requestAnimationFrame(pissLoop);
  }

  function updatePissHud(remainingMs) {
    pissTimerEl.textContent = `${(Math.max(0, remainingMs) / 1000).toFixed(1)} s`;
    pissScoreEl.textContent = String(pissGame ? pissGame.hits : 0);
  }

  function drawPiss(now = performance.now()) {
    const g = pissGame;
    if (!g || !(pissCanvas instanceof HTMLCanvasElement)) return;
    const ctx = pissCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, g.w, g.h);
    drawNeonFloor(ctx, g.w, g.h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Pulsing cyan target ring so the current toilet reads as THE objective.
    const ringR = g.toiletSize * 0.68 + Math.sin(now / 220) * 3;
    ctx.save();
    ctx.strokeStyle = "rgba(45, 226, 255, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(45, 226, 255, 0.9)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(g.toilet.x, g.toilet.y, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = `${Math.floor(g.toiletSize)}px serif`;
    ctx.fillText("🚽", g.toilet.x, g.toilet.y);

    // The 🍆 leans toward the aim so it reads as the nozzle.
    const lean = ((g.aimX - g.w / 2) / (g.w / 2)) * 0.5;
    ctx.save();
    ctx.translate(g.originX, g.originY);
    ctx.rotate(lean);
    ctx.font = `${Math.floor(g.w * 0.13)}px serif`;
    ctx.fillText("🍆", 0, 0);
    ctx.restore();

    if (pissPhase !== "playing") return;

    // The stream: a wobbling arc from the 🍆 tip to the aim point, with a few
    // splash droplets circling the tip.
    const t = now / 1000;
    const sx = g.originX + lean * 20;
    const sy = g.originY - g.w * 0.08;
    const cx = (sx + g.aimX) / 2 + Math.sin(t * 9) * 5;
    const cy = Math.min(sy, g.aimY) - Math.abs(sx - g.aimX) * 0.18 - 24;
    ctx.strokeStyle = "rgba(250, 224, 45, 0.9)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(250, 224, 45, 0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, g.aimX, g.aimY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(250, 224, 45, 0.85)";
    for (let i = 0; i < 3; i++) {
      const a = t * 10 + i * 2.1;
      ctx.beginPath();
      ctx.arc(g.aimX + Math.cos(a) * 7, g.aimY + Math.sin(a) * 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function endPissRound() {
    pissPhase = "done";
    pissCanvas.dataset.state = "done";
    if (pissRaf) {
      window.cancelAnimationFrame(pissRaf);
      pissRaf = null;
    }
    const hits = pissGame ? pissGame.hits : 0;
    const level = pissLevel(hits);
    updatePissHud(0);
    pissepausInstructionEl.textContent = "";
    drawPiss();
    pissResultEl.dataset.level = level.cls;
    pissResultEl.innerHTML =
      `<span class="piss-result-headline">${level.label}</span>` +
      `<span class="piss-result-score">${hits} 🚽</span>` +
      `<span class="piss-result-msg">${level.message}</span>`;
    pissResultEl.classList.remove("hidden");
    if (level.alarm) signalSoberAlarm(pissepausOverlayEl);
    else if (level.celebrate) signalDrunkCelebration(pissepausOverlayEl);
    else playWinSound(false);
    recordRewardResult("piss", Math.min(KLUNK_PISS_MAX, hits), level.label);
    recordStat("piss", hits);
  }

  function pissLevel(hits) {
    if (hits >= PISS_NYKTER_MIN) {
      return { cls: "red", label: "Nykter", message: "Kirurgisk träffsäkerhet. Du behöver öka takten.<br>Fortsätt dricka.", alarm: true };
    }
    if (hits >= PISS_SALONG_MIN) {
      return { cls: "yellow", label: "Salongsberusad", message: "Lite stänk vid sidan om. Du är på god väg.<br>Fortsätt dricka." };
    }
    return { cls: "green", label: "Full som ett ägg", message: "Du pissade mest på väggarna. Ser bra ut.<br>Fortsätt dricka.", celebrate: true };
  }

  // rAF + countdown + the orientation listener are all torn down here; called
  // on round teardown and from closeDialog so a closed dialog can't keep
  // listening to the gyroscope.
  function stopPissGame() {
    if (pissRaf) {
      window.cancelAnimationFrame(pissRaf);
      pissRaf = null;
    }
    if (pissCountdownTimer) {
      window.clearInterval(pissCountdownTimer);
      pissCountdownTimer = null;
    }
    window.removeEventListener("deviceorientation", onPissOrientation);
    pissPhase = "idle";
  }

  // ── Win detection ─────────────────────────────────────────────────────────

  function updateStatsAndWinState({ triggerEffects }) {
    if (!state) return;

    const marked = state.checked.length;
    const lines = getWinningLines(state.checked);
    const lineKeys = lines.map((line) => line.join("-"));

    highlightWinningCells(lines);

    if (triggerEffects) {
      const newLines = lineKeys.filter((line) => !state.bingoLinesAwarded.includes(line));
      if (newLines.length > 0) {
        state.bingoLinesAwarded = [...state.bingoLinesAwarded, ...newLines];
        saveState();
      }

      const justGrandWin = marked === CELL_COUNT && !state.grandWin;
      if (justGrandWin) {
        state.grandWin = true;
        saveState();
      } else if (marked < CELL_COUNT && state.grandWin) {
        state.grandWin = false;
        saveState();
      }

      // A grand win supersedes the single-line reward for the same check: filling
      // the last cell also completes lines, but we only run one reward flow.
      if (justGrandWin) startGrandReward();
      else if (newLines.length > 0) startBingoReward();
      else if (marked === CELL_COUNT - 1) {
        // Kommentatorn: tension calls when no reward fired this check.
        sayCommentary(randomItem(KOMMENTATOR.almostGrand));
      } else {
        const checkedSet = new Set(state.checked);
        const almost = getAllBoardLines().some(
          (line) =>
            line.filter((i) => checkedSet.has(i)).length === BOARD_SIZE - 1 &&
            !state.bingoLinesAwarded.includes(line.join("-"))
        );
        if (almost) sayCommentary(randomItem(KOMMENTATOR.almost));
      }
    }
  }

  function highlightWinningCells(lines) {
    // Position along the line drives the pulse's animation-delay (via
    // --win-order), so the neon shimmer travels down the row like a marquee
    // instead of blinking all at once. A cell in two lines keeps the last order.
    const order = new Map();
    lines.forEach((line) => line.forEach((cellIdx, i) => order.set(cellIdx, i)));
    boardEl.querySelectorAll(".cell").forEach((cell, idx) => {
      if (order.has(idx)) {
        cell.dataset.winning = "true";
        cell.style.setProperty("--win-order", String(order.get(idx)));
      } else {
        cell.dataset.winning = "false";
        cell.style.removeProperty("--win-order");
      }
    });
  }

  // All 10 candidate lines (4 rows + 4 columns + 2 diagonals).
  function getAllBoardLines() {
    const lines = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      const rowLine = [];
      for (let col = 0; col < BOARD_SIZE; col++) rowLine.push(row * BOARD_SIZE + col);
      lines.push(rowLine);
    }
    for (let col = 0; col < BOARD_SIZE; col++) {
      const colLine = [];
      for (let row = 0; row < BOARD_SIZE; row++) colLine.push(row * BOARD_SIZE + col);
      lines.push(colLine);
    }
    const diagOne = [];
    const diagTwo = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      diagOne.push(i * BOARD_SIZE + i);
      diagTwo.push(i * BOARD_SIZE + (BOARD_SIZE - 1 - i));
    }
    lines.push(diagOne, diagTwo);
    return lines;
  }

  function getWinningLines(checked) {
    const checkedSet = new Set(checked);
    return getAllBoardLines().filter((line) => line.every((i) => checkedSet.has(i)));
  }

  // ── Bingo rewards ─────────────────────────────────────────────────────────

  // A bingo no longer hands out a fixed prize: it launches a mini-game whose
  // result decides how many "klunkar" (sips) you get to share out to everyone.
  // A single line plays one random game; a grand win plays all five in a row and
  // sums them. recordRewardResult is a no-op outside a session, so the beer-
  // counter rotation and the test menu keep running the games exactly as before.
  const REWARD_GAMES = {
    fyllekollen: { open: openFyllekollen, overlay: fyllekollenOverlayEl, closeBtn: fyllekollenCloseBtn, label: "Fyllekollen", blurb: "Led 🐭 till 🍺" },
    reaktion: { open: openReaktionskollen, overlay: reaktionOverlayEl, closeBtn: reaktionCloseBtn, label: "Reaktionskollen", blurb: "Tryck när 🍺 dyker upp" },
    minne: { open: openMinneslucka, overlay: memoryOverlayEl, closeBtn: memoryCloseBtn, label: "Minnesluckatestet", blurb: "Räkna 🍺 och 🐭" },
    spy: { open: openSpykollen, overlay: spykollenOverlayEl, closeBtn: spyCloseBtn, label: "Spykollen", blurb: "Undvik 🤮 med 🛋️ - en hommage till Per" },
    piss: { open: openPissepaus, overlay: pissepausOverlayEl, closeBtn: pissCloseBtn, label: "Pissepaus", blurb: "Luta mobilen och sikta 🍆-strålen på 🚽" },
  };
  const REWARD_GAME_IDS = Object.keys(REWARD_GAMES);

  function startBingoReward() {
    playWinSound(false);
    runConfetti(1800);
    vibrate([60, 50, 60]);
    rewardSession = newRewardSession("single", [randomItem(REWARD_GAME_IDS)]);
    showRewardIntro();
  }

  function startGrandReward() {
    playWinSound(true);
    runConfetti(3400);
    vibrate([80, 60, 80, 60, 80, 60, 300]);
    document.body.classList.add("champion");
    setTimeout(() => document.body.classList.remove("champion"), 5600);
    const order = REWARD_GAME_IDS.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    rewardSession = newRewardSession("grand", order);
    showRewardIntro();
  }

  function newRewardSession(mode, queue) {
    return { mode, queue, idx: 0, total: 0, breakdown: [], currentOverlay: null, resolved: false };
  }

  function showRewardIntro() {
    const grand = rewardSession.mode === "grand";
    rewardTitleEl.textContent = grand ? "HELA BRICKAN KLAR!" : "BINGO!";
    const preview = grand
      ? `<ul class="reward-game-list">${rewardSession.queue
          .map((id) => {
            const g = REWARD_GAMES[id];
            return `<li><strong>${g.label}</strong> — ${g.blurb}</li>`;
          })
          .join("")}</ul>`
      : `<p class="reward-game-preview"><strong>${REWARD_GAMES[rewardSession.queue[0]].label}</strong> — ${REWARD_GAMES[rewardSession.queue[0]].blurb}</p>`;
    rewardBodyEl.innerHTML =
      (grand
        ? `<p class="reward-lead">Spela alla fem spelen — summan av klunkarna delar du sedan ut till alla i sällskapet.</p>`
        : `<p class="reward-lead">Spela ett spel. Resultatet avgör hur många klunkar du får dela ut till alla i sällskapet.</p>`) +
      preview;
    rewardActionBtn.textContent = grand ? "Kör alla fem" : "Spela";
    rewardActionHandler = () => {
      rewardTransitioning = true;
      closeDialog(rewardOverlayEl);
      rewardTransitioning = false;
      startCurrentRewardGame();
    };
    openDialog(rewardOverlayEl);
  }

  function startCurrentRewardGame() {
    const g = REWARD_GAMES[rewardSession.queue[rewardSession.idx]];
    rewardSession.currentOverlay = g.overlay;
    rewardSession.resolved = false;
    g.open();
  }

  // Each mini-game's terminal result calls this; outside a session it no-ops.
  // Klunkar round to nearest, never below 0. The close button advances the flow.
  function recordRewardResult(gameId, klunkar, verdict) {
    if (!rewardSession || rewardSession.resolved) return;
    rewardSession.resolved = true;
    const g = REWARD_GAMES[gameId];
    const amount = Math.max(0, Math.round(klunkar));
    rewardSession.total += amount;
    rewardSession.breakdown.push({ label: g.label, verdict, klunkar: amount });
    const last = rewardSession.idx >= rewardSession.queue.length - 1;
    g.closeBtn.textContent = last ? "Klar" : "Nästa spel";
  }

  // Closing the current game (button, Escape, or backdrop) moves the flow on;
  // an unfinished game counts as 0. Called from closeDialog.
  function advanceRewardAfterGame() {
    if (!rewardSession.resolved) {
      const g = REWARD_GAMES[rewardSession.queue[rewardSession.idx]];
      rewardSession.breakdown.push({ label: g.label, verdict: "Avbrutet", klunkar: 0 });
    }
    rewardSession.currentOverlay = null;
    rewardSession.idx += 1;
    if (rewardSession.idx < rewardSession.queue.length) startCurrentRewardGame();
    else showRewardPayout();
  }

  function showRewardPayout() {
    const grand = rewardSession.mode === "grand";
    rewardTitleEl.textContent = grand ? "HELA BRICKAN KLAR!" : "BINGO!";
    const rows = rewardSession.breakdown
      .map(
        (b) =>
          `<li><span class="reward-row-game">${b.label}</span>` +
          `<span class="reward-row-verdict">${b.verdict}</span>` +
          `<span class="reward-row-klunk">${b.klunkar} ${b.klunkar === 1 ? "klunk" : "klunkar"}</span></li>`
      )
      .join("");
    const total = rewardSession.total;
    rewardBodyEl.innerHTML =
      `<ul class="reward-breakdown">${rows}</ul>` +
      `<p class="reward-total">Dela ut <strong>${total}</strong> ${total === 1 ? "klunk" : "klunkar"} till alla i sällskapet!</p>`;
    rewardActionBtn.textContent = "Klart";
    rewardActionHandler = () => closeDialog(rewardOverlayEl);
    runConfetti(2200);
    playWinSound(true);
    openDialog(rewardOverlayEl);
    // Tally + broadcast the finished reward — the payout is the moment the
    // klunkar total exists. The shared id keys the recap dedupe, so a `since`
    // replay of this event (own device id changes on reload) can't double-count.
    const rewardEventId = generateSeed();
    bumpNight(activePlayerId, grand ? "grand" : "single", total, rewardEventId);
    publishParty({ t: "bingo", id: rewardEventId, p: activePlayerId, kind: grand ? "grand" : "single", k: total });
  }

  // ── Party-länk (live sync between phones) ─────────────────────────────────

  // Every phone in live mode joins one shared pub/sub topic (see the PARTY_*
  // constants): beer counts stream into a live roster ("Ölligan") and a
  // finished bingo reward takes over everyone ELSE's screen with fanfare,
  // vibration, and the Swedish voice. Publishing is fire-and-forget fetch
  // POSTs; receiving is one auto-reconnecting EventSource. Everything degrades
  // silently — no sensor, no net, or party-läge off just means a quiet phone.

  function isPartyEnabled() {
    return safeGet(PARTY_KEY) !== "off";
  }

  function connectParty() {
    if (currentMode !== MODE_LIVE || !isPartyEnabled()) return;
    if (partyEs || typeof window.EventSource !== "function") return;
    setPartyStatus("connecting");
    // `since` replays the recent stream so the roster is warm on join;
    // onPartyEvent only lets *fresh* bingo events flash (PARTY_FRESH_MS).
    const es = new EventSource(`${PARTY_SERVER}/${PARTY_TOPIC}/sse?since=${PARTY_SINCE}`);
    partyEs = es;
    es.onopen = () => {
      if (partyEs !== es) return;
      setPartyStatus("on");
      publishPartyHello();
    };
    // EventSource reconnects on its own; just reflect the state.
    es.onerror = () => {
      if (partyEs === es) setPartyStatus("connecting");
    };
    es.onmessage = (e) => {
      if (partyEs !== es) return;
      let envelope;
      try {
        envelope = JSON.parse(e.data);
      } catch {
        return;
      }
      if (typeof envelope.message !== "string") return;
      let evt;
      try {
        evt = JSON.parse(envelope.message);
      } catch {
        return;
      }
      if (!evt || evt.d === partyDeviceId) return; // own echo
      onPartyEvent(evt, (envelope.time || 0) * 1000, envelope.id);
    };
  }

  function disconnectParty() {
    if (partyEs) {
      partyEs.close();
      partyEs = null;
    }
    if (partyBeerTimer) {
      window.clearTimeout(partyBeerTimer);
      partyBeerTimer = null;
    }
    partyPlayers = {};
    setPartyStatus("off");
  }

  function publishParty(evt) {
    if (!partyEs) return; // party not running (test mode, disabled, exited)
    try {
      fetch(`${PARTY_SERVER}/${PARTY_TOPIC}`, {
        method: "POST",
        body: JSON.stringify({ ...evt, d: partyDeviceId }),
      }).catch(() => {});
    } catch {
      /* fire-and-forget */
    }
  }

  function publishPartyHello() {
    partyLastHelloAt = Date.now();
    publishParty({ t: "hello", p: activePlayerId, c: beerCountOf(loadBeers(), activePlayerId) });
  }

  // Rapid +/- taps collapse into one publish with the final count.
  function schedulePartyBeerPublish(playerId) {
    if (!partyEs) return;
    if (partyBeerTimer) window.clearTimeout(partyBeerTimer);
    partyBeerTimer = window.setTimeout(() => {
      partyBeerTimer = null;
      publishParty({ t: "beer", p: playerId, c: beerCountOf(loadBeers(), playerId) });
    }, PARTY_BEER_DEBOUNCE_MS);
  }

  function onPartyEvent(evt, atMs, eventId) {
    if (!isValidPlayerId(evt.p)) return;

    if (evt.t === "hello" || evt.t === "beer") {
      const prev = partyPlayers[evt.p];
      if (!prev || atMs >= prev.at) {
        partyPlayers[evt.p] = { count: typeof evt.c === "number" ? evt.c : prev && prev.count, at: atMs };
      }
      // Hello ping-pong: a fresh join announces itself; answering (at most
      // once a minute, so responses to responses die out) means a late joiner
      // learns who's already here even past the `since` replay window.
      if (evt.t === "hello" && Date.now() - atMs < PARTY_FRESH_MS && Date.now() - partyLastHelloAt > 60000) {
        publishPartyHello();
      }
      if (activeDialog === partyOverlayEl) renderPartyRoster();
      return;
    }

    if (evt.t === "bingo") {
      partyPlayers[evt.p] = { count: partyPlayers[evt.p] && partyPlayers[evt.p].count, at: atMs };
      const klunkar = Math.max(0, Math.round(evt.k || 0));
      const grand = evt.kind === "grand";
      // Tally for Kvällens recap, deduped by event id so a `since` replay
      // after a reload can't double-count.
      bumpNight(evt.p, evt.kind, klunkar, evt.id || eventId || `${evt.p}:${evt.k}:${atMs}`);
      // Replayed history from `since` must not take over the screen — only
      // genuinely-live bingos flash.
      if (Date.now() - atMs > PARTY_FRESH_MS) return;
      if (evt.p === activePlayerId) return; // it's this player's own win
      const label = getPlayer(evt.p).label;
      showPartyFlash(
        grand ? "🏆 HELA BRICKAN!" : "🎉 BINGO!",
        `${label} delar ut ${klunkar} ${klunkar === 1 ? "klunk" : "klunkar"} — DRICK!`,
        `${spokenName(evt.p)} har ${grand ? "hela brickan" : "bingo"}! Drick ${klunkar} klunkar!`
      );
      return;
    }

    if (evt.t === "rekord") {
      const news = applyRemoteRecord(evt.p, evt.g, evt.v);
      if (activeDialog === rekordOverlayEl) renderRekordList();
      if (!news || Date.now() - atMs > PARTY_FRESH_MS) return;
      const meta = REKORD_META[evt.g];
      showPartyFlash(
        "🏆 NYTT REKORD!",
        `${getPlayer(evt.p).label}: ${meta.label} — ${meta.fmt(evt.v)}`,
        `Nytt rekord! ${spokenName(evt.p)}: ${meta.speech(evt.v)}`
      );
    }
  }

  function showPartyFlash(title, text, speech) {
    if (partyFlashTimer) window.clearTimeout(partyFlashTimer);
    partyFlashTitleEl.textContent = title;
    partyFlashTextEl.textContent = text;
    partyFlashEl.classList.remove("hidden");
    confettiCanvas.classList.add("confetti--front");
    runConfetti(2600);
    playPartySound();
    vibrate([80, 60, 80, 60, 220]);
    if (speech) speakVerdict(speech);
    partyFlashTimer = window.setTimeout(hidePartyFlash, PARTY_FLASH_MS);
  }

  function hidePartyFlash() {
    if (partyFlashTimer) {
      window.clearTimeout(partyFlashTimer);
      partyFlashTimer = null;
    }
    partyFlashEl.classList.add("hidden");
    // Only drop the lifted confetti if no verdict celebration owns it.
    if (!drunkPartyEl) confettiCanvas.classList.remove("confetti--front");
  }

  function openPartyOverlay() {
    connectParty(); // idempotent; re-tries if it was never started
    renderPartyRoster();
    renderPartyStatus();
    openDialog(partyOverlayEl);
  }

  function onPartyToggle() {
    if (isPartyEnabled()) {
      safeSet(PARTY_KEY, "off");
      disconnectParty();
    } else {
      safeSet(PARTY_KEY, "on");
      connectParty();
    }
    renderPartyStatus();
    renderPartyRoster();
  }

  function setPartyStatus(status) {
    partyStatus = status;
    renderPartyStatus();
  }

  function renderPartyStatus() {
    const enabled = isPartyEnabled();
    partyStatusDotEl.dataset.state = enabled ? partyStatus : "off";
    partyStatusTextEl.textContent = !enabled
      ? "Avstängd"
      : partyStatus === "on"
        ? "Ansluten"
        : partyStatus === "connecting"
          ? "Ansluter…"
          : "Avstängd";
    partyToggleBtn.textContent = enabled ? "Stäng av party-läge" : "Slå på party-läge";
  }

  function renderPartyRoster() {
    partyRosterEl.innerHTML = "";
    players.forEach((player) => {
      const seen = partyPlayers[player.id];
      const isSelf = player.id === activePlayerId;
      const li = document.createElement("li");
      li.dataset.seen = seen || isSelf ? "true" : "false";
      const name = document.createElement("span");
      name.textContent = player.label + (isSelf ? " (du)" : "");
      const beers = document.createElement("span");
      beers.className = "party-beers";
      const count = isSelf
        ? beerCountOf(loadBeers(), player.id)
        : seen && typeof seen.count === "number"
          ? seen.count
          : null;
      beers.textContent = count === null ? "–" : `${count} 🍺`;
      li.append(name, beers);
      partyRosterEl.appendChild(li);
    });
  }

  // ── Rekord (Hall of Fame) ─────────────────────────────────────────────────

  // Per-player all-time records, keyed stats[playerId][gameId] = { v, at }.
  // Every mini-game's terminal result calls recordStat; a genuine improvement
  // (not the seeding first result) triggers the NYTT REKORD takeover — delayed
  // a beat so the verdict effects land first — and broadcasts to the party,
  // where applyRemoteRecord converges every phone's Hall of Fame.
  const REKORD_META = {
    reaktion: {
      label: "Reaktionskollen",
      better: "lower",
      fmt: (v) => `${v} ms`,
      speech: (v) => `snabbaste reaktionen, ${v} millisekunder`,
    },
    fylle: {
      label: "Fyllekollen",
      better: "higher",
      fmt: (v) => `${v.toFixed(1)} s kvar`,
      speech: (v) => `${v.toFixed(1)} sekunder kvar i labyrinten`,
    },
    minne: {
      label: "Minnesluckatestet",
      better: "higher",
      fmt: (v) => `${v}/2 rätt`,
      speech: (v) => `${v} av 2 rätt i minnestestet`,
    },
    spy: {
      label: "Spykollen",
      better: "higher",
      fmt: (v) => `${v} undvikna`,
      speech: (v) => `${v} undvikna spyor`,
    },
    piss: {
      label: "Pissepaus",
      better: "higher",
      fmt: (v) => `${v} träffade 🚽`,
      speech: (v) => `${v} träffade toaletter`,
    },
  };

  function loadStats() {
    return loadJSON(STATS_KEY, () => ({}), isPlainObject);
  }

  function isBetterRecord(meta, value, prev) {
    if (!prev) return true;
    return meta.better === "lower" ? value < prev.v : value > prev.v;
  }

  function recordStat(gameId, value) {
    if (currentMode !== MODE_LIVE || !activePlayerId) return;
    const meta = REKORD_META[gameId];
    if (!meta || typeof value !== "number" || !isFinite(value)) return;
    const stats = loadStats();
    const entry = stats[activePlayerId] || (stats[activePlayerId] = {});
    const prev = entry[gameId];
    if (!isBetterRecord(meta, value, prev)) return;
    entry[gameId] = { v: value, at: Date.now() };
    safeSet(STATS_KEY, JSON.stringify(stats));
    if (!prev) return; // first-ever result seeds silently
    const label = getPlayer(activePlayerId).label;
    // Let the round's own verdict effects land before the takeover.
    window.setTimeout(() => {
      showPartyFlash(
        "🏆 NYTT REKORD!",
        `${label}: ${meta.label} — ${meta.fmt(value)}`,
        `Nytt rekord! ${spokenName(activePlayerId)}: ${meta.speech(value)}`
      );
    }, 1400);
    publishParty({ t: "rekord", p: activePlayerId, g: gameId, v: value });
  }

  // A record heard over the party: store if it beats what this phone knows
  // (converging every phone's list), return whether it was news.
  function applyRemoteRecord(playerId, gameId, value) {
    const meta = REKORD_META[gameId];
    if (!meta || typeof value !== "number" || !isFinite(value)) return false;
    const stats = loadStats();
    const entry = stats[playerId] || (stats[playerId] = {});
    if (!isBetterRecord(meta, value, entry[gameId])) return false;
    entry[gameId] = { v: value, at: Date.now() };
    safeSet(STATS_KEY, JSON.stringify(stats));
    return true;
  }

  function renderRekordList() {
    const stats = loadStats();
    rekordListEl.innerHTML = "";
    Object.keys(REKORD_META).forEach((gameId) => {
      const meta = REKORD_META[gameId];
      let best = null;
      let holder = null;
      players.forEach((player) => {
        const rec = stats[player.id] && stats[player.id][gameId];
        if (rec && (!best || isBetterRecord(meta, rec.v, best))) {
          best = rec;
          holder = player;
        }
      });
      const li = document.createElement("li");
      li.dataset.set = best ? "true" : "false";
      const game = document.createElement("span");
      game.className = "rekord-game";
      game.textContent = meta.label;
      const value = document.createElement("span");
      value.className = "rekord-value";
      if (best) {
        const strong = document.createElement("strong");
        strong.textContent = meta.fmt(best.v);
        value.append(strong, ` — ${holder.label}`);
      } else {
        value.textContent = "–";
      }
      li.append(game, value);
      rekordListEl.appendChild(li);
    });
  }

  // ── Kvällens recap ────────────────────────────────────────────────────────

  // Tonight's tallies: bingos/grand wins/klunkar per player, own results from
  // showRewardPayout and everyone else's via party bingo events (deduped by
  // event id so `since` replays don't double-count). Resets after 18h quiet.
  function loadNight() {
    const night = loadJSON(NIGHT_KEY, createFreshNight, isPlainObject);
    if (!isPlainObject(night.players) || typeof night.at !== "number" || Date.now() - night.at > NIGHT_RESET_MS) {
      return createFreshNight();
    }
    return night;
  }

  function createFreshNight() {
    return { at: Date.now(), seen: [], players: {} };
  }

  function bumpNight(playerId, kind, klunkar, dedupeId) {
    if (!isValidPlayerId(playerId)) return;
    const night = loadNight();
    if (dedupeId) {
      if (night.seen.includes(dedupeId)) return;
      night.seen.push(dedupeId);
      if (night.seen.length > 60) night.seen = night.seen.slice(-60);
    }
    const row = night.players[playerId] || (night.players[playerId] = { bingos: 0, grand: 0, klunkar: 0 });
    if (kind === "grand") row.grand += 1;
    else row.bingos += 1;
    row.klunkar += Math.max(0, Math.round(klunkar || 0));
    night.at = Date.now();
    safeSet(NIGHT_KEY, JSON.stringify(night));
  }

  // Beer counts for the poster: own from this phone, others preferably from
  // the live party roster (their own phones are authoritative).
  function recapBeerCount(playerId) {
    const local = beerCountOf(loadBeers(), playerId);
    if (playerId === activePlayerId) return local;
    const seen = partyPlayers[playerId];
    return seen && typeof seen.count === "number" ? seen.count : local;
  }

  function renderRecap() {
    const W = 1080;
    const H = 1350;
    recapCanvas.width = W;
    recapCanvas.height = H;
    const ctx = recapCanvas.getContext("2d");
    if (!ctx) return;

    const night = loadNight();
    const rows = players
      .map((player) => ({
        player,
        beers: recapBeerCount(player.id),
        stats: night.players[player.id] || { bingos: 0, grand: 0, klunkar: 0 },
      }))
      .sort((a, b) => b.beers - a.beers);
    const maxBeers = Math.max(1, ...rows.map((r) => r.beers));
    const totals = rows.reduce(
      (acc, r) => ({
        bingos: acc.bingos + r.stats.bingos,
        grand: acc.grand + r.stats.grand,
        klunkar: acc.klunkar + r.stats.klunkar,
      }),
      { bingos: 0, grand: 0, klunkar: 0 }
    );

    // Ground
    const bg = ctx.createRadialGradient(W * 0.25, H * 0.06, 80, W * 0.5, H * 0.5, H);
    bg.addColorStop(0, "#2a0b3d");
    bg.addColorStop(0.55, "#170529");
    bg.addColorStop(1, "#05010c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 108) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // Neon frame
    ctx.strokeStyle = "#ff2d78";
    ctx.lineWidth = 6;
    ctx.shadowColor = "#ff2d78";
    ctx.shadowBlur = 26;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.shadowBlur = 0;

    ctx.textAlign = "center";
    ctx.fillStyle = "#5beaff";
    ctx.font = "900 40px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText("🐭 STYGG MUS BINGO", W / 2, 120);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#ff2d78";
    ctx.shadowBlur = 34;
    ctx.font = "900 92px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText("KVÄLLENS RECAP", W / 2, 226);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#bda4d4";
    ctx.font = "800 34px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText(new Date().toLocaleDateString("sv-SE"), W / 2, 282);

    // Ölligan bars
    const barLeft = 90;
    const barMaxW = W - 340;
    rows.forEach((row, i) => {
      const y = 380 + i * 128;
      ctx.textAlign = "left";
      ctx.fillStyle = "#fdf3ff";
      ctx.font = "900 40px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.fillText(row.player.label, barLeft, y);
      const w = Math.max(14, (row.beers / maxBeers) * barMaxW);
      ctx.fillStyle = "#faff2d";
      ctx.shadowColor = "#faff2d";
      ctx.shadowBlur = 18;
      ctx.fillRect(barLeft, y + 22, w, 34);
      ctx.shadowBlur = 0;
      ctx.textAlign = "right";
      ctx.font = "900 44px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.fillText(`${row.beers} 🍺`, W - 90, y + 54);
    });

    // Totals
    const totalsY = 380 + rows.length * 128 + 40;
    ctx.strokeStyle = "rgba(45, 226, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(90, totalsY - 62);
    ctx.lineTo(W - 90, totalsY - 62);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#5beaff";
    ctx.font = "900 42px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText(
      `🎉 ${totals.bingos} bingo · 🏆 ${totals.grand} hela brickan · 🍻 ${totals.klunkar} klunkar`,
      W / 2,
      totalsY
    );

    // Kvällens Fyllo
    const fyllo = rows[0];
    ctx.fillStyle = "#bda4d4";
    ctx.font = "900 38px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText("KVÄLLENS FYLLO", W / 2, H - 220);
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#ff2d78";
    ctx.shadowBlur = 30;
    ctx.font = "900 64px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText(
      fyllo.beers > 0 ? `👑 ${fyllo.player.label}` : "Ingen?! Skärpning.",
      W / 2,
      H - 140
    );
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#bda4d4";
    ctx.font = "800 30px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText("oski89.github.io/styggmus-bingo", W / 2, H - 68);

    // CRT finish: faint scanlines + corner vignette over the whole poster.
    ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    const vin = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    vin.addColorStop(0, "rgba(0, 0, 0, 0)");
    vin.addColorStop(1, "rgba(0, 0, 0, 0.32)");
    ctx.fillStyle = vin;
    ctx.fillRect(0, 0, W, H);
  }

  function shareRecap() {
    if (!(recapCanvas instanceof HTMLCanvasElement)) return;
    recapCanvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "kvallens-recap.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Kvällens recap — Stygg Mus Bingo" });
          return;
        } catch {
          /* cancelled → fall through to download */
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kvallens-recap.png";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  }

  // ── Kommentatorn ──────────────────────────────────────────────────────────

  // A sportscaster voice for the moments between verdicts. Few, deterministic
  // triggers (near-bingo, near-grand, beer milestones, false starts) with a
  // global cooldown, and it never interrupts ongoing speech — the verdict
  // shouts always win.
  const KOMMENTATOR = {
    almost: [
      "En ruta kvar till bingo. Det darrar i lokalen!",
      "Bingovittring! Bara en ruta kvar.",
      "Nu är det nära. En enda ruta kvar!",
    ],
    almostGrand: [
      "EN RUTA KVAR PÅ HELA BRICKAN. Historiskt ögonblick på gång!",
      "Hela brickan hänger på en enda ruta!",
    ],
    falskstart: [
      "Falskstart! Alldeles för nykter och ivrig.",
      "Falskstart. Domaren skakar på huvudet.",
    ],
  };

  function spokenName(playerId) {
    return getPlayer(playerId).label.replace(/^\S+\s/, "");
  }

  function kommentatorBeerLine(count, name) {
    if (count === 5) return `${name} tar sin femte öl. Nu börjar det likna något.`;
    if (count === 10) return `Tvåsiffrigt! ${name} är uppe i tio öl. Publiken jublar.`;
    if (count === 15) return `Femton öl för ${name}. Vi är imponerade och lite oroliga.`;
    return `${count} öl för ${name}. Fortsätt dricka.`;
  }

  function sayCommentary(text) {
    if (currentMode !== MODE_LIVE || !text) return;
    if (!("speechSynthesis" in window)) return;
    if (window.speechSynthesis.speaking) return; // never talk over a verdict
    const now = Date.now();
    if (now - kommentatorLastAt < KOMMENTATOR_COOLDOWN_MS) return;
    kommentatorLastAt = now;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sv-SE";
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang && v.lang.toLowerCase().startsWith("sv"));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  }

  // ── Celebrations ──────────────────────────────────────────────────────────

  // `tone` "fail" red-tints the heading; default is the celebratory gold.
  function showOverlay(title, text, tone) {
    overlayTitleEl.textContent = title;
    overlayTextEl.textContent = text;
    overlayEl.dataset.tone = tone === "fail" ? "fail" : "normal";
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
    acquireWakeLock();
    const focusable = getFocusable(dialogEl);
    if (focusable.length) focusable[0].focus();
  }

  // Keeps the screen awake while a dialog is open — a phone dimming mid-round
  // would kill a mini-game. Fire-and-forget: unsupported browsers just skip it.
  // The browser force-releases the lock whenever the tab is hidden, so a
  // visibilitychange listener re-acquires it if a dialog is still up.
  function acquireWakeLock() {
    if (!navigator.wakeLock || wakeLock) return;
    navigator.wakeLock.request("screen").then(
      (lock) => {
        wakeLock = lock;
        lock.addEventListener("release", () => {
          if (wakeLock === lock) wakeLock = null;
        });
      },
      () => {}
    );
  }

  function releaseWakeLock() {
    if (!wakeLock) return;
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  function closeDialog(dialogEl) {
    dialogEl.classList.add("hidden");
    if (activeDialog === dialogEl) activeDialog = null;
    // A confirm that's dismissed any way other than its accept button (cancel,
    // Escape, backdrop) is a "no" — drop the pending action and remember its
    // onCancel (if any) to run once this dialog has fully finished closing.
    // `pendingConfirmAction` is already null here when onConfirmAccept() was
    // the caller (it clears it before calling closeDialog), so a still-set
    // value means this really is a cancel, not an accept.
    let confirmCancelHandler = null;
    if (dialogEl === confirmOverlayEl) {
      if (pendingConfirmAction) confirmCancelHandler = pendingCancelAction;
      pendingConfirmAction = null;
      pendingCancelAction = null;
    }
    // Closing Reaktionskollen any way (button, Escape, backdrop) must stop its
    // pending timers so a queued countdown/appear can't fire into a closed dialog.
    if (dialogEl === fyllekollenOverlayEl) clearMazeTimer();
    if (dialogEl === reaktionOverlayEl) {
      clearReaktionTimers();
      reaktionPhase = "idle";
    }
    if (dialogEl === memoryOverlayEl) {
      clearMemoryTimers();
      memoryPhase = "idle";
    }
    if (dialogEl === spykollenOverlayEl) stopSpyGame();
    if (dialogEl === pissepausOverlayEl) stopPissGame();
    stopVerdictEffects();
    if (dialogReturnFocus && document.contains(dialogReturnFocus)) {
      dialogReturnFocus.focus();
    }
    dialogReturnFocus = null;

    // Bingo reward routing (after teardown so timers/effects are already stopped):
    // closing the active reward game advances the flow; dismissing the reward
    // overlay itself (other than an intro→game transition) ends the session.
    if (rewardSession) {
      if (dialogEl === rewardSession.currentOverlay) {
        advanceRewardAfterGame();
      } else if (dialogEl === rewardOverlayEl && !rewardTransitioning) {
        rewardSession = null;
      }
    }

    // Run last, once this dialog is fully closed, so e.g. reopening the menu
    // captures its own fresh focus target instead of racing this one's.
    if (confirmCancelHandler) confirmCancelHandler();

    // Let the screen sleep again once no dialog remains open (reward routing or
    // a cancel handler above may already have opened the next one).
    if (!activeDialog) releaseWakeLock();
  }

  // Styled stand-in for window.confirm(): shows the confirm overlay and runs
  // `onConfirm` only if the user presses the accept button. `onCancel` (if
  // given) runs instead when the dialog is dismissed any other way — Avbryt,
  // Escape, or backdrop click.
  function showConfirm({ title, message, confirmLabel, onConfirm, onCancel }) {
    confirmTitleEl.textContent = title;
    confirmTextEl.textContent = message;
    confirmAcceptBtn.textContent = confirmLabel || "OK";
    pendingConfirmAction = typeof onConfirm === "function" ? onConfirm : null;
    pendingCancelAction = typeof onCancel === "function" ? onCancel : null;
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

  // ── Ambient embers ────────────────────────────────────────────────────────

  // Slow-drifting neon motes rising through the background, giving the room a
  // living-air feel behind the board. Runs once for the app's lifetime;
  // skipped entirely under reduced motion (and if the canvas is missing).
  function startEmbers() {
    const canvas = document.getElementById("embers");
    if (!(canvas instanceof HTMLCanvasElement) || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COLORS = ["rgba(255, 45, 120,", "rgba(45, 226, 255,", "rgba(250, 255, 45,"];
    let motes = [];
    let ratio = 1;

    function size() {
      ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Scale count to the viewport so big screens aren't sparse.
      const target = Math.round((window.innerWidth * window.innerHeight) / 26000);
      motes = Array.from({ length: Math.max(18, Math.min(46, target)) }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 1 + Math.random() * 2.4,
        speed: 0.15 + Math.random() * 0.5,
        drift: -0.3 + Math.random() * 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.15 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    size();
    window.addEventListener("resize", size);

    let t = 0;
    function frame() {
      t += 0.016;
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.speed;
        m.x += m.drift + Math.sin(t + m.phase) * 0.2;
        if (m.y < -6) {
          m.y = h + 6;
          m.x = Math.random() * w;
        }
        const twinkle = m.alpha * (0.6 + 0.4 * Math.sin(t * 2 + m.phase));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.color + twinkle + ")";
        ctx.shadowColor = m.color + "0.9)";
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  // ── Confetti ──────────────────────────────────────────────────────────────

  function runConfetti(durationMs) {
    if (!(confettiCanvas instanceof HTMLCanvasElement)) return;
    if (prefersReducedMotion()) return;
    resizeConfettiCanvas();

    const ctx = confettiCanvas.getContext("2d");
    if (!ctx) return;

    if (confettiAnimationFrame) cancelAnimationFrame(confettiAnimationFrame);

    // The ctx is scaled by devicePixelRatio in resizeConfettiCanvas, so draw in
    // CSS pixels.
    const W = window.innerWidth;
    const H = window.innerHeight;
    const colors = ["#ff2d78", "#2de2ff", "#faff2d", "#ff9dc0", "#b26bff"];
    // Casino confetti: card suits and the odd 🍺/🎲 tumbling among neon chips.
    const GLYPHS = ["♠", "♥", "♦", "♣", "🍺", "🎲"];
    const SHAPES = ["rect", "circle", "glyph"];
    const pieces = Array.from({ length: 130 }, () => {
      const shape = randomItem(SHAPES);
      return {
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.4,
        size: shape === "glyph" ? 13 + Math.random() * 12 : 4 + Math.random() * 8,
        color: randomItem(colors),
        glyph: randomItem(GLYPHS),
        shape,
        speedY: 2 + Math.random() * 5,
        speedX: -2 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.18 + Math.random() * 0.36,
      };
    });

    const endAt = performance.now() + durationMs;
    animate();

    function animate() {
      ctx.clearRect(0, 0, W, H);

      pieces.forEach((piece) => {
        piece.x += piece.speedX;
        piece.y += piece.speedY;
        piece.rotation += piece.rotationSpeed;

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        if (piece.shape === "glyph") {
          ctx.font = `${piece.size}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Emoji glyphs carry their own color; suits pick up the neon palette.
          if (piece.glyph.length === 1) {
            ctx.fillStyle = piece.color;
            ctx.shadowColor = piece.color;
            ctx.shadowBlur = 10;
          }
          ctx.fillText(piece.glyph, 0, 0);
        } else {
          ctx.fillStyle = piece.color;
          ctx.shadowColor = piece.color;
          ctx.shadowBlur = 8;
          if (piece.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
          }
        }
        ctx.restore();

        if (piece.y > H + 20) {
          piece.y = -20;
          piece.x = Math.random() * W;
        }
      });

      if (performance.now() < endAt) {
        confettiAnimationFrame = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, W, H);
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

  // A harsh two-tone klaxon for the "Nykter" (sober — too slow!) verdict. Sweeps
  // between two dissonant tones a few times like an alarm siren.
  function playAlarmSound() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const start = audioCtx.currentTime + 0.02;
    const beep = 0.16; // length of each siren tone
    const tones = [880, 620, 880, 620, 880, 620];
    tones.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const t = start + i * beep;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beep);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + beep);
    });
  }

  // Shouts the verdict with a Swedish voice on top of the klaxon/fanfare. If no
  // sv voice is installed the default voice still gets Swedish pronunciation
  // hints via `lang`. Cancelled by stopVerdictEffects so a closed dialog can't
  // keep talking. (iOS may drop timer-triggered speech — e.g. the maze timeout
  // — since it requires a user gesture in the chain; tap-driven verdicts work.)
  function speakVerdict(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sv-SE";
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang && v.lang.toLowerCase().startsWith("sv"));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    window.speechSynthesis.speak(utterance);
  }

  // A triumphant rising fanfare for the "Full som ett ägg" (proper drunk — the
  // goal!) verdict, capped with a shimmering high chord.
  function playPartySound() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime + 0.02;
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    arp.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });

    const chord = [783.99, 1046.5, 1318.51];
    const ct = now + arp.length * 0.1 + 0.04;
    chord.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ct);
      gain.gain.exponentialRampToValueAtTime(0.18, ct + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ct + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(ct);
      osc.stop(ct + 0.52);
    });
  }

  // Flashes the overlay with a red warning and re-fires the klaxon a few times so
  // the "Nykter" verdict feels like a genuine drink-faster alarm. The flash is a
  // looping CSS class; the repeated sound is driven here and bounded so it can't
  // run forever. stopVerdictEffects() (round start / dialog close) tears it down.
  function signalSoberAlarm(overlayEl) {
    stopVerdictEffects();
    soberAlarmEl = overlayEl;
    overlayEl.classList.add("sober-alarm");
    playAlarmSound();
    vibrate([160, 80, 160, 80, 260]);
    speakVerdict("Nykter!");
    let bursts = 0;
    soberAlarmTimer = window.setInterval(() => {
      bursts += 1;
      if (bursts >= 3) {
        window.clearInterval(soberAlarmTimer);
        soberAlarmTimer = null;
        return;
      }
      playAlarmSound();
    }, 1100);
  }

  // The celebratory counterpart for "Full som ett ägg": a flashing green party
  // overlay, confetti, and the fanfare, repeated once for extra emphasis. Bounded
  // and torn down by stopVerdictEffects() on round restart / dialog close.
  function signalDrunkCelebration(overlayEl) {
    stopVerdictEffects();
    drunkPartyEl = overlayEl;
    overlayEl.classList.add("drunk-celebrate");
    // The confetti canvas sits below the overlay by default; lift it in front so
    // the celebration rains over the result card instead of behind its backdrop.
    confettiCanvas.classList.add("confetti--front");
    runConfetti(2600);
    playPartySound();
    vibrate([35, 45, 35, 45, 35, 45, 120]);
    speakVerdict("Full som ett ägg!");
    let bursts = 0;
    drunkPartyTimer = window.setInterval(() => {
      bursts += 1;
      if (bursts >= 2) {
        window.clearInterval(drunkPartyTimer);
        drunkPartyTimer = null;
        return;
      }
      runConfetti(2000);
      playPartySound();
    }, 1300);
  }

  function stopSoberAlarm() {
    if (soberAlarmTimer) {
      window.clearInterval(soberAlarmTimer);
      soberAlarmTimer = null;
    }
    if (soberAlarmEl) {
      soberAlarmEl.classList.remove("sober-alarm");
      soberAlarmEl = null;
    }
  }

  function stopDrunkCelebration() {
    if (drunkPartyTimer) {
      window.clearInterval(drunkPartyTimer);
      drunkPartyTimer = null;
    }
    if (drunkPartyEl) {
      drunkPartyEl.classList.remove("drunk-celebrate");
      drunkPartyEl = null;
      confettiCanvas.classList.remove("confetti--front");
    }
  }

  // One call clears whichever verdict effect is currently running (only ever one
  // per round). Used by signalSoberAlarm/signalDrunkCelebration, the three
  // round-start helpers, and closeDialog.
  function stopVerdictEffects() {
    stopSoberAlarm();
    stopDrunkCelebration();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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

  // Haptic feedback where the hardware supports it. Android Chrome has the
  // Vibration API (patterns work). iOS Safari has NO vibration API, so as a
  // best-effort fallback we flip a hidden <input switch>, whose toggle fires a
  // subtle system haptic on iOS 17.4+ — a single light tick, no patterns, and
  // only perceptible when called inside a user gesture (a tap). Everywhere it
  // isn't supported it's a silent no-op.
  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
      return;
    }
    if (hapticTickEl) {
      // A real .click() toggle is what emits the haptic on iOS (a synthetic
      // change event does not); the resulting checked state is meaningless.
      hapticTickEl.click();
    }
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
    } catch {
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
    } catch {
      return fallback();
    }
  }
})();
