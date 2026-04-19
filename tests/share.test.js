import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildChallengeNativeSharePayload,
  buildChallengeInviteText,
  buildChallengeShareText,
  buildShareText,
  feedbackToEmoji,
  isMobileShareEnvironment,
  shareResult,
} from '../js/share.js';
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
      isDailyPractice: false,
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
      isDailyPractice: false,
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

  it('uses a practice-specific title for daily practice results', () => {
    expect(buildShareText({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      isDailyPractice: true,
      rounds: 5,
      maxGuesses: 10,
      win: true,
      history: [],
    })).toContain('密码机 今日练习 2026-03-10');
  });
});

describe('buildChallengeShareText', () => {
  it('includes the challenge url in copied challenge text', () => {
    expect(buildChallengeShareText('https://mastermind.rustypiano.com/?challenge=abc', 'hard')).toBe([
      '密码机 困难模式 好友挑战',
      '我设了一个密码，你能破解吗？',
      'https://mastermind.rustypiano.com/?challenge=abc',
    ].join('\n'));
  });
});

describe('buildChallengeInviteText', () => {
  it('omits the url for system share payloads', () => {
    expect(buildChallengeInviteText('hard')).toBe([
      '密码机 困难模式 好友挑战',
      '我设了一个密码，你能破解吗？',
    ].join('\n'));
  });
});

describe('isMobileShareEnvironment', () => {
  it('detects mobile browsers from userAgentData', () => {
    expect(isMobileShareEnvironment({ userAgentData: { mobile: true } })).toBe(true);
  });

  it('detects mobile browsers from userAgent', () => {
    expect(isMobileShareEnvironment({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true);
    expect(isMobileShareEnvironment({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe(false);
  });
});

describe('buildChallengeNativeSharePayload', () => {
  it('keeps url separate on desktop to avoid duplicate copied links', () => {
    expect(buildChallengeNativeSharePayload(
      'https://mastermind.rustypiano.com/?challenge=abc',
      'hard',
      { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    )).toEqual({
      title: '密码机 朋友挑战',
      text: [
        '密码机 困难模式 好友挑战',
        '我设了一个密码，你能破解吗？',
      ].join('\n'),
      url: 'https://mastermind.rustypiano.com/?challenge=abc',
    });
  });

  it('inlines the url on mobile so system copy keeps the challenge link', () => {
    expect(buildChallengeNativeSharePayload(
      'https://mastermind.rustypiano.com/?challenge=abc',
      'hard',
      { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    )).toEqual({
      title: '密码机 朋友挑战',
      text: [
        '密码机 困难模式 好友挑战',
        '我设了一个密码，你能破解吗？',
        'https://mastermind.rustypiano.com/?challenge=abc',
      ].join('\n'),
    });
  });
});

describe('shareResult', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('passes the site url explicitly to navigator.share for normal results', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share },
      configurable: true,
      writable: true,
    });

    await shareResult({
      mode: 'single',
      variant: 'classic',
      challengeKey: null,
      rounds: 4,
      maxGuesses: 10,
      win: true,
      history: [],
    });

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: '密码机 经典模式',
      url: 'https://mastermind.rustypiano.com/',
    }));
  });
});
