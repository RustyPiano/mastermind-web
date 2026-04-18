function wrapStatusTip(message) {
  return `<br><span class="status-tip">${message}</span>`;
}

export function buildGuessStatusMessage({
  codeLength,
  isDaily,
  isDailyPractice,
  challengeKey,
  isGuessComplete,
  isFirstGuidedGame,
}) {
  const prefix = isDaily
    ? `${isDailyPractice ? '今日练习' : '每日挑战'} ${challengeKey} · `
    : '';
  const baseMessage = isGuessComplete
    ? `${prefix}已选满 ${codeLength} 色，点击提交`
    : `${prefix}选满 ${codeLength} 色后提交`;

  if (!isFirstGuidedGame || isGuessComplete) {
    return baseMessage;
  }

  return `${baseMessage}${wrapStatusTip('先试着确定有哪些颜色存在。')}`;
}

export function buildRoundSummaryMessage({
  roundNumber,
  exactCount,
  misplacedCount,
  maxGuesses,
  isFirstGuidedGame,
}) {
  const remaining = maxGuesses - roundNumber;
  const baseMessage = `第 ${roundNumber} 轮 · 🟢 ${exactCount} · 🟠 ${misplacedCount} · 剩余 ${remaining} 次`;

  if (!isFirstGuidedGame) {
    return baseMessage;
  }

  if (roundNumber === 1) {
    return `${baseMessage}${wrapStatusTip('先看 🟢 数量，再根据 🟠 调整位置。')}`;
  }

  if (roundNumber === 2) {
    return `${baseMessage}${wrapStatusTip('重复验证已确定的颜色，再缩小剩余位置。')}`;
  }

  return baseMessage;
}
