import { beforeEach, describe, expect, it } from 'vitest';
import { GameState } from '../js/state.js';
import {
  clearSession,
  createSessionSnapshot,
  loadPreferences,
  loadSession,
  loadStats,
  savePreferences,
  saveSession,
  saveStats,
  SESSION_STORAGE_KEY,
} from '../js/storage.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

function makeSession() {
  return {
    mode: 'single',
    variant: 'classic',
    startedAt: '2026-03-10T08:00:00.000Z',
    challengeKey: null,
    isChallenge: false,
    challengeUrl: null,
    secretCode: ['c1', 'c2', 'c3', 'c4'],
    currentGuess: ['c1', null, null, null],
    guessHistory: [
      {
        guess: ['c4', 'c3', 'c2', 'c1'],
        feedback: ['misplaced', 'misplaced', 'misplaced', 'misplaced'],
      },
    ],
    setupActiveSlot: 0,
    guessActiveSlot: 1,
    screenId: 'screenGuess',
    status: 'in_progress',
  };
}

describe('storage helpers', () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
    GameState.reset();
  });

  it('serializes and deserializes session data without methods', () => {
    GameState.restore(makeSession());

    const snapshot = createSessionSnapshot(GameState);
    saveSession(snapshot);
    const loaded = loadSession();

    expect(loaded).toMatchObject(snapshot);
    expect(loaded).not.toHaveProperty('reset');
    expect(loaded.version).toBe(1);
  });

  it('restores all supported game state fields', () => {
    const session = makeSession();

    GameState.restore(session);

    expect(GameState.mode).toBe(session.mode);
    expect(GameState.variant).toBe(session.variant);
    expect(GameState.startedAt).toBe(session.startedAt);
    expect(GameState.challengeKey).toBeNull();
    expect(GameState.isChallenge).toBe(false);
    expect(GameState.challengeUrl).toBeNull();
    expect(GameState.secretCode).toEqual(session.secretCode);
    expect(GameState.currentGuess).toEqual(session.currentGuess);
    expect(GameState.guessHistory).toEqual(session.guessHistory);
    expect(GameState.setupActiveSlot).toBe(session.setupActiveSlot);
    expect(GameState.guessActiveSlot).toBe(session.guessActiveSlot);
    expect(GameState.screenId).toBe(session.screenId);
    expect(GameState.status).toBe(session.status);
  });

  it('pads legacy session arrays to match the current mode config', () => {
    GameState.restore({
      ...makeSession(),
      variant: 'hard',
      secretCode: ['c1', 'c2', 'c3', 'c4'],
      currentGuess: ['c1', 'c2', 'c3', 'c4'],
      guessHistory: [
        {
          guess: ['c4', 'c3', 'c2', 'c1'],
          feedback: ['misplaced', 'misplaced', 'misplaced', 'misplaced'],
        },
      ],
    });

    expect(GameState.secretCode).toEqual(['c1', 'c2', 'c3', 'c4', null]);
    expect(GameState.currentGuess).toEqual(['c1', 'c2', 'c3', 'c4', null]);
    expect(GameState.guessHistory[0].feedback).toHaveLength(5);
    expect(GameState.guessHistory[0].feedback[4]).toBe('none');
  });

  it('preserves challenge-specific fields through snapshot and restore', () => {
    const session = {
      ...makeSession(),
      mode: 'dual',
      variant: 'hard',
      isChallenge: true,
      challengeUrl: 'https://mastermind.rustypiano.com/?challenge=abc123',
      secretCode: ['c1', 'c2', 'c3', 'c4', 'c5'],
      currentGuess: ['c1', 'c2', null, null, null],
      guessHistory: [],
    };

    GameState.restore(session);
    const snapshot = createSessionSnapshot(GameState);

    expect(snapshot.isChallenge).toBe(true);
    expect(snapshot.challengeUrl).toBe(session.challengeUrl);

    GameState.reset();
    expect(GameState.isChallenge).toBe(false);
    expect(GameState.challengeUrl).toBeNull();

    GameState.restore(snapshot);
    expect(GameState.isChallenge).toBe(true);
    expect(GameState.challengeUrl).toBe(session.challengeUrl);
  });

  it('returns null and clears malformed saved session payloads', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{broken');

    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears sessions with missing fields', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, mode: 'single' }));

    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('returns null and clears sessions on version mismatch', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      ...makeSession(),
      version: 999,
    }));

    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears the session explicitly', () => {
    saveSession(makeSession());

    clearSession();

    expect(loadSession()).toBeNull();
  });

  it('provides safe defaults for stats and preferences', () => {
    expect(loadStats()).toEqual({
      version: 1,
      totals: { gamesPlayed: 0, wins: 0, losses: 0 },
      streaks: { currentDailyWin: 0, bestDailyWin: 0 },
      modes: {
        starter: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        classic: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        hard: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        expert: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        daily: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        duplicates: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        dual: { gamesPlayed: 0 },
      },
      completedDailyKeys: [],
      lastDailyPlayedKey: null,
      achievements: [],
    });
    expect(loadPreferences()).toEqual({ version: 1, firstRunDismissed: false });

    saveStats({ version: 1, totals: { gamesPlayed: 1 }, completedDailyKeys: ['2026-03-10'] });
    savePreferences({ version: 1, firstRunDismissed: true });

    expect(loadStats()).toEqual({
      version: 1,
      totals: { gamesPlayed: 1, wins: 0, losses: 0 },
      streaks: { currentDailyWin: 0, bestDailyWin: 0 },
      modes: {
        starter: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        classic: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        hard: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        expert: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        daily: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        duplicates: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        dual: { gamesPlayed: 0 },
      },
      completedDailyKeys: ['2026-03-10'],
      lastDailyPlayedKey: null,
      achievements: [],
    });
    expect(loadPreferences()).toEqual({ version: 1, firstRunDismissed: true });
  });

  it('normalizes partial stats payloads from older local data', () => {
    localStorage.setItem('mastermind:stats:v1', JSON.stringify({
      version: 1,
      completedDailyKeys: ['2026-03-10'],
    }));

    expect(loadStats()).toEqual({
      version: 1,
      totals: { gamesPlayed: 0, wins: 0, losses: 0 },
      streaks: { currentDailyWin: 0, bestDailyWin: 0 },
      modes: {
        starter: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        classic: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        hard: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        expert: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        daily: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        duplicates: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        dual: { gamesPlayed: 0 },
      },
      completedDailyKeys: ['2026-03-10'],
      lastDailyPlayedKey: null,
      achievements: [],
    });
  });
});
