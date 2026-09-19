# 03: Entity Editor: Entity and Placeholders Tabs

Status: ready-for-human
Status note: Built in "Give The Library Entity Editor Entity And Placeholders Tabs". Focus is a `focusField` prop plus `entityEditorTabForField`; no caller sends one yet, because the library modal has no find. Sub-tab labels show from `lg`, through a new `labelClassName` on `PanelTabsList`.
Base: 6d200263
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** The library entity editor has two tabs: Entity and Placeholders. The Entity tab shows Tags in a left column and the Profile, Descriptions, and Openings sub-tabs on the right. The sub-tabs are the same strip and the same field components that the World Editor's entity panel uses. The Overview tab is gone.

**Rationale for the model:** the layout is simple, but the field-to-tab lookup and the dev-router ledger go to two levels, and several callers depend on them. A mid-size model at high effort.

## Acceptance criteria

- [x] The top strip shows Entity, then Placeholders. No Overview tab exists.
- [x] At `sm` and up, Tags sit in a left column that shows on all three sub-tabs.
- [x] Below `sm`, the layout is one column, and Tags show at the top of the Profile sub-tab only.
- [x] The sub-tab strip is the shared panel tab strip and renders from the shared entity panel tab list. The library editor shows every sub-tab, in any editor mode.
- [x] The editor tab list states once that Placeholders is a top tab in the library editor, so both hosts still derive from one source.
- [x] The library editor mounts the same Profile, Descriptions, and Openings field components as the World Editor, and drops any layout override that the wider pane makes unnecessary.
- [x] The editor opens on Entity and Profile.
- [x] A field focus request from find, search and replace, or findings opens the correct top tab and sub-tab.
- [x] The dev-router ledger for the library entity editor reaches both top tabs and all three sub-tabs, and the drift guard covers them.
- [x] The Playwright widths spec from ticket 02 also checks that no sub-tab label overflows its trigger in the modal.
- [x] The World Editor entity panel does not change, and its tests pass untouched.
- [x] All four gates pass, and `graphify update .` has run.
