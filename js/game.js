import { COLORS, DEFAULT_MODE_ID } from './constants.js';
import { GameState } from './state.js';
import { calcFeedback, FEEDBACK, isWinningFeedback } from './engine.js';
import { dateToChallengeKey, generateDailySecret, isDailySessionForKey } from './daily.js';
import { hasCompletedDaily, recordGameResult } from './stats.js';
import { getModeConfig } from './mode-config.js';
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
import { shareResult } from './share.js';
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
} from './ui.js';

let saveScheduled = false;
const challengeTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let latestResult = null;

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
  const prefix = GameState.variant === 'daily'
    ? `每日挑战 ${GameState.challengeKey} · `
    : '';

  if (GameState.isGuessComplete()) {
    return `${prefix}密码选好了，点击提交！`;
  }

  return `${prefix}请选择4个颜色提交猜测`;
}

function getRoundSummaryMessage(roundNumber, exactCount, misplacedCount) {
  const remaining = GameState.activeConfig.maxGuesses - roundNumber;
  return `第 ${roundNumber} 轮：${exactCount} 个位置正确，${misplacedCount} 个颜色正确但位置错误。还剩 ${remaining} 次机会。`;
}

function getTodayChallengeKey() {
  return dateToChallengeKey(new Date(), challengeTimeZone);
}

function refreshModeSelectionMeta() {
  const challengeKey = getTodayChallengeKey();
  const stats = loadStats();
  const savedSession = loadSession();

  updateDailyModeEntry({
    challengeKey,
    isCompleted: hasCompletedDaily(stats, challengeKey),
    hasActiveSession: isDailySessionForKey(savedSession, challengeKey),
  });
  renderStatsPanel(stats);
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
  setStatsPanelExpanded(Boolean(panel?.hidden));
}

function recordFinishedGame({ win, rounds }) {
  const nextStats = recordGameResult(loadStats(), {
    mode: GameState.mode,
    variant: GameState.variant,
    challengeKey: GameState.challengeKey,
    rounds,
    win,
    finishedAt: new Date().toISOString(),
  });

  saveStats(nextStats);
  latestResult = {
    mode: GameState.mode,
    variant: GameState.variant,
    challengeKey: GameState.challengeKey,
    rounds,
    win,
    history: GameState.guessHistory.map((entry) => ({
      feedback: [...entry.feedback],
    })),
    maxGuesses: GameState.activeConfig.maxGuesses,
  };
}

async function handleShareResult() {
  if (!latestResult) {
    updateStatus('当前没有可分享的结果');
    return;
  }

  try {
    const result = await shareResult(latestResult);
    updateStatus(result.method === 'share' ? '分享成功' : '已复制结果，可直接粘贴分享');
  } catch {
    updateStatus('当前浏览器不支持直接分享，请手动复制结果');
  }
}

function hydrateRecoveredSession() {
  applyModeLabels(GameState.mode, GameState.variant, GameState.challengeKey);
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

function startGuessing() {
  setCurrentScreen('screenGuess');
  setLegendVisibility(false);
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
  updateStatus(getGuessStatusMessage());
  scheduleSave();
}

function startSingleMode() {
  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('classic');
  GameState.setActiveConfig(getModeConfig('classic'));
  GameState.setStartedAt();
  GameState.setStatus('in_progress');
  GameState.generateRandomSecret(COLORS.map(c => c.id));
  applyModeLabels('single', 'classic');
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDailyMode() {
  const challengeKey = getTodayChallengeKey();

  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('daily');
  GameState.setActiveConfig(getModeConfig('daily'));
  GameState.setStartedAt();
  GameState.setChallengeKey(challengeKey);
  GameState.setStatus('in_progress');
  GameState.secretCode = generateDailySecret({
    dateKey: challengeKey,
    colors: COLORS.map((color) => color.id),
    codeLength: GameState.activeConfig.codeLength,
    allowDuplicates: GameState.activeConfig.allowDuplicates,
  });
  applyModeLabels('single', 'daily', challengeKey);
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDuplicatesMode() {
  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('duplicates');
  GameState.setActiveConfig(getModeConfig('duplicates'));
  GameState.setStartedAt();
  GameState.setStatus('in_progress');
  GameState.generateRandomSecret(COLORS.map(c => c.id));
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
  applyModeLabels('dual', 'classic');
  buildBoard();
  setCurrentScreen('screenSetup');
  scheduleSave();
  refreshSetupUI();
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
    clearSession();
    refreshModeSelectionMeta();
    setTimeout(() => {
      showResult(true, r + 1);
      renderResultStats(loadStats(), latestResult);
      setShareButtonEnabled(true);
    }, 400);
    return;
  }

  if (r + 1 >= GameState.activeConfig.maxGuesses) {
    GameState.setStatus('lost');
    recordFinishedGame({ win: false, rounds: r + 1 });
    clearSession();
    refreshModeSelectionMeta();
    setTimeout(() => {
      showResult(false);
      renderResultStats(loadStats(), latestResult);
      setShareButtonEnabled(true);
    }, 400);
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
    startDailyMode();
  } else if (mode === 'single' && variant === 'duplicates') {
    startDuplicatesMode();
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
    .addEventListener('click', startSingleMode);

  document.getElementById('btnModeDaily')
    .addEventListener('click', startDailyMode);

  document.getElementById('btnModeDuplicates')
    .addEventListener('click', startDuplicatesMode);

  document.getElementById('btnModeDual')
    .addEventListener('click', startDualMode);

  document.getElementById('btnConfirmSecret')
    .addEventListener('click', confirmSecret);

  document.getElementById('btnStartGuessing')
    .addEventListener('click', startGuessing);

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

  document.getElementById('btnToggleStats')
    .addEventListener('click', toggleStatsPanel);

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
  setShareButtonEnabled(false);
}

init();
