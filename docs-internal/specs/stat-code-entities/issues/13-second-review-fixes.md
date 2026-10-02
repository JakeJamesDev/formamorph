# 13: Second review fixes

Status: done
Base: 378213d1
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Fixes from the second effort review, of tickets 06, 10, 11 and 12. The guide must match what the sandbox does, a released template slot type goes back to its released behavior, and three small duplications in the sandbox merge.

## Acceptance criteria

- [x] **Test Code** shows every read-only write the run reports, by its path, not only writes to `acquired` (Q32, Q35). The guide's claim that **Test Code** reports read-only writes is then true.
- [x] The guide states the Q39 exception: `persona === entities[persona.name]` holds only when the persona entity has a code name.
- [x] A `text` template slot inserts its value as typed again, as in v3.1.2 (Q41). Saved author templates generate the same code they did on v3.1.2. The two new built-in templates stay safe for a name with a quote in it, through their own slot types or quoting. The template module's header comment matches the behavior.
- [x] The Test Bench finding for an entity with no code name reads correctly for an unnamed entity (no `"Untitled" has no name`), and uses no markdown backticks, like its sibling findings.
- [x] The rewrite module's comment names the retired `placeholders` map without a release version.
- [x] The sandbox preludes share one helper that adds a reported path only once, in place of the three inline copies.
- [x] One function decides whether an entity gets a key in `entities`. Analysis and the sandbox both use it.
- [x] The shared write-row type's entity-only `traitRows` field gets a general name that fits dictionaries too.
- [x] Tests for the **Test Code** read-only warnings, the `text` slot as typed and the finding copy, each shown to bite. The changelog line is in In Progress, folded into this effort's unreleased entry where one covers the subject.
