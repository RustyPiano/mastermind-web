import { describe, expect, it } from 'vitest';
import { buildResultStatsText } from '../js/ui.js';

describe('buildResultStatsText', () => {
  it('keeps practice summaries separate from the official daily result', () => {
    const text = buildResultStatsText({
      version: 1,
      totals: { gamesPlayed: 1, wins: 0, losses: 1 },
      streaks: { currentDailyWin: 0, bestDailyWin: 2 },
      modes: {
        starter: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        classic: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        hard: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        expert: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        daily: { bestRounds: null, totalRoundsSum: 10, gameCount: 1, wins: 0, losses: 1 },
        duplicates: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
        dual: { gamesPlayed: 0 },
      },
      completedDailyKeys: ['2026-03-10'],
      lastDailyPlayedKey: '2026-03-10',
      dailyResults: {
        '2026-03-10': {
          status: 'lost',
          rounds: 10,
          finishedAt: '2026-03-10T12:00:00.000Z',
        },
      },
      achievements: [],
    }, {
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      isDailyPractice: true,
      win: true,
    });

    expect(text).toContain('今日练习不计入正式成绩');
    expect(text).toContain('正式记录：今天这题还没拿下');
  });
});
