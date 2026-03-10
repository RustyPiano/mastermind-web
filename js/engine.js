export const FEEDBACK = Object.freeze({
  EXACT: 'exact',
  MISPLACED: 'misplaced',
  NONE: 'none',
});

export function calcFeedback(guess, secret) {
  if (guess.length !== secret.length) {
    throw new Error('Guess and secret must have the same length');
  }

  const result = Array(secret.length).fill(FEEDBACK.NONE);
  const remainingSecret = [...secret];
  const remainingGuess = [...guess];

  for (let index = 0; index < secret.length; index += 1) {
    if (guess[index] === secret[index]) {
      result[index] = FEEDBACK.EXACT;
      remainingSecret[index] = null;
      remainingGuess[index] = null;
    }
  }

  for (let index = 0; index < remainingGuess.length; index += 1) {
    if (remainingGuess[index] === null) continue;

    const secretIndex = remainingSecret.indexOf(remainingGuess[index]);
    if (secretIndex !== -1) {
      result[index] = FEEDBACK.MISPLACED;
      remainingSecret[secretIndex] = null;
    }
  }

  return result;
}

export function shuffle(array, rng = Math.random) {
  const pool = [...array];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool;
}

export function generateSecret({ colors, codeLength, allowDuplicates, rng = Math.random }) {
  if (!allowDuplicates && colors.length < codeLength) {
    throw new Error('Not enough unique colors to generate secret');
  }

  if (allowDuplicates) {
    return Array.from({ length: codeLength }, () => {
      const colorIndex = Math.floor(rng() * colors.length);
      return colors[colorIndex];
    });
  }

  return shuffle(colors, rng).slice(0, codeLength);
}

export function isWinningFeedback(feedback, codeLength) {
  return (
    feedback.length === codeLength
    && feedback.every((value) => value === FEEDBACK.EXACT)
  );
}
