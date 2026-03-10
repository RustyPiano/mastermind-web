import { describe, expect, it } from 'vitest';
import { calcFeedback, generateSecret, isWinningFeedback, FEEDBACK } from '../js/engine.js';

describe('calcFeedback', () => {
  it('returns all exact for a perfect guess', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c2', 'c3', 'c4']))
      .toEqual([FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT]);
  });

  it('returns misplaced when a color exists in the wrong position', () => {
    expect(calcFeedback(['c5', 'c6', 'c7', 'c1'], ['c1', 'c2', 'c3', 'c4']))
      .toEqual([FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.MISPLACED]);
  });

  it('returns all none when there is no overlap', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c5', 'c6', 'c7', 'c5']))
      .toEqual([FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE]);
  });

  it('handles mixed exact and misplaced matches', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c3', 'c2', 'c4']))
      .toEqual([FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.MISPLACED, FEEDBACK.EXACT]);
  });

  it('consumes matches correctly when the guess has duplicates', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c1', 'c5', 'c6']))
      .toEqual([FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE]);
  });

  it('throws on length mismatch', () => {
    expect(() => calcFeedback(['c1', 'c2'], ['c1', 'c2', 'c3', 'c4']))
      .toThrow();
  });
});

describe('generateSecret', () => {
  const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

  it('returns the requested code length', () => {
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: false });
    expect(secret).toHaveLength(4);
  });

  it('contains no duplicates when disallowed', () => {
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: false });
    expect(new Set(secret).size).toBe(4);
  });

  it('allows duplicates when enabled', () => {
    let index = 0;
    const rng = () => [0, 0, 0.5, 0.5][index++] ?? 0;
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: true, rng });
    expect(secret).toEqual(['c1', 'c1', 'c4', 'c4']);
  });

  it('produces deterministic output with a fixed rng', () => {
    const rng = () => 0.1;
    const first = generateSecret({ colors, codeLength: 4, allowDuplicates: false, rng });
    const second = generateSecret({ colors, codeLength: 4, allowDuplicates: false, rng: () => 0.1 });
    expect(first).toEqual(second);
  });
});

describe('isWinningFeedback', () => {
  it('returns true for all exact feedback', () => {
    expect(isWinningFeedback(
      [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.EXACT],
      4,
    )).toBe(true);
  });

  it('returns false if any value is not exact', () => {
    expect(isWinningFeedback(
      [FEEDBACK.EXACT, FEEDBACK.MISPLACED, FEEDBACK.EXACT, FEEDBACK.EXACT],
      4,
    )).toBe(false);
  });
});
