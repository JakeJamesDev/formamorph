# Graphify Rebuild Cache

Status: needs-triage

## Problem Statement

Every graph rebuild of the main checkout re-extracts the whole repo. The five rebuilds of 2026-10-07 between 15:45 and 16:08 UTC (four ticket landings and one spec-session ruling commit) each log `AST extraction: 2817/2817 uncached files` (the last one 2820) and run two to four minutes. A rebuild after a one-file commit should touch one file.

The cost is not the rebuild itself. It runs detached and the user never waits on it. The cost is that it ran while the next queued ticket's gates ran, and three gate runs that afternoon failed on a single unrelated test timeout each. The ticket hooks now defer a landing's rebuild until the gate queue drains. A commit made on main by a spec session still starts a full rebuild at once through `post-commit`, so the overlap is narrowed, not gone. The rebuild is still a full re-extraction, so a day with many commits spends most of its CPU on the same 2,800 files.

## Evidence

- Job records: `~/.cache/graphify/jobs/<id>.json` and `.log`. Jobs `32a35d97`, `5aa6c0bd`, `f886ad13`, `cca01d2e` (landings) and `0f77e312` (the ruling commit `d123a5bf`) on 2026-10-07 each show the full `uncached` count. Wall times 3.1, 3.6, 3.3, 1.9, and 3.7 minutes.
- Both repo hooks run `graphify-hidden.exe update .`: `post-merge` directly, and `post-commit` on its Windows short-circuit before its own incremental `GRAPHIFY_CHANGED` path, so that path is dead on this machine. The launcher goes through `~/.local/bin/graphify-dispatch.py`, which sets `GRAPHIFY_MAX_WORKERS=1` and `PYTHONHASHSEED=0` unless already set. The logs never print the worker count.
- Since 2026-10-07 a ticket landing skips `post-merge` and the gate lock's release starts the rebuild instead, in `~/.claude/hooks/ticket_gates.py`.
- Leads from a first read of the package: `graphify/cache.py` keys entries by size and `mtime_ns`; `graphify/cli.py` runs `update` as a full code re-scan with incremental mode off, so the `uncached` line may be the AST pass over every file rather than a cache miss.

## Open Questions

- Q1 Where does graphify keep its AST cache, and what is the key? A key on mtime would miss after every checkout and rebase; a key on content hash should hit.
- Q2 Does `update .` honor the cache at all, or only the watch and hook paths?
- Q3 Can the deferred landing rebuild, and `post-commit`, pass the commit's file list to graphify instead of `update .`?
- Q4 Should `post-commit` defer the same way as a landing while a gate run holds the lock?

## Out of Scope

- The gate timeouts themselves. The hooks now keep the rebuild off the gate window.
- Labeling and the LM Studio backend.
