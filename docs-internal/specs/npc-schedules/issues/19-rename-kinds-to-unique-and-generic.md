# 19: Rename Kinds To Unique And Generic

Status: done
Blocked by: 14, 15, 16, 17, 18, 20
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

The world shape and the save shape change. Say so in the landing report (export-shape reminder).

## What to build

The entity kinds are named Unique and Generic everywhere. Tickets 14 to 18 already wrote user-facing text with those names; this ticket renames the rest, so the code, the stored data and the glossary use one pair of words.

A wide, mechanical rename. It runs last so it never crosses a running ticket.

- **Stored kind value:** `individual` → `unique`, `group` → `generic`, in the world shape, the migration's output, the bundled worlds and every fixture. The form is unreleased: write no compat and no second migration step for the old words.
- **Save shape:** the per-kind state names follow the same rename.
- **Code:** types, helpers, variables, test names and comments that say Individual or Group for the entity kind. Leave every other use of "group" alone: entity groups (folders), trait groups, stat groups, placeholder groups and history groups are different things.
- **Text:** the glossary, the world format doc, the wiki pages, the unreleased changelog entries, the help topics and the script help. Rebuild the help vectors if a help topic changed.
- **A stale paragraph:** the Locations wiki page still says the Presence tab's Entities picker lists entities that "stand at Every Location they list" and that an edit changes the entity's Locations field. Tickets 14 and 16 each left it for the other. Rewrite it from what the picker does now: it lists Generic entities, and an edit adds or removes where the entity begins.
- **Spec and tickets:** leave them as written. Q162 records the rename.

Do the rename with a script or the editor's rename, then read every hit of the old words by hand. A regex cannot tell an entity kind from an entity group.

Spec rulings: Q162, Q163.

## Acceptance criteria

- [x] No source, test, fixture or bundled world stores or reads `individual` or `group` as an entity kind. The landing report gives the search used and its remaining hits, each explained. (`EntityKind` is `'unique' | 'generic'`, so tsc caught typed sites; searches below caught the untyped ones.)
- [x] Entity groups, trait groups, stat groups, placeholder groups and history groups are unchanged, shown by their existing tests. (Their tests ran unchanged and green in the gates; the diff touches none of their code.)
- [x] A released world still migrates, and its entities get `unique` or `generic` by ticket 18's rule. (`version.test.ts` routine-migration cases.)
- [x] The save's per-kind state uses the new names, and a new game saves and loads with them. (`GameplayContext.positions.test.tsx`: rolls, saves and loads `uniqueStates` and `genericStates`.)
- [x] No user-facing string, doc, wiki page or unreleased changelog entry calls a kind Individual or Group. (Grep of `docs/`, `src/` strings and the In Progress section.)
- [x] The glossary defines Unique and Generic and drops the old entries. (`CONTEXT.md`: Unique (entity kind), Generic (entity kind); old words in `_Avoid_`.)

## Landed

**Search used:** `git grep -n -E "kind: ?['\"](individual|group)['\"]|\"kind\": ?\"(individual|group)\"|[Ii]ndividual"` over `src`, `e2e`, `testing`, `scripts`, `docs`, `CONTEXT.md`. Remaining hits:
- `kind: 'group'` in trait links, gate conditions (`{ kind: 'group', id }`), group-tree nodes, stat links, the script variable tree and placeholder scopes. None is the entity kind.
- `"kind": "group"` in `emberwatch.json` and `src/lib/__parity__/ownerTreeLinks.json`: trait links.
- "individual" in `GamePrompts.ts`, `testing/parity/*.json` and `testing/baseline/fantasy-futanari.json`: plain English in prompts and world prose (out of scope by the spec session's answer).
- `Individual` and `Group (entity kind)` in the `CONTEXT.md` `_Avoid_` lines.

**Script surface:** scripts expose no kind. No entity entry field, sandbox global or script-help text names it. `docs/Scripts-Reference.md` already said Unique and Generic in prose.

**Not verified:** nothing left unticked.

**For you:**
- Export shape: the world's entity `kind` is now `"unique"` or `"generic"`, and the save's `individualStates`/`groupStates` are now `uniqueStates`/`genericStates`. Neither shipped (absent from v3.6.2), so no compat.
- `sectionVectors.json` re-embedded about 60 sections, most from earlier tickets' doc edits that had left vectors stale.
- `docs/WorldFormat.md`: the "older world file" callout describes the several-locations migration from before ticket 18's pronoun rule. Only its words were renamed here.
