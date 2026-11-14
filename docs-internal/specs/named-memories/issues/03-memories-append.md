# 03: Memories Append

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

`memories.add(text)` becomes `memories.append(text)` with the same behavior, and older scripts are rewritten when a world loads (Q2, Q5).

- The script surface offers `memories.append`; no `add` alias stays.
- The script-text migration gains an idempotent rewrite of `memories.add(` to `memories.append(`, leaving other code byte for byte, as the earlier `memory.add` and `diary` rewrites do.
- Emberwatch and Slime are updated in source (`bundled-worlds` skill).
- Ships its docs: Scripts Reference Memory section, the Tools page's surface list and load-rewrite paragraph, completions and hover cards.

## Acceptance criteria

- [ ] `memories.append(text)` adds the turn's memory line as `add` did (existing tests moved to `append`).
- [ ] `memories.add(` is rewritten on load; a second run returns its input; unrelated code stays byte for byte.
- [ ] A world with `memories.add` loads and runs its script.
- [ ] Emberwatch and Slime use `memories.append`.
- [ ] No doc, completion or hover card names `memories.add` except the load-rewrite note.
- [ ] Changelog fragment written.
