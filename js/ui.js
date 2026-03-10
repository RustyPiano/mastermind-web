import { COLORS, getAvailableColors } from './constants.js';
import { GameState } from './state.js';
import { FEEDBACK } from './engine.js';
import { getAverageRounds } from './stats.js';
import { getModeConfig } from './mode-config.js';

/* ---- Helpers ---- */

function getColor(colorId) {
  return COLORS.find(c => c.id === colorId) || null;
}

function getPaletteColors() {
  return getAvailableColors(GameState.activeConfig.paletteColorCount);
}

/* ---- Ball Factory ---- */

export function makeBall(colorId, sizeVar) {
  const c = getColor(colorId);
  const div = document.createElement('div');

  if (c) {
    div.className = 'ball';
    div.style.setProperty('--ball-bg', c.bg);
    div.dataset.colorId = c.id;
  } else {
    div.className = 'ball ball--empty';
  }

  if (sizeVar) {
    div.style.setProperty('--ball-size', `var(${sizeVar})`);
  }

  return div;
}

/* ---- Board ---- */

export function buildBoard() {
  const container = document.getElementById('rowsContainer');
  container.innerHTML = '';
  const { maxGuesses, codeLength } = GameState.activeConfig;

  for (let r = 0; r < maxGuesses; r++) {
    const row = document.createElement('div');
    row.className = 'guess-row';
    row.id = `row-${r}`;

    const num = document.createElement('div');
    num.className = 'row-num';
    num.textContent = r + 1;
    row.appendChild(num);

    const pegs = document.createElement('div');
    pegs.className = 'pegs';
    for (let i = 0; i < codeLength; i++) {
      const peg = makeBall(null, '--ball-sm');
      peg.id = `g${r}-${i}`;
      pegs.appendChild(peg);
    }
    row.appendChild(pegs);

    const fb = document.createElement('div');
    fb.className = 'feedback';
    for (let i = 0; i < codeLength; i++) {
      const dot = document.createElement('div');
      dot.className = 'fb-dot';
      dot.id = `fb${r}-${i}`;
      fb.appendChild(dot);
    }
    row.appendChild(fb);
    container.appendChild(row);
  }

  highlightActiveRow();
}

/* ---- Active Row / Freeze ---- */

export function highlightActiveRow() {
  const r = GameState.currentRound();
  const { maxGuesses } = GameState.activeConfig;
  document.querySelectorAll('.active-arrow').forEach(e => e.remove());

  for (let i = 0; i < maxGuesses; i++) {
    const row = document.getElementById(`row-${i}`);
    if (row) row.classList.toggle('active', i === r);
  }

  const activeRow = document.getElementById(`row-${r}`);
  if (activeRow) {
    const arrow = document.createElement('div');
    arrow.className = 'active-arrow';
    arrow.textContent = '\u25B6';
    activeRow.appendChild(arrow);

    // 提交后自动将新的活跃行滚动到可视区域
    activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

export function freezeRow(r) {
  for (let i = 0; i < GameState.activeConfig.codeLength; i++) {
    const ball = document.getElementById(`g${r}-${i}`);
    if (ball) {
      ball.classList.remove('ball--focused');
      ball.style.cursor = 'default';
      // clone to strip event listeners
      const clone = ball.cloneNode(true);
      ball.replaceWith(clone);
    }
  }
}

/* ---- Secret Row (Player 1 Setup) ---- */

export function buildSecretRow(onClickSlot) {
  const row = document.getElementById('secretRow');
  row.innerHTML = '';

  for (let i = 0; i < GameState.activeConfig.codeLength; i++) {
    const ball = makeBall(GameState.secretCode[i], '--ball-md');
    ball.style.cursor = 'pointer';
    
    if (GameState.setupActiveSlot === i) {
      ball.classList.add('ball--focused');
    }

    if (GameState.secretCode[i]) {
      ball.setAttribute('aria-label', `移除并聚焦该位置`);
    } else {
      ball.setAttribute('aria-label', `聚焦位置 ${i + 1}`);
    }

    ball.addEventListener('click', () => onClickSlot(i));
    row.appendChild(ball);
  }
}

/* ---- Palette (shared logic) ---- */

function buildPalette(containerId, isUsed, onClick) {
  const pal = document.getElementById(containerId);
  pal.innerHTML = '';
  const paletteColors = getPaletteColors();
  pal.dataset.colorCount = String(paletteColors.length);

  paletteColors.forEach(c => {
    const ball = makeBall(c.id);
    ball.setAttribute('aria-label', c.name);
    const used = isUsed(c.id);

    if (used) {
      ball.classList.add('ball--used');
    } else {
      ball.style.cursor = 'pointer';
      ball.addEventListener('click', () => onClick(c.id));
    }

    pal.appendChild(ball);
  });
}

export function buildSetupPalette(onClick) {
  buildPalette('setupPalette', id => GameState.isSecretUsed(id), onClick);
}

export function buildGuessPalette(onClick) {
  buildPalette('guessPalette', id => GameState.isGuessUsed(id), onClick);
}

/* ---- Current Guess Display ---- */

export function updateCurrentGuessDisplay(onClickSlot) {
  const r = GameState.currentRound();
  for (let i = 0; i < GameState.activeConfig.codeLength; i++) {
    const old = document.getElementById(`g${r}-${i}`);
    if (!old) continue;

    const ball = makeBall(GameState.currentGuess[i], '--ball-sm');
    ball.id = `g${r}-${i}`;
    ball.style.cursor = 'pointer';

    if (GameState.guessActiveSlot === i) {
      ball.classList.add('ball--focused');
    }

    if (onClickSlot) {
      ball.addEventListener('click', () => onClickSlot(i));
    }

    old.replaceWith(ball);
  }
}

export function restoreBoardHistory(onClickSlot) {
  GameState.guessHistory.forEach((entry, round) => {
    entry.guess.forEach((colorId, index) => {
      const old = document.getElementById(`g${round}-${index}`);
      if (!old) return;

      const ball = makeBall(colorId, '--ball-sm');
      ball.id = `g${round}-${index}`;
      old.replaceWith(ball);
    });

    renderFeedback(round, entry.feedback);
    freezeRow(round);
  });

  updateCurrentGuessDisplay(onClickSlot);
  highlightActiveRow();
}

/* ---- Guess Info ---- */

export function updateSubmitButton() {
  document.getElementById('btnSubmit').disabled = !GameState.isGuessComplete();
}

export function updateConfirmButton() {
  document.getElementById('btnConfirmSecret').disabled = !GameState.isSecretComplete();
}

/* ---- Status ---- */

export function updateStatus(msg) {
  document.getElementById('statusBox').innerHTML = msg;
}

/* ---- Feedback Dots ---- */

export function renderFeedback(round, feedback) {
  const sorted = [...feedback].sort((a, b) => {
    const order = {
      [FEEDBACK.EXACT]: 0,
      [FEEDBACK.MISPLACED]: 1,
      [FEEDBACK.NONE]: 2,
    };
    return order[a] - order[b];
  });

  sorted.forEach((f, i) => {
    const dot = document.getElementById(`fb${round}-${i}`);
    if (!dot) return;
    if (f === FEEDBACK.EXACT) dot.classList.add('exact');
    else if (f === FEEDBACK.MISPLACED) dot.classList.add('misplaced');
  });
}

/* ---- Result Overlay ---- */

export function showResult(win, rounds) {
  const isSingleMode = GameState.mode === 'single';
  const winnerText = isSingleMode ? '你' : '玩家二';
  const modeLabel = GameState.mode === 'dual' ? '双人对战' : getModeConfig(GameState.variant).label;
  const resultLabel = GameState.variant === 'daily'
    ? `${modeLabel} · ${GameState.challengeKey}`
    : modeLabel;
  const roundText = rounds ? `<strong>${rounds}</strong> 次` : `${GameState.activeConfig.maxGuesses} 次`;
  let summaryText = '';

  if (win) {
    if (GameState.variant === 'daily') {
      summaryText = `${winnerText}用了 ${roundText} 完成今天这题。`;
    } else if (GameState.variant === 'duplicates') {
      summaryText = `${winnerText}用了 ${roundText} 破解重复色规则。`;
    } else {
      summaryText = `${winnerText}用了 ${roundText} 破解了密码。`;
    }
  } else if (GameState.variant === 'daily') {
    summaryText = `${winnerText}没能在 ${roundText} 内完成今天这题。`;
  } else if (GameState.variant === 'duplicates') {
    summaryText = `${winnerText}没能在 ${roundText} 内破解重复色规则。`;
  } else {
    summaryText = `${winnerText}没能在 ${roundText} 内破解密码。`;
  }

  document.getElementById('overlayEmoji').textContent = win ? '\uD83C\uDF89' : '\uD83D\uDE35';
  document.getElementById('overlayTitle').textContent = win ? '密码破解成功！' : '挑战失败';
  document.getElementById('overlaySub').innerHTML = `${resultLabel}<br>${summaryText} 正确答案：`;
  document.getElementById('overlayStats').textContent = '';

  const finalRow = document.getElementById('answerFinal');
  finalRow.innerHTML = '';
  GameState.secretCode.forEach(colorId => {
    const ball = makeBall(colorId, '--ball-lg');
    finalRow.appendChild(ball);
  });

  document.getElementById('overlay').classList.add('show');

  // Daily mode is once-per-day: relabel "再来一局" so user knows it will start a classic game
  const playAgainBtn = document.getElementById('btnPlayAgain');
  if (playAgainBtn) {
    playAgainBtn.textContent = GameState.variant === 'daily' ? '试试经典模式' : '再来一局';
  }
}

export function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

export function setOnboardingVisibility(visible) {
  const card = document.getElementById('onboardingCard');
  if (!card) return;

  card.hidden = !visible;
}

export function setLegendVisibility(visible) {
  const sheet = document.getElementById('legendSheet');
  const button = document.getElementById('btnOpenLegend');
  if (!sheet || !button) return;

  sheet.hidden = !visible;
  sheet.classList.toggle('legend-sheet--open', visible);
  button.setAttribute('aria-expanded', visible ? 'true' : 'false');
}

export function isLegendVisible() {
  const sheet = document.getElementById('legendSheet');
  return Boolean(sheet && !sheet.hidden);
}

export function setShareButtonEnabled(enabled) {
  const button = document.getElementById('btnShareResult');
  if (!button) return;

  button.disabled = !enabled;
}

export function applyModeLabels(mode, variant = 'classic', challengeKey = null) {
  const setupTitle = document.getElementById('setupTitle');
  const guessTitle = document.getElementById('guessTitle');
  if (!setupTitle || !guessTitle) return;
  const modeLabel = getModeConfig(variant).label;

  if (mode === 'single' && variant === 'daily') {
    setupTitle.textContent = `每日挑战 · ${challengeKey ?? ''}`.trim();
    guessTitle.textContent = `每日挑战 · ${challengeKey ?? ''}`.trim();
  } else if (mode === 'single' && variant === 'duplicates') {
    setupTitle.textContent = '重复色模式 · 电脑已生成密码';
    guessTitle.textContent = '重复色模式 · 允许重复颜色';
  } else if (mode === 'single') {
    setupTitle.textContent = `${modeLabel} · 电脑已生成密码`;
    guessTitle.textContent = `${modeLabel} · 你来猜测`;
  } else {
    setupTitle.textContent = '玩家一 · 设置密码';
    guessTitle.textContent = '玩家二 · 猜测颜色';
  }
}

export function updateDailyModeEntry({ challengeKey, isCompleted, hasActiveSession }) {
  const button = document.getElementById('btnModeDaily');
  const meta = document.getElementById('dailyModeMeta');
  if (!button || !meta) return;

  if (hasActiveSession) {
    button.textContent = '继续每日挑战';
    meta.textContent = `继续 ${challengeKey} 的进度，保住你的每日连胜。`;
    return;
  }

  button.textContent = '每日挑战';
  meta.textContent = isCompleted
    ? `${challengeKey} 已完成 ✓，明天继续冲击连胜。`
    : `${challengeKey} 今日题目，通关后会记入每日连胜。`;
}

export function renderStatsPanel(stats) {
  const safeStats = stats ?? {
    totals: { gamesPlayed: 0, wins: 0 },
    streaks: { currentDailyWin: 0, bestDailyWin: 0 },
    modes: { classic: { bestRounds: null } },
  };
  const gamesPlayed = safeStats.totals?.gamesPlayed ?? 0;
  const winRate = gamesPlayed === 0
    ? 0
    : Math.round(((safeStats.totals?.wins ?? 0) / gamesPlayed) * 100);
  const classicBest = safeStats.modes?.classic?.bestRounds ?? null;
  const streak = safeStats.streaks?.currentDailyWin ?? 0;

  document.getElementById('statsGamesPlayed').textContent = String(gamesPlayed);
  document.getElementById('statsWinRate').textContent = `${winRate}%`;
  document.getElementById('statsDailyStreak').textContent = String(streak);
  document.getElementById('statsBestDailyStreak').textContent = String(safeStats.streaks?.bestDailyWin ?? 0);
  document.getElementById('statsBestClassic').textContent = classicBest === null ? '-' : `${classicBest}步`;
  document.getElementById('statsSummaryLine').textContent = `已玩 ${gamesPlayed} 局 · 经典最佳 ${classicBest === null ? '-' : `${classicBest}步`} · 每日连胜 ${streak}`;
}

export function renderResultStats(stats, result) {
  const target = document.getElementById('overlayStats');
  if (!target || !stats || !result) return;

  if (result.variant === 'daily') {
    target.textContent = result.win
      ? `今日挑战已完成\n当前每日连胜 ${stats.streaks.currentDailyWin} · 最佳 ${stats.streaks.bestDailyWin}`
      : `今天这题还没拿下\n明天还有新的每日挑战`;
    return;
  }

  if (result.mode === 'single') {
    const modeStats = stats.modes?.[result.variant];
    const modeLabel = getModeConfig(result.variant).label;
    const average = getAverageRounds(modeStats);
    const averageText = average === null ? '-' : average.toFixed(1);
    const bestText = modeStats?.bestRounds ?? null;
    const bestSummary = bestText === null
      ? `${modeLabel}暂时还没有通关记录`
      : result.win && result.rounds === bestText
        ? `你刷新或追平了${modeLabel}最佳`
        : result.win
          ? `距离${modeLabel}最佳还差 ${Math.max(result.rounds - bestText, 0)} 步`
          : `当前${modeLabel}最佳仍是 ${bestText} 步`;
    target.textContent = `${bestSummary}\n${modeLabel}最佳 ${bestText === null ? '-' : `${bestText}步`} · 平均 ${averageText}步`;
    return;
  }

  target.textContent = `累计双人对战 ${stats.modes.dual.gamesPlayed} 局`;
}

export function setStatsPanelExpanded(expanded) {
  const panel = document.getElementById('statsPanel');
  const button = document.getElementById('btnToggleStats');
  if (!panel || !button) return;

  panel.hidden = !expanded;
  button.textContent = expanded ? '收起详细统计' : '查看详细统计';
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

/* ---- Screen Switching ---- */

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  // 仅猜测阶段启用固定分屏布局
  document.body.classList.toggle('game-phase--guessing', screenId === 'screenGuess');

  if (window.innerWidth <= 640 && screenId !== 'screenGuess') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
