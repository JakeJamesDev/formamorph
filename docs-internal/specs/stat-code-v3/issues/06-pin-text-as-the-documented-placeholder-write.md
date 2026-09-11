# 06: Pin(text) As The Documented Placeholder Write

Status: ready-for-human
Base: f8b199db
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A one-line prelude alias plus a static-check extension and a copy pass. Sonnet at medium effort.

## What to build

`placeholders.<name>.pin(text)` pins the placeholder, as an alias of the `value` setter. The reader sees one write either way; the last of `pin`, `value`, and `unpin` wins. A non-text argument fails the run as a `bad-write` with the same message shape as a bad `value` write. `pin()` on an unknown name is dropped and reported. The editor treats `.pin(` as a write for the unknown-name and duplicate-name diagnostics, as it treats `.unpin(`. The completion for `value` describes a read and the completion for `pin` describes the write; `value` stays assignable and in the surface list, but no hint, guide sample, or template nudges toward it. The Placeholder Follows This Stat template and the guide's pin samples use `pin()`. Test Code lists a pin made either way the same.

## Acceptance criteria

- [x] `pin("x")` lands as a Code Pin; last of `pin`/`value`/`unpin` wins in one run
- [x] `pin({})` fails as `bad-write`; `pin` on an unknown name is reported and dropped
- [x] The editor underlines `placeholders.Nope.pin("x")` and warns on a duplicate name reached through `pin`
- [x] Completions: `value` reads as a read, `pin` as the write; `pin` is in the entry field list and the drift guard passes
- [x] The pin template and every guide and help pin sample use `pin()`; `value =` appears in none of them
- [x] Test Code lists a `pin()` write the same as a `value` write
- [x] Executor, per-turn, analysis, and template tests cover the above
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)

## Comments

Implemented and reviewed against `Base:` in commit `e97ba4c9` ("Add pin(text) as the documented placeholder write"). `/mattpocock-skills:code-review` found nothing wrong with the pin() surface itself on either axis.

**File collision, flagged not fixed:** this repo's working tree is shared by every parallel session (not separate worktrees), so the files this ticket touched — `statCodeExecutor.ts`, `statCodeAnalysis.ts`, `statCodeSurface.ts`, `statCodeTemplates.ts`, `statCodeExecutor.test.ts`, `statCodeTurn.test.ts` — already carried tickets 01's and 04's uncommitted work when this commit was staged by name. `e97ba4c9` therefore also contains ticket 01's `stats` name-keyed map (`statsPrelude`, `TrackedMapBase`) and ticket 04's frozen `previous` snapshot (`StatSnapshot`, `Object.freeze(self.previous)`), neither mentioned in this ticket's own scope. The Standards review also caught that this leaves `statCodeSurface.ts`, `helpTopics.ts`, and `StatCodeGuide.md` teaching `stats.find(...)` against a `stats` that is no longer an array — that's ticket 03's job (map-form docs), left alone here since it's outside this ticket. Sessions 01 and 04 were notified directly that their work already landed under this commit.
