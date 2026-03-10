import { FEEDBACK } from './engine.js';

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

  if (result.mode === 'dual') {
    return '密码机 双人对战';
  }

  return '密码机 单人经典';
}

export function buildShareText(result) {
  const score = result.win ? result.rounds : 'X';
  const rows = result.history.map((entry) => entry.feedback.map(feedbackToEmoji).join(''));

  return [
    buildTitle(result),
    `${score}/${result.maxGuesses}`,
    ...rows,
    SITE_URL,
  ].join('\n');
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
