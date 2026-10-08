# 01: Save Menu And Optimize Images Button

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a rearrangement of existing app-bar parts with an existing split-button pattern; no new state.

Parent: [World Editor Auto Save spec](../spec.md)

## What to build

The World Editor's app bar gets the layout auto save will live in. Nothing about saving changes yet.

- Save becomes a split button. The face saves as today and keeps the Save (Ctrl+S) tooltip, the disabled-when-clean state and the Authoring Tour's save anchor. The chevron opens a menu holding **Export World**. The chevron stays enabled when the face is disabled.
- The **More world actions** menu goes away in Advanced mode. The separate Export World icon goes away in Simple mode. Both modes reach Export World from the Save menu.
- **Optimize Images** becomes its own icon button with a tooltip, shown in Advanced mode only. It shows a spinner while it runs, and its progress shows in the tooltip.
- Mobile's footer follows the same rules: its Save icon gets the menu chevron, and Optimize Images shows as an icon in Advanced mode.
- The existing split button opens upward and is sized for the editor footer. Extend it or add an app-bar form; do not copy it.

Rulings: Q20, Q23, Q24. Prototype: `prototype/autosave-button`, `878f9cfb`.

## Acceptance criteria

- [ ] Save's face saves, shows Save (Ctrl+S), and is disabled when the world is clean; the chevron stays enabled.
- [ ] The Save menu holds Export World in Simple and Advanced mode, and on mobile.
- [ ] The More world actions menu and the Simple-mode Export icon are gone.
- [ ] Optimize Images is an icon button in Advanced mode only, with spinner and tooltip progress while it runs.
- [ ] The Authoring Tour still anchors on Save and still saves on Next.
- [ ] Changelog fragment written; dev route still lands on the editor.
