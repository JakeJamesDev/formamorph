# 04: Stat Code Reads Placeholders

Status: ready-for-human
Base: d1a5bb5b
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

## Comments

**2026-09-10: handover.**

- **Seam.** `StatCodeTurn.placeholders` is a `StatCodePlaceholderSet` (`placeholders`, `rolls`, `pins`, `pick`). `sandboxPlaceholders` in `src/lib/statCodePlaceholders.ts` turns it into the sandbox entries, and `readPlaceholders` in `src/lib/placeholders.ts` does the resolution. Ticket 05 adds its Code Pins to `pins`.
- **What "every placeholder" means.** It is the combined list: shared, then each entity's own, then each book's. Test Code and the Test Bench read with no rolls, so an unrolled placeholder reads as a fresh draw there.
- **Decisions to confirm:**
  - A placeholder with every value at weight 0 still rolls. `roll()` takes the resolver's uniform fallback, the same as play.
  - A placeholder placed only as Unique chips has no world roll. It reads as a throwaway draw on every run.
  - `roll()` redraws only the top level. A chip value's nested Wildcard keeps this run's one draw.
- **Not done.** `executeStatCode` now takes six positional parameters. An options object is the clean shape, but ticket 03 is editing that signature now.
- **Live check.** `e2e/stat-code-turn.spec.ts` covers the ticket demo.
