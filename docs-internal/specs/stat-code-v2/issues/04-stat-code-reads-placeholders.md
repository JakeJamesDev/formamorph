# 04: Stat Code Reads Placeholders

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Read-only, but it resolves every placeholder per run under the live rolls and pins without minting a roll, and it marshals a per-entry function into the VM. The resolver's roll-minting rules are the trap; medium effort on Opus is enough for a read path.

## What to build

The sandbox injects `placeholders`, an object keyed by placeholder name over every placeholder in the world. Each entry is `{ value, values, roll }`. `value` is the current resolved text under this playthrough's rolls and active pins. `values` is every authored value resolved to text, in authored order, benched values included. `roll()` returns one value text drawn with the author's weights and has no side effect. A value that is itself a chip reads as its resolved chain.

Resolution during the run never mints a roll. A placeholder that has not rolled yet reads as its draw would, and the draw is discarded. Names that are not identifiers use bracket syntax. Two placeholders with one name collide; the last authored wins and the editor warns.

Completions offer `placeholders`, the placeholder names, and the entry members. A reference to a placeholder name that does not exist is a diagnostic.

Demo: a stat whose code sets `self.value` to a different number per `placeholders.Mood.value` shows the right number after Enter World.

## Acceptance criteria

- [ ] `placeholders.<name>.value` reads the current resolved text, pins included
- [ ] `values` lists every authored value resolved to text, benched values included, chips resolved
- [ ] `roll()` draws with the author's weights; a weight-0 value never comes up; the draw is not persisted
- [ ] Reading a placeholder with no roll mints nothing in the save
- [ ] Completions and the surface list cover `placeholders` and its entry members; the drift guard still holds
- [ ] Unknown placeholder name is a diagnostic; duplicate name is a warning naming the winner
- [ ] Tests at the per-turn seam cover read, list, weighted roll via an injected picker, and unknown name; a resolver test proves no roll is minted
- [ ] Four gates green; graph updated

## Blocked by

- 02 — Stat Code Reads The Turn And Writes Its Value
