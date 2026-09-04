# 01 — Vocabulary rows carry heading kind, owner kind, bare labels; separator becomes ›

Status: done
Type: task
Spec: ../spec.md (Vocabulary rows are the one source)

## Task

- `OWNER_NAME_SEPARATOR` in `src/lib/placementLetters.ts` becomes `›` with spaces on both sides in
  display output (`Keeper › Mood`). Every helper that builds a display name keeps reading the
  constant: `ownerPrefix`, `placeholderDisplayName`, `chipPathName`, `labelPlaceholders`, sample
  span names, pin summaries in `placeholderPins.ts`, `ScopedPlaceholdersSection` copy.
- `palette()` and `allRows()` in `src/lib/chipVocabulary.ts`: a heading row gains
  `headingKind: 'folder' | 'owner'`; an owner heading gains `ownerKind: 'entity' | 'book'`,
  `ownerId`, and `ownerName` as the raw chip-bearing string. Rows under an owner heading carry the
  bare name as `label`; rows elsewhere carry the full path.
- Query normalization for chip search and the typeahead: `.`, space, and `>` in the query match
  the separator. `›` still matches. Put the normalizer beside the existing plain-text label
  matcher so both `worldSearch` and the vocabulary's filter share it.

## Acceptance

- `chipVocabulary.test.ts`: owner heading carries kind and owner kind; rows under an owner carry
  the bare name; rows elsewhere carry `Keeper › Mood`; folder heading stays `folder`.
- `placementLetters.test.ts` owner-qualified cases flip to `›`.
- Search matches `keeper.mood`, `keeper mood`, `keeper>mood`, `keeper › mood`.
- Existing dot-form assertions in `PlaceholderManager.test.tsx`, `PlaceholderPaletteBar.test.tsx`,
  `ChipTypeahead.test.tsx`, `DrillPicker.test.tsx` flip to the new form. No surface change yet.
- Four gates green. `graphify update .` run.
