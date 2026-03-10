# Mobile UX Pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the phone experience so users can start immediately and make guesses without repeated scrolling between the board and the palette.

**Architecture:** Keep the desktop two-column layout intact, but switch mobile to an interaction-first flow. On small screens, render the active screen above the history board and add a dedicated current-guess strip inside the guess panel so slot focus and palette stay in one compact area.

**Tech Stack:** Semantic HTML, vanilla JavaScript modules, responsive CSS

---

### Task 1: Document and isolate the mobile interaction surface

**Files:**
- Modify: `index.html`
- Modify: `css/game.css`

**Step 1: Add a mobile-only current guess section to the guess screen**

Insert a compact row near the palette with the active guess slots and short hint text so the player can tap slots and colors without leaving the control panel.

**Step 2: Reorder mobile layout visually**

Update the small-screen layout so `.side-panel` appears before `.board`, while preserving the existing desktop order and widths.

**Step 3: Tighten mobile spacing**

Reduce gaps, card padding, and board height on mobile to keep the active controls visible earlier in the viewport.

### Task 2: Sync the new mobile guess strip with the existing game state

**Files:**
- Modify: `js/ui.js`
- Modify: `js/game.js`

**Step 1: Build and refresh the mobile guess row from current state**

Render the same four active guess slots inside the new mobile section and reuse the existing slot-focus behavior.

**Step 2: Keep status text and counts near the palette**

Ensure guess refresh paths update the mobile row, count, button state, and status message together after color selection, slot clearing, submit, and reset.

**Step 3: Preserve board history behavior**

Do not remove the board row updates; the new mobile strip is only an interaction surface for the current round.

### Task 3: Verify and ship

**Files:**
- Modify: `README.md` only if behavior notes become necessary

**Step 1: Review the diff for desktop regressions**

Confirm desktop layout remains two-column and existing board rendering still works.

**Step 2: Run lightweight local validation**

Check the modified HTML, CSS, and JS for obvious selector or binding errors.

**Step 3: Commit and push**

Create a focused commit for the mobile UX pass and push it to `origin/main`.
