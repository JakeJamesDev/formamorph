# 13: Glossary, and full coverage

Status: done
Base: 9edac2fd
Blocked by: 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The docs are complete, and the coverage test holds them there with no exceptions (Q17).

1. **Glossary page** (Q19). A new docs page defines the terms a player meets: Entity, Persona, Opening, Starting Location, Placeholder, Chip, Pin, Blueprint, Copy, Override, Bearer, Trait modes, Pick Count, Tool, Avatar, Like, Install (one copy of the app, never the verb for getting a listing; that verb is download), Test Bench and the rest. Write it for players from the internal glossary. Leave out developer terms such as Turn Pipeline and AI Request Spec. Each term links the page that explains it.
2. **Cross-page pass.** Read every page once for contradictions between pages and for one term per concept. Fix what you find against the code.
3. **Deferred links.** Docs tickets that ran in parallel left out links to pages that did not exist yet. Add them. At least: the Settings page's Data section links Backup & Restore on the Saves and Backup page.
4. **Index pages.** The home page index and the wiki sidebar list every page, in a sensible order.
5. **Delete the known-gaps list.** The coverage test runs with the exclusion list only.

Recommended model rationale: the cross-page pass needs the whole corpus in view and judgment about which page is right.

## Acceptance criteria

- [x] The glossary page exists and every term links its home page
- [x] No developer-only term is on the glossary page
- [x] No two pages contradict each other on a statement found in the pass; each fix is listed in the commit body
- [x] The home index and the sidebar list every player page
- [x] The known-gaps list no longer exists, and the coverage test passes on the exclusion list alone
- [x] Every help topic links a docs heading
- [x] Four gates green
