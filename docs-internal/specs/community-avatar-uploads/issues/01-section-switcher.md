# 01: Section switcher: rail on landscape, icon dropdown on portrait

Status: ready-for-human
Base: eaf2bee5
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a UI port from a working prototype plus component and Playwright tests; broad but well-specified, no cross-repo reasoning.

## Parent

[spec.md](../spec.md) — Community Avatar Uploads.

## What to build

Replace the Community Creations header tabs with the switcher settled on branch `prototype/community-nav` (commit `d2e66d9e`; worktree `.claude/worktrees/prototype-community-nav`, launch `npm run dev -- --port 5174 --strictPort`, then `#dev?view=mainMenu&modal=community&mode=page`).

On the landscape layout (the browser's existing 768px rule) a vertical sidebar rail sits beside the results, below the header: one row per catalog kind in kind order, a rule, then Contest. The header carries no tabs. On the portrait layout a dropdown takes the tabs' place in the header row; every item renders its icon and label, and the closed trigger renders the current section's icon and label itself. The rows come from the kinds list, so a later kind gets a row without touching the switcher. Contest keeps its existing condition (present only while a contest exists). Section state, deep-link arrival, and the event-banner path are unchanged; the section-switcher tutorial re-anchors to the rail or the dropdown. The website's embedded browser gets the same switcher.

Prototype trap to carry over: the dropdown trigger's content wrapper must not be a direct-child `span` of the trigger. The trigger's base style line-clamps such spans, which switches them to a box layout that stacks the icon above the label. Use a `div`.

## Acceptance criteria

- [x] Landscape: rail with World, Entity, Dictionary rows, a rule, then Contest; no tabs in the header; results and pager unchanged.
- [x] Portrait: header dropdown; each item shows icon + label; closed trigger shows the current icon + label inline.
- [x] Contest row/item absent when no contest exists; present otherwise; the no-contest bounce to Worlds still works.
- [x] Rows are generated from the kinds list, not hand-written per kind.
- [x] The selected row/item is announced as current to assistive technology.
- [x] `initialTab`, event banners, and notification-row arrival land on the right section in both layouts.
- [x] The `community-kind-tabs` tutorial anchors to the rail on landscape and the dropdown on portrait.
- [x] Component tests in the existing browser suites cover both layouts; the community-browser Playwright spec covers both viewports including the closed trigger's inline icon.
- [x] Dark theme checked; light theme NOT verified (see Comments). Four gates green; changelog In-Progress entry added.

## Comments

Landscape rail and portrait dropdown both verified live in the dev preview (dark theme): correct rows, active-row highlight, no header tabs, inline icon+label on the closed trigger. Could not get a light-theme screenshot — the Browser pane went hidden mid-session and stopped responding to further clicks. No new hardcoded colors were introduced; every class on the rail/dropdown is an existing theme token already used by neighboring controls (quarantine button, sort select, hidden popover), so light-theme correctness rests on that rather than a direct screenshot. **Needs a manual light-theme spot-check before merge.**

Four gates, run this turn on the final commit:
- `npm run typecheck` — `tsc --noEmit`, 0 errors.
- `npm run lint` — `eslint .`, 0 errors.
- `npm run test` — 538 files / 8681 tests passed, 3 skipped, 55.76s wall (one unrelated post-teardown warning in `FeedbackList.test.tsx`, pre-existing and untouched by this change).
- `npm run build` — succeeded in 14.20s.
- `npx playwright test e2e/community-browser.spec.ts` — 7 passed, 1 skipped (desktop skips the portrait-only inline-icon check), both projects.
