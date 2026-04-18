# Daily Growth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily challenge deterministic in a fixed timezone, expose explicit daily card states on the home screen, and instrument the core funnel with analytics events.

**Architecture:** Keep the app fully client-side and extend the existing module boundaries. `daily.js` owns calendar math, `stats.js` owns official daily outcomes, `ui.js` renders derived daily card copy, and `game.js` emits analytics through a new wrapper module.

**Tech Stack:** Vanilla ES modules, localStorage, Vitest 3.2.4, Vercel Analytics (`window.va`)

---

## File Map

- Create: `js/analytics.js`
- Modify: `js/daily.js`
- Modify: `js/game.js`
- Modify: `js/stats.js`
- Modify: `js/ui.js`
- Modify: `tests/daily.test.js`
- Modify: `tests/stats.test.js`
- Create: `tests/analytics.test.js`

### Task 1: Fixed Daily Timezone Helpers

**Files:**
- Modify: `js/daily.js`
- Test: `tests/daily.test.js`

- [ ] Step 1: Add failing tests for fixed timezone key generation and countdown helpers.
- [ ] Step 2: Run `npm test -- tests/daily.test.js` and verify the new assertions fail for the current implementation.
- [ ] Step 3: Implement fixed-timezone helpers in `js/daily.js` with `Asia/Shanghai` as the product timezone.
- [ ] Step 4: Re-run `npm test -- tests/daily.test.js` and verify the file passes.

### Task 2: Daily Result Model and Home Card State

**Files:**
- Modify: `js/stats.js`
- Modify: `js/game.js`
- Modify: `js/ui.js`
- Test: `tests/stats.test.js`
- Test: `tests/daily.test.js`

- [ ] Step 1: Add failing tests for recording daily win/loss outcomes and deriving `available`, `in_progress`, `won`, and `lost` card states.
- [ ] Step 2: Run `npm test -- tests/stats.test.js tests/daily.test.js` and verify the new assertions fail.
- [ ] Step 3: Extend stats normalization and recording logic to store official daily results without wiping existing local data.
- [ ] Step 4: Update the mode-selection refresh flow in `js/game.js` and the daily card renderer in `js/ui.js` to display richer state copy and the refresh countdown.
- [ ] Step 5: Re-run `npm test -- tests/stats.test.js tests/daily.test.js` and verify both files pass.

### Task 3: Analytics Wrapper and Funnel Events

**Files:**
- Create: `js/analytics.js`
- Modify: `js/game.js`
- Test: `tests/analytics.test.js`

- [ ] Step 1: Add failing tests for a safe analytics wrapper and representative event emission payloads.
- [ ] Step 2: Run `npm test -- tests/analytics.test.js` and verify the new assertions fail.
- [ ] Step 3: Implement `trackEvent(name, payload)` in `js/analytics.js` and instrument home view, mode click, game start, guess submit, game finish, share, and challenge events in `js/game.js`.
- [ ] Step 4: Re-run `npm test -- tests/analytics.test.js` and verify the file passes.

### Task 4: Full Verification

**Files:**
- Modify: none
- Test: `tests/daily.test.js`
- Test: `tests/stats.test.js`
- Test: `tests/analytics.test.js`

- [ ] Step 1: Run the focused suite for touched areas.
- [ ] Step 2: Run `npm test` and verify the full suite passes.
- [ ] Step 3: Review the diff for unintended churn before reporting status.
