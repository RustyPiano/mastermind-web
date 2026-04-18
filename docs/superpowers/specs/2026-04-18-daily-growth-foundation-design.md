# Daily Growth Foundation Design

**Scope**

This slice hardens the daily challenge loop and makes the funnel measurable without introducing accounts or a backend. It covers three user-facing outcomes:

1. Daily challenge uses a fixed product timezone instead of the browser timezone.
2. The home daily card clearly distinguishes "today not started", "in progress", "won", and "lost", and shows time remaining until the next refresh.
3. Core funnel, share, and challenge flows emit analytics events through a thin wrapper around Vercel Analytics.

**Product Decisions**

- Fixed daily timezone: `Asia/Shanghai`
- Daily outcomes are tracked separately from resumable session state.
- A failed official daily challenge remains recorded as failed for the day. Practice-mode replay is planned next, but not included in this slice.
- Storage stays backward-compatible. We extend normalized stats data instead of invalidating existing local data.

**Architecture**

- `js/daily.js` becomes the source of truth for daily calendar helpers: fixed timezone, current key, time remaining, and state derivation inputs.
- `js/stats.js` stores per-day official outcomes so the app can distinguish win vs loss instead of only "completed".
- `js/ui.js` renders richer daily card copy from derived state rather than inferring from two booleans.
- `js/analytics.js` provides a no-op-safe `trackEvent(name, payload)` API so `js/game.js` can instrument the funnel without coupling logic to the analytics vendor.

**Data Model**

- Add `dailyResults` to stats, keyed by challenge key.
- Each entry stores `{ status: 'won' | 'lost', rounds, finishedAt }`.
- Keep `completedDailyKeys` for compatibility and streak logic, but derive card state from `dailyResults` first.

**Verification**

- Add tests for fixed timezone helpers and next-refresh countdown.
- Add tests for daily status derivation and recording win/loss outcomes.
- Add tests for analytics wrapper behavior and event payload forwarding.
- Run targeted tests while iterating, then the full Vitest suite.
