# Retention And Challenge Followthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining P0 loop by adding daily practice mode, first-session guidance, and a challenge landing screen before the puzzle starts.

**Architecture:** Keep new behavior behind small state flags and pure helpers. `state.js` and `storage.js` hold practice/challenge-entry state, `daily.js` and a new `guidance.js` hold derived UI text, and `game.js` orchestrates transitions while `ui.js` stays render-focused.

**Tech Stack:** Vanilla ES modules, localStorage, Vitest 3.2.4, Vercel Analytics (`window.va`)

---

## File Map

- Create: `js/guidance.js`
- Modify: `index.html`
- Modify: `css/components.css`
- Modify: `js/daily.js`
- Modify: `js/game.js`
- Modify: `js/result.js`
- Modify: `js/share.js`
- Modify: `js/state.js`
- Modify: `js/storage.js`
- Modify: `js/ui.js`
- Modify: `tests/challenge.test.js`
- Create: `tests/guidance.test.js`
- Modify: `tests/result.test.js`
- Modify: `tests/storage.test.js`

### Task 1: Daily Practice State

- [ ] Add failing tests for daily practice state persistence and result snapshots.
- [ ] Run the focused tests and verify they fail.
- [ ] Add `isDailyPractice` and challenge-intro metadata to game state and session snapshots.
- [ ] Re-run focused tests and verify they pass.

### Task 2: Daily Practice Flow

- [ ] Add failing tests for daily-session type detection and daily-card state copy for practice resumes.
- [ ] Run the focused tests and verify they fail.
- [ ] Implement official-daily vs practice-daily start flow, replay flow, and daily result handling.
- [ ] Re-run focused tests and verify they pass.

### Task 3: First-Session Guidance

- [ ] Add failing tests for first-session status and round-summary guidance helpers.
- [ ] Run the focused tests and verify they fail.
- [ ] Implement onboarding CTA plus first-game hint rendering from pure helper functions.
- [ ] Re-run focused tests and verify they pass.

### Task 4: Challenge Landing Screen

- [ ] Add failing tests for v2 challenge payload parsing and challenge landing copy helpers.
- [ ] Run the focused tests and verify they fail.
- [ ] Implement the challenge intro screen and route challenge URLs there before starting the puzzle.
- [ ] Re-run focused tests and verify they pass.

### Task 5: Full Verification And Review

- [ ] Run `npm test` and verify the full suite passes.
- [ ] Review the diff for unintended churn.
- [ ] Request a subagent code review focused on bugs, regressions, and missing tests.
