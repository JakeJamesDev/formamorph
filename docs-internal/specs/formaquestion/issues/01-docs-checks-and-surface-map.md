# 01: Docs checks and surface map

Status: done
Base: 7bb7de14
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A test tells a developer when the docs fall behind the app. It has three checks (Q4, Q23):

1. **Surface coverage.** A surface map ties every player-facing screen, dialog and tab id to one docs page and heading. The test fails when an id has no map entry, or when the heading does not exist. The ids come from the same registry the dev router uses, so one list names every surface. Surfaces that players never see (staff panel, design system showcase, likers list) are on an explicit exclusion list.
2. **Help-topic links.** Every **?** help topic names a docs page and heading that exists.
3. **Docs links.** Every link between docs pages, and every heading anchor in such a link, resolves.

The docs are incomplete today, so the test starts with a **known-gaps list**: the surface ids and help topics that have no docs section yet. An id on the list passes. An id on the list that *does* have a valid map entry fails, so the list can only shrink. Tickets 02–12 remove their entries. Ticket 13 deletes the list.

The heading-to-anchor rule is one shared function. It must match the anchors the GitHub wiki makes, because ticket 15 and the reader reuse it.

Fix any broken link between docs pages that check 3 finds today.

Recommended model rationale: the map's id vocabulary and the "list can only shrink" rule decide whether 12 later tickets can trust this gate.

## Acceptance criteria

- [x] The test fails for a surface id with no map entry and no known-gaps entry
- [x] The test fails for a map entry whose heading does not exist
- [x] The test fails for a known-gaps entry that has a valid map entry
- [x] The test fails for a help topic whose docs heading does not exist
- [x] The test fails for a broken link or anchor between docs pages
- [x] Each guard is proven to bite: reinstate the fault in a scratch run and quote the failure
- [x] The exclusion list names each staff or dev surface with a one-word reason
- [x] The map and the lists live in production code with no dev-only guard, so ticket 18 can read them
- [x] Four gates green

## Comments

**Built.** Code is in `src/lib/docs/`: `headingAnchors.ts` (the shared anchor rule), `docsChecks.ts` (the three checks), `surfaceMap.ts` (ids, map, exclusions, known gaps by ticket), `docsCoverage.test.ts`. The anchor rule passes 190 anchors captured from the live wiki (`wikiAnchors.fixture.json`).

**Guards bite.** Each fault was reinstated against the real docs in a scratch run, then restored:

| Fault | Failure |
|---|---|
| Drop the `memoryManager` map entry | `memoryManager has no docs section: add it to the surface map` |
| Rename Memory's "The Memory Manager" heading | `memoryManager maps to Memory#the-memory-manager, but heading #the-memory-manager is not on Memory` |
| Add `memoryManager` to a known-gaps group | `memoryManager maps to Memory#the-memory-manager, so remove it from the known gaps` |
| Rename "When Each Memory Happened" | `help topic game.memoryManager links Memory#when-each-memory-happened, but heading #when-each-memory-happened is not on Memory` |
| Restore `#-media-fields` in WorldFormat | `WorldFormat:61 links #-media-fields, but heading #-media-fields is not on WorldFormat` |
| Drop `\p{M}` from the anchor rule | 4 tests fail, including the WorldFormat wiki parity case |

**Links fixed.** 4 × `#-media-fields` (the wiki keeps the emoji's variation selector, so the anchor is `#%EF%B8%8F-media-fields`). 8 × `Page.md` links, which the wiki redirects to raw markdown.

**Limits, for later tickets.**
- Only ids in the dev-router ledger are checked. Settings → Prompts per-prompt tabs and Endpoints sub-tabs have no id, so ticket 08's "every Prompts tab" is not enforced by this gate.
- Nothing blocks adding a new id to the known gaps. The list shrinks because a mapped id fails while it is still a gap.
- `headingAnchor` keeps `_` from `_emphasis_` markup. No heading uses it today.
