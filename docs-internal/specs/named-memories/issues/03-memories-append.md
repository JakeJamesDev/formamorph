# 03: Memories Append

Status: ready-for-human
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

- [x] `memories.append(text)` adds the turn's memory line as `add` did (existing tests moved to `append`). `statCodeExecutor.memories.test.ts`, `statCodeExecutor.memoryWrites.test.ts`.
- [x] `memories.add(` is rewritten on load; a second run returns its input; unrelated code stays byte for byte. `migrateMemoriesAppend` tests, including `changes nothing on a second run`.
- [x] A world with `memories.add` loads and runs its script. `rewrites memories.add in every script of a shipped world` and `runs the rewritten call as the old one ran`.
- [x] Emberwatch and Slime use `memories.append`. One line each in `src/defaultworlds`; grep shows no `memories.add` left.
- [x] No doc, completion or hover card names `memories.add` except the load-rewrite note. Grep over `src` and `docs`; `docs/Tools.md` keeps the note.
- [x] Changelog fragment written. `docs-internal/changelog.d/named-memories-03.md`.

## Landed

**Not verified**
- The bundled worlds ran only through the gate tests, not in a live game turn.
- `src/lib/formaquestion/sectionVectors.json` still holds the old help text. `build:help-vectors` before the release refreshes it.

**For you**
- Export-shape reminder (constraint #2): world scripts that say `memories.add` are rewritten to `memories.append` on load. Shipped worlds and saved worlds change text, not shape.
