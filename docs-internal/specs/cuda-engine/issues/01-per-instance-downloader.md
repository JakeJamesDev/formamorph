# 01: Per-Instance Downloader

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a contained prefactor of one main-process module with good tests already in place.

## What to build

Prefactor for the CUDA download. Today the model downloader holds one download for the whole module, and its allow-list is a Hugging Face–only constant. Make it a downloader you create per use. Each instance has its own allow-list, its own current download, Cancel, and progress callback. The model download creates one instance with the Hugging Face allow-list and keeps its behavior, its error text, and its progress channel exactly as they are. Two instances can run at the same time, and Cancel on one never touches the other.

No player-visible change, so no changelog fragment.

## Acceptance criteria

- [x] The model download still downloads, resumes, segments and cancels exactly as before. The existing model download tests pass unchanged, apart from how they construct the downloader. (existing `modelDownload.test.mjs` cases untouched; affected-tests gate green. The module's exports are the model instance, so they need no change.)
- [x] Two instances with different allow-lists each refuse a host outside their own list. (test "refuses a host outside its own list, with its own message")
- [x] Two instances download at the same time, and Cancel on one leaves the other running to completion. (test "runs two downloads at once, and Cancel on one leaves the other running to completion")
- [x] The renderer's model download progress and errors are unchanged: same channel, same payload. (`main.cjs` untouched; error text byte-identical)

## Landed

**Not verified**
- None. No mutation test of the per-instance state was run.

**For you**
- Nothing for a player to judge: no player-visible change.
