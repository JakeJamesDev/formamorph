# 01: Find The Cache Miss

Status: needs-triage
Blocked by: None (can start immediately)

## What to build

Find out why every graph rebuild of the main checkout re-extracts all files, and make a rebuild after a small landing incremental.

Steps:

1. Read graphify's cache code (package `graphifyy`, installed under `~/AppData/Roaming/uv/tools/graphifyy`). Name the cache location and its key.
2. Run `graphify update .` twice in a row in the main checkout with nothing changed. Record the `uncached` count of the second run. A nonzero count is the bug reproduced.
3. If the key is mtime-based, check what a landing's fast-forward and a rebase do to mtimes. If the key is content-based, find why it misses.
4. Fix at the cheapest layer: a graphify setting, an environment variable the dispatcher can set, or a file list passed to the deferred landing rebuild in `~/.claude/hooks/ticket_gates.py`.
5. Note the before and after wall time of a rebuild after a one-file commit in `~/.claude/notes/graphify.md`.

## Acceptance criteria

- [ ] A second `graphify update .` with no changes reports zero uncached files, or the reason it cannot is written down with the graphify source line.
- [ ] A rebuild after a one-file landing runs in well under a minute.
- [ ] The graphify note names the cache location, its key, and the fix.
