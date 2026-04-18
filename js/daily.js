import { generateSecret } from './engine.js';

export const CHALLENGE_TIME_ZONE = 'Asia/Shanghai';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getZonedDateParts(date, timeZone = CHALLENGE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

export function dateToChallengeKey(date = new Date(), timeZone = CHALLENGE_TIME_ZONE) {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function getTimeUntilNextChallenge(date = new Date(), timeZone = CHALLENGE_TIME_ZONE) {
  const { hour, minute, second } = getZonedDateParts(date, timeZone);
  const elapsed = (
    (Number(hour) * 60 * 60 * 1000)
    + (Number(minute) * 60 * 1000)
    + (Number(second) * 1000)
    + date.getMilliseconds()
  );

  const remaining = DAY_IN_MS - elapsed;
  return remaining > 0 ? remaining : DAY_IN_MS;
}

export function formatChallengeCountdown(msUntilNextChallenge) {
  const totalSeconds = Math.max(0, Math.ceil(msUntilNextChallenge / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function buildDailyModeEntryState({
  challengeKey,
  activeSessionType = null,
  hasCompleted = false,
  dailyResult = null,
  msUntilNextChallenge,
}) {
  const countdownText = `${formatChallengeCountdown(msUntilNextChallenge)} 后刷新`;

  if (activeSessionType === 'official') {
    return {
      status: 'in_progress',
      buttonText: '继续每日挑战',
      metaText: `继续 ${challengeKey} 的进度，保住你的每日连胜。${countdownText}`,
    };
  }

  if (activeSessionType === 'practice') {
    return {
      status: 'practice_in_progress',
      buttonText: '继续今日练习',
      metaText: `继续 ${challengeKey} 的复盘练习，不会覆盖今天的正式成绩。${countdownText}`,
    };
  }

  if (dailyResult?.status === 'won') {
    return {
      status: 'won',
      buttonText: '每日挑战',
      metaText: `${challengeKey} 已完成 ✓，明天继续冲击连胜。${countdownText}`,
    };
  }

  if (dailyResult?.status === 'lost') {
    return {
      status: 'lost',
      buttonText: '今日练习',
      metaText: `${challengeKey} 已失败，今日成绩已记录。${countdownText}`,
    };
  }

  if (hasCompleted) {
    return {
      status: 'recorded',
      buttonText: '今日练习',
      metaText: `${challengeKey} 今日成绩已记录。${countdownText}`,
    };
  }

  return {
    status: 'available',
    buttonText: '每日挑战',
    metaText: `${challengeKey} 今日题目，通关后会记入每日连胜。${countdownText}`,
  };
}

export function getDailySessionType(session, challengeKey) {
  if (
    session?.mode !== 'single'
    || session?.variant !== 'daily'
    || session?.challengeKey !== challengeKey
    || session?.status !== 'in_progress'
  ) {
    return null;
  }

  return session?.isDailyPractice ? 'practice' : 'official';
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
  return getDailySessionType(session, challengeKey) !== null;
}
