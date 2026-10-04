# 19: Mascot switch row and scrollbars

Status: ready-for-human
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

## Answer

Built as ruled. The switch row sits under the preset row and its hint, outside both scrollers. Both columns are shared ScrollAreas (`type="auto"`) from lg, and one ScrollArea holds the stack below lg.

The "no scrollbar at 1600×900" criterion could not hold (Q63): at 1600×900 the preview viewport is 493px and the widget is 744px with padding, so the preview column fits only from about 1180px of viewport height. The e2e test checks the bar at 1280×700 and none at 1920×1200.
