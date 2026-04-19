import { COLORS, getAvailableColors } from './constants.js';
import { GameState } from './state.js';
import { FEEDBACK } from './engine.js';
import {
  buildStatsPanelSections,
  getAverageRounds,
  getBestSinglePreset,
  getDailyChallengeResult,
  getModeWinRate,
  normalizeStats,
  ACHIEVEMENTS,
} from './stats.js';
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

    dot.style.animationDelay = `${i * 150}ms`;

    if (f === FEEDBACK.EXACT) {
      dot.classList.add('exact');
    } else if (f === FEEDBACK.MISPLACED) {
      dot.classList.add('misplaced');
    }
  });
}

/* ---- Result Overlay ---- */

export function showResult(win, rounds) {
  const isSingleMode = GameState.mode === 'single';
  const winnerText = isSingleMode ? '你' : '玩家二';
  const modeLabel = GameState.mode === 'dual' ? '双人对战' : getModeConfig(GameState.variant).label;
  const dailyLabel = GameState.isDailyPractice ? '今日练习' : modeLabel;
  const resultLabel = GameState.variant === 'daily'
    ? `${dailyLabel} · ${GameState.challengeKey}`
    : modeLabel;
  const roundText = rounds ? `<strong>${rounds}</strong> 次` : `${GameState.activeConfig.maxGuesses} 次`;
  let summaryText = '';

  if (win) {
    if (GameState.variant === 'daily' && GameState.isDailyPractice) {
      summaryText = `${winnerText}用了 ${roundText} 复盘了今天这题。`;
    } else if (GameState.variant === 'daily') {
      summaryText = `${winnerText}用了 ${roundText} 拿下今天这题。`;
    } else if (GameState.variant === 'duplicates') {
      summaryText = `${winnerText}用了 ${roundText} 搞定了重复色。`;
    } else {
      summaryText = `${winnerText}用了 ${roundText} 破解了密码。`;
    }
  } else if (GameState.variant === 'daily' && GameState.isDailyPractice) {
    summaryText = `${winnerText}这次还没复盘成功，再试一次。`;
  } else if (GameState.variant === 'daily') {
    summaryText = `今天这题没能在 ${roundText} 内拿下。`;
  } else if (GameState.variant === 'duplicates') {
    summaryText = `重复色这次没能在 ${roundText} 内破解。`;
  } else {
    summaryText = `这次没能在 ${roundText} 内破解密码。`;
  }

  let coachText = '';
  if (GameState.variant === 'daily' && GameState.isDailyPractice) {
    coachText = `\n\n<span style="color:var(--text-muted);">今日练习不计入正式成绩。</span>`;
  } else if (win && GameState.mode !== 'dual') {
    // Generate coach evaluation for single player modes based on attempts
    if (rounds <= 3) {
      coachText = `\n\n<span style="color:var(--accent-primary);">S 级：这手法，福尔摩斯来了也得服气。</span>`;
    } else if (rounds <= 5) {
      coachText = `\n\n<span style="color:var(--color-correct);">A 级：思路很清晰，推理走得挺稳。</span>`;
    } else if (rounds <= 8) {
      coachText = `\n\n<span style="color:var(--color-misplaced);">B 级：稳扎稳打，没出大错。</span>`;
    } else {
      coachText = `\n\n<span style="color:var(--text-muted);">C 级：险过，但过了就是过了。</span>`;
    }
  } else if (win && GameState.mode === 'dual' && GameState.isChallenge) {
    coachText = `\n\n<span style="color:var(--accent-primary);">朋友的密码让你破了。</span>`;
  }

  document.getElementById('overlayEmoji').textContent = win ? '\uD83C\uDF89' : '\uD83D\uDE35';
  document.getElementById('overlayTitle').textContent = win ? '密码破解成功！' : '这次没能破解';
  document.getElementById('overlaySub').innerHTML = `${resultLabel}<br>${summaryText}${coachText}`;
  document.getElementById('overlayStats').textContent = '';

  const finalRow = document.getElementById('answerFinal');
  finalRow.innerHTML = '';
  finalRow.style.flexWrap = 'wrap';

  const answerLabel = document.createElement('div');
  answerLabel.textContent = '正确答案：';
  answerLabel.style.cssText = 'width:100%;text-align:center;font-size:0.85rem;color:var(--text-muted);margin-bottom:4px;';
  finalRow.appendChild(answerLabel);
  GameState.secretCode.forEach(colorId => {
    const ball = makeBall(colorId, '--ball-lg');
    finalRow.appendChild(ball);
  });

  document.getElementById('overlay').classList.add('show');

  // Daily mode is once-per-day: relabel "再来一局" so user knows it will start a classic game
  const playAgainBtn = document.getElementById('btnPlayAgain');
  if (playAgainBtn) {
    if (GameState.variant === 'daily' && GameState.isDailyPractice) {
      playAgainBtn.textContent = '再练一次';
    } else if (GameState.variant === 'daily' && !win) {
      playAgainBtn.textContent = '继续今日练习';
    } else if (GameState.variant === 'daily') {
      playAgainBtn.textContent = '试试经典模式';
    } else {
      playAgainBtn.textContent = '再来一局';
    }
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

export function updateMakeupCardBanner({ show, missedKey, available, alreadyUsed }) {
  const banner = document.getElementById('makeupCardBanner');
  if (!banner) return;

  banner.hidden = !show;
  if (!show) return;

  const textEl = document.getElementById('makeupCardText');
  const subEl = document.getElementById('makeupCardSub');
  const btn = document.getElementById('btnUseMakeupCard');

  if (alreadyUsed) {
    if (textEl) textEl.textContent = `已补签 ${missedKey} ✓  今天通关即可延续连击`;
    if (btn) btn.hidden = true;
  } else {
    if (textEl) textEl.textContent = `${missedKey} 未参与每日挑战，可补签维持连击`;
    if (btn) {
      btn.hidden = false;
      btn.disabled = available === 0;
    }
  }

  if (subEl) subEl.textContent = `剩余 ${available} 张 · 每月补充 ${available === 0 && !alreadyUsed ? '（已用完）' : ''}`.trim().replace(' （已用完）', '（已用完）');
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

export function applyModeLabels(mode, variant = 'classic', challengeKey = null, options = {}) {
  const setupTitle = document.getElementById('setupTitle');
  const guessTitle = document.getElementById('guessTitle');
  if (!setupTitle || !guessTitle) return;
  const modeLabel = getModeConfig(variant).label;
  const isDailyPractice = options.isDailyPractice ?? false;

  if (mode === 'single' && variant === 'daily') {
    const titlePrefix = isDailyPractice ? '今日练习' : '每日挑战';
    setupTitle.textContent = `${titlePrefix} · ${challengeKey ?? ''}`.trim();
    guessTitle.textContent = `${titlePrefix} · ${challengeKey ?? ''}`.trim();
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

export function updateDailyModeEntry({ buttonText, metaText }) {
  const button = document.getElementById('btnModeDaily');
  const meta = document.getElementById('dailyModeMeta');
  if (!button || !meta) return;

  button.textContent = buttonText;
  meta.textContent = metaText;
}

export function renderStatsPanel(stats) {
  const safeStats = normalizeStats(stats);
  const panel = document.getElementById('statsPanel');
  if (!panel) return;

  const gamesPlayed = safeStats.totals?.gamesPlayed ?? 0;
  const streak = safeStats.streaks?.currentDailyWin ?? 0;
  const bestSingle = getBestSinglePreset(safeStats);

  document.getElementById('statsSummaryLine').textContent = `已玩 ${gamesPlayed} 局 · 单人最佳 ${bestSingle ? `${bestSingle.label} ${bestSingle.bestRounds}步` : '-'} · 每日连胜 ${streak}`;

  panel.innerHTML = '';
  buildStatsPanelSections(safeStats).forEach((section) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'stats-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'stats-section__title';
    titleEl.textContent = section.title;
    sectionEl.appendChild(titleEl);

    const cardsEl = document.createElement('div');
    cardsEl.className = 'stats-cards';

    section.cards.forEach((card) => {
      const cardEl = document.createElement('article');
      cardEl.className = 'stats-card';

      const cardTitle = document.createElement('div');
      cardTitle.className = 'stats-card__title';
      cardTitle.textContent = card.title;
      cardEl.appendChild(cardTitle);

      const metricsEl = document.createElement('div');
      metricsEl.className = 'stats-card__metrics';

      card.metrics.forEach((metric) => {
        const metricEl = document.createElement('div');
        metricEl.className = 'stats-card__metric';

        const labelEl = document.createElement('span');
        labelEl.className = 'stats-card__label';
        labelEl.textContent = metric.label;

        const valueEl = document.createElement('strong');
        valueEl.className = 'stats-card__value';
        valueEl.textContent = metric.value;

        metricEl.append(labelEl, valueEl);
        metricsEl.appendChild(metricEl);
      });

      cardEl.appendChild(metricsEl);
      cardsEl.appendChild(cardEl);
    });

    sectionEl.appendChild(cardsEl);
    panel.appendChild(sectionEl);
  });

  // Render Achievements Section
  const achievementsEl = document.createElement('section');
  achievementsEl.className = 'stats-section achievements-section';
  achievementsEl.style.marginTop = '16px';

  const badgeTitleEl = document.createElement('div');
  badgeTitleEl.className = 'stats-section__title';
  badgeTitleEl.textContent = '成就徽章';
  achievementsEl.appendChild(badgeTitleEl);

  const badgesGrid = document.createElement('div');
  badgesGrid.style.display = 'flex';
  badgesGrid.style.gap = '8px';
  badgesGrid.style.flexWrap = 'wrap';
  badgesGrid.style.marginTop = '8px';

  const userAchievements = safeStats.achievements || [];

  const badgesList = [
    { id: 'FIRST_TRY', emoji: '🎯', title: '一发入魂', label: ACHIEVEMENTS.FIRST_TRY },
    { id: 'LAST_CHANCE', emoji: '⏱️', title: '极限绝杀', label: ACHIEVEMENTS.LAST_CHANCE },
    { id: 'BLIND', emoji: '🙈', title: '盲人摸象', label: ACHIEVEMENTS.BLIND },
  ];

  badgesList.forEach(badge => {
    const isUnlocked = userAchievements.includes(badge.id);
    const badgeEl = document.createElement('div');
    badgeEl.style.padding = '8px 12px';
    badgeEl.style.backgroundColor = 'var(--bg-card)';
    badgeEl.style.borderRadius = '8px';
    badgeEl.style.display = 'flex';
    badgeEl.style.flexDirection = 'column';
    badgeEl.style.alignItems = 'center';
    badgeEl.style.flex = '1';
    badgeEl.style.minWidth = '80px';
    badgeEl.style.opacity = isUnlocked ? '1' : '0.4';

    const bgEmoji = document.createElement('div');
    bgEmoji.textContent = isUnlocked ? badge.emoji : '❓';
    bgEmoji.style.fontSize = '24px';
    bgEmoji.style.marginBottom = '4px';

    const bgLabel = document.createElement('div');
    bgLabel.textContent = badge.title;
    bgLabel.style.fontSize = '12px';
    bgLabel.style.color = isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)';

    badgeEl.appendChild(bgEmoji);
    badgeEl.appendChild(bgLabel);
    badgesGrid.appendChild(badgeEl);
  });

  achievementsEl.appendChild(badgesGrid);
  panel.appendChild(achievementsEl);
}

export function buildResultStatsText(stats, result) {
  if (!stats || !result) return '';
  const safeStats = normalizeStats(stats);

  if (result.variant === 'daily') {
    if (result.isDailyPractice) {
      const average = getAverageRounds(safeStats.modes.daily);
      const officialDailyResult = getDailyChallengeResult(safeStats, result.challengeKey);
      const officialSummary = officialDailyResult?.status === 'won'
        ? '正式记录：今日挑战已完成'
        : '正式记录：今天这题还没拿下';

      return `今日练习不计入正式成绩\n${officialSummary}\n最佳 ${safeStats.modes.daily.bestRounds === null ? '-' : `${safeStats.modes.daily.bestRounds}步`} · 平均 ${average === null ? '-' : `${average.toFixed(1)}步`} · 胜率 ${getModeWinRate(safeStats.modes.daily)}%\n当前每日连胜 ${safeStats.streaks.currentDailyWin} · 最佳 ${safeStats.streaks.bestDailyWin}`;
    }

    const average = getAverageRounds(safeStats.modes.daily);
    return `${result.win ? '今日挑战已完成' : '今天这题还没拿下'}\n最佳 ${safeStats.modes.daily.bestRounds === null ? '-' : `${safeStats.modes.daily.bestRounds}步`} · 平均 ${average === null ? '-' : `${average.toFixed(1)}步`} · 胜率 ${getModeWinRate(safeStats.modes.daily)}%\n当前每日连胜 ${safeStats.streaks.currentDailyWin} · 最佳 ${safeStats.streaks.bestDailyWin}`;
  }

  if (result.mode === 'single' && result.variant !== 'duplicates') {
    const modeStats = safeStats.modes?.[result.variant];
    const modeLabel = getModeConfig(result.variant).label;
    const average = getAverageRounds(modeStats);
    return `${modeLabel}最佳 ${modeStats?.bestRounds === null ? '-' : `${modeStats.bestRounds}步`} · 平均 ${average === null ? '-' : `${average.toFixed(1)}步`} · 胜率 ${getModeWinRate(modeStats)}%`;
  }

  if (result.variant === 'duplicates') {
    const modeStats = safeStats.modes.duplicates;
    const average = getAverageRounds(modeStats);
    return `重复色模式最佳 ${modeStats.bestRounds === null ? '-' : `${modeStats.bestRounds}步`} · 平均 ${average === null ? '-' : `${average.toFixed(1)}步`} · 胜率 ${getModeWinRate(modeStats)}%`;
  }

  return `累计双人对战 ${safeStats.modes.dual.gamesPlayed} 局`;
}

export function renderResultStats(stats, result) {
  const target = document.getElementById('overlayStats');
  if (!target) return;

  target.textContent = buildResultStatsText(stats, result);
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
