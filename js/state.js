import { DEFAULT_MODE_ID } from './constants.js';
import { FEEDBACK, generateSecret } from './engine.js';
import { getModeConfig } from './mode-config.js';

function createEmptySlots(codeLength) {
  return Array(codeLength).fill(null);
}

function normalizeSlots(slots, codeLength) {
  return Array.from({ length: codeLength }, (_, index) => slots?.[index] ?? null);
}

function normalizeFeedback(feedback, codeLength) {
  return Array.from({ length: codeLength }, (_, index) => feedback?.[index] ?? FEEDBACK.NONE);
}

export const GameState = {
  mode: 'dual',
  variant: DEFAULT_MODE_ID,
  activeConfig: getModeConfig(DEFAULT_MODE_ID),
  startedAt: null,
  challengeKey: null,
  isChallenge: false,
  challengeUrl: null,
  secretCode: createEmptySlots(getModeConfig(DEFAULT_MODE_ID).codeLength),
  currentGuess: createEmptySlots(getModeConfig(DEFAULT_MODE_ID).codeLength),
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
    this.activeConfig = getModeConfig(variant);
  },

  setActiveConfig(config) {
    this.activeConfig = config;
    this.secretCode = createEmptySlots(config.codeLength);
    this.currentGuess = createEmptySlots(config.codeLength);
    this.setupActiveSlot = 0;
    this.guessActiveSlot = 0;
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
      codeLength: this.activeConfig.codeLength,
      allowDuplicates: this.activeConfig.allowDuplicates,
    });
    this.setupActiveSlot = 0;
  },

  /* ---- Secret Code (Setup) ---- */

  setSecretColor(colorId) {
    if (!this.activeConfig.allowDuplicates && this.secretCode.includes(colorId)) return false;
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
    for (let i = 0; i < this.activeConfig.codeLength; i++) {
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
    if (this.activeConfig.allowDuplicates) return false;
    return this.secretCode.includes(colorId);
  },

  /* ---- Current Guess ---- */

  setGuessColor(colorId) {
    if (!this.activeConfig.allowDuplicates && this.currentGuess.includes(colorId)) return false;
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
    for (let i = 0; i < this.activeConfig.codeLength; i++) {
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
    if (this.activeConfig.allowDuplicates) return false;
    return this.currentGuess.includes(colorId);
  },

  guessFilledCount() {
    return this.currentGuess.filter(Boolean).length;
  },

  clearGuess() {
    this.currentGuess = createEmptySlots(this.activeConfig.codeLength);
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
    const activeConfig = getModeConfig(data.variant ?? DEFAULT_MODE_ID);
    const codeLength = activeConfig.codeLength;

    Object.assign(this, {
      mode: data.mode,
      variant: data.variant,
      activeConfig,
      startedAt: data.startedAt,
      challengeKey: data.challengeKey ?? null,
      isChallenge: data.isChallenge ?? false,
      challengeUrl: data.challengeUrl ?? null,
      secretCode: normalizeSlots(data.secretCode, codeLength),
      currentGuess: normalizeSlots(data.currentGuess, codeLength),
      guessHistory: data.guessHistory.map((entry) => ({
        guess: normalizeSlots(entry.guess, codeLength),
        feedback: normalizeFeedback(entry.feedback, codeLength),
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
    this.variant = DEFAULT_MODE_ID;
    this.activeConfig = getModeConfig(DEFAULT_MODE_ID);
    this.startedAt = null;
    this.challengeKey = null;
    this.isChallenge = false;
    this.challengeUrl = null;
    this.secretCode = createEmptySlots(this.activeConfig.codeLength);
    this.currentGuess = createEmptySlots(this.activeConfig.codeLength);
    this.guessHistory = [];
    this.setupActiveSlot = 0;
    this.guessActiveSlot = 0;
    this.screenId = 'screenMode';
    this.status = 'idle';
  },
};
