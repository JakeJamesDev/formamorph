# 19: Mascot switch row and scrollbars

Status: ready-for-agent
Blocked by: 17
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Mascot switch reads as its own setting, and the tab's columns scroll like the rest of the app.

- The Mascot switch moves out of the controls column into a fixed row directly under the preset row, above the two columns. It never scrolls and is not part of the draft; it writes at once as today (Q59, Q60).
- Both columns scroll through the shared ScrollArea with a flex-resolved height, per the Design System's Scrollbars standard, in place of native overflow. The preview column keeps Q35: it scrolls only when the screen is too short. The mobile stack keeps one scrolling owner.

Spec: Q60, Q61; Implementation → Mascot tab.

Recommended model rationale: a row move and two scroller swaps on one tab, guarded by existing tests.

## Acceptance criteria

- [ ] Component tests: the switch renders above the columns, outside the draft, and toggles the chrome at once with a dirty draft untouched.
- [ ] Playwright: both columns show the shared scrollbar at 1280×700; the preview column shows none at 1600×900.
- [ ] The four gates are green.
