# 04: Library Avatars Detailed View

Status: ready-for-human
Base: be9bbf3d
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Avatar Portrait Cards](../spec.md)

**What to build:** The **Detailed** toggle works on the Library's Avatars tab (Q4). The tab reads the per-tab layout state that already exists. In Detailed view it shows split cards in the same grid entities use. Each card's text is the credit line derived from the record's license authors, using the helper the publish payload uses (Q7). An Avatar with no usable image draws Morph art in both Grid and Detailed, seeded by the record id (Q8). The GLB badge stays in both views.

## Acceptance criteria

- [x] Choosing **Detailed** on the Avatars tab shows split cards. Choosing **Grid** returns to tiles. The choice persists per tab.
- [x] A Detailed Avatar card shows its credit line. A record with no authors shows no description line.
- [x] A record with no thumbnail, or one marked as failed, draws Morph art in both views.
- [x] Plain glTF records keep the GLB badge in both views.
- [x] Checked in the preview through the dev-router at a real viewport, in both themes. No new render harness is added.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.
