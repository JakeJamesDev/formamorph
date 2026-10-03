# 06: Semantic Search switch

Status: done
Base: 9481bc16
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The General tab gains a **Semantic Search** switch, default off (Q6, Q21).

- The switch starts the download of the embedding model when it goes on. Today the semantic source never starts a download; this switch is the one place that does.
- The row shows progress, a ready state and a failed state. A failed download leaves the source off and offers a retry.
- A model that is already on the device needs no download: the switch goes on at once.
- While the model is not ready, a question uses the other sources and does not wait.
- The General docs section gains the switch.

Recommended model rationale: one switch on an existing source and an existing downloader, with three row states.

## Acceptance criteria

- [ ] The switch on, with no model on the device, starts one download and shows progress.
- [ ] A failed download shows the failed state, leaves the source off, and a retry starts a new download.
- [ ] A question sent during the download uses the other sources.
- [ ] With the model ready and the switch on, the semantic ranking joins the merge (help session test with a fake embedder).
- [ ] An unmount during the download leaves no timer or fetch behind.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
