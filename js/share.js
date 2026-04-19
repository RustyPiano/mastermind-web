import { FEEDBACK } from './engine.js';
import { getAvailableColors } from './constants.js';
import { getModeConfig, MODE_CONFIGS } from './mode-config.js';

const SITE_URL = 'https://mastermind.rustypiano.com/';
const CHALLENGE_PAYLOAD_VERSION = 2;
const DEFAULT_CHALLENGE_VARIANT = 'classic';

export function feedbackToEmoji(value) {
  if (value === FEEDBACK.EXACT) return '🟢';
  if (value === FEEDBACK.MISPLACED) return '🟠';
  return '⚪';
}

function buildTitle(result) {
  if (result.variant === 'daily' && result.isDailyPractice) {
    return `密码机 今日练习 ${result.challengeKey}`;
  }

  if (result.variant === 'daily') {
    return `密码机 每日挑战 ${result.challengeKey}`;
  }

  if (result.isChallenge) {
    return '密码机 解锁了好友的密码挑战！';
  }

  if (result.mode === 'dual') {
    return '密码机 双人对战';
  }

  return `密码机 ${getModeConfig(result.variant).label}`;
}

export function buildShareText(result) {
  const score = result.win ? result.rounds : 'X';
  const rows = result.history.map((entry) => entry.feedback.map(feedbackToEmoji).join(''));
  let url = SITE_URL;

  if (result.isChallenge && result.challengeUrl) {
    url = result.challengeUrl;
  }

  return [
    buildTitle(result),
    `${score}/${result.maxGuesses}`,
    ...rows,
    url,
  ].join('\n');
}

export function buildChallengeShareText(url, variant) {
  const modeLabel = getModeConfig(variant).label;

  return [
    `密码机 ${modeLabel} 好友挑战`,
    '我设了一个密码，你能破解吗？',
    url,
  ].join('\n');
}

export function buildChallengeInviteText(variant) {
  const modeLabel = getModeConfig(variant).label;

  return [
    `密码机 ${modeLabel} 好友挑战`,
    '我设了一个密码，你能破解吗？',
  ].join('\n');
}

export function buildChallengeIntroContent({ variant, challengeTargetRounds = null }) {
  const modeLabel = getModeConfig(variant).label;

  return {
    title: `${modeLabel} 好友挑战`,
    body: Number.isFinite(challengeTargetRounds)
      ? `朋友用了 ${challengeTargetRounds} 步。你能更少吗？`
      : '朋友设了一道密码，看你能不能破。',
    actionLabel: '开始挑战',
  };
}

export function isMobileShareEnvironment(navigatorObject = navigator) {
  if (!navigatorObject) {
    return false;
  }

  if (navigatorObject.userAgentData?.mobile === true) {
    return true;
  }

  const userAgent = navigatorObject.userAgent ?? '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
}

export function buildChallengeNativeSharePayload(url, variant, navigatorObject = navigator) {
  const payload = {
    title: '密码机 朋友挑战',
    text: buildChallengeInviteText(variant),
  };

  if (isMobileShareEnvironment(navigatorObject)) {
    payload.text = buildChallengeShareText(url, variant);
    return payload;
  }

  payload.url = url;
  return payload;
}

function isSupportedChallengeVariant(variant) {
  return variant !== 'daily' && Boolean(MODE_CONFIGS[variant]);
}

function isValidSecretForVariant(secretCode, variant) {
  if (!Array.isArray(secretCode) || secretCode.length === 0) {
    return false;
  }

  if (!isSupportedChallengeVariant(variant)) {
    return false;
  }

  const config = getModeConfig(variant);
  const allowedColors = new Set(
    getAvailableColors(config.paletteColorCount).map((color) => color.id),
  );

  if (secretCode.length !== config.codeLength) {
    return false;
  }

  if (secretCode.some((colorId) => typeof colorId !== 'string' || !allowedColors.has(colorId))) {
    return false;
  }

  if (!config.allowDuplicates && new Set(secretCode).size !== secretCode.length) {
    return false;
  }

  return true;
}

export function parseChallengePayload(challengeParam) {
  if (!challengeParam) {
    return null;
  }

  try {
    const decoded = JSON.parse(atob(challengeParam));
    if (!decoded || !Array.isArray(decoded.s)) {
      return null;
    }

    if (decoded.v === undefined && isValidSecretForVariant(decoded.s, DEFAULT_CHALLENGE_VARIANT)) {
      return {
        secretCode: [...decoded.s],
        variant: DEFAULT_CHALLENGE_VARIANT,
        challengeSource: null,
        challengeTargetRounds: null,
      };
    }

    if ((decoded.v !== 1 && decoded.v !== CHALLENGE_PAYLOAD_VERSION) || typeof decoded.m !== 'string') {
      return null;
    }

    if (!isValidSecretForVariant(decoded.s, decoded.m)) {
      return null;
    }

    return {
      secretCode: [...decoded.s],
      variant: decoded.m,
      challengeSource: typeof decoded.src === 'string' ? decoded.src : null,
      challengeTargetRounds: Number.isFinite(decoded.r) ? decoded.r : null,
    };
  } catch {
    return null;
  }
}

export function buildChallengeUrl(secretCode, currentSiteUrl = window.location.href, options = {}) {
  // Extract base URL without query params or hashes
  const baseUrl = currentSiteUrl.split(/[?#]/)[0];
  const variant = options.variant ?? DEFAULT_CHALLENGE_VARIANT;

  if (!isValidSecretForVariant(secretCode, variant)) {
    throw new Error('Invalid challenge payload');
  }

  const payload = JSON.stringify({
    v: CHALLENGE_PAYLOAD_VERSION,
    m: variant,
    s: secretCode,
    ...(typeof options.source === 'string' ? { src: options.source } : {}),
    ...(Number.isFinite(options.targetRounds) ? { r: options.targetRounds } : {}),
  });

  // Use btoa to create a base64 encoded string
  // Note: For unicode safely we should technically use encodeURIComponent, 
  // but since our secretCode only contains ascii IDs (e.g. 'c1', 'c2'), direct btoa is fine
  const encoded = btoa(payload);

  return `${baseUrl}?challenge=${encoded}`;
}

export async function copyShareText(text) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }

  await navigator.clipboard.writeText(text);
}

export async function shareResult(payload) {
  const text = buildShareText(payload);
  const url = payload.isChallenge && payload.challengeUrl
    ? payload.challengeUrl
    : SITE_URL;

  if (navigator?.share) {
    await navigator.share({ text, title: buildTitle(payload), url });
    return { method: 'share', text };
  }

  await copyShareText(text);
  return { method: 'clipboard', text };
}
