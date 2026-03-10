import { describe, expect, it } from 'vitest';
import { buildShareText, feedbackToEmoji } from '../js/share.js';
import { FEEDBACK } from '../js/engine.js';

describe('feedbackToEmoji', () => {
  it('maps semantic feedback values to emoji', () => {
    expect(feedbackToEmoji(FEEDBACK.EXACT)).toBe('🟢');
    expect(feedbackToEmoji(FEEDBACK.MISPLACED)).toBe('🟠');
    expect(feedbackToEmoji(FEEDBACK.NONE)).toBe('⚪');
  });
});

describe('buildShareText', () => {
  const history = [
    { feedback: [FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.NONE, FEEDBACK.NONE] },
    { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.NONE] },
    { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT] },
  ];

  it('builds daily win share text', () => {
    expect(buildShareText({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 4,
      maxGuesses: 10,
      win: true,
      history,
    })).toBe([
      '密码机 每日挑战 2026-03-10',
      '4/10',
      '🟢🟠⚪⚪',
      '🟢🟢🟠⚪',
      '🟢🟢🟢🟢',
      'https://mastermind.rustypiano.com/',
    ].join('\n'));
  });

  it('builds classic loss share text with X score', () => {
    expect(buildShareText({
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 10,
      maxGuesses: 10,
      win: false,
      history: [
        { feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
      ],
    })).toBe([
      '密码机 经典模式',
      'X/10',
      '🟢⚪⚪⚪',
      'https://mastermind.rustypiano.com/',
    ].join('\n'));
  });

  it('builds expert share text with the mode label', () => {
    expect(buildShareText({
      mode: 'single',
      variant: 'expert',
      challengeKey: null,
      rounds: 8,
      maxGuesses: 10,
      win: true,
      history: [
        { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.NONE, FEEDBACK.NONE] },
      ],
    })).toBe([
      '密码机 专家模式',
      '8/10',
      '🟢🟢🟠⚪⚪',
      'https://mastermind.rustypiano.com/',
    ].join('\n'));
  });

  it('does not leak secret color ids', () => {
    const text = buildShareText({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      rounds: 3,
      maxGuesses: 10,
      win: true,
      history: [
        { guess: ['c1', 'c2', 'c3', 'c4'], feedback: [FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
      ],
    });

    expect(text).not.toContain('c1');
    expect(text).not.toContain('c2');
    expect(text).not.toContain('c3');
    expect(text).not.toContain('c4');
  });
});
