# 09 — Placement label in the token, edited from the pop-out

Status: done
Type: task
Spec: ../followup-spec.md (issue 5, storage and editing)

## Task

- `lib/placeholders.ts`: extend `PlaceholderToken` with `label?: string` and the token grammar with an
  optional encoded segment. Percent-escape `%`, `:`, `{`, `}`, `>` as the path grammar does. `TOKEN_RE`,
  `WHOLE_TOKEN_RE`, `encodePlaceholderToken`, `decodePlaceholderToken`, `remintPlaceholderPlacements`
  and `remapPlaceholderIds` carry it. Resolution and describe ignore it.
- `VariableNode` pop-out: a **Label** text input, shown only while the chip is Unique. Writes the token.
  A switch to World keeps the label in the token.
- **Export-shape change**: say so in the response. The token grammar in every string field gains a
  segment.

## Acceptance

- Codec round-trips a label with every grammar character. A token without a label parses as today.
- Re-mint on duplicate keeps the label.
- The input is absent on a World chip and returns with its text after Unique → World → Unique.

## Answer

Shipped. The token grammar is `{{ph:<id>:<mode>:<placementId>[:<path>][:=<label>]}}`. The label
segment carries the `:=` prefix, and a path segment starts with its kind letter and never `=`, which is
what keeps the two trailing groups apart when only one is present. The label is percent-escaped with the
same `escapeSeg` the path grammar uses (`%`, `:`, `{`, `}`, `>`). `PlaceholderToken.label` is set only
when the segment is present, so a token written before this parses to the same object as before.
`remintPlaceholderPlacements` and `remapPlaceholderIds` pass the raw segment through; resolve and describe
never read it.

`ChipVocabulary` gains optional `placementLabel(token)` (`''` unset, `null` where the chip takes none) and
`setPlacementLabel(token, label)`. The placeholder vocabulary answers `null` for a World chip and writes
the label whatever the mode, so a World trip keeps it, and `repoint` carries it, so Re-Pick keeps it too. `VariableChip` renders a **Label** input while
`placementLabel` is non-null, writing through on each keystroke under `SKIP_DOM_SELECTION_TAG` so the
commit never moves the DOM selection out of the pop-out.

Tests: codec round-trip with every grammar character, with and without a path; a label-less token decodes
with no `label` key; re-mint and remap keep it; resolve and describe match an unlabeled chip. Vocabulary:
label only on Unique, clear on empty, Unique → World → Unique keeps it. Pop-out: absent on a World chip,
writes the token, survives the World trip. Live: typed a label on the stress-test world's Unique Beast
chip, saw it hide on World and return on Unique. The affix inputs share the jsdom-only focus flip the tag
addresses; in Chromium they type through untouched, so they were left as they are.
