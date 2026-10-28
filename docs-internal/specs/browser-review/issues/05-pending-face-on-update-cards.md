# 05: Pending Face On Update Cards

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one row field, one card branch, existing thumbnail hook
Reasoning effort: medium

## What to build

A pinned Update Pending card shows the pending name and the pending thumbnail, so staff judge the change. It builds against the `pending_preview` contract from 01 and falls back to the live face when the field is absent.

## Acceptance criteria

- [ ] The listing service passes `pending_preview` through on catalog rows.
- [ ] A pinned update card shows `pending_preview.name` and the Update Pending badge.
- [ ] A pinned update card loads `pending_preview.thumbnail_url` through `usePendingThumbnail`, and shows the live thumbnail while loading, on error, or when there is no URL.
- [ ] Browser search matches a pinned update by `pending_preview.name` as well as its live name, so a mod finds the name the card shows (ticket 03 review finding).
- [ ] With **Show Pending** off, an update card shows its live face.
- [ ] A row without `pending_preview` shows its live face.
- [ ] Frames: `.scratch/frames/pending-face-light.png` at 1280px wide.

For you: after 01 deploys, check that one real pending update's card shows the new thumbnail.
