# 03: Connect World References

Status: ready-for-human
Base: dda964de
Status note: The linking flag is gone and links are live. Two follow-ups and one
product call are under Comments.
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

- [x] `src/lib/linkingFlag.ts` is gone and no file references `LINKING_ENABLED`.
- [x] Adding content whose references all resolve inserts it with no dialog.
- [x] Adding content with one unresolved Placeholder opens the dialog with that row preselected to its single match and a value preview.
- [x] A reference with two equal matches opens with no preselection and the note; Connect & Add is disabled until chosen.
- [x] A location reference offers world locations and Create New; choosing Create New adds the location and the Entity references it.
- [x] Back keeps every selection; Connect & Add inserts the content with connections stored on the world copy.
- [x] A source update that renames a Placeholder keeps the stored connection; deleting the world Placeholder surfaces the copy in the issue list with Save Connections.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 02 — Save to Library and Add from Library with links.

## Comments

### Handover (2026-09-13)

One commit on top of `Base:`. Four gates green: typecheck 0, lint 0, tests 9620 passed / 3 skipped in 68.30s,
build 17.35s. Reviewed against `dda964de` on both axes; every correctness finding is folded into the
commit.

**Export shape.** Two additive fields, both reported to the author:

| Field | Where | Written when |
| --- | --- | --- |
| `ContentLink.connections` | `Entity.link` / `Dictionary.link`, inside a world | every linked add, and every update |
| `Entity.locationRefs` | off-world only, on a library item | `toLibraryItem` for an entity that stood somewhere |

No version bump, no migration. A world saved by an earlier build has neither field and reads as a copy
with nothing connected, which is what it is.

**A bug fixed on the way.** `applyLibraryUpdate` copied the source's text fields verbatim into a world
copy that kept its own placeholder defs, so every chip in an updated copy pointed at the source world's
ids. It was parked behind the flag, so it never shipped. The pass now re-adopts through the stored
connections.

**Verified in the app** at 1600x900 and 375x812, on a seeded library book against a world holding two
Placeholders named `Capital` and none named `Weather`: the ambiguous row preselected nothing and said so,
Connect & Add stayed disabled until both rows were answered, and the world came out with both connections
stored and both chips re-aimed. Adding the same book again raised only the `Capital` row, because the
first add had created `Weather`.

### Open for the author

1. **A reference the source newly introduces joins as a new world Placeholder.** The synchronization pass
   cannot open a dialog, and the two alternatives are worse: blocking the pass, or leaving the copy's
   chips pointing at nothing. The author sees the new Placeholder on the Placeholders tab and can re-aim
   it with Save Connections. If that is too quiet, the pass could raise a notice.

2. **`Cancel` is on the dialog.** The spec names only Connect & Add, Back, and Save Connections. Every
   other dialog in the app offers Cancel, and without it a repair opened by accident has no way out but
   the X.

### Follow-ups for later tickets

- **The issue-list row navigates; it carries no Save Connections button.** `Rule.fix` is for repairs that
  need no authorial judgment, and this one is nothing but judgment. The row's item button lands on the
  copy, where the menu holds Save Connections. A per-item action on a finding row does not exist in the
  Instrument contract yet; ticket 10 (missing-source checks and repairs) is the place to add one.
- **Repair needs the library item.** A copy whose library item is gone gets a toast, not a dialog. Ticket
  10 owns the missing-source story.
- **A source that drops a location reference leaves the copy's membership alone.** The copy's `locations`
  is world-owned, so an update never rewrites it. If a later ticket wants the source to move a copy
  between places, that is a new decision, not a bug here.
