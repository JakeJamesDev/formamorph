# Graphify Rebuild Cache

Status: needs-triage

## Problem Statement

Every graph rebuild of the main checkout re-extracts the whole repo. The job logs for the five rebuilds of 2026-10-07 (15:45 to 16:08 UTC, one per ticket landing) each say `AST extraction: 2817/2817 uncached files` and run three to four minutes. A rebuild after a one-file landing should touch one file.

The cost is not the rebuild itself. It runs at one worker, detached, and the user never waits on it. The cost is that it ran while the next queued ticket's gates ran, and three gate runs that afternoon failed on a single unrelated test timeout each. The ticket hooks now defer the rebuild until the gate queue drains, so the overlap is gone. The rebuild is still a full re-extraction, so a day with many landings spends most of its CPU on the same 2,800 files.

## Evidence

- Job records: `~/.cache/graphify/jobs/<id>.json` and `.log`. Jobs `32a35d97`, `0f77e312`, `5aa6c0bd` on 2026-10-07 each show the full `uncached` count.
- The landing path runs `graphify-hidden.exe update .` from the repo's `post-merge` hook, through `~/.local/bin/graphify-dispatch.py`, with `GRAPHIFY_MAX_WORKERS=1` and `PYTHONHASHSEED=0` set by the dispatcher.
- The `post-commit` hook passes `GRAPHIFY_CHANGED` (the commit's file list) to an in-process rebuild; the `post-merge` and the deferred landing rebuild pass nothing, so `update .` scans everything.

## Open Questions

- Q1 Where does graphify keep its AST cache, and what is the key? A key on mtime would miss after every checkout and rebase; a key on content hash should hit.
- Q2 Does `update .` honor the cache at all, or only the watch and hook paths?
- Q3 Can the deferred landing rebuild pass the landed commit's file list, the way `post-commit` does, instead of `update .`?

## Out of Scope

- The gate timeouts themselves. The hooks now keep the rebuild off the gate window.
- Labeling and the LM Studio backend.
