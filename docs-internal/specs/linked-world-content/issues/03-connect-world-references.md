# 03: Connect World References

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: one dialog with clear rules from the spec and prototype, plus a matching function that needs tests for the ambiguity cases.

## Parent

[spec.md](../spec.md) — World Placeholder reference resolution, Settled follow-up decisions (Updates and repairs), ADR 0003 entity-owned location membership.

## What to build

When linked content arrives in a world and expects Placeholders or locations the world does not have, the author connects each one before the content is inserted. When every reference already resolves, no extra step appears.

After confirming the library picker, a **Connect World References** dialog lists one row per unresolved reference in two groups, Placeholders and Locations. Each row names what the content expects and offers a selector of this world's candidates plus **Create New…**. A single clear match is preselected with a preview of its values. Two or more equal matches preselect nothing and say so. A location row offers the world's locations and Create New; the Entity keeps ownership of its location references. **Connect & Add** stays disabled until every row has a connection. **Back** returns to the picker with choices kept.

Connections persist per world and survive updates from the source. The same dialog opens as **Save Connections** to repair a copy whose references broke, reachable from the selected item and from the editor issue list. Names alone never establish a connection.

## Acceptance criteria

- [ ] Adding content whose references all resolve inserts it with no dialog.
- [ ] Adding content with one unresolved Placeholder opens the dialog with that row preselected to its single match and a value preview.
- [ ] A reference with two equal matches opens with no preselection and the note; Connect & Add is disabled until chosen.
- [ ] A location reference offers world locations and Create New; choosing Create New adds the location and the Entity references it.
- [ ] Back keeps every selection; Connect & Add inserts the content with connections stored on the world copy.
- [ ] A source update that renames a Placeholder keeps the stored connection; deleting the world Placeholder surfaces the copy in the issue list with Save Connections.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 02 — Save to Library and Add from Library with links.
