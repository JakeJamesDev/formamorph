# 03: Tabbed Entity Panel

Status: ready-for-human
Base: e16d4a91
Blocked by: 01, 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The main build: layout, mode gating, persistence, dev-router, and the editor-level tests all land here.

## What to build

Selecting an entity in the World Editor shows a tab strip with Profile, Descriptions, and (Advanced only) Placeholders, under the content-link header and the placeholder palette bar.

Profile, at `sm` and wider, is a two-column grid: an 18rem left column with the gallery frame, thumbnail strip, and Generate with AI button; a flexible right column with Name, Aliases, Type, Image Tags. Below the grid, full-width: Locations, then 3D Model. Aliases, Type, Image Tags, and 3D Model are Advanced only. Descriptions stacks the three prose fields; Summary is Advanced only. Placeholders shows the hint line and the scoped placeholder editor sized to the remaining panel height with a minimum, not a fixed box.

The chosen tab survives selecting another entity for the life of the editor session and is held by the editor, not module state. When the chosen tab is unavailable, the panel shows Profile. The entity group panel is unchanged. The library character modal keeps its stacked body.

The winning prototype is `?variant=A2` at commit `7d1b61e5` on branch `prototype/entity-panel` (launch entry `proto-entity-panel`, port 5191); run it beside the build to compare.

## Acceptance criteria

- [x] Advanced: three tabs. Profile shows Image, Name, Aliases, Type, Image Tags, Locations, 3D Model and no description. Descriptions shows the three prose fields only. Placeholders shows the scoped editor.
- [x] Simple: two tabs. Profile shows Image, Name, Locations and the Generate with AI button; no Aliases, Type, Image Tags, or 3D Model.
- [x] Locations and 3D Model are full-width lines below the grid.
- [x] The tab persists across selecting another entity; on Placeholders, switching to Simple lands on Profile.
- [x] Selecting an entity group shows the group panel with no tab strip.
- [x] The dev-router gains a `subtab` ledger entry for `profile`, `descriptions`, `placeholders`, and the ledger drift test covers it.
- [x] World Editor bench-harness tests cover every criterion above.
- [x] Changelog: one 👤 entry in the In-Progress bucket.
- [x] Desktop verified in the preview against the prototype at 1600x900; no export-shape change.
- [x] Four gates green; graph updated.

## Blocked by

- 01 — Split The Entity Field Body Into Named Groups
- 02 — Separate Image Tags From The Gallery Widget
