import { describe, expect, it } from 'vitest';
import {
  buildStatsPanelSections,
  getAverageRounds,
  getBestSinglePreset,
  getModeWinRate,
  hasCompletedDaily,
  recordGameResult,
  refreshMakeupCardsIfNeeded,
  canUseMakeupCard,
  applyMakeupCard,
  getMissedDayKey,
  createDefaultStats,
} from '../js/stats.js';

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

  it('tracks starter and hard runs in separate mode buckets', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'starter',
      challengeKey: null,
      rounds: 5,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'hard',
      challengeKey: null,
      rounds: 9,
      win: true,
      finishedAt: '2026-03-10T09:00:00.000Z',
    });

    expect(stats.modes.starter.bestRounds).toBe(5);
    expect(stats.modes.hard.bestRounds).toBe(9);
    expect(stats.modes.classic.bestRounds).toBeNull();
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
    expect(stats.dailyResults['2026-03-11']).toMatchObject({
      status: 'lost',
      rounds: 10,
    });
  });

  it('resets the daily streak when days are not consecutive', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 3,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    // Skip 2026-03-11, come back on 2026-03-12
    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-12',
      rounds: 4,
      win: true,
      finishedAt: '2026-03-12T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(1);
    expect(stats.streaks.bestDailyWin).toBe(1);
  });

  it('starts streak at 1 on first daily win', () => {
    const stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 3,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(1);
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

  it('tracks duplicates as its own stats bucket', () => {
    const stats = recordGameResult(null, {
      mode: 'single',
      variant: 'duplicates',
      challengeKey: null,
      rounds: 7,
      win: false,
      finishedAt: '2026-03-10T08:00:00.000Z',
    });

    expect(stats.modes.duplicates).toMatchObject({
      bestRounds: null,
      totalRoundsSum: 7,
      gameCount: 1,
      wins: 0,
      losses: 1,
    });
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
    expect(stats.dailyResults['2026-03-10']).toMatchObject({
      status: 'won',
      rounds: 4,
    });
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

describe('stats helpers', () => {
  it('calculates mode win rate from wins and game count', () => {
    expect(getModeWinRate({ wins: 3, gameCount: 4 })).toBe(75);
    expect(getModeWinRate({ wins: 0, gameCount: 0 })).toBe(0);
  });

  it('selects the best single preset by lowest best round count', () => {
    const stats = {
      modes: {
        starter: { bestRounds: 6 },
        classic: { bestRounds: 4 },
        hard: { bestRounds: null },
        expert: { bestRounds: 5 },
      },
    };

    expect(getBestSinglePreset(stats)).toEqual({
      variant: 'classic',
      label: '经典模式',
      bestRounds: 4,
    });
  });

  it('returns null when no single preset has a win yet', () => {
    expect(getBestSinglePreset({
      modes: {
        starter: { bestRounds: null },
        classic: { bestRounds: null },
        hard: { bestRounds: null },
        expert: { bestRounds: null },
      },
    })).toBeNull();
  });

  it('builds grouped stats panel sections for all current modes', () => {
    const stats = recordGameResult(recordGameResult(null, {
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 4,
      win: true,
      finishedAt: '2026-03-10T08:00:00.000Z',
    }), {
      mode: 'single',
      variant: 'duplicates',
      challengeKey: null,
      rounds: 7,
      win: false,
      finishedAt: '2026-03-10T09:00:00.000Z',
    });

    const sections = buildStatsPanelSections(stats);

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe('单人闯关');
    expect(sections[0].cards).toHaveLength(4);
    expect(sections[1].cards[0].metrics.some((metric) => metric.label === '当前连胜')).toBe(true);
    expect(sections[2].cards.map((card) => card.title)).toEqual(['重复色模式', '双人对战']);
  });
});

describe('makeup card system', () => {
  it('defaults to 2 available cards with no refresh month', () => {
    const stats = createDefaultStats();
    expect(stats.makeupCards.available).toBe(2);
    expect(stats.makeupCards.refreshMonth).toBeNull();
    expect(stats.makeupDays).toEqual([]);
  });

  it('refreshMakeupCardsIfNeeded resets available to 2 on new month', () => {
    const stats = { ...createDefaultStats(), makeupCards: { available: 0, refreshMonth: '2026-03' } };
    const refreshed = refreshMakeupCardsIfNeeded(stats, '2026-04');
    expect(refreshed.makeupCards.available).toBe(2);
    expect(refreshed.makeupCards.refreshMonth).toBe('2026-04');
  });

  it('refreshMakeupCardsIfNeeded is a no-op within the same month', () => {
    const stats = { ...createDefaultStats(), makeupCards: { available: 1, refreshMonth: '2026-04' } };
    const refreshed = refreshMakeupCardsIfNeeded(stats, '2026-04');
    expect(refreshed.makeupCards.available).toBe(1);
  });

  it('canUseMakeupCard returns true when cards available', () => {
    expect(canUseMakeupCard({ makeupCards: { available: 2, refreshMonth: null } })).toBe(true);
    expect(canUseMakeupCard({ makeupCards: { available: 0, refreshMonth: null } })).toBe(false);
  });

  it('applyMakeupCard consumes one card and records the missed day', () => {
    const stats = createDefaultStats();
    const next = applyMakeupCard(stats, '2026-04-10');
    expect(next.makeupCards.available).toBe(1);
    expect(next.makeupDays).toContain('2026-04-10');
  });

  it('applyMakeupCard is idempotent for the same day', () => {
    const stats = createDefaultStats();
    const once = applyMakeupCard(stats, '2026-04-10');
    const twice = applyMakeupCard(once, '2026-04-10');
    expect(twice.makeupCards.available).toBe(1);
    expect(twice.makeupDays.filter((d) => d === '2026-04-10')).toHaveLength(1);
  });

  it('applyMakeupCard is a no-op when no cards remain', () => {
    const stats = { ...createDefaultStats(), makeupCards: { available: 0, refreshMonth: null } };
    const next = applyMakeupCard(stats, '2026-04-10');
    expect(next.makeupDays).not.toContain('2026-04-10');
  });

  it('getMissedDayKey returns the skipped day when there is exactly a 1-day gap', () => {
    const stats = { ...createDefaultStats(), lastDailyPlayedKey: '2026-04-17' };
    expect(getMissedDayKey(stats, '2026-04-19')).toBe('2026-04-18');
  });

  it('getMissedDayKey returns null when gap is 0 (consecutive)', () => {
    const stats = { ...createDefaultStats(), lastDailyPlayedKey: '2026-04-17' };
    expect(getMissedDayKey(stats, '2026-04-18')).toBeNull();
  });

  it('getMissedDayKey returns null when gap is >1 day', () => {
    const stats = { ...createDefaultStats(), lastDailyPlayedKey: '2026-04-15' };
    expect(getMissedDayKey(stats, '2026-04-19')).toBeNull();
  });

  it('streak is maintained when made-up day bridges the gap on next daily win', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-04-17',
      rounds: 4,
      win: true,
      finishedAt: '2026-04-17T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(1);

    // Player uses a makeup card for the missed day (2026-04-18)
    stats = applyMakeupCard(stats, '2026-04-18');

    // Player wins on 2026-04-19 (2 days after last played, but gap bridged by makeup)
    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-04-19',
      rounds: 5,
      win: true,
      finishedAt: '2026-04-19T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(2);
    expect(stats.streaks.bestDailyWin).toBe(2);
  });

  it('streak resets without makeup card when days are skipped', () => {
    let stats = recordGameResult(null, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-04-17',
      rounds: 4,
      win: true,
      finishedAt: '2026-04-17T08:00:00.000Z',
    });

    // No makeup card used — direct jump to 2026-04-19
    stats = recordGameResult(stats, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-04-19',
      rounds: 3,
      win: true,
      finishedAt: '2026-04-19T08:00:00.000Z',
    });

    expect(stats.streaks.currentDailyWin).toBe(1);
  });
});
