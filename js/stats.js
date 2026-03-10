import { SINGLE_PRESET_IDS, getModeConfig } from './mode-config.js';

const MAX_COMPLETED_DAILIES = 365;
const TRACKED_VARIANTS = Object.freeze([
  ...SINGLE_PRESET_IDS,
  'daily',
  'duplicates',
]);

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

function createTrackedModeStats() {
  return Object.fromEntries(
    TRACKED_VARIANTS.map((variant) => [variant, createModeStats()]),
  );
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
      ...createTrackedModeStats(),
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
  const nextModes = Object.fromEntries(
    TRACKED_VARIANTS.map((variant) => [
      variant,
      {
        ...defaults.modes[variant],
        ...(stats?.modes?.[variant] ?? {}),
      },
    ]),
  );

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
      ...nextModes,
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

export function getModeWinRate(modeStats) {
  if (!modeStats?.gameCount) {
    return 0;
  }

  return Math.round(((modeStats.wins ?? 0) / modeStats.gameCount) * 100);
}

export function getBestSinglePreset(stats) {
  const safeStats = normalizeStats(stats);
  const candidates = SINGLE_PRESET_IDS
    .map((variant) => {
      const modeStats = safeStats.modes[variant];
      if (modeStats.bestRounds === null) return null;

      return {
        variant,
        label: getModeConfig(variant).label,
        bestRounds: modeStats.bestRounds,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.bestRounds - b.bestRounds);

  return candidates[0] ?? null;
}

function buildModeMetrics(modeStats) {
  const average = getAverageRounds(modeStats);

  return {
    bestText: modeStats?.bestRounds === null || modeStats?.bestRounds === undefined
      ? '-'
      : `${modeStats.bestRounds}步`,
    averageText: average === null ? '-' : `${average.toFixed(1)}步`,
    winRateText: `${getModeWinRate(modeStats)}%`,
    gamesText: String(modeStats?.gameCount ?? 0),
  };
}

export function buildStatsPanelSections(stats) {
  const safeStats = normalizeStats(stats);
  const makeModeCard = (variant) => {
    const metrics = buildModeMetrics(safeStats.modes[variant]);

    return {
      kind: 'mode',
      variant,
      title: getModeConfig(variant).label,
      metrics: [
        { label: '最佳', value: metrics.bestText },
        { label: '平均', value: metrics.averageText },
        { label: '胜率', value: metrics.winRateText },
        { label: '场次', value: metrics.gamesText },
      ],
    };
  };

  return [
    {
      id: 'single-presets',
      title: '单人闯关',
      cards: SINGLE_PRESET_IDS.map(makeModeCard),
    },
    {
      id: 'daily',
      title: '每日挑战',
      cards: [{
        kind: 'daily',
        variant: 'daily',
        title: '每日挑战',
        metrics: [
          { label: '最佳', value: buildModeMetrics(safeStats.modes.daily).bestText },
          { label: '平均', value: buildModeMetrics(safeStats.modes.daily).averageText },
          { label: '胜率', value: buildModeMetrics(safeStats.modes.daily).winRateText },
          { label: '当前连胜', value: String(safeStats.streaks.currentDailyWin) },
          { label: '最佳连胜', value: String(safeStats.streaks.bestDailyWin) },
        ],
      }],
    },
    {
      id: 'variants',
      title: '其他模式',
      cards: [
        makeModeCard('duplicates'),
        {
          kind: 'dual',
          variant: 'dual',
          title: '双人对战',
          metrics: [
            { label: '总场次', value: String(safeStats.modes.dual.gamesPlayed ?? 0) },
          ],
        },
      ],
    },
  ];
}

export function recordGameResult(stats, result) {
  const nextStats = normalizeStats(stats);
  const isDaily = result.variant === 'daily';
  const isDual = result.mode === 'dual';
  const trackedVariant = result.mode === 'single' && TRACKED_VARIANTS.includes(result.variant)
    ? result.variant
    : null;

  if (isDaily && hasCompletedDaily(nextStats, result.challengeKey)) {
    return nextStats;
  }

  nextStats.totals.gamesPlayed += 1;
  if (result.win) {
    nextStats.totals.wins += 1;
  } else {
    nextStats.totals.losses += 1;
  }

  if (trackedVariant) {
    nextStats.modes[trackedVariant].gameCount += 1;
    nextStats.modes[trackedVariant].totalRoundsSum += result.rounds;
    nextStats.modes[trackedVariant].wins += result.win ? 1 : 0;
    nextStats.modes[trackedVariant].losses += result.win ? 0 : 1;

    if (result.win) {
      nextStats.modes[trackedVariant].bestRounds = nextStats.modes[trackedVariant].bestRounds === null
        ? result.rounds
        : Math.min(nextStats.modes[trackedVariant].bestRounds, result.rounds);
    }
  }

  if (isDaily) {
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
