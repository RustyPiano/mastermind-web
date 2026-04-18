const MOBILE_DEVICE_PATTERN = /Android|webOS|iPhone|iPad|iPod|Mobile/i;

function normalizePayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => (
      ['string', 'number', 'boolean'].includes(typeof value)
      || value === null
    )),
  );
}

function getAnalyticsClient(analyticsClient) {
  if (typeof analyticsClient === 'function') {
    return analyticsClient;
  }

  if (typeof window !== 'undefined' && typeof window.va === 'function') {
    return window.va;
  }

  return null;
}

export function getDeviceType(navigatorLike = globalThis.navigator) {
  if (navigatorLike?.userAgentData?.mobile) {
    return 'mobile';
  }

  return MOBILE_DEVICE_PATTERN.test(navigatorLike?.userAgent ?? '')
    ? 'mobile'
    : 'desktop';
}

export function trackEvent(name, payload = {}, analyticsClient) {
  const client = getAnalyticsClient(analyticsClient);
  if (!client) {
    return false;
  }

  client(name, normalizePayload(payload));
  return true;
}

export function trackHomeView({ isFirstSession, deviceType = getDeviceType() }, track = trackEvent) {
  return track('home_view', {
    is_first_session: isFirstSession,
    device_type: deviceType,
  });
}

export function trackModeClick({ mode, variant }, track = trackEvent) {
  return track('mode_click', { mode, variant });
}

export function trackDailyClick({ hasActiveSession }, track = trackEvent) {
  return track(hasActiveSession ? 'daily_resume' : 'daily_click', {
    variant: 'daily',
  });
}

export function trackGameStart({ variant, isChallenge, isPractice = false }, track = trackEvent) {
  return track('game_start', {
    variant,
    is_challenge: isChallenge,
    is_practice: isPractice,
  });
}

export function trackGuessSubmit({ variant, round, isPractice = false }, track = trackEvent) {
  return track('guess_submit', {
    variant,
    round,
    is_practice: isPractice,
  });
}

export function trackGameFinish({ variant, win, roundsUsed, isPractice = false }, track = trackEvent) {
  return track('game_finish', {
    variant,
    win,
    rounds_used: roundsUsed,
    is_practice: isPractice,
  });
}

export function trackStatsOpen(track = trackEvent) {
  return track('stats_open', {
    screen: 'mode',
  });
}

export function trackShareClick({ kind, variant }, track = trackEvent) {
  return track('share_click', {
    kind,
    variant,
  });
}

export function trackShareSuccess({ kind, variant }, track = trackEvent) {
  return track('share_success', {
    kind,
    variant,
  });
}

export function trackChallengeCreate({ variant, source }, track = trackEvent) {
  return track('challenge_create', {
    variant,
    source,
  });
}

export function trackChallengeOpen({ variant, source = 'url' }, track = trackEvent) {
  return track('challenge_open', {
    variant,
    source,
  });
}

export function trackChallengeStart({ variant, source = 'url' }, track = trackEvent) {
  return track('challenge_start', {
    variant,
    source,
  });
}
