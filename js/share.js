import { FEEDBACK } from './engine.js';
import { getModeConfig } from './mode-config.js';

const SITE_URL = 'https://mastermind.rustypiano.com/';

export function feedbackToEmoji(value) {
  if (value === FEEDBACK.EXACT) return '🟢';
  if (value === FEEDBACK.MISPLACED) return '🟠';
  return '⚪';
}

function buildTitle(result) {
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

export function buildChallengeUrl(secretCode, currentSiteUrl = window.location.href) {
  // Extract base URL without query params or hashes
  const baseUrl = currentSiteUrl.split(/[?#]/)[0];

  // Create a minimal payload with just the color IDs array
  // We can compress this further if needed, but JSON over base64 is fine for 4-5 items
  const payload = JSON.stringify({ s: secretCode });

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

  if (navigator?.share) {
    await navigator.share({ text, title: buildTitle(payload) });
    return { method: 'share', text };
  }

  await copyShareText(text);
  return { method: 'clipboard', text };
}
