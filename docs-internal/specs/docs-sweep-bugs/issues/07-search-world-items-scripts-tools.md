# 07: Search World Covers Items, Scripts and Tools

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three new search sources, each with its own fields and its own jump-to target in the editor.

## What to build

**Search World** skips the Items, Scripts and Tools tabs. Add them to the search sources. Items search their name, descriptions, unidentified name and description, and image tags. Scripts search their name and code. Tools search their name, description and parameter descriptions. Each hit opens its row through the editor's existing search-target navigation, as hits on other tabs do. Media holds no text of its own and stays out.

Spec: Implementation Decisions "Search World". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] A world-search test with text only in an item, a script and a Tool fails today (no hits), then passes with one hit on each tab: `worldSearch.test.ts` "finds text in an item, a script and a Tool, one hit on each tab", red before the build (7 of 7 new cases failed), green after.
- [x] A hit on each new tab opens that tab with its row selected (component test): `WorldEditor.findLogicTabs.test.tsx`. Item hits also open the panel tab that holds the field (Descriptions; Scripts for an item script). Mutation: with the find hint dropped, both item cases go red.
- [x] Each new field obeys the current Simple/Advanced mode, as the other tabs' fields do (test): same file. Advanced counts 4 hits for "bell", Simple counts 1 (Items only). The filter is per tab only, per ruling 3.
- [x] The WorldEditor page's search sentence lists the searched tabs and says Media holds no searchable text; the docs tests are green: [WorldEditor.md](../../../../docs/WorldEditor.md) Find and Replace, plus a line on the Tool-name skip. `src/lib/docs`, `ownerTermGuard`, `playerInputRename`, `copySweep` and `changelogFormat`: 386 of 386 pass.
- [x] A changelog fragment under Minor / Fixed / 👤: `docs-internal/changelog.d/docs-sweep-bugs-07.md`.

## Landed

Rulings from the spec session: search every Scripts-tab row and item scripts (as Items hits); new fields take Replace; mode filter per tab only; a Replace into a Tool name is skipped when the Save Tool name check refuses it.

The review found that one Replace pass across a stat's own field and that stat's script could drop the field edit. A world stat's or trait's scripts now write through that stat's or trait's own record. Tested, with a mutation check.

**Not verified**
- None of the criteria is unverified.
- The single-match **Replace** notice for a refused Tool name (`EditorFindBar`) has no test. Replace All's count is tested in the lib.

**For you**
- A Tool hit selects its row, but the Tool detail view shows no box for the name or the parameter descriptions, so those hits mark no field. Open a world Tool and search its parameter text in the World Editor.
- In Simple mode, an item hit inside a script counts and opens the item on Profile, because the Scripts panel tab is hidden. Search an item script's code in Simple mode.
