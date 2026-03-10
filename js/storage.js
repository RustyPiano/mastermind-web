import { createDefaultStats, normalizeStats } from './stats.js';

const STORAGE_VERSION = 1;

export const SESSION_STORAGE_KEY = `mastermind:session:v${STORAGE_VERSION}`;
export const STATS_STORAGE_KEY = `mastermind:stats:v${STORAGE_VERSION}`;
export const PREFERENCES_STORAGE_KEY = `mastermind:preferences:v${STORAGE_VERSION}`;

const DEFAULT_STATS = Object.freeze(createDefaultStats());
const DEFAULT_PREFERENCES = Object.freeze({
  version: STORAGE_VERSION,
  firstRunDismissed: false,
});

function getStorage() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage;
}

function cloneSlots(slots) {
  return Array.isArray(slots) ? [...slots] : [];
}

function cloneHistory(history) {
  return Array.isArray(history)
    ? history.map((entry) => ({
      guess: cloneSlots(entry.guess),
      feedback: cloneSlots(entry.feedback),
    }))
    : [];
}

function isValidSessionShape(data) {
  return (
    data
    && data.version === STORAGE_VERSION
    && typeof data.mode === 'string'
    && typeof data.variant === 'string'
    && (typeof data.startedAt === 'string' || data.startedAt === null)
    && (typeof data.challengeKey === 'string' || data.challengeKey === null)
    && Array.isArray(data.secretCode)
    && Array.isArray(data.currentGuess)
    && Array.isArray(data.guessHistory)
    && typeof data.setupActiveSlot === 'number'
    && typeof data.guessActiveSlot === 'number'
    && typeof data.screenId === 'string'
    && typeof data.status === 'string'
  );
}

function parseStorageItem(key, validate, fallback) {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) {
      storage.removeItem(key);
      return fallback;
    }

    return parsed;
  } catch {
    storage.removeItem(key);
    return fallback;
  }
}

function saveStorageItem(key, value) {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(key, JSON.stringify(value));
}

export function createSessionSnapshot(state) {
  return {
    version: STORAGE_VERSION,
    mode: state.mode,
    variant: state.variant,
    startedAt: state.startedAt,
    challengeKey: state.challengeKey ?? null,
    secretCode: cloneSlots(state.secretCode),
    currentGuess: cloneSlots(state.currentGuess),
    guessHistory: cloneHistory(state.guessHistory),
    setupActiveSlot: state.setupActiveSlot,
    guessActiveSlot: state.guessActiveSlot,
    screenId: state.screenId,
    status: state.status,
  };
}

export function loadSession() {
  return parseStorageItem(SESSION_STORAGE_KEY, isValidSessionShape, null);
}

export function saveSession(session) {
  saveStorageItem(SESSION_STORAGE_KEY, {
    ...session,
    challengeKey: session.challengeKey ?? null,
    version: STORAGE_VERSION,
  });
}

export function clearSession() {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(SESSION_STORAGE_KEY);
}

export function loadStats() {
  const stats = parseStorageItem(
    STATS_STORAGE_KEY,
    (data) => data && data.version === STORAGE_VERSION,
    createDefaultStats(),
  );

  return normalizeStats(stats);
}

export function saveStats(stats) {
  saveStorageItem(STATS_STORAGE_KEY, {
    ...normalizeStats(stats),
    version: STORAGE_VERSION,
  });
}

export function loadPreferences() {
  return parseStorageItem(
    PREFERENCES_STORAGE_KEY,
    (data) => (
      data
      && data.version === STORAGE_VERSION
      && typeof data.firstRunDismissed === 'boolean'
    ),
    { ...DEFAULT_PREFERENCES },
  );
}

export function savePreferences(preferences) {
  saveStorageItem(PREFERENCES_STORAGE_KEY, {
    ...preferences,
    version: STORAGE_VERSION,
  });
}
