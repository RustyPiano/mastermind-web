import { CODE_LENGTH } from './constants.js';

function createEmptySlots() {
  return Array(CODE_LENGTH).fill(null);
}

export const GameState = {
  mode: 'dual',
  secretCode: createEmptySlots(),
  currentGuess: createEmptySlots(),
  guessHistory: [],

  setupActiveSlot: 0,
  guessActiveSlot: 0,

  setMode(mode) {
    this.mode = mode;
  },

  generateRandomSecret(colors) {
    const pool = [...colors];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.secretCode = pool.slice(0, CODE_LENGTH);
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

  /* ---- Reset ---- */

  reset() {
    this.mode = 'dual';
    this.secretCode = createEmptySlots();
    this.currentGuess = createEmptySlots();
    this.guessHistory = [];
    this.setupActiveSlot = 0;
    this.guessActiveSlot = 0;
  },
};
