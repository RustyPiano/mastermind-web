import { DEFAULT_MODE_ID, getAvailableColors } from './constants.js';
import {
  getDeviceType,
  trackChallengeCreate,
  trackChallengeOpen,
  trackChallengeStart,
  trackDailyClick,
  trackGameFinish,
  trackGameStart,
  trackGuessSubmit,
  trackHomeView,
  trackModeClick,
  trackShareClick,
  trackShareSuccess,
  trackStatsOpen,
} from './analytics.js';
import {
  buildGuessStatusMessage,
  buildRoundSummaryMessage,
} from './guidance.js';
import { GameState } from './state.js';
import { calcFeedback, FEEDBACK, isWinningFeedback } from './engine.js';
import {
  buildDailyModeEntryState,
  dateToChallengeKey,
  generateDailySecret,
  getDailySessionType,
  getTimeUntilNextChallenge,
} from './daily.js';
import { getDailyChallengeResult, hasCompletedDaily, recordGameResult, getMissedDayKey, canUseMakeupCard, applyMakeupCard, refreshMakeupCardsIfNeeded } from './stats.js';
import { SINGLE_PRESET_IDS, getModeConfig, isSinglePresetVariant } from './mode-config.js';
import {
  clearSession,
  createSessionSnapshot,
  loadPreferences,
  loadSession,
  loadStats,
  savePreferences,
  saveSession,
  saveStats,
} from './storage.js';
import {
  buildChallengeIntroContent,
  buildChallengeNativeSharePayload,
  shareResult,
  buildChallengeShareText,
  buildChallengeUrl,
  copyShareText,
} from './share.js';
import { parseChallengePayload } from './share.js';
import { buildFinishedResult } from './result.js';
import {
  buildBoard,
  buildSecretRow,
  buildSetupPalette,
  buildGuessPalette,
  highlightActiveRow,
  freezeRow,
  updateCurrentGuessDisplay,
  updateSubmitButton,
  updateConfirmButton,
  updateStatus,
  renderFeedback,
  showResult,
  hideOverlay,
  applyModeLabels,
  showScreen,
  restoreBoardHistory,
  updateDailyModeEntry,
  renderStatsPanel,
  renderResultStats,
  setStatsPanelExpanded,
  setShareButtonEnabled,
  setLegendVisibility,
  isLegendVisible,
  setOnboardingVisibility,
  updateMakeupCardBanner,
} from './ui.js';

let saveScheduled = false;
let dailyCountdownIntervalId = null;
let latestResult = null;
const presetButtonIds = Object.freeze({
  starter: 'btnPresetStarter',
  classic: 'btnPresetClassic',
  hard: 'btnPresetHard',
  expert: 'btnPresetExpert',
});

function getColorIdsForConfig(config) {
  return getAvailableColors(config.paletteColorCount).map((color) => color.id);
}

function setCurrentScreen(screenId) {
  GameState.setScreen(screenId);
  showScreen(screenId);
}

function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;

  queueMicrotask(() => {
    saveScheduled = false;
    if (GameState.status !== 'in_progress') return;
    saveSession(createSessionSnapshot(GameState));
  });
}

function getGuessStatusMessage() {
  return buildGuessStatusMessage({
    codeLength: GameState.activeConfig.codeLength,
    isDaily: GameState.variant === 'daily',
    isDailyPractice: GameState.isDailyPractice,
    challengeKey: GameState.challengeKey,
    isGuessComplete: GameState.isGuessComplete(),
    isFirstGuidedGame: loadStats().totals.gamesPlayed === 0 && !GameState.isChallenge,
  });
}

function getRoundSummaryMessage(roundNumber, exactCount, misplacedCount) {
  return buildRoundSummaryMessage({
    roundNumber,
    exactCount,
    misplacedCount,
    maxGuesses: GameState.activeConfig.maxGuesses,
    isFirstGuidedGame: loadStats().totals.gamesPlayed === 0 && !GameState.isChallenge,
  });
}

function getTodayChallengeKey() {
  return dateToChallengeKey(new Date());
}

function getMonthKey(challengeKey) {
  return challengeKey ? challengeKey.slice(0, 7) : null;
}

function refreshModeSelectionMeta({ renderStats = true } = {}) {
  const challengeKey = getTodayChallengeKey();
  let stats = loadStats();
  const savedSession = loadSession();
  const hasCompleted = hasCompletedDaily(stats, challengeKey);
  const activeSessionType = getDailySessionType(savedSession, challengeKey);

  // Refresh makeup cards at start of new month
  const monthKey = getMonthKey(challengeKey);
  if (stats.makeupCards?.refreshMonth !== monthKey) {
    stats = refreshMakeupCardsIfNeeded(stats, monthKey);
    saveStats(stats);
  }

  updateDailyModeEntry(buildDailyModeEntryState({
    challengeKey,
    hasCompleted,
    activeSessionType,
    dailyResult: getDailyChallengeResult(stats, challengeKey),
    msUntilNextChallenge: getTimeUntilNextChallenge(),
  }));

  // Show makeup card banner if there's exactly a 1-day gap and today not yet completed
  if (!hasCompleted && activeSessionType !== 'official') {
    const missedKey = getMissedDayKey(stats, challengeKey);
    if (missedKey) {
      const alreadyUsed = stats.makeupDays?.includes(missedKey) ?? false;
      const available = stats.makeupCards?.available ?? 0;
      if (alreadyUsed || available > 0) {
        updateMakeupCardBanner({ show: true, missedKey, available, alreadyUsed });
      } else {
        updateMakeupCardBanner({ show: false });
      }
    } else {
      updateMakeupCardBanner({ show: false });
    }
  } else {
    updateMakeupCardBanner({ show: false });
  }

  if (renderStats) {
    renderStatsPanel(stats);
  }
}

function ensureDailyCountdownTicker() {
  if (dailyCountdownIntervalId) {
    clearInterval(dailyCountdownIntervalId);
  }

  dailyCountdownIntervalId = window.setInterval(() => {
    if (GameState.screenId === 'screenMode') {
      refreshModeSelectionMeta({ renderStats: false });
    }
  }, 1000);
}

function dismissOnboarding() {
  savePreferences({
    ...loadPreferences(),
    firstRunDismissed: true,
  });
  setOnboardingVisibility(false);
}

function toggleLegend() {
  setLegendVisibility(!isLegendVisible());
}

function toggleStatsPanel() {
  const panel = document.getElementById('statsPanel');
  if (panel?.hidden) {
    trackStatsOpen();
  }
  setStatsPanelExpanded(Boolean(panel?.hidden));
}

function recordFinishedGame({ win, rounds }) {
  const finishedResult = buildFinishedResult(GameState, { win, rounds });
  latestResult = finishedResult;

  if (GameState.isDailyPractice) {
    return;
  }

  const nextStats = recordGameResult(loadStats(), {
    ...finishedResult,
    finishedAt: new Date().toISOString(),
  });

  saveStats(nextStats);
}

async function handleShareResult() {
  if (!latestResult) {
    updateStatus('当前没有可分享的结果');
    return;
  }

  trackShareClick({
    kind: 'result',
    variant: latestResult.variant,
  });

  try {
    const result = await shareResult(latestResult);
    trackShareSuccess({
      kind: 'result',
      variant: latestResult.variant,
    });
    updateStatus(result.method === 'share' ? '分享成功' : '已复制，可直接粘贴。');
  } catch {
    updateStatus('当前浏览器不支持直接分享，请手动复制结果。');
  }
}

function hydrateRecoveredSession() {
  applyModeLabels(GameState.mode, GameState.variant, GameState.challengeKey, {
    isDailyPractice: GameState.isDailyPractice,
  });
  buildBoard();
  restoreBoardHistory(handleGuessSlotClick);

  if (GameState.screenId === 'screenSetup') {
    refreshSetupUI();
    setCurrentScreen('screenSetup');
    return;
  }

  if (GameState.screenId === 'screenTransition') {
    refreshSetupUI();
    setCurrentScreen('screenTransition');
    return;
  }

  if (GameState.screenId === 'screenChallengeIntro') {
    refreshChallengeIntro();
    setCurrentScreen('screenChallengeIntro');
    return;
  }

  if (GameState.screenId === 'screenGuess') {
    refreshGuessUI();
    updateCurrentGuessDisplay(handleGuessSlotClick);
    updateStatus(getGuessStatusMessage());
    setCurrentScreen('screenGuess');
    return;
  }

  setCurrentScreen('screenMode');
}

/* ============================================
   Setup Phase (Player 1)
   ============================================ */

function handleSecretSlotClick(slotIndex) {
  if (GameState.secretCode[slotIndex]) {
    GameState.clearSecretSlot(slotIndex);
  } else {
    GameState.setSetupFocus(slotIndex);
  }
  scheduleSave();
  refreshSetupUI();
}

function handleSetupColorClick(colorId) {
  GameState.setSecretColor(colorId);
  scheduleSave();
  refreshSetupUI();
}

function refreshSetupUI() {
  buildSecretRow(handleSecretSlotClick);
  buildSetupPalette(handleSetupColorClick);
  updateConfirmButton();
}

function confirmSecret() {
  if (!GameState.isSecretComplete()) return;
  setCurrentScreen('screenTransition');
  scheduleSave();
}

async function generateChallenge() {
  if (!GameState.isSecretComplete()) return;

  const url = buildChallengeUrl(GameState.secretCode, undefined, {
    variant: GameState.variant,
    source: 'dual_setup',
  });
  const copyText = buildChallengeShareText(url, GameState.variant);
  trackShareClick({
    kind: 'challenge',
    variant: GameState.variant,
  });
  try {
    if (navigator?.share) {
      await navigator.share(buildChallengeNativeSharePayload(url, GameState.variant));
      trackShareSuccess({
        kind: 'challenge',
        variant: GameState.variant,
      });
      trackChallengeCreate({
        variant: GameState.variant,
        source: 'dual_setup',
      });
      updateStatus('挑战链接分享成功');
    } else if (navigator?.clipboard?.writeText) {
      await copyShareText(copyText);
      trackShareSuccess({
        kind: 'challenge',
        variant: GameState.variant,
      });
      trackChallengeCreate({
        variant: GameState.variant,
        source: 'dual_setup',
      });
      updateStatus('挑战链接已复制，发给朋友吧！');
    } else {
      updateStatus('无法分享，建议截图发给朋友。');
    }
  } catch (err) {
    updateStatus('分享失败或已取消。');
  }
}

function startGuessing() {
  setCurrentScreen('screenGuess');
  setLegendVisibility(false);
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
  updateStatus(getGuessStatusMessage());
  scheduleSave();
}

function refreshChallengeIntro() {
  const titleEl = document.getElementById('challengeIntroTitle');
  const bodyEl = document.getElementById('challengeIntroBody');
  const actionButton = document.getElementById('btnStartChallenge');
  if (!titleEl || !bodyEl || !actionButton) return;

  const content = buildChallengeIntroContent({
    variant: GameState.variant,
    challengeTargetRounds: GameState.challengeTargetRounds,
  });

  titleEl.textContent = content.title;
  bodyEl.textContent = content.body;
  actionButton.textContent = content.actionLabel;
}

function openSingleModes() {
  setCurrentScreen('screenSingleModes');
}

function startSingleMode(variant = 'classic') {
  const config = getModeConfig(variant);

  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant(variant);
  GameState.setActiveConfig(config);
  GameState.setStartedAt();
  GameState.setStatus('in_progress');
  GameState.generateRandomSecret(getColorIdsForConfig(config));
  trackGameStart({
    variant,
    isChallenge: false,
  });
  applyModeLabels('single', variant);
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDailyMode({ practice = false } = {}) {
  const challengeKey = getTodayChallengeKey();
  const config = getModeConfig('daily');

  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('daily');
  GameState.setActiveConfig(config);
  GameState.setStartedAt();
  GameState.setChallengeKey(challengeKey);
  GameState.setStatus('in_progress');
  GameState.isDailyPractice = practice;
  GameState.secretCode = generateDailySecret({
    dateKey: challengeKey,
    colors: getColorIdsForConfig(config),
    codeLength: config.codeLength,
    allowDuplicates: config.allowDuplicates,
  });
  trackGameStart({
    variant: 'daily',
    isChallenge: false,
    isPractice: practice,
  });
  applyModeLabels('single', 'daily', challengeKey, {
    isDailyPractice: practice,
  });
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDuplicatesMode() {
  const config = getModeConfig('duplicates');

  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('duplicates');
  GameState.setActiveConfig(config);
  GameState.setStartedAt();
  GameState.setStatus('in_progress');
  GameState.generateRandomSecret(getColorIdsForConfig(config));
  trackGameStart({
    variant: 'duplicates',
    isChallenge: false,
  });
  applyModeLabels('single', 'duplicates');
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDualMode() {
  GameState.reset();
  GameState.setMode('dual');
  GameState.setVariant(DEFAULT_MODE_ID);
  GameState.setActiveConfig(getModeConfig(DEFAULT_MODE_ID));
  GameState.setStartedAt();
  GameState.setStatus('in_progress');
  trackGameStart({
    variant: DEFAULT_MODE_ID,
    isChallenge: false,
  });
  applyModeLabels('dual', 'classic');
  buildBoard();
  setCurrentScreen('screenSetup');
  scheduleSave();
  refreshSetupUI();
}

function openChallengeIntro({
  secretCode,
  variant,
  challengeUrl,
  challengeSource = null,
  challengeTargetRounds = null,
}) {
  const config = getModeConfig(variant);

  GameState.reset();
  GameState.setMode('dual');
  GameState.setVariant(variant);
  GameState.setActiveConfig(config);
  GameState.setStartedAt();
  GameState.setStatus('in_progress');

  GameState.secretCode = [...secretCode];
  GameState.isChallenge = true;
  GameState.challengeUrl = challengeUrl;
  GameState.challengeSource = challengeSource;
  GameState.challengeTargetRounds = challengeTargetRounds;
  GameState.isDailyPractice = false;

  applyModeLabels('dual', variant);
  buildBoard();
  refreshChallengeIntro();
  setCurrentScreen('screenChallengeIntro');
  scheduleSave();
}

function startChallengeGuessing() {
  trackGameStart({
    variant: GameState.variant,
    isChallenge: true,
    isPractice: false,
  });
  trackChallengeStart({
    variant: GameState.variant,
    source: GameState.challengeSource ?? 'url',
  });
  startGuessing();
}

/* ============================================
   Guess Phase (Player 2)
   ============================================ */

function handleGuessSlotClick(slotIndex) {
  if (GameState.currentGuess[slotIndex]) {
    GameState.clearGuessSlot(slotIndex);
  } else {
    GameState.setGuessFocus(slotIndex);
  }
  scheduleSave();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
}

function handleGuessColorClick(colorId) {
  GameState.setGuessColor(colorId);
  scheduleSave();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);

  updateStatus(getGuessStatusMessage());
}

function refreshGuessUI() {
  buildGuessPalette(handleGuessColorClick);
  updateSubmitButton();
}

function clearCurrentGuess() {
  GameState.clearGuess();
  scheduleSave();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
  updateStatus(getGuessStatusMessage());
}

function submitGuess() {
  if (!GameState.isGuessComplete()) return;

  const r = GameState.currentRound();
  trackGuessSubmit({
    variant: GameState.variant,
    round: r + 1,
    isPractice: GameState.isDailyPractice,
  });
  const feedback = calcFeedback(GameState.currentGuess, GameState.secretCode);

  freezeRow(r); // Lock current row

  GameState.pushGuess(feedback);
  scheduleSave();
  renderFeedback(r, feedback);

  const exactCount = feedback.filter(f => f === FEEDBACK.EXACT).length;
  const misplacedCount = feedback.filter(f => f === FEEDBACK.MISPLACED).length;

  if (isWinningFeedback(feedback, GameState.activeConfig.codeLength)) {
    GameState.setStatus('won');
    recordFinishedGame({ win: true, rounds: r + 1 });
    trackGameFinish({
      variant: GameState.variant,
      win: true,
      roundsUsed: r + 1,
      isPractice: GameState.isDailyPractice,
    });
    clearSession();
    refreshModeSelectionMeta();

    // Add win animation to answer row
    setTimeout(() => {
      const finalRow = document.getElementById('answerFinal');
      if (finalRow) {
        finalRow.classList.add('reveal-win');
      }
      showResult(true, r + 1);
      renderResultStats(loadStats(), latestResult);
      setShareButtonEnabled(true);
    }, 400 + (GameState.activeConfig.codeLength * 150)); // wait for peg animations
    return;
  }

  if (r + 1 >= GameState.activeConfig.maxGuesses) {
    GameState.setStatus('lost');
    recordFinishedGame({ win: false, rounds: r + 1 });
    trackGameFinish({
      variant: GameState.variant,
      win: false,
      roundsUsed: r + 1,
      isPractice: GameState.isDailyPractice,
    });
    clearSession();
    refreshModeSelectionMeta();
    setTimeout(() => {
      showResult(false);
      renderResultStats(loadStats(), latestResult);
      setShareButtonEnabled(true);
    }, 400 + (GameState.activeConfig.codeLength * 150)); // wait for peg animations
    return;
  }

  GameState.clearGuess();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick); // Initialize new row
  updateStatus(getRoundSummaryMessage(r + 1, exactCount, misplacedCount));
  highlightActiveRow();
  scheduleSave();
}

/* ============================================
   Reset
   ============================================ */

function resetGame() {
  GameState.reset();
  latestResult = null;
  clearSession();
  applyModeLabels('dual', 'classic');
  hideOverlay();
  setShareButtonEnabled(false);
  setLegendVisibility(false);
  setCurrentScreen('screenMode');
  refreshSetupUI();
  buildBoard();
  refreshModeSelectionMeta();
}

function replayGame() {
  const { mode, variant } = GameState;
  latestResult = null;
  hideOverlay();
  setShareButtonEnabled(false);
  if (mode === 'single' && variant === 'daily') {
    if (GameState.isDailyPractice || GameState.status === 'lost') {
      startDailyMode({ practice: true });
    } else {
      startSingleMode();
    }
  } else if (mode === 'single' && variant === 'duplicates') {
    startDuplicatesMode();
  } else if (mode === 'single' && isSinglePresetVariant(variant)) {
    startSingleMode(variant);
  } else if (mode === 'single') {
    startSingleMode();
  } else {
    startDualMode();
  }
}

/* ============================================
   Event Binding
   ============================================ */

function bindEvents() {
  document.getElementById('btnModeSingle')
    .addEventListener('click', () => {
      trackModeClick({ mode: 'single', variant: 'presets' });
      openSingleModes();
    });

  document.getElementById('btnModeDaily')
    .addEventListener('click', () => {
      const challengeKey = getTodayChallengeKey();
      const savedSession = loadSession();
      const activeSessionType = getDailySessionType(savedSession, challengeKey);
      const dailyResult = getDailyChallengeResult(loadStats(), challengeKey);
      trackModeClick({ mode: 'single', variant: 'daily' });
      trackDailyClick({ hasActiveSession: activeSessionType === 'official' });
      if (activeSessionType && savedSession) {
        latestResult = null;
        GameState.restore(savedSession);
        hydrateRecoveredSession();
        setShareButtonEnabled(false);
        return;
      }
      startDailyMode({ practice: dailyResult?.status === 'lost' });
    });

  document.getElementById('btnModeDuplicates')
    .addEventListener('click', () => {
      trackModeClick({ mode: 'single', variant: 'duplicates' });
      startDuplicatesMode();
    });

  document.getElementById('btnModeDual')
    .addEventListener('click', () => {
      trackModeClick({ mode: 'dual', variant: DEFAULT_MODE_ID });
      startDualMode();
    });

  SINGLE_PRESET_IDS.forEach((variant) => {
    document.getElementById(presetButtonIds[variant])
      .addEventListener('click', () => {
        trackModeClick({ mode: 'single', variant });
        startSingleMode(variant);
      });
  });

  document.getElementById('btnBackToMode')
    .addEventListener('click', () => {
      setCurrentScreen('screenMode');
    });

  document.getElementById('btnConfirmSecret')
    .addEventListener('click', confirmSecret);

  const genBtn = document.getElementById('btnGenerateChallenge');
  if (genBtn) {
    genBtn.addEventListener('click', generateChallenge);
  }

  document.getElementById('btnStartGuessing')
    .addEventListener('click', startGuessing);

  document.getElementById('btnStartChallenge')
    .addEventListener('click', startChallengeGuessing);

  document.getElementById('btnClear')
    .addEventListener('click', clearCurrentGuess);

  document.getElementById('btnSubmit')
    .addEventListener('click', submitGuess);

  document.getElementById('btnBackHome')
    .addEventListener('click', resetGame);

  document.querySelectorAll('.btn-exit-home')
    .forEach((button) => {
      button.addEventListener('click', resetGame);
    });

  document.getElementById('btnShareResult')
    .addEventListener('click', () => {
      void handleShareResult();
    });

  document.getElementById('btnDismissOnboarding')
    .addEventListener('click', dismissOnboarding);

  document.getElementById('btnBrowseModes')
    .addEventListener('click', dismissOnboarding);

  document.getElementById('btnStartStarter')
    .addEventListener('click', () => {
      trackModeClick({ mode: 'single', variant: 'starter' });
      dismissOnboarding();
      startSingleMode('starter');
    });

  document.getElementById('btnToggleStats')
    .addEventListener('click', toggleStatsPanel);

  const makeupBtn = document.getElementById('btnUseMakeupCard');
  if (makeupBtn) {
    makeupBtn.addEventListener('click', () => {
      const challengeKey = getTodayChallengeKey();
      const stats = loadStats();
      const missedKey = getMissedDayKey(stats, challengeKey);
      if (!missedKey || !canUseMakeupCard(stats)) return;
      const nextStats = applyMakeupCard(stats, missedKey);
      saveStats(nextStats);
      refreshModeSelectionMeta();
    });
  }

  document.getElementById('btnOpenLegend')
    .addEventListener('click', toggleLegend);

  document.getElementById('btnCloseLegend')
    .addEventListener('click', () => {
      setLegendVisibility(false);
    });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setLegendVisibility(false);
    }
  });

  document.getElementById('btnPlayAgain')
    .addEventListener('click', replayGame);
}

/* ============================================
   Initialization
   ============================================ */

function init() {
  bindEvents();
  setOnboardingVisibility(!loadPreferences().firstRunDismissed);
  setLegendVisibility(false);
  setStatsPanelExpanded(false);
  ensureDailyCountdownTicker();

  // Check URL for challenge parameter first
  const params = new URLSearchParams(window.location.search);
  const challengeParam = params.get('challenge');

  if (challengeParam) {
    const challengeUrl = window.location.href;
    const payload = parseChallengePayload(challengeParam);

    if (payload) {
      // Clear the param from URL without refreshing so it doesn't stay there if they replay
      window.history.replaceState({}, document.title, window.location.pathname);
      trackChallengeOpen({
        variant: payload.variant,
        source: payload.challengeSource ?? 'url',
      });
      openChallengeIntro({
        ...payload,
        challengeUrl,
      });
      return;
    }

    console.warn('Failed to parse challenge parameter');
  }

  const savedSession = loadSession();

  if (savedSession) {
    GameState.restore(savedSession);
    hydrateRecoveredSession();
    refreshModeSelectionMeta();
    setShareButtonEnabled(false);
    return;
  }

  applyModeLabels('dual', 'classic');
  buildBoard();
  refreshSetupUI();
  setCurrentScreen('screenMode');
  refreshModeSelectionMeta();
  trackHomeView({
    isFirstSession: loadStats().totals.gamesPlayed === 0,
    deviceType: getDeviceType(),
  });
  setShareButtonEnabled(false);
}

init();
