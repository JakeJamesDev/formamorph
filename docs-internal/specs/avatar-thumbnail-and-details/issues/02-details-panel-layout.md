# 02: Collapse Avatar Details and Put the Actions in One Row

Status: ready-for-human
Base: be9bbf3d
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q11–Q14.

## What to build

A player opens an Avatar's details. The details table (author, format, size, license facts) starts collapsed, so the 3D preview gets the room. When the player opens it, it stays open the next time, on this device. World Overview's custom player Avatar panel uses the same shared panel, so it behaves the same and shares the remembered state.

The Model Library modal's footer shows **Export** and **Publish** side by side at equal width. When **Publish** is absent, **Export** fills the row.

## Acceptance criteria

- [ ] The shared Avatar details panel wraps the table in the existing collapsible section component. No new visual pattern.
- [ ] The table starts collapsed.
- [ ] The open state persists in `localStorage` under one key for every surface that uses the panel. Reads and writes are wrapped in try/catch. A failure falls back to collapsed.
- [ ] The Model Library modal and World Overview behave the same.
- [ ] **Export** and **Publish** sit in one row at equal width. **Export** takes the full row when **Publish** is absent.
- [ ] The labels read **Export** and **Publish**.
- [ ] Pressing **Publish** still reports which license requirement fails, with the table collapsed.
- [ ] Tests in the panel and modal test files: starts collapsed, open persists, remount reads the stored state, storage failure falls back, one- and two-button footers, new labels. Each guard bites when its bug returns.
- [ ] `verify-ui` on both surfaces at a realistic viewport, in both themes.
- [ ] A changelog line under 🚧 In Progress.
- [ ] Four gates green.
