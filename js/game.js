import { COLORS, MAX_GUESSES, CODE_LENGTH } from './constants.js';
import { GameState } from './state.js';
import {
  buildBoard,
  buildSecretRow,
  buildSetupPalette,
  buildGuessPalette,
  highlightActiveRow,
  freezeRow,
  updateCurrentGuessDisplay,
  updateSelectedCount,
  updateSubmitButton,
  updateConfirmButton,
  updateStatus,
  renderFeedback,
  showResult,
  hideOverlay,
  applyModeLabels,
  showScreen,
} from './ui.js';

/* ============================================
   Core Algorithm
   ============================================ */

function calcFeedback(guess, secret) {
  const result = Array(CODE_LENGTH).fill('none');
  const sl = [...secret];
  const gl = [...guess];

  // Pass 1: exact matches
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'green';
      sl[i] = null;
      gl[i] = null;
    }
  }

  // Pass 2: color matches (wrong position)
  for (let i = 0; i < CODE_LENGTH; i++) {
    if (gl[i] === null) continue;
    const j = sl.indexOf(gl[i]);
    if (j !== -1) {
      result[i] = 'white';
      sl[j] = null;
    }
  }

  return result;
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
  refreshSetupUI();
}

function handleSetupColorClick(colorId) {
  GameState.setSecretColor(colorId);
  refreshSetupUI();
}

function refreshSetupUI() {
  buildSecretRow(handleSecretSlotClick);
  buildSetupPalette(handleSetupColorClick);
  updateConfirmButton();
}

function confirmSecret() {
  if (!GameState.isSecretComplete()) return;
  showScreen('screenTransition');
}

function startGuessing() {
  showScreen('screenGuess');
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
  updateStatus('请选择4个颜色提交猜测');
}

function startSingleMode() {
  GameState.reset();
  GameState.setMode('single');
  GameState.generateRandomSecret(COLORS.map(c => c.id));
  applyModeLabels('single');
  buildBoard();
  startGuessing();
}

function startDualMode() {
  GameState.reset();
  GameState.setMode('dual');
  applyModeLabels('dual');
  buildBoard();
  showScreen('screenSetup');
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
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
}

function handleGuessColorClick(colorId) {
  GameState.setGuessColor(colorId);
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);

  if (GameState.isGuessComplete()) {
    updateStatus('密码选好了，点击提交！');
  } else {
    updateStatus('请选择4个颜色提交猜测');
  }
}

function refreshGuessUI() {
  buildGuessPalette(handleGuessColorClick);
  updateSelectedCount();
  updateSubmitButton();
}

function clearCurrentGuess() {
  GameState.clearGuess();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick);
  updateStatus('请选择4个颜色提交猜测');
}

function submitGuess() {
  if (!GameState.isGuessComplete()) return;

  const r = GameState.currentRound();
  const feedback = calcFeedback(GameState.currentGuess, GameState.secretCode);

  freezeRow(r); // Lock current row

  GameState.pushGuess(feedback);
  renderFeedback(r, feedback);

  const greens = feedback.filter(f => f === 'green').length;
  const whites = feedback.filter(f => f === 'white').length;

  if (greens === CODE_LENGTH) {
    setTimeout(() => showResult(true, r + 1), 400);
    return;
  }

  if (r + 1 >= MAX_GUESSES) {
    setTimeout(() => showResult(false), 400);
    return;
  }

  GameState.clearGuess();
  refreshGuessUI();
  updateCurrentGuessDisplay(handleGuessSlotClick); // Initialize new row
  updateStatus(`第${r + 1}轮：🟢 ${greens}个正确 🟠 ${whites}个位置错 — 继续！`);
  highlightActiveRow();
}

/* ============================================
   Reset
   ============================================ */

function resetGame() {
  GameState.reset();
  applyModeLabels('dual');
  hideOverlay();
  showScreen('screenMode');
  refreshSetupUI();
  buildBoard();
}

/* ============================================
   Event Binding
   ============================================ */

function bindEvents() {
  document.getElementById('btnModeSingle')
    .addEventListener('click', startSingleMode);

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

  document.getElementById('btnPlayAgain')
    .addEventListener('click', resetGame);
}

/* ============================================
   Initialization
   ============================================ */

function init() {
  bindEvents();
  applyModeLabels('dual');
  buildBoard();
  refreshSetupUI();
  showScreen('screenMode');
}

init();
