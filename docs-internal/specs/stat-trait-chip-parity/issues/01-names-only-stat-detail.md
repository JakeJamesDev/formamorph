# 01: Names-Only Stat Detail

Status: ready-for-agent
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

- [ ] In the Chip Options dialog, all three Stat Detail pieces can be unchecked on the Stats, Persona and Entities chips. The saved token carries each unchecked piece.
- [ ] `<PERSONA|norange.nodescriptor.nodescription>` over the sample scene renders `stats: Nerve` inline in plain, markdown and XML.
- [ ] `<ENTITIES|norange.nodescriptor.nodescription>` renders Wren's stats inline.
- [ ] The bare `<STATS DESCRIPTION>`, `<PERSONA>` and `<ENTITIES>` renders are unchanged. The rendered corpus snapshot shows no diff.
- [ ] Each new test fails with the lock or the old owned-stat render put back.
