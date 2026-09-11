# 01: Stats Becomes A Name-Keyed Map

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The editor's stat-like scanner, the after-dot and in-bracket completions, and the other-stat write check all assume `stats` is an array searched with `find`. Retargeting them to a map while keeping every existing diagnostic honest is the sharp part, so Opus at high effort.

## What to build

Inside the sandbox, `stats` is a map keyed by stat name, built on the same tracked-map prelude as `placeholders` and `traits`: a null prototype, an unknown name reads as a blank entry, a name with a space is reached with brackets, and of two stats sharing a name the last authored is the entry. The array is gone; `stats.find` is not a function. `self` is the map's own entry for the current stat, the same object, so `self` and `stats[self.name]` are one. A blank entry carries the entry shape with `id` and `name` empty and every number zero, `max` included. Only `self` takes writes; a write to another entry is ignored by the host. Iteration is `Object.values(stats)`. `currentStatId` stays as a global, undocumented.

In the editor, completions after `stats.` list stat names and inside `stats[` list quoted names; after `stats.Name.` or `stats["Name"].` they list the stat fields. An unknown stat name is underlined, two stats sharing a name get a warning naming the winner, and a write to another stat's entry through the map gets the existing "write to self instead" warning. The surface list describes `stats` as a map and the drift guard still passes.

Templates, help, guide, bundled worlds, and the world migration are separate tickets; this one leaves them on the old form.

## Acceptance criteria

- [ ] `stats["Health"].value` and `stats.Health.value` read the stat; `stats.find` is undefined
- [ ] `self === stats[self.name]` inside the sandbox
- [ ] An unknown name reads as a blank entry with zeros, and `"Nope" in stats` is false
- [ ] Of two same-named stats the last authored is the entry
- [ ] A write to another stat through the map changes nothing after the run
- [ ] Completions: names after `stats.`, quoted names inside `stats[`, stat fields after an entry
- [ ] Diagnostics: unknown name, duplicate name naming the winner, other-stat write through the map
- [ ] Surface list and drift guard updated; `currentStatId` remains injected
- [ ] Executor, per-turn, and analysis tests cover the above; Test Code in the editor runs under the map
- [ ] Four gates green; graph updated

## Blocked by

- None (can start immediately)
