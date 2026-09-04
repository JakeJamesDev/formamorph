# 09 — Stable value ids

Status: done

Spec: `../ownership-spec.md` (Value identity).

## Scope

- A placeholder's values carry a stable id alongside the author's text. The id is minted once and never
  changes; the text is what resolves and what the author edits.
- `weights` keys by value id. Values stay unique by text — the chip row and the multiline boxes keep
  collapsing a repeat.
- Both positional weight remaps are **deleted**: the manager's own, and the find bar's independent carry.
  Neither has a job once a rename cannot orphan a weight.
- Migration converts a string list to a record list at the import boundary, idempotent by element type, and
  rekeys existing weight maps by matching text once.
- Trait pins gain an optional value id, preferred over the text when present. The text field stays for a pin
  naming a value the list does not carry.
- Rolls keep storing resolved text. The save envelope does not change.

## Done

- Tests: a rename keeps its weight with no remap in the path; the migration is idempotent and rekeys weights;
  a repeat is still collapsed; a picked pin survives a rename and a typed pin still writes text. Mutation-proven
  where guarding.
- Export-shape reminder in the response — the world JSON's value shape changes.
- Live-verified via dev-router against `saltmarsh-reach.json`; four gates green; changelog entry appended.
