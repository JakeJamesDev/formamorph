# 01: Docs checks and surface map

Status: ready-for-agent
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

- [ ] The test fails for a surface id with no map entry and no known-gaps entry
- [ ] The test fails for a map entry whose heading does not exist
- [ ] The test fails for a known-gaps entry that has a valid map entry
- [ ] The test fails for a help topic whose docs heading does not exist
- [ ] The test fails for a broken link or anchor between docs pages
- [ ] Each guard is proven to bite: reinstate the fault in a scratch run and quote the failure
- [ ] The exclusion list names each staff or dev surface with a one-word reason
- [ ] The map and the lists live in production code with no dev-only guard, so ticket 18 can read them
- [ ] Four gates green
