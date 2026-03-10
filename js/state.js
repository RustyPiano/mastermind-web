import { CODE_LENGTH, ALLOW_DUPLICATE_COLORS } from './constants.js';
import { generateSecret } from './engine.js';

function createEmptySlots() {
  return Array(CODE_LENGTH).fill(null);
}

export const GameState = {
  mode: 'dual',
  variant: 'classic',
  startedAt: null,
  challengeKey: null,
  secretCode: createEmptySlots(),
  currentGuess: createEmptySlots(),
  guessHistory: [],

  setupActiveSlot: 0,
  guessActiveSlot: 0,
  screenId: 'screenMode',
  status: 'idle',

  setMode(mode) {
    this.mode = mode;
  },

  setVariant(variant) {
    this.variant = variant;
  },

  setStartedAt(timestamp = new Date().toISOString()) {
    this.startedAt = timestamp;
  },

  setChallengeKey(challengeKey) {
    this.challengeKey = challengeKey;
  },

  setScreen(screenId) {
    this.screenId = screenId;
  },

  setStatus(status) {
    this.status = status;
  },

  generateRandomSecret(colors) {
    this.secretCode = generateSecret({
      colors,
      codeLength: CODE_LENGTH,
      allowDuplicates: ALLOW_DUPLICATE_COLORS,
    });
    this.setupActiveSlot = 0;
  },

  /* ---- Secret Code (Setup) ---- */

  setSecretColor(colorId) {
    if (this.secretCode.includes(colorId)) return false;
    this.secretCode[this.setupActiveSlot] = colorId;
    this.advanceSetupSlot();
    return true;
  },

  clearSecretSlot(index) {
    this.secretCode[index] = null;
    this.setupActiveSlot = index;
  },

  setSetupFocus(index) {
    this.setupActiveSlot = index;
  },

  advanceSetupSlot() {
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (!this.secretCode[i]) {
        this.setupActiveSlot = i;
        break;
      }
    }
  },

  isSecretComplete() {
    return !this.secretCode.includes(null);
  },

  isSecretUsed(colorId) {
    return this.secretCode.includes(colorId);
  },

  /* ---- Current Guess ---- */

  setGuessColor(colorId) {
    if (this.currentGuess.includes(colorId)) return false;
    this.currentGuess[this.guessActiveSlot] = colorId;
    this.advanceGuessSlot();
    return true;
  },

  clearGuessSlot(index) {
    this.currentGuess[index] = null;
    this.guessActiveSlot = index;
  },

  setGuessFocus(index) {
    this.guessActiveSlot = index;
  },

  advanceGuessSlot() {
    for (let i = 0; i < CODE_LENGTH; i++) {
      if (!this.currentGuess[i]) {
        this.guessActiveSlot = i;
        break;
      }
    }
  },

  isGuessComplete() {
    return !this.currentGuess.includes(null);
  },

  isGuessUsed(colorId) {
    return this.currentGuess.includes(colorId);
  },

  guessFilledCount() {
    return this.currentGuess.filter(Boolean).length;
  },

  clearGuess() {
    this.currentGuess = createEmptySlots();
    this.guessActiveSlot = 0;
  },

  /* ---- History ---- */

  currentRound() {
    return this.guessHistory.length;
  },

  pushGuess(feedback) {
    this.guessHistory.push({
      guess: [...this.currentGuess],
      feedback,
    });
  },

  restore(data) {
    Object.assign(this, {
      mode: data.mode,
      variant: data.variant,
      startedAt: data.startedAt,
      challengeKey: data.challengeKey ?? null,
      secretCode: [...data.secretCode],
      currentGuess: [...data.currentGuess],
      guessHistory: data.guessHistory.map((entry) => ({
        guess: [...entry.guess],
        feedback: [...entry.feedback],
      })),
      setupActiveSlot: data.setupActiveSlot,
      guessActiveSlot: data.guessActiveSlot,
      screenId: data.screenId,
      status: data.status,
    });
  },

  /* ---- Reset ---- */

  reset() {
    this.mode = 'dual';
    this.variant = 'classic';
    this.startedAt = null;
    this.challengeKey = null;
    this.secretCode = createEmptySlots();
    this.currentGuess = createEmptySlots();
    this.guessHistory = [];
    this.setupActiveSlot = 0;
    this.guessActiveSlot = 0;
    this.screenId = 'screenMode';
    this.status = 'idle';
  },
};
