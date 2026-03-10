import { COLORS, MAX_GUESSES, CODE_LENGTH } from './constants.js';
import { GameState } from './state.js';

/* ---- Helpers ---- */

function getColor(colorId) {
  return COLORS.find(c => c.id === colorId) || null;
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

  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'guess-row';
    row.id = `row-${r}`;

    const num = document.createElement('div');
    num.className = 'row-num';
    num.textContent = r + 1;
    row.appendChild(num);

    const pegs = document.createElement('div');
    pegs.className = 'pegs';
    for (let i = 0; i < CODE_LENGTH; i++) {
      const peg = makeBall(null, '--ball-sm');
      peg.id = `g${r}-${i}`;
      pegs.appendChild(peg);
    }
    row.appendChild(pegs);

    const fb = document.createElement('div');
    fb.className = 'feedback';
    for (let i = 0; i < CODE_LENGTH; i++) {
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
  document.querySelectorAll('.active-arrow').forEach(e => e.remove());

  for (let i = 0; i < MAX_GUESSES; i++) {
    const row = document.getElementById(`row-${i}`);
    if (row) row.classList.toggle('active', i === r);
  }

  const activeRow = document.getElementById(`row-${r}`);
  if (activeRow) {
    const arrow = document.createElement('div');
    arrow.className = 'active-arrow';
    arrow.textContent = '\u25B6';
    activeRow.appendChild(arrow);
  }
}

export function freezeRow(r) {
  for (let i = 0; i < CODE_LENGTH; i++) {
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

  for (let i = 0; i < CODE_LENGTH; i++) {
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

  COLORS.forEach(c => {
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

export function buildMobileGuessRow(onClickSlot) {
  const row = document.getElementById('mobileGuessRow');
  if (!row) return;

  row.innerHTML = '';

  for (let i = 0; i < CODE_LENGTH; i++) {
    const ball = makeBall(GameState.currentGuess[i], '--ball-md');
    ball.style.cursor = 'pointer';

    if (GameState.guessActiveSlot === i) {
      ball.classList.add('ball--focused');
    }

    if (GameState.currentGuess[i]) {
      ball.setAttribute('aria-label', `移除并聚焦第${i + 1}个位置`);
    } else {
      ball.setAttribute('aria-label', `聚焦位置 ${i + 1}`);
    }

    if (onClickSlot) {
      ball.addEventListener('click', () => onClickSlot(i));
    }

    row.appendChild(ball);
  }
}

/* ---- Current Guess Display ---- */

export function updateCurrentGuessDisplay(onClickSlot) {
  const r = GameState.currentRound();
  for (let i = 0; i < CODE_LENGTH; i++) {
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

  buildMobileGuessRow(onClickSlot);
}

/* ---- Guess Info ---- */

export function updateSelectedCount() {
  const count = GameState.guessFilledCount();
  document.getElementById('selectedCount').textContent = count;
}

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
    const order = { green: 0, white: 1, none: 2 };
    return order[a] - order[b];
  });

  sorted.forEach((f, i) => {
    const dot = document.getElementById(`fb${round}-${i}`);
    if (!dot) return;
    if (f === 'green') dot.classList.add('green');
    else if (f === 'white') dot.classList.add('white');
  });
}

/* ---- Result Overlay ---- */

export function showResult(win, rounds) {
  const isSingleMode = GameState.mode === 'single';
  const winnerText = isSingleMode ? '你' : '玩家二';

  document.getElementById('overlayEmoji').textContent = win ? '\uD83C\uDF89' : '\uD83D\uDE35';
  document.getElementById('overlayTitle').textContent = win ? '密码破解成功！' : '挑战失败';
  document.getElementById('overlaySub').innerHTML = win
    ? `${winnerText}用了 <strong>${rounds}</strong> 次破解了密码！正确答案：`
    : `${winnerText}在${MAX_GUESSES}次内未能破解。正确答案：`;

  const finalRow = document.getElementById('answerFinal');
  finalRow.innerHTML = '';
  GameState.secretCode.forEach(colorId => {
    const ball = makeBall(colorId, '--ball-lg');
    finalRow.appendChild(ball);
  });

  document.getElementById('overlay').classList.add('show');
}

export function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

export function applyModeLabels(mode) {
  const setupTitle = document.getElementById('setupTitle');
  const guessTitle = document.getElementById('guessTitle');
  if (!setupTitle || !guessTitle) return;

  if (mode === 'single') {
    setupTitle.textContent = '单人模式 · 电脑已生成密码';
    guessTitle.textContent = '单人模式 · 你来猜测';
  } else {
    setupTitle.textContent = '玩家一 · 设置密码';
    guessTitle.textContent = '玩家二 · 猜测颜色';
  }
}

/* ---- Screen Switching ---- */

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');

  if (window.innerWidth <= 640) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
