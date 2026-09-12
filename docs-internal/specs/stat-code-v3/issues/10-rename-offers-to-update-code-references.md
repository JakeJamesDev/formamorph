# 10: Rename Offers To Update Code References

Status: ready-for-human
Base: 03c57013
Blocked by: 09
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A committed-edit detector on three name fields, a scoped rewrite over the map-lookup forms, and one prompt. The editor's search-and-replace is the prior art. Sonnet at medium effort.

## What to build

When an author commits a new name for a stat, a placeholder, or a trait, and at least one stat's code references the old name in a map form, the editor asks whether to update those references. Yes rewrites every exact map-lookup form of the old name to the new one across every stat's code: dot form, bracket form, both quote styles. No leaves the code as it is. A rename nothing references is silent.

A rename is a committed edit: the name field loses focus or takes Enter with text that differs from what it held when the field gained focus. Keystrokes are not renames. A rename applied through the editor's search-and-replace counts. Renaming to a name another entry of the same kind already carries is detected but offered no rewrite; the duplicate-name warning covers it. New, imported, and deleted entries are not renames.

For stats, old and new are code names as ticket 09 defines them, so a chip-bearing name compares the same way code reads it. The discard path rolls the name and the rewritten code back together.

## Acceptance criteria

- [x] Renaming a stat referenced by two scripts prompts with the count; Yes rewrites both, No rewrites neither
- [x] Dot, bracket, single-quoted, and double-quoted references all rewrite; a comparison-form leftover does not
- [x] Typing through intermediate names before blur produces one prompt, for the final name
- [x] Renaming to a duplicate name prompts nothing and leaves the duplicate-name warning to fire
- [x] Placeholder and trait renames behave the same over `placeholders` and `traits` references
- [x] A search-and-replace rename goes through the same prompt
- [x] Discard restores the old name and the old code together
- [x] Unit tests on the detector and the rewrite; a live check renames in the editor and reads the rewritten code
- [x] Four gates green; graph updated

## Blocked by

- 09 — One Stable Code Name For Every Stat

## Comments

**2026-09-11 — built, reviewed, and handed over.**

The pure seam is `src/lib/statCodeRename.ts`: it parses with the CodeMirror JS parser and rewrites only the
exact map-lookup forms, so a comparison against the name, an escaped key, a computed key, and a shadowed
`stats` are all left alone. `src/lib/useCodeRename.ts` takes the baseline on focus; the offer and its dialog
live in `src/components/editor/CodeRenameOffer.tsx`, mounted above the panels in `WorldEditor`.

Live check: renaming `Health` to `Vigor` in the editor asked "The code of 1 stat names the stat "Health" 2
times. Update them to "Vigor"?" and Update Code rewrote the other stat to
`return stats.Vigor.value + stats['Vigor'].max;` — both forms, the author's quote style kept. Enter behaves
the same as blur.

Three defects the review and the verification caught, all fixed in this unit:

- Answering **Update Code** settled the queue twice, because the action runs its handler and then closes the
  dialog. That dropped the next queued rename — the one case the queue exists for. Settling is now keyed on
  the request rather than its index, so the second call does nothing.
- The dialog body emptied while the dialog animated out. It now keeps the last plan through the exit.
- `planCodeRename` trimmed the new name but compared it against untrimmed sibling names.

### Left for later

- **A placeholder rename does not follow into stat code names.** Renaming the placeholder `Beast` changes the
  code name of a stat named `{{Beast}} Power` from `Beast Power` to `Wolf Power`, stranding
  `stats['Beast Power']`. That is a derived, second-order rename, and the spec's Out of Scope limits this
  work to "the exact map-lookup forms a rename touches". Worth its own ticket.
- **Chip-bearing trait names never offer.** Traits pass no code-name reader, because ticket 09 mandated code
  names for stats only. Play keys `traits` by resolved text, so the two disagree for a chipped trait name.
  Pre-existing, not introduced here.
- **Find-and-replace judges duplicates against pre-pass names.** The search targets hold the values from
  before the pass, so a duplicate created mid-pass is measured against stale names. The editor's own
  duplicate-name warning still fires.
