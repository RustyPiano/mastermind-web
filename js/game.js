import { DEFAULT_MODE_ID, getAvailableColors } from './constants.js';
import { GameState } from './state.js';
import { calcFeedback, FEEDBACK, isWinningFeedback } from './engine.js';
import { dateToChallengeKey, generateDailySecret, isDailySessionForKey } from './daily.js';
import { hasCompletedDaily, recordGameResult } from './stats.js';
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
  shareResult,
  buildChallengeInviteText,
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
} from './ui.js';

let saveScheduled = false;
const challengeTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  const { codeLength } = GameState.activeConfig;
  const prefix = GameState.variant === 'daily'
    ? `每日挑战 ${GameState.challengeKey} · `
    : '';

  if (GameState.isGuessComplete()) {
    return `${prefix}已选满 ${codeLength} 色，点击提交`;
  }

  return `${prefix}选满 ${codeLength} 色后提交`;
}

function getRoundSummaryMessage(roundNumber, exactCount, misplacedCount) {
  const remaining = GameState.activeConfig.maxGuesses - roundNumber;
  return `第 ${roundNumber} 轮 · 🟢 ${exactCount} · 🟠 ${misplacedCount} · 剩余 ${remaining} 次`;
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
  const finishedResult = buildFinishedResult(GameState, { win, rounds });
  const nextStats = recordGameResult(loadStats(), {
    ...finishedResult,
    finishedAt: new Date().toISOString(),
  });

  saveStats(nextStats);
  latestResult = finishedResult;
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

async function generateChallenge() {
  if (!GameState.isSecretComplete()) return;

  const url = buildChallengeUrl(GameState.secretCode, undefined, {
    variant: GameState.variant,
  });
  const shareText = buildChallengeInviteText(GameState.variant);
  const copyText = buildChallengeShareText(url, GameState.variant);
  try {
    if (navigator?.share) {
      await navigator.share({
        title: '密码机 朋友挑战',
        text: shareText,
        url,
      });
      updateStatus('挑战链接分享成功');
    } else if (navigator?.clipboard?.writeText) {
      await copyShareText(copyText);
      updateStatus('挑战链接已复制到剪贴板，快发给朋友吧！');
    } else {
      updateStatus('无法分享，请截图或手动告诉朋友');
    }
  } catch (err) {
    updateStatus('分享失败或被取消');
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
  applyModeLabels('single', variant);
  buildBoard();
  scheduleSave();
  startGuessing();
}

function startDailyMode() {
  const challengeKey = getTodayChallengeKey();
  const config = getModeConfig('daily');

  GameState.reset();
  GameState.setMode('single');
  GameState.setVariant('daily');
  GameState.setActiveConfig(config);
  GameState.setStartedAt();
  GameState.setChallengeKey(challengeKey);
  GameState.setStatus('in_progress');
  GameState.secretCode = generateDailySecret({
    dateKey: challengeKey,
    colors: getColorIdsForConfig(config),
    codeLength: config.codeLength,
    allowDuplicates: config.allowDuplicates,
  });
  applyModeLabels('single', 'daily', challengeKey);
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

function startChallengeMode({ secretCode, variant, challengeUrl }) {
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

  applyModeLabels('dual', variant);
  buildBoard();
  scheduleSave();
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
    // Daily is once-per-day; redirect to classic mode so user can keep playing
    startSingleMode();
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
    .addEventListener('click', openSingleModes);

  document.getElementById('btnModeDaily')
    .addEventListener('click', startDailyMode);

  document.getElementById('btnModeDuplicates')
    .addEventListener('click', startDuplicatesMode);

  document.getElementById('btnModeDual')
    .addEventListener('click', startDualMode);

  SINGLE_PRESET_IDS.forEach((variant) => {
    document.getElementById(presetButtonIds[variant])
      .addEventListener('click', () => startSingleMode(variant));
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

  // Check URL for challenge parameter first
  const params = new URLSearchParams(window.location.search);
  const challengeParam = params.get('challenge');

  if (challengeParam) {
    const challengeUrl = window.location.href;
    const payload = parseChallengePayload(challengeParam);

    if (payload) {
      // Clear the param from URL without refreshing so it doesn't stay there if they replay
      window.history.replaceState({}, document.title, window.location.pathname);
      startChallengeMode({
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
  setShareButtonEnabled(false);
}

init();
