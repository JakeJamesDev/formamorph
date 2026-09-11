# 10: Rename Offers To Update Code References

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A committed-edit detector on three name fields, a scoped rewrite over the map-lookup forms, and one prompt. The editor's search-and-replace is the prior art. Sonnet at medium effort.

## What to build

When an author commits a new name for a stat, a placeholder, or a trait, and at least one stat's code references the old name in a map form, the editor asks whether to update those references. Yes rewrites every exact map-lookup form of the old name to the new one across every stat's code: dot form, bracket form, both quote styles. No leaves the code as it is. A rename nothing references is silent.

A rename is a committed edit: the name field loses focus or takes Enter with text that differs from what it held when the field gained focus. Keystrokes are not renames. A rename applied through the editor's search-and-replace counts. Renaming to a name another entry of the same kind already carries is detected but offered no rewrite; the duplicate-name warning covers it. New, imported, and deleted entries are not renames.

For stats, old and new are code names as ticket 09 defines them, so a chip-bearing name compares the same way code reads it. The discard path rolls the name and the rewritten code back together.

## Acceptance criteria

- [ ] Renaming a stat referenced by two scripts prompts with the count; Yes rewrites both, No rewrites neither
- [ ] Dot, bracket, single-quoted, and double-quoted references all rewrite; a comparison-form leftover does not
- [ ] Typing through intermediate names before blur produces one prompt, for the final name
- [ ] Renaming to a duplicate name prompts nothing and leaves the duplicate-name warning to fire
- [ ] Placeholder and trait renames behave the same over `placeholders` and `traits` references
- [ ] A search-and-replace rename goes through the same prompt
- [ ] Discard restores the old name and the old code together
- [ ] Unit tests on the detector and the rewrite; a live check renames in the editor and reads the rewritten code
- [ ] Four gates green; graph updated

## Blocked by

- 09 — One Stable Code Name For Every Stat
