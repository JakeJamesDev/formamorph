# 06: Pin(text) As The Documented Placeholder Write

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A one-line prelude alias plus a static-check extension and a copy pass. Sonnet at medium effort.

## What to build

`placeholders.<name>.pin(text)` pins the placeholder, as an alias of the `value` setter. The reader sees one write either way; the last of `pin`, `value`, and `unpin` wins. A non-text argument fails the run as a `bad-write` with the same message shape as a bad `value` write. `pin()` on an unknown name is dropped and reported. The editor treats `.pin(` as a write for the unknown-name and duplicate-name diagnostics, as it treats `.unpin(`. The completion for `value` describes a read and the completion for `pin` describes the write; `value` stays assignable and in the surface list, but no hint, guide sample, or template nudges toward it. The Placeholder Follows This Stat template and the guide's pin samples use `pin()`. Test Code lists a pin made either way the same.

## Acceptance criteria

- [ ] `pin("x")` lands as a Code Pin; last of `pin`/`value`/`unpin` wins in one run
- [ ] `pin({})` fails as `bad-write`; `pin` on an unknown name is reported and dropped
- [ ] The editor underlines `placeholders.Nope.pin("x")` and warns on a duplicate name reached through `pin`
- [ ] Completions: `value` reads as a read, `pin` as the write; `pin` is in the entry field list and the drift guard passes
- [ ] The pin template and every guide and help pin sample use `pin()`; `value =` appears in none of them
- [ ] Test Code lists a `pin()` write the same as a `value` write
- [ ] Executor, per-turn, analysis, and template tests cover the above
- [ ] Four gates green; graph updated

## Blocked by

- None (can start immediately)
