# 01: Section switcher: rail on landscape, icon dropdown on portrait

Status: ready-for-agent
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

- [ ] Landscape: rail with World, Entity, Dictionary rows, a rule, then Contest; no tabs in the header; results and pager unchanged.
- [ ] Portrait: header dropdown; each item shows icon + label; closed trigger shows the current icon + label inline.
- [ ] Contest row/item absent when no contest exists; present otherwise; the no-contest bounce to Worlds still works.
- [ ] Rows are generated from the kinds list, not hand-written per kind.
- [ ] The selected row/item is announced as current to assistive technology.
- [ ] `initialTab`, event banners, and notification-row arrival land on the right section in both layouts.
- [ ] The `community-kind-tabs` tutorial anchors to the rail on landscape and the dropdown on portrait.
- [ ] Component tests in the existing browser suites cover both layouts; the community-browser Playwright spec covers both viewports including the closed trigger's inline icon.
- [ ] Both themes checked; four gates green; changelog In-Progress entry added.
