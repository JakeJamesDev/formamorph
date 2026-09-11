# 01: Stats Becomes A Name-Keyed Map

Status: ready-for-human
Base: f8b199db
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The editor's stat-like scanner, the after-dot and in-bracket completions, and the other-stat write check all assume `stats` is an array searched with `find`. Retargeting them to a map while keeping every existing diagnostic honest is the sharp part, so Opus at high effort.

## What to build

Inside the sandbox, `stats` is a map keyed by stat name, built on the same tracked-map prelude as `placeholders` and `traits`: a null prototype, an unknown name reads as a blank entry, a name with a space is reached with brackets, and of two stats sharing a name the last authored is the entry. The array is gone; `stats.find` is not a function. `self` is the map's own entry for the current stat, the same object, so `self` and `stats[self.name]` are one. A blank entry carries the entry shape with `id` and `name` empty and every number zero, `max` included. Only `self` takes writes; a write to another entry is ignored by the host. Iteration is `Object.values(stats)`. `currentStatId` stays as a global, undocumented.

In the editor, completions after `stats.` list stat names and inside `stats[` list quoted names; after `stats.Name.` or `stats["Name"].` they list the stat fields. An unknown stat name is underlined, two stats sharing a name get a warning naming the winner, and a write to another stat's entry through the map gets the existing "write to self instead" warning. The surface list describes `stats` as a map and the drift guard still passes.

Templates, help, guide, bundled worlds, and the world migration are separate tickets; this one leaves them on the old form.

## Acceptance criteria

- [x] `stats["Health"].value` and `stats.Health.value` read the stat; `stats.find` is undefined
- [x] `self === stats[self.name]` inside the sandbox
- [x] An unknown name reads as a blank entry with zeros, and `"Nope" in stats` is false
- [x] Of two same-named stats the last authored is the entry
- [x] A write to another stat through the map changes nothing after the run
- [x] Completions: names after `stats.`, quoted names inside `stats[`, stat fields after an entry
- [x] Diagnostics: unknown name, duplicate name naming the winner, other-stat write through the map
- [x] Surface list and drift guard updated; `currentStatId` remains injected
- [x] Executor, per-turn, and analysis tests cover the above; Test Code in the editor runs under the map
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)

## Comments

**2026-09-11, implementation notes.**

- **Scope moved in, per the orchestrating session.** 01 rewrote the 11 `stats.find` lookups in the built-in template code to `stats[{{slot:stat}}]` and `self`, and the 4 bundled-world code strings to `stats.Name`. Without them the template and bundled-world sandbox tests fail under the map. 02 and 03 skip those edits; template descriptions, help, the guide, snippets, and the migration stay theirs.
- **Scope moved out.** The Test Bench rules that scan `s.name === "X"` lookups (`stat-code-unknown-stat`, `codeReadsSelf`) are ticket 07.
- **Where the code landed.** The shared tree put the executor, executor-test, template, and per-turn-test edits for this ticket into `b274ff79` (ticket 06). This ticket's own commit holds the editor side, the surface list, the bundled worlds, and the remaining test fixtures.
- **`stats.find` is a blank entry, not `undefined`.** The map reads every unknown name as a blank entry, `find` included, so `stats.find(...)` throws "not a function". The acceptance line said `undefined`; the body said "not a function". The tests assert the body.
- **`selfName` in the editor.** The analysis takes the current stat's name, so `stats.Mood.value = 5` inside Mood's own code counts as its own write instead of getting the other-stat warning.
- **Review folded in.** A write through the map or an alias to the stat's own entry now gets the same field checks as `self` (`stats.Mood.valeu`, `me.delta.ai.value`). A write nested in another stat's `previous` or `delta` gets the other-stat warning. `Object.values(stats).find(f).filter(g).` no longer completes stat fields, and `stats[""]` is not flagged.
- **Known limits, not fixed.** When the current stat loses its name to a later stat, `self` stands alone and a write through `stats[self.name]` is dropped with no diagnostic; the duplicate-name warning is the only sign. `Object.values(stats)` puts number-like names first, as any JS object does. The duplicate warning names the winner as "the last one authored", since the names are identical.
- **Re-lint fix.** `forceLinting` does nothing once a lint has settled (`@codemirror/lint` 6.9.7 `force()` runs only while one is pending). The code session now marks a world-list change with a state effect the linter's `needsRefresh` reads, so a stat, placeholder, or trait rename re-lints with no edit to the code.
