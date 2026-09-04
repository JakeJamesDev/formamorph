# 08 — World | Unique on a Variable that rolls its chips

Status: done
Type: task
Spec: ../followup-spec.md (issue 4)

## Task

- `chipVocabulary.placeholderVocabulary.axes`: show `PLACEHOLDER_MODE_AXIS` when the placeholder
  reaches a wildcard through its values, transitively (walk lone-chip and composed chips in every value;
  guard cycles with `placeholderCycleExclusions` or an id set). A plain Object with no nested wildcard
  gets no axis.
- Copy: the ⓘ `KIND_INFO` and the state line under Kind say a one-value Variable whose value holds
  wildcard chips is a template that rolls them, and picks World or Unique like a Wildcard.

## Acceptance

- Tavern Name (one value nesting two wildcards) shows the picker. Unique gives two placements different
  names in Preview and in play.
- A one-value Variable with plain text shows no picker. A two-value Object with plain values shows no
  picker.
- Vocabulary test covers all three.

## Answer

Shipped. `placeholderRandomizes(placeholders, id)` in `lib/placeholders.ts` walks
`reachablePlaceholderIds` and reports true where any reached placeholder `placeholderIsChoice`; the walk
covers lone and composed chips and terminates on a cycle. `placeholderVocabulary.axes` now gates
`PLACEHOLDER_MODE_AXIS` on it, so a template Variable gets the picker and a plain Object loses it. The
manager's Kind ⓘ carries a template bullet, and the state line reads "A Variable: its one value is a
template. It rolls its chips, and picks World or Unique like a Wildcard." when the draft reaches a wildcard.
Tests: the vocabulary axes case covers Tavern Name, a plain Variable, a plain Object, an Object nesting only
an Object, and a two-level reach; `placeholderRandomizes` has its own three cases including the cycle; a
resolver test proves two Unique placements of a one-value template roll `The Rusty Anchor` and
`The Gilded Lantern` under their own chains; a rendered `PlaceholderManager` test covers the state line.
Preview and play share the resolver, so the in-play half rests on that resolver test; no bundled world
holds a template Variable, so the live editor check is still to be done by hand.
