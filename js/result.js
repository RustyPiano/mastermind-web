export function buildFinishedResult(state, { win, rounds }) {
  return {
    mode: state.mode,
    variant: state.variant,
    challengeKey: state.challengeKey,
    isChallenge: state.isChallenge,
    challengeUrl: state.challengeUrl,
    challengeSource: state.challengeSource ?? null,
    challengeTargetRounds: state.challengeTargetRounds ?? null,
    isDailyPractice: Boolean(state.isDailyPractice),
    rounds,
    win,
    history: state.guessHistory.map((entry) => ({
      feedback: [...entry.feedback],
    })),
    maxGuesses: state.activeConfig.maxGuesses,
  };
}
