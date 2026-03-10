# Replayability And Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current mobile-first Mastermind prototype into a replayable product with daily return value, local progression, clearer onboarding, and safer engineering foundations for future modes.

**Architecture:** Do not stack new features directly on top of the current DOM-driven flow. First extract deterministic game logic and local persistence into testable modules, then build daily challenge, stats, sharing, onboarding, and difficulty layers on top of those primitives. Keep the app as a static, local-first single-page site with no backend dependency.

**Tech Stack:** Semantic HTML, CSS, vanilla JavaScript ES modules, `localStorage`, Web Share API with clipboard fallback, Vitest for logic tests

**Data Migration Policy:** All `localStorage` schemas use a numeric `version` field. On version mismatch, clear the incompatible key and start fresh. For this project's scope, data loss on schema bump is acceptable—document the version change in the commit message. Do NOT attempt field-level migration.

**Known Architectural Constraint:** `GameState` remains a mutable singleton object throughout this plan. This is sufficient for the current single-game-at-a-time scope, but prevents future features like replays or concurrent sessions. Refactoring to a factory/class pattern is deferred as out of scope.

---

## Scope And Release Order

**Release 1: Foundation + Retention Loop** (Tasks 1–5)
- Deterministic game engine
- Local persistence and resume
- Daily challenge mode
- Local stats and streaks
- Shareable post-game result

> **Release 1 Gate:** After Task 5, run `npm test` for full pass + complete the Release 1 section of the manual QA checklist (see Task 9) before proceeding.

**Release 2: Comprehension + Depth** (Tasks 6–8)
- Better onboarding and inline teaching
- Difficulty system
- Accessibility pass

**Out Of Scope For This Plan**
- Backend accounts
- Online leaderboard
- Real-time multiplayer
- Native app packaging

### Task 1: Create a testable game engine baseline

**Files:**
- Create: `package.json`
- Create: `tests/engine.test.js`
- Create: `js/engine.js`
- Modify: `js/game.js`
- Modify: `js/state.js`
- Modify: `js/constants.js`

**Feedback Value Convention:** Throughout this plan, feedback values use semantic constants:
- `'exact'` — correct color AND correct position (displayed as 🟢)
- `'misplaced'` — correct color, wrong position (displayed as 🟠)
- `'none'` — color not in secret (displayed as ⚪)

The existing code uses `'green'` / `'white'` / `'none'`; rename to the above during extraction. Update all references in `js/game.js` and `js/ui.js` (`renderFeedback`, `submitGuess`) accordingly. Add a mapping constant in `js/engine.js`:

```js
export const FEEDBACK = Object.freeze({
  EXACT: 'exact',
  MISPLACED: 'misplaced',
  NONE: 'none',
});
```

**Step 1: Add a minimal test runner setup**

Create `package.json` with scripts for local development and tests.

```json
{
  "name": "mastermind-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "python3 -m http.server 3000",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

**Step 2: Write failing engine tests**

Create `tests/engine.test.js` covering:
- exact-match feedback
- misplaced-color feedback
- no-match feedback
- mixed feedback with consumption logic
- unique secret generation from a fixed color pool
- duplicate handling policy for future modes
- input length validation (defensive)

```js
import { describe, expect, it } from 'vitest';
import { calcFeedback, generateSecret, isWinningFeedback, FEEDBACK } from '../js/engine.js';

describe('calcFeedback', () => {
  it('returns all exact for a perfect guess', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c2', 'c3', 'c4']))
      .toEqual(['exact', 'exact', 'exact', 'exact']);
  });

  it('returns all none when no colors match', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c5', 'c6', 'c7', 'c1']))
      // c1 is in secret[0] but guess has c1 at [3] → misplaced; c5,c6,c7 → none
      // Actually: guess=['c5','c6','c7','c1'], secret=['c1','c2','c3','c4']
      // c5 not in secret → none; c6 not → none; c7 not → none; c1 in secret[0] → misplaced
      .toEqual(['none', 'none', 'none', 'misplaced']);
  });

  it('returns all none when truly no overlap', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c5', 'c6', 'c7', 'c5']))
      .toEqual(['none', 'none', 'none', 'none']);
  });

  it('handles mixed exact and misplaced', () => {
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c3', 'c2', 'c4']))
      .toEqual(['exact', 'misplaced', 'misplaced', 'exact']);
  });

  it('consumes matches correctly with duplicates in guess', () => {
    // secret has one c1; guess has c1 twice → only the exact match counts
    expect(calcFeedback(['c1', 'c2', 'c3', 'c4'], ['c1', 'c1', 'c5', 'c6']))
      .toEqual(['exact', 'none', 'none', 'none']);
  });

  it('throws on length mismatch', () => {
    expect(() => calcFeedback(['c1', 'c2'], ['c1', 'c2', 'c3', 'c4']))
      .toThrow();
  });
});

describe('generateSecret', () => {
  const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];

  it('returns correct length', () => {
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: false });
    expect(secret).toHaveLength(4);
  });

  it('contains no duplicates when disallowed', () => {
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: false });
    expect(new Set(secret).size).toBe(4);
  });

  it('allows duplicates when enabled', () => {
    // Use a fixed rng to force a duplicate
    let i = 0;
    const rng = () => [0, 0, 0.5, 0.5][i++] ?? 0;
    const secret = generateSecret({ colors, codeLength: 4, allowDuplicates: true, rng });
    expect(secret).toHaveLength(4);
  });

  it('produces deterministic output with fixed rng', () => {
    const rng = () => 0.1;
    const a = generateSecret({ colors, codeLength: 4, allowDuplicates: false, rng });
    const b = generateSecret({ colors, codeLength: 4, allowDuplicates: false, rng: () => 0.1 });
    expect(a).toEqual(b);
  });
});

describe('isWinningFeedback', () => {
  it('returns true for all exact', () => {
    expect(isWinningFeedback(['exact', 'exact', 'exact', 'exact'], 4)).toBe(true);
  });

  it('returns false if any non-exact', () => {
    expect(isWinningFeedback(['exact', 'misplaced', 'exact', 'exact'], 4)).toBe(false);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `js/engine.js` does not exist yet.

**Step 4: Extract the pure engine module**

Create `js/engine.js` with:
- `FEEDBACK` constant object (`EXACT`, `MISPLACED`, `NONE`)
- `calcFeedback(guess, secret)` — throw if lengths differ
- `shuffle(array, rng = Math.random)`
- `generateSecret({ colors, codeLength, allowDuplicates, rng })`
- `isWinningFeedback(feedback, codeLength)`

Move feedback rules out of `js/game.js` and keep the new module DOM-free.

Add defensive input checks:
- `calcFeedback` throws if `guess.length !== secret.length`
- `generateSecret` throws if `!allowDuplicates && colors.length < codeLength`

**Step 5: Update current game flow to use the engine**

Replace the inline `calcFeedback` in `js/game.js` with imports from `js/engine.js`.

Update all feedback string comparisons in `js/game.js` (`submitGuess`):
- `f === 'green'` → `f === FEEDBACK.EXACT`
- `f === 'white'` → `f === FEEDBACK.MISPLACED`
- `greens === CODE_LENGTH` → use `isWinningFeedback(feedback, CODE_LENGTH)`

Update `js/ui.js` `renderFeedback`:
- `f === 'green'` → `f === FEEDBACK.EXACT` → add CSS class `exact` (rename from `green`)
- `f === 'white'` → `f === FEEDBACK.MISPLACED` → add CSS class `misplaced` (rename from `white`)
- Update corresponding CSS selectors in `css/game.css`

Make `GameState.generateRandomSecret()` call the engine helper instead of maintaining its own shuffle logic.

**Step 6: Run tests again**

Run: `npm test`

Expected: PASS for engine tests.

**Step 7: Commit**

```bash
git add package.json tests/engine.test.js js/engine.js js/game.js js/state.js js/ui.js js/constants.js css/game.css
git commit -m "refactor: extract deterministic game engine with semantic feedback constants"
```

### Task 2: Add local persistence and session recovery

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.test.js`
- Modify: `js/state.js`
- Modify: `js/game.js`
- Modify: `js/ui.js`

**Step 1: Define storage schemas**

Create `js/storage.js` with versioned keys:
- `mastermind:session:v1`
- `mastermind:stats:v1`
- `mastermind:preferences:v1`

Represent a session like:

```js
{
  version: 1,
  mode: 'single',
  variant: 'classic',
  startedAt: '2026-03-10T08:00:00.000Z',
  secretCode: ['c1', 'c2', 'c3', 'c4'],
  currentGuess: ['c1', null, null, null],
  guessHistory: [
    { guess: ['c4', 'c3', 'c2', 'c1'], feedback: ['misplaced', 'misplaced', 'misplaced', 'misplaced'] }
  ],
  setupActiveSlot: 0,
  guessActiveSlot: 0,
  status: 'in_progress'
}
```

**Serialization strategy:** `GameState` is a singleton object with methods. Storage only persists its data fields. On restore, use `GameState.restore(data)` — a new method that does `Object.assign(this, data)` for the known data fields (mode, secretCode, currentGuess, guessHistory, setupActiveSlot, guessActiveSlot). Do NOT serialize methods.

**Accepted risk:** `secretCode` is stored in plaintext in `localStorage`. Users can inspect it via DevTools to see the answer. This is acceptable for a local single-player puzzle game. The daily challenge secret is deterministic from the date anyway, so obscuring the stored value adds no real security.

Represent preferences like:

```js
{
  version: 1,
  firstRunDismissed: false
}
```

Pre-define this schema now so Task 6 (onboarding) can use `savePreferences()` without modifying the storage module later.

**Step 2: Write failing storage tests**

Create tests for:
- serialize and deserialize session state (only data fields, not methods)
- `GameState.restore(data)` correctly populates all fields
- gracefully ignore malformed saved data (corrupted JSON, missing fields)
- version mismatch → clear and return null
- clearing session on completed game

**Step 3: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because storage helpers are missing.

**Step 4: Implement storage helpers**

Add:
- `loadSession()`
- `saveSession(session)`
- `clearSession()`
- `loadStats()`
- `saveStats(stats)`
- `loadPreferences()`
- `savePreferences(preferences)`

Wrap all `JSON.parse` calls in try-catch. On any error (SyntaxError, missing fields, wrong version), clear the bad key and return `null` / default value. Do not let invalid JSON crash app startup.

**Step 5: Connect autosave to gameplay**

Use a debounced auto-save approach: create a `scheduleSave()` function that calls `saveSession()` via `queueMicrotask` or a short `setTimeout(0)` to batch rapid state changes. Call `scheduleSave()` after any `GameState` mutation:
- `setSecretColor`, `clearSecretSlot`, `setSetupFocus`
- `setGuessColor`, `clearGuessSlot`, `setGuessFocus`, `clearGuess`
- `pushGuess`
- mode and secret initialization

Clear the session after:
- player wins
- player loses
- user returns home

**Step 6: Restore interrupted sessions on load**

Update initialization flow to:
- load saved session if present
- call `GameState.restore(savedData)` to populate fields
- rebuild board and UI state
- route to the correct screen
- restore mode labels and current active row

**Step 7: Run tests and manual recovery validation**

Run: `npm test`

Manual checks:
- start a game, refresh, resume correctly
- finish a game, refresh, no stale session
- corrupt storage in devtools, app still loads
- restore works for both setup phase and guessing phase

**Step 8: Commit**

```bash
git add js/storage.js tests/storage.test.js js/state.js js/game.js js/ui.js
git commit -m "feat: add local session persistence with debounced autosave"
```

### Task 3: Ship a daily challenge mode

**Files:**
- Create: `js/daily.js`
- Create: `tests/daily.test.js`
- Modify: `index.html`
- Modify: `js/game.js`
- Modify: `js/state.js`
- Modify: `js/ui.js`
- Modify: `css/components.css`

**Step 1: Write failing determinism tests**

Create tests for:
- same date produces same secret
- different dates produce different secrets
- challenge key changes only by local calendar day
- completed daily challenge can be recognized from stats/session data
- hash function determinism (fixed input → fixed output)

**Step 2: Implement seeded daily secret generation**

Create `js/daily.js` with:
- `dateToChallengeKey(date, timeZone)` — returns `"YYYY-MM-DD"` string using local date
- `hashStringToSeed(input)` — use **FNV-1a** (fast, well-distributed, easy to implement in ~10 lines). Pin this choice: changing the algorithm later will change all historical daily puzzles.
- `createSeededRng(seed)` — returns a function compatible with `generateSecret`'s `rng` param
- `generateDailySecret({ dateKey, colors, codeLength, allowDuplicates })` — assembles the above

Use local date, not UTC rollover, so the daily puzzle matches user expectation.

**Known behavior:** Because the challenge key uses local timezone, users who change timezones may see a different puzzle for the "same" calendar date. When sharing results across timezones, the date label may correspond to different puzzles. This is acceptable for a local-first game with no server-side validation.

Add defensive check: if `colors.length < codeLength` when `allowDuplicates` is false, throw an error.

**Step 3: Add a new mode entry point**

Update `index.html` mode selection UI to include three options:
- `单人经典`
- `每日挑战`
- `双人对战`

The current `.mode-actions` container has two horizontally laid out buttons. With three buttons, update CSS to use a vertical stack layout (`flex-direction: column` with `gap`) on screens ≤ 640px. On desktop, a horizontal row is fine.

Optionally add a small sub-label under the daily button: show today's date or "已完成 ✓" if already done.

**Step 4: Add daily mode state rules**

Update game flow so daily mode:
- always uses a deterministic secret via `generateDailySecret`
- stores `challengeKey` in the session
- records completion result once per day
- blocks duplicate completion from inflating streaks (check `hasCompletedDaily` before recording)

**Step 5: Surface daily challenge messaging**

Update UI copy to show:
- today's challenge label
- whether today is already completed
- "continue challenge" if interrupted

**Step 6: Run tests and manual checks**

Run: `npm test`

Manual checks:
- complete daily challenge
- reload page and verify today's run is remembered
- change mocked date and verify new puzzle

**Step 7: Commit**

```bash
git add js/daily.js tests/daily.test.js index.html js/game.js js/state.js js/ui.js css/components.css
git commit -m "feat: add daily challenge mode with FNV-1a seeded generation"
```

### Task 4: Add local stats, streaks, and best-score tracking

**Files:**
- Create: `js/stats.js`
- Create: `tests/stats.test.js`
- Modify: `js/storage.js`
- Modify: `js/game.js`
- Modify: `js/ui.js`
- Modify: `index.html`
- Modify: `css/components.css`

**Step 1: Define the stats model**

Use a versioned structure with incremental-update fields:

```js
{
  version: 1,
  totals: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0
  },
  streaks: {
    currentDailyWin: 0,
    bestDailyWin: 0
  },
  modes: {
    classic: { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
    daily:   { bestRounds: null, totalRoundsSum: 0, gameCount: 0, wins: 0, losses: 0 },
    dual:    { gamesPlayed: 0 }
  },
  completedDailyKeys: []
}
```

**Design notes:**
- Use `totalRoundsSum` and `gameCount` instead of `averageRounds` so the average can be computed incrementally as `totalRoundsSum / gameCount` without needing a full history array.
- Cap `completedDailyKeys` at 365 entries. When adding a new key, if `length >= 365`, remove the oldest (first) entry. This prevents unbounded growth in localStorage. Use sorted insertion so `includes()` can be replaced with binary search if needed later, though linear scan of ≤365 items is fine.

**Step 2: Write failing stats tests**

Cover:
- first win initialization
- streak increment on consecutive daily wins
- streak reset on missed/failed daily run
- average rounds calculation via `totalRoundsSum / gameCount`
- prevention of double-counting the same daily challenge
- `completedDailyKeys` cap enforcement

**Step 3: Implement stats helpers**

Add pure functions:
- `recordGameResult(stats, result)` — updates totals, mode stats, streaks, completedDailyKeys
- `getAverageRounds(modeStats)` — returns `modeStats.totalRoundsSum / modeStats.gameCount` or null
- `hasCompletedDaily(stats, challengeKey)`

**Step 4: Wire stats updates into end-of-game flow**

Update `js/game.js` and result overlay flow so every finished game records:
- mode
- challenge key if daily
- rounds used
- win/loss
- finished timestamp

**Step 5: Add visible progression UI**

Show a compact stats panel on the mode selection screen with:
- total games
- win rate
- current daily streak
- best daily streak
- best classic solve

Also show a lightweight summary in the result overlay.

**Step 6: Run tests and manual validation**

Run: `npm test`

Manual checks:
- win classic game
- lose classic game
- win daily game twice on same day and confirm no double count

**Step 7: Commit**

```bash
git add js/stats.js tests/stats.test.js js/storage.js js/game.js js/ui.js index.html css/components.css
git commit -m "feat: add local stats and streak tracking"
```

### Task 5: Add spoiler-safe result sharing

**Files:**
- Create: `js/share.js`
- Create: `tests/share.test.js`
- Modify: `js/ui.js`
- Modify: `js/game.js`
- Modify: `index.html`

**Step 1: Write failing share-format tests**

Create tests for:
- daily challenge share text
- classic mode share text
- win and loss cases
- no secret color values leaked in share output
- correct emoji mapping from semantic feedback constants

Emoji mapping:
- `FEEDBACK.EXACT` → `🟢`
- `FEEDBACK.MISPLACED` → `🟠`
- `FEEDBACK.NONE` → `⚪`

Example expected text (win):

```txt
密码机 每日挑战 2026-03-10
4/10
🟢🟠⚪⚪
🟢🟢🟠⚪
🟢🟢🟢🟢
```

Example expected text (loss):

```txt
密码机 每日挑战 2026-03-10
X/10
🟢🟠⚪⚪
🟠🟠🟠⚪
...（10 rows）
```

Use `X` for losses (consistent with Wordle convention).

**Step 2: Implement share helpers**

Create:
- `buildShareText(result, history)` — maps `feedback` arrays to emoji lines
- `shareResult(payload)` — calls `navigator.share` first, clipboard fallback second
- `copyShareText(text)` — `navigator.clipboard.writeText` with try/catch

**Step 3: Add a share button to the result overlay**

Update overlay actions to include:
- `分享结果`
- existing replay and home actions

Keep the share action available only when a result exists.

**Step 4: Add success and fallback messaging**

Update status or overlay copy to report:
- shared successfully
- copied to clipboard
- manual copy fallback if browser API unavailable

**Step 5: Run tests and manual browser checks**

Run: `npm test`

Manual checks:
- share on iOS Safari
- share on Android Chrome
- clipboard fallback on desktop

**Step 6: Commit**

```bash
git add js/share.js tests/share.test.js js/ui.js js/game.js index.html
git commit -m "feat: add shareable game results"
```

---

> **🚦 Release 1 Gate**
>
> Before proceeding to Release 2:
> 1. Run `npm test` — all tests must pass
> 2. Complete the Release 1 section of the manual QA checklist (Task 9)
> 3. Test on at least: iOS Safari, Android Chrome, desktop Chrome
> 4. Commit and tag: `git tag v1.0.0-release1`

---

### Task 6: Improve onboarding and in-game comprehension

**Files:**
- Modify: `index.html`
- Modify: `js/ui.js`
- Modify: `js/game.js`
- Modify: `js/storage.js` (only if `preferences` schema needs new fields beyond `firstRunDismissed`)
- Modify: `css/components.css`
- Modify: `css/game.css`

**Step 1: Add a first-run teaching layer**

Show a short, dismissible explanation on first launch:
- 4 colors
- no duplicates in classic mode
- 🟢 means exact
- 🟠 means correct color, wrong position

Persist dismissal using `savePreferences({ firstRunDismissed: true })` — the `preferences` schema and `firstRunDismissed` field were already defined in Task 2.

**Step 2: Keep feedback help accessible during play**

Current behavior: the legend card (`index.html` lines 101–117) is always visible below the palette during play. On very short screens it may push content off-view.

Replace the always-visible legend card with a compact collapsible help chip or bottom-sheet trigger. The chip shows a `?` icon; tapping opens the legend as an overlay or expandable section. This saves vertical space on small phones while keeping the information one tap away.

**Step 3: Improve post-turn guidance**

After each submitted guess, update status text with:
- round number
- exact count
- misplaced count
- guesses remaining

Example:

```txt
第 3 轮：2 个位置正确，1 个颜色正确但位置错误。还剩 7 次机会。
```

**Step 4: Add clearer empty-state copy**

Improve the mode selection and result states to explain:
- why daily challenge matters
- what streaks mean
- why replaying classic mode helps practice

**Step 5: Manual validation**

Check:
- first-run flow only appears once
- legend can be re-opened
- copy stays readable in Chinese on narrow screens

**Step 6: Commit**

```bash
git add index.html js/ui.js js/game.js css/components.css css/game.css
git commit -m "feat: improve onboarding and puzzle comprehension"
```

### Task 7: Add a mode configuration system for difficulty expansion

**Files:**
- Create: `js/mode-config.js`
- Create: `tests/mode-config.test.js`
- Modify: `js/constants.js`
- Modify: `js/state.js`
- Modify: `js/game.js`
- Modify: `js/ui.js`
- Modify: `index.html`

**Step 1: Define explicit mode configs**

Create a single config map:

```js
export const MODE_CONFIGS = {
  classic: {
    label: '单人经典',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false
  },
  daily: {
    label: '每日挑战',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: false
  },
  duplicates: {
    label: '重复色模式',
    codeLength: 4,
    maxGuesses: 10,
    allowDuplicates: true
  },
  expert: {
    label: '专家模式',
    codeLength: 4,
    maxGuesses: 8,
    allowDuplicates: false
  }
};
```

**Step 2: Write failing config tests**

Cover:
- duplicate mode allows repeated colors
- classic mode rejects repeated colors
- expert mode uses fewer guesses
- UI labels map correctly to mode ids

**Step 3: Replace hard-coded assumptions**

This is a cross-cutting refactor. Every import of `CODE_LENGTH` and `MAX_GUESSES` from `js/constants.js` must be replaced with a config accessor. Affected call sites:

**`js/state.js`:**
- `createEmptySlots()` — uses `CODE_LENGTH` → use `GameState.activeConfig.codeLength`
- `generateRandomSecret()` — uses `CODE_LENGTH` → use config
- `advanceSetupSlot()` / `advanceGuessSlot()` — loop bound uses `CODE_LENGTH`
- `setGuessColor()` line 68 — has `if (this.currentGuess.includes(colorId)) return false;` → check `this.activeConfig.allowDuplicates` before rejecting
- `setSecretColor()` line 33 — same duplicate guard, needs config check

**`js/ui.js`:**
- `buildBoard()` — `MAX_GUESSES` for row count, `CODE_LENGTH` for peg count
- `highlightActiveRow()` — `MAX_GUESSES` for loop bound
- `freezeRow()` — `CODE_LENGTH` for loop bound
- `buildSecretRow()` — `CODE_LENGTH` for slot count
- `buildMobileGuessRow()` — `CODE_LENGTH` for slot count
- `updateCurrentGuessDisplay()` — `CODE_LENGTH` for loop bound
- `buildPalette()` — `isUsed` callback currently uses `GameState.isGuessUsed(id)` which always checks `includes()` → when `allowDuplicates` is true, never mark as used (or mark with a count indicator)

**`js/game.js`:**
- `submitGuess()` — `CODE_LENGTH` for win check, `MAX_GUESSES` for loss check

**Approach:** Add `activeConfig` property to `GameState`. Set it from `MODE_CONFIGS[modeId]` when starting a game. Replace all direct `CODE_LENGTH` / `MAX_GUESSES` imports with `GameState.activeConfig.codeLength` / `GameState.activeConfig.maxGuesses`. Keep the old constants in `js/constants.js` as defaults only.

**Step 4: Add at least one new playable variant**

Ship `重复色模式` first because it changes puzzle reasoning without requiring major board redesign.

Key changes for duplicates mode:
- `GameState.setGuessColor()` — skip the `includes()` guard when `activeConfig.allowDuplicates` is true
- `GameState.setSecretColor()` — same for setup phase
- `buildGuessPalette()` and `buildSetupPalette()` — do not add `ball--used` class when duplicates are allowed; the color can be clicked again

Leave expert mode behind a disabled or hidden config flag if UI still needs more work.

**Step 5: Run tests and manual validation**

Run: `npm test`

Manual checks:
- duplicate guesses can be entered in duplicate mode
- classic mode still blocks duplicate input
- board renders correct guess count
- expert mode (if exposed) uses 8 rows

**Step 6: Commit**

```bash
git add js/mode-config.js tests/mode-config.test.js js/constants.js js/state.js js/game.js js/ui.js index.html
git commit -m "feat: add extensible difficulty configuration"
```

### Task 8: Complete the accessibility pass

**Files:**
- Modify: `index.html`
- Modify: `js/ui.js`
- Modify: `css/game.css`
- Modify: `css/components.css`

**Step 1: Replace clickable `div` balls with button semantics**

Interactive color balls and slots should become actual `button` elements or elements with equivalent keyboard behavior.

Preserve visual style while adding:
- focus states
- `aria-pressed` where useful
- disabled state semantics

**Step 2: Add keyboard interaction**

Support:
- arrow keys to move active slot
- number keys or shortcut keys for colors if practical
- Enter/Space to activate focused item
- Escape to close overlays/help

**Step 3: Add non-color identifiers**

Each color should have a secondary marker:
- short letter (e.g. 红→R, 橙→O, 黄→Y, 绿→G, 蓝→B, 紫→P, 白→W)
- or a CSS pattern overlay (stripes, dots, etc.)

Do not rely on color alone to distinguish playable pieces.

**Step 4: Improve live region and dialog behavior**

Make sure:
- result overlay traps focus appropriately
- status updates are concise and useful
- hidden sections are not keyboard reachable

**Step 5: Check contrast ratios**

Verify WCAG AA compliance (4.5:1 for normal text, 3:1 for large text) for:
- `.text-hint` and `.text-small` classes (gray text on dark background)
- feedback legend text
- button labels in disabled state

Adjust colors in `css/variables.css` as needed.

**Step 6: Manual validation**

Check:
- full keyboard-only playthrough
- screen-reader labels for palette and slots
- color-blind distinguishability review

**Step 7: Commit**

```bash
git add index.html js/ui.js css/game.css css/components.css css/variables.css
git commit -m "feat: improve accessibility and keyboard support"
```

### Task 9: Final QA, docs, and rollout notes

**Files:**
- Modify: `README.md`
- Create: `docs/plans/manual-qa-checklist.md`

**Step 1: Document the new feature set**

Update README with:
- daily challenge
- local stats
- result sharing
- persistence/resume
- accessibility improvements

**Step 2: Create a manual QA checklist**

Add a checklist split by release:

**Release 1 QA:**
- [ ] iOS Safari: classic game, daily game, share, persistence
- [ ] Android Chrome: same flows
- [ ] Narrow height Android device: layout, scroll, palette visibility
- [ ] Desktop Chrome/Safari: clipboard fallback, keyboard shortcuts
- [ ] Storage recovery: corrupt JSON, version mismatch
- [ ] Daily challenge rollover: complete today, check tomorrow

**Release 2 QA:**
- [ ] First-run onboarding appears once, dismissal persists
- [ ] Help chip opens/closes legend
- [ ] Duplicate mode: repeated colors accepted
- [ ] Expert mode: 8-row board (if shipped)
- [ ] Keyboard-only playthrough
- [ ] Screen reader basic flow
- [ ] Contrast check on all text elements

**Step 3: Run final validation**

Run: `npm test`

Manual checks:
- all mode entries visible
- one complete classic game
- one complete daily game
- one interrupted and restored session
- one share action

**Step 4: Commit**

```bash
git add README.md docs/plans/manual-qa-checklist.md
git commit -m "docs: add roadmap-aligned gameplay documentation"
```

## Success Criteria

- Users can come back daily to a deterministic challenge without creating an account.
- Refreshing or accidental tab closure does not destroy an in-progress run.
- A completed game updates local progression and can be shared without spoilers.
- The game can expand beyond the current single ruleset without reworking every file.
- Core puzzle logic is covered by repeatable tests before harder variants ship.
- Mobile UX still fits small Android screens while new meta features are added.
- Feedback values use semantic constants (`exact`/`misplaced`/`none`) throughout the codebase.
- All localStorage schemas are versioned and degrade gracefully on corruption or version mismatch.
