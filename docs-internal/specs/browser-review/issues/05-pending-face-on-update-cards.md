# 05: Pending Face On Update Cards

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one row field, one card branch, existing thumbnail hook
Reasoning effort: medium

## What to build

A pinned Update Pending card shows the pending name and the pending thumbnail, so staff judge the change. It builds against the `pending_preview` contract from 01 and falls back to the live face when the field is absent.

## Acceptance criteria

- [x] The listing service passes `pending_preview` through on catalog rows. (`fetchCatalog` test "keeps a row's pending_preview as the server sent it"; the service returns rows untouched)
- [x] A pinned update card shows `pending_preview.name` and the Update Pending badge. (`RemoteWorldCard.pendingFace.test.tsx`)
- [x] A pinned update card loads `pending_preview.thumbnail_url` through `usePendingThumbnail`, and shows the live thumbnail while loading, on error, or when there is no URL. (card tests: ready, failed read, no URL)
- [x] Browser search matches a pinned update by `pending_preview.name` as well as its live name, so a mod finds the name the card shows (ticket 03 review finding). (browser test; ruling: pinned view only, proved by dropping the `review === 'pin'` guard and seeing the Show Pending off test fail)
- [x] With **Show Pending** off, an update card shows its live face. (browser test; card test "outside the review group")
- [x] A row without `pending_preview` shows its live face. (card test)
- [ ] Frames: `.scratch/frames/pending-face-light.png` at 1280px wide.

For you: after 01 deploys, check that one real pending update's card shows the new thumbnail.

## Landed

**Not verified**
- Frame `pending-face-light.png`: the dev route stops at the age gate, and accepting it asserts the viewer's age. Open `#dev?modal=community&fixture=review` after accepting it yourself.

**For you**
- After server ticket 01 deploys, check one real pending update's card shows the new thumbnail.
- On the dev route, check the pinned update card shows "Lanterns Over the Fen" with the held thumbnail.
- A pinned update of an Entity or Avatar kind keeps its placeholder art (it has no thumbnail), with the pending name as title.
