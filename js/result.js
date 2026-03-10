export function buildFinishedResult(state, { win, rounds }) {
  return {
    mode: state.mode,
    variant: state.variant,
    challengeKey: state.challengeKey,
    isChallenge: state.isChallenge,
    challengeUrl: state.challengeUrl,
    rounds,
    win,
    history: state.guessHistory.map((entry) => ({
      feedback: [...entry.feedback],
    })),
    maxGuesses: state.activeConfig.maxGuesses,
  };
}
