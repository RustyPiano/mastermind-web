import { describe, expect, it } from 'vitest';
import { getAverageRounds, hasCompletedDaily, recordGameResult } from '../js/stats.js';

describe('recordGameResult', () => {
  it('initializes stats on the first classic win', () => {
    const stats = recordGameResult(null, {
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 4,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    expect(stats.totals).toEqual({ gamesPlayed: 1, wins: 1, losses: 0 });
    expect(stats.modes.classic).toMatchObject({
      bestRounds: 4,
      totalRoundsSum: 4,
      gameCount: 1,
      wins: 1,
      losses: 0,
    });
  });

  it('increments the daily streak on consecutive daily wins', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 3,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-11',
      rounds: 4,
      win: true,
      finishedAt: '2026-03-11T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(2);
    expect(stats.streaks.bestDailyWin).toBe(2);
  });

  it('resets the daily streak on a failed daily challenge', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 3,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-11',
      rounds: 10,
      win: false,
      finishedAt: '2026-03-11T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(0);
    expect(stats.streaks.bestDailyWin).toBe(1);
  });

  it('calculates averages from totalRoundsSum and gameCount', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 3,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 5,
      win: false,
      finishedAt: '2026-03-10T09:00:00.000Z',
    });

    expect(getAverageRounds(stats.modes.classic)).toBe(4);
  });

  it('prevents double-counting the same daily challenge', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 4,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 6,
      win: true,
      finishedAt: '2026-03-10T09:00:00.000Z',
    });

    expect(stats.totals.gamesPlayed).toBe(1);
    expect(stats.modes.daily.gameCount).toBe(1);
  });

  it('caps completedDailyKeys at 365 entries', () => {
    let stats = null;

    for (let day = 1; day <= 366; day += 1) {
      const key = `2026-03-${String(day).padStart(2, '0')}`;
      stats = recordGameResult(stats, {
        mode: 'single',
        variant: 'daily',
        challengeKey: key,
        rounds: 4,
        win: true,
        finishedAt: `2026-03-${String(day).padStart(2, '0')}T08:00:00.000Z`,
      });
    }

    expect(stats.completedDailyKeys).toHaveLength(365);
    expect(stats.completedDailyKeys[0]).toBe('2026-03-02');
  });
});

describe('hasCompletedDaily', () => {
  it('checks whether a challenge key is already completed', () => {
    expect(hasCompletedDaily({ completedDailyKeys: ['2026-03-10'] }, '2026-03-10')).toBe(true);
    expect(hasCompletedDaily({ completedDailyKeys: ['2026-03-10'] }, '2026-03-11')).toBe(false);
  });
});
