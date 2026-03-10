import { generateSecret } from './engine.js';

export function dateToChallengeKey(date = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hashStringToSeed(input) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function createSeededRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function generateDailySecret({ dateKey, colors, codeLength, allowDuplicates }) {
  if (!allowDuplicates && colors.length < codeLength) {
    throw new Error('Not enough unique colors to generate daily secret');
  }

  const seed = hashStringToSeed(dateKey);
  const rng = createSeededRng(seed);

  return generateSecret({
    colors,
    codeLength,
    allowDuplicates,
    rng,
  });
}

export function isDailySessionForKey(session, challengeKey) {
  return (
    session?.mode === 'single'
    && session?.variant === 'daily'
    && session?.challengeKey === challengeKey
    && session?.status === 'in_progress'
  );
}
