# 19: Rename Kinds To Unique And Generic

Status: ready-for-agent
Blocked by: 14, 15, 16, 17, 18
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
- **Spec and tickets:** leave them as written. Q162 records the rename.

Do the rename with a script or the editor's rename, then read every hit of the old words by hand. A regex cannot tell an entity kind from an entity group.

Spec rulings: Q162, Q163.

## Acceptance criteria

- [ ] No source, test, fixture or bundled world stores or reads `individual` or `group` as an entity kind. The landing report gives the search used and its remaining hits, each explained.
- [ ] Entity groups, trait groups, stat groups, placeholder groups and history groups are unchanged, shown by their existing tests.
- [ ] A released world still migrates, and its entities get `unique` or `generic` by ticket 18's rule.
- [ ] The save's per-kind state uses the new names, and a new game saves and loads with them.
- [ ] No user-facing string, doc, wiki page or unreleased changelog entry calls a kind Individual or Group.
- [ ] The glossary defines Unique and Generic and drops the old entries.
