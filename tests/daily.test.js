import { describe, expect, it } from 'vitest';
import {
  createSeededRng,
  dateToChallengeKey,
  generateDailySecret,
  hashStringToSeed,
  isDailySessionForKey,
} from '../js/daily.js';
import { hasCompletedDaily } from '../js/stats.js';

describe('dateToChallengeKey', () => {
  it('uses the local calendar date for the supplied timezone', () => {
    const date = new Date('2026-03-10T16:30:00.000Z');

    expect(dateToChallengeKey(date, 'Asia/Shanghai')).toBe('2026-03-11');
    expect(dateToChallengeKey(date, 'America/Los_Angeles')).toBe('2026-03-10');
  });
});

describe('hashStringToSeed', () => {
  it('is deterministic for the same input', () => {
    expect(hashStringToSeed('2026-03-10')).toBe(hashStringToSeed('2026-03-10'));
    expect(hashStringToSeed('2026-03-10')).toBe(2815780391);
  });
});

describe('createSeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createSeededRng(12345);
    const second = createSeededRng(12345);

    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe('generateDailySecret', () => {
  const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

  it('returns the same secret for the same date key', () => {
    const first = generateDailySecret({
      dateKey: '2026-03-10',
      colors,
      codeLength: 4,
      allowDuplicates: false,
    });
    const second = generateDailySecret({
      dateKey: '2026-03-10',
      colors,
      codeLength: 4,
      allowDuplicates: false,
    });

    expect(first).toEqual(second);
  });

  it('returns a different secret for a different date key', () => {
    const first = generateDailySecret({
      dateKey: '2026-03-10',
      colors,
      codeLength: 4,
      allowDuplicates: false,
    });
    const second = generateDailySecret({
      dateKey: '2026-03-11',
      colors,
      codeLength: 4,
      allowDuplicates: false,
    });

    expect(first).not.toEqual(second);
  });

  it('throws when unique colors are insufficient', () => {
    expect(() => generateDailySecret({
      dateKey: '2026-03-10',
      colors: ['c1', 'c2', 'c3'],
      codeLength: 4,
      allowDuplicates: false,
    })).toThrow();
  });
});

describe('isDailySessionForKey', () => {
  it('recognizes a resumable daily session for today', () => {
    expect(isDailySessionForKey({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      status: 'in_progress',
    }, '2026-03-10')).toBe(true);
  });

  it('rejects sessions for other dates or finished sessions', () => {
    expect(isDailySessionForKey({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-09',
      status: 'in_progress',
    }, '2026-03-10')).toBe(false);

    expect(isDailySessionForKey({
      mode: 'single',
      variant: 'daily',
      challengeKey: '2026-03-10',
      status: 'won',
    }, '2026-03-10')).toBe(false);
  });
});

describe('hasCompletedDaily', () => {
  it('recognizes completed daily keys from stored stats data', () => {
    expect(hasCompletedDaily({
      completedDailyKeys: ['2026-03-09', '2026-03-10'],
    }, '2026-03-10')).toBe(true);
  });

  it('returns false when the key is not present', () => {
    expect(hasCompletedDaily({
      completedDailyKeys: ['2026-03-09'],
    }, '2026-03-10')).toBe(false);
  });
});
