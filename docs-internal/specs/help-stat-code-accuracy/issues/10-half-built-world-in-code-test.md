# 10: Half-Built World In Code Test

Status: ready-for-human
Blocked by: 09 — Persona Writes Pending In Code Test
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a result-shape change plus one scratch kind in the code test's run; the typo/new-name split reuses the editor's nearest-name rule and needs careful negatives.

## What to build

A player with the editor open on a half-built world asks Morphie for stat code that names a stat, trait, placeholder or entity they have not made yet. Today each such name comes back as an unknown-name error or a dropped write, and the function's guidance tells her to fix correct code. After this ticket:

- **"Create it" labels.** An unknown name with no near match (the editor's nearest-name rule) is tagged in the result as *not in this world*. The function's description says that tag is not an error: tell the player to create the thing, and name its kind. A name with a near match stays a typo error with its suggestion.
- **Assumed stats.** An unknown stat name with no near match is added to a scratch copy of the world's stats for the run: a number stat at value 0 with range 0–100. Correct code that reads it, including `value / max`, returns a number instead of failing the run. The result lists the assumed stats. Stats are the one scratch kind; traits, placeholders, entities and dictionaries are labeled, never built.

- **Stand-in persona, completed.** Ticket 09's stand-in persona holds trait names only. It now also holds the union of the persona-capable entities' placeholders, so a `persona.placeholders.X.pin(…)` on a held name is a pending write, not a dropped one. Its `inScene` reads true, as a played persona's does. The `pending` list and its description wording stay as 09 landed them.

The sandbox and the editor's own Test Code are unchanged. The no-world run (Q27) is unchanged.

## Acceptance criteria

- [ ] An unknown name with no near match returns a *not in this world* tag with its kind, not an error or a plain dropped write
- [ ] An unknown name with a near match still returns the typo error and suggestion
- [ ] A world-map write to a name that exists on another owner (`traits.Seasoned` when only a persona-capable entity holds Seasoned) stays an error, never a create-it tag; 08's harness test "flag seasoned-on-persona" holds
- [ ] Create-it tags and pending writes sit outside `errors` and `run.dropped`, so 08's clean check passes on correct code
- [ ] An unknown stat with no near match is assumed at 0 in 0–100; `stats.New.value / stats.New.max` returns a number and the run does not fail
- [ ] The result lists assumed stats apart from writes and dropped writes
- [ ] The function's description names the tag and the assumed stats and says neither is an error
- [ ] A `persona.placeholders.X` pin on a name a persona-capable entity holds returns pending; `persona.inScene` reads true on the stand-in
- [ ] The editor's Test Code output is byte-identical for the same code (existing test holds)
- [ ] The no-world run is unchanged
- [ ] Changelog fragment written
