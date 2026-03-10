const MAX_COMPLETED_DAILIES = 365;

/**
 * Returns true if currentKey is exactly one calendar day after prevKey.
 * Both keys are in "YYYY-MM-DD" format.
 * Uses local-time Date arithmetic to match how challenge keys are generated.
 */
function isConsecutiveDay(prevKey, currentKey) {
  if (!prevKey || !currentKey) return false;

  const [py, pm, pd] = prevKey.split('-').map(Number);
  const nextDate = new Date(py, pm - 1, pd + 1); // handles month/year overflow

  const nextKey = [
    nextDate.getFullYear(),
    String(nextDate.getMonth() + 1).padStart(2, '0'),
    String(nextDate.getDate()).padStart(2, '0'),
  ].join('-');

  return nextKey === currentKey;
}

function createModeStats() {
  return {
    bestRounds: null,
    totalRoundsSum: 0,
    gameCount: 0,
    wins: 0,
    losses: 0,
  };
}

export function createDefaultStats() {
  return {
    version: 1,
    totals: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
    },
    streaks: {
      currentDailyWin: 0,
      bestDailyWin: 0,
    },
    modes: {
      classic: createModeStats(),
      daily: createModeStats(),
      dual: {
        gamesPlayed: 0,
      },
    },
    completedDailyKeys: [],
    lastDailyPlayedKey: null,
  };
}

export function normalizeStats(stats) {
  const defaults = createDefaultStats();

  if (!stats || typeof stats !== 'object') {
    return defaults;
  }

  return {
    ...defaults,
    ...stats,
    totals: {
      ...defaults.totals,
      ...(stats.totals ?? {}),
    },
    streaks: {
      ...defaults.streaks,
      ...(stats.streaks ?? {}),
    },
    modes: {
      classic: {
        ...defaults.modes.classic,
        ...(stats.modes?.classic ?? {}),
      },
      daily: {
        ...defaults.modes.daily,
        ...(stats.modes?.daily ?? {}),
      },
      dual: {
        ...defaults.modes.dual,
        ...(stats.modes?.dual ?? {}),
      },
    },
    completedDailyKeys: Array.isArray(stats.completedDailyKeys)
      ? [...stats.completedDailyKeys]
      : [],
    lastDailyPlayedKey: stats.lastDailyPlayedKey ?? null,
  };
}

function addCompletedDailyKey(keys, challengeKey) {
  const nextKeys = [...keys];

  if (!nextKeys.includes(challengeKey)) {
    nextKeys.push(challengeKey);
    nextKeys.sort();
  }

  if (nextKeys.length > MAX_COMPLETED_DAILIES) {
    nextKeys.splice(0, nextKeys.length - MAX_COMPLETED_DAILIES);
  }

  return nextKeys;
}

export function hasCompletedDaily(stats, challengeKey) {
  return Array.isArray(stats?.completedDailyKeys)
    && stats.completedDailyKeys.includes(challengeKey);
}

export function getAverageRounds(modeStats) {
  if (!modeStats?.gameCount) {
    return null;
  }

  return modeStats.totalRoundsSum / modeStats.gameCount;
}

export function recordGameResult(stats, result) {
  const nextStats = normalizeStats(stats);
  const isDaily = result.variant === 'daily';
  const isClassic = result.variant === 'classic' && result.mode === 'single';
  const isDual = result.mode === 'dual';

  if (isDaily && hasCompletedDaily(nextStats, result.challengeKey)) {
    return nextStats;
  }

  nextStats.totals.gamesPlayed += 1;
  if (result.win) {
    nextStats.totals.wins += 1;
  } else {
    nextStats.totals.losses += 1;
  }

  if (isClassic) {
    nextStats.modes.classic.gameCount += 1;
    nextStats.modes.classic.totalRoundsSum += result.rounds;
    nextStats.modes.classic.wins += result.win ? 1 : 0;
    nextStats.modes.classic.losses += result.win ? 0 : 1;

    if (result.win) {
      nextStats.modes.classic.bestRounds = nextStats.modes.classic.bestRounds === null
        ? result.rounds
        : Math.min(nextStats.modes.classic.bestRounds, result.rounds);
    }
  }

  if (isDaily) {
    nextStats.modes.daily.gameCount += 1;
    nextStats.modes.daily.totalRoundsSum += result.rounds;
    nextStats.modes.daily.wins += result.win ? 1 : 0;
    nextStats.modes.daily.losses += result.win ? 0 : 1;

    if (result.win) {
      nextStats.modes.daily.bestRounds = nextStats.modes.daily.bestRounds === null
        ? result.rounds
        : Math.min(nextStats.modes.daily.bestRounds, result.rounds);
    }

    nextStats.completedDailyKeys = addCompletedDailyKey(
      nextStats.completedDailyKeys,
      result.challengeKey,
    );

    if (result.win) {
      const isConsecutive = isConsecutiveDay(nextStats.lastDailyPlayedKey, result.challengeKey);
      nextStats.streaks.currentDailyWin = isConsecutive ? nextStats.streaks.currentDailyWin + 1 : 1;
      nextStats.streaks.bestDailyWin = Math.max(
        nextStats.streaks.bestDailyWin,
        nextStats.streaks.currentDailyWin,
      );
    } else {
      nextStats.streaks.currentDailyWin = 0;
    }

    nextStats.lastDailyPlayedKey = result.challengeKey;
  }

  if (isDual) {
    nextStats.modes.dual.gamesPlayed += 1;
  }

  return nextStats;
}
