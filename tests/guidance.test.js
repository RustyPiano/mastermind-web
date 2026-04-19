import { describe, expect, it } from 'vitest';
import {
  buildGuessStatusMessage,
  buildRoundSummaryMessage,
} from '../js/guidance.js';

describe('buildGuessStatusMessage', () => {
  it('adds a first-game discovery hint before the first submission', () => {
    expect(buildGuessStatusMessage({
      codeLength: 4,
      isDaily: false,
      isDailyPractice: false,
      challengeKey: null,
      isGuessComplete: false,
      isFirstGuidedGame: true,
    })).toContain('先试着确认哪些颜色存在。');
  });

  it('uses the daily practice prefix when practicing today’s puzzle', () => {
    expect(buildGuessStatusMessage({
      codeLength: 4,
      isDaily: true,
      isDailyPractice: true,
      challengeKey: '2026-03-10',
      isGuessComplete: true,
      isFirstGuidedGame: false,
    })).toContain('今日练习 2026-03-10');
  });
});

describe('buildRoundSummaryMessage', () => {
  it('adds the first feedback hint after round one in a guided first game', () => {
    expect(buildRoundSummaryMessage({
      roundNumber: 1,
      exactCount: 1,
      misplacedCount: 2,
      maxGuesses: 10,
      isFirstGuidedGame: true,
    })).toContain('先数 🟢，再用 🟠 判断位置。');
  });

  it('adds a second hint after round two in a guided first game', () => {
    expect(buildRoundSummaryMessage({
      roundNumber: 2,
      exactCount: 2,
      misplacedCount: 0,
      maxGuesses: 10,
      isFirstGuidedGame: true,
    })).toContain('送入已确定的颜色');
  });

  it('falls back to the compact summary outside the guided first game', () => {
    expect(buildRoundSummaryMessage({
      roundNumber: 1,
      exactCount: 1,
      misplacedCount: 2,
      maxGuesses: 10,
      isFirstGuidedGame: false,
    })).toBe('第 1 轮 · 🟢 1 · 🟠 2 · 剩余 9 次');
  });
});
