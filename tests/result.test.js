import { describe, expect, it } from 'vitest';
import { FEEDBACK } from '../js/engine.js';
import { buildFinishedResult } from '../js/result.js';

describe('buildFinishedResult', () => {
  it('includes challenge metadata, history, and maxGuesses for stats/share consumers', () => {
    const result = buildFinishedResult({
      mode: 'dual',
      variant: 'hard',
      challengeKey: null,
      isChallenge: true,
      challengeUrl: 'https://mastermind.rustypiano.com/?challenge=abc',
      activeConfig: { maxGuesses: 12 },
      guessHistory: [
        { feedback: [FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
        { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
      ],
    }, {
      win: true,
      rounds: 12,
    });

    expect(result).toEqual({
      mode: 'dual',
      variant: 'hard',
      challengeKey: null,
      isChallenge: true,
      challengeUrl: 'https://mastermind.rustypiano.com/?challenge=abc',
      rounds: 12,
      win: true,
      history: [
        { feedback: [FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
        { feedback: [FEEDBACK.EXACT, FEEDBACK.EXACT, FEEDBACK.NONE, FEEDBACK.NONE, FEEDBACK.NONE] },
      ],
      maxGuesses: 12,
    });
  });
});
