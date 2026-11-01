# 13: 🔗 Marker Shows Link Pending Save

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: thread one list from the World Editor through three marker call sites.

## What to build

A row linked to a library item but not yet saved shows **Link pending save** only on the footer button's tip. The 🔗 marker on the row always shows the linked state. Pass the linking hook's pending list from the World Editor to every 🔗 marker: the dictionary tree, the entity tree and the entities adapter.

Spec: Implementation Decisions "Pending links". Evidence: docs-sweep ticket 11, Landed.

## Acceptance criteria

- [x] A World Editor library-links test reads the row marker's tip after a link and before save: it fails today, then passes with **Link pending save** (`reads Link pending save on the … row marker until the world saves`, dictionary and entity; red with the argument dropped)
- [x] After save, the row marker shows the linked state (same test, after Save)
- [x] The LinkedContent page no longer says only the footer shows **Link pending save**; the docs tests are green (docs tests run in the gates)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/13-pending-link-marker.md`)

## Landed

**Not verified**
- None. The docs tests ran in the prepare gates, not apart.

**For you**
- Link a row to the library in the World Editor, hover its 🔗 marker, and read **Link pending save · name**. Save the world and read **Linked · name**.
