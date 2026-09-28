# 06: Link To as a panel footer

Status: ready-for-human
Base: 2e1a0d0f
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a contained move of one control from a Details-only header slot to a panel-level footer, with the existing link tests as the net.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

On the **Traits** tab, a world trait's or group's **Link To…** button sits in a footer below the panel, under the tab strip, so an author sees it on every panel tab and not only on Details. It no longer opens the Details view at the top. Ruling Q32.

## Acceptance criteria

- [x] The trait panel and the group panel take a panel footer that renders below the tab content on every tab. The Details-only header slot no longer carries **Link To…**.
- [x] On the **Traits** tab, a world original's **Link To…** renders in that footer in Advanced, on Details, Requires and Stats alike. Basic shows no button, as today.
- [x] A link's row viewing its original keeps its Linked-from line at the top of Details, and its **This Link** section where it is today.
- [x] An owned trait, the mirror, and the library editor show no **Link To…**, as today (Q4).
- [x] Bench tests assert the button on a non-Details tab and its absence in Basic and on an owned trait. Existing link tests pass; a changed assertion has a stated reason.
- [x] Static frames from the dev-router show the footer on Details and on Requires in both themes.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] No export-shape change; say so in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

- 2026-09-28, user ruling mid-build: the footer is frozen, like the editor's **Save** bar. It is the detail pane's own bar (`p-3 border-t`), outside the detail scroll, in the side-by-side card and in the `ListDetail` push (`detailFooter`). It is not a slot inside the trait or group panel. The flyout opens upward.
- The trait panel's tabs are Details, Stats and Pins. The Bench tests check Stats and Pins; "Requires" in the criteria has no tab.
