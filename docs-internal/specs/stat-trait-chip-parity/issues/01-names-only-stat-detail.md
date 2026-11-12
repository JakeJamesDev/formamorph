# 01: Names-Only Stat Detail

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author can uncheck every Stat Detail piece (Range, Descriptor, Description) on the Stats, Persona and Entities chips. With all three off, the chip sends stat names only.

- The Chip Options dialog stops locking the last checked Stat Detail piece on. Remove the `statDetail` lock group, and the lock-group field if nothing else reads it.
- The Stats chip already renders names only with every piece off. Confirm that it does after the lock goes, in plain, markdown and XML.
- An owned stat list (Persona and Entities chips) with all three pieces off renders inline after its `stats` label: `stats: Nerve, Patience`. Do this in every format, the same way owned trait names render under Summary or Name content.
- Defaults do not change. The bare Stats chip still sends names only, and owned stat lines still default to all three pieces.
- Update the chip pages in `docs/` that say a Stat Detail piece must stay on.
- Changelog fragment in `docs-internal/changelog.d/` (Added: names-only stats on every chip).

Spec rulings: Q1, Q3, Q5.

## Acceptance criteria

- [x] In the Chip Options dialog, all three Stat Detail pieces can be unchecked on the Stats, Persona and Entities chips. The saved token carries each unchecked piece. (ChipOptionsDialog tests: Stats, and Entities/Persona `it.each`)
- [x] `<PERSONA|norange.nodescriptor.nodescription>` over the sample scene renders `stats: Nerve` inline in plain, markdown and XML. (promptTokenGrammar test, sample scene)
- [x] `<ENTITIES|norange.nodescriptor.nodescription>` renders Wren's stats inline. (promptTokenGrammar and rosterOptions tests)
- [x] The bare `<STATS DESCRIPTION>`, `<PERSONA>` and `<ENTITIES>` renders are unchanged. The rendered corpus snapshot shows no diff. (corpusRendered test green, snapshot untouched)
- [x] Each new test fails with the lock or the old owned-stat render put back. (Render branch disabled: 4 tests went red. The dialog tests assert enabled boxes, which the lock failed.)

## Landed

**Not verified**

- The lock-restored mutation was not run. The dialog tests assert the Range box is enabled and clears, which the lock disabled.
- No browser check of the dialog.

**For you**

- Open Chip Options on the Persona chip and uncheck all three Stat Detail pieces. Preview should read `stats: Nerve, ...` inline.
