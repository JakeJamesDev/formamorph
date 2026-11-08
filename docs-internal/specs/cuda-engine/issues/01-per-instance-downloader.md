# 01: Per-Instance Downloader

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a contained prefactor of one main-process module with good tests already in place.

## What to build

Prefactor for the CUDA download. Today the model downloader holds one download for the whole module, and its allow-list is a Hugging Face–only constant. Make it a downloader you create per use. Each instance has its own allow-list, its own current download, Cancel, and progress callback. The model download creates one instance with the Hugging Face allow-list and keeps its behavior, its error text, and its progress channel exactly as they are. Two instances can run at the same time, and Cancel on one never touches the other.

No player-visible change, so no changelog fragment.

## Acceptance criteria

- [ ] The model download still downloads, resumes, segments and cancels exactly as before. The existing model download tests pass unchanged, apart from how they construct the downloader.
- [ ] Two instances with different allow-lists each refuse a host outside their own list.
- [ ] Two instances download at the same time, and Cancel on one leaves the other running to completion.
- [ ] The renderer's model download progress and errors are unchanged: same channel, same payload.
