# 16: Contribution Entity Names (Server)

Status: ready-for-human
Base: 7a4f873
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Staff see raw entity ids in the Mentions review tab, because a contribution carries ids only and staff have no copy of the world (spec Q71).

- **Submit:** accept an optional `entityNames` map, `{ entityId: name }`, on the contribution `POST`. Validate it: string keys and values, each bounded like the other ids, at most one entry per entity the clusters, cluster entities and corrections reference. Drop unknown keys.
- **Store:** keep the map with the row. A replacing send (Q35) replaces it too.
- **Queue:** return the map with each queue item.
- **Export:** the corpus export leaves it out; the annotation format is unchanged.
- **Deploy:** this lands and deploys before ticket 17.
- **Changelog:** none (staff tooling).

## Acceptance criteria

- [x] A submit with names stores them, and the queue returns them; a submit without names still works. Tests `stores the names and the queue returns them`, `takes a submit without names`, `replaces the names with a replacing send`.
- [x] Oversized or malformed maps are refused or trimmed, each case tested. A non-object map or an empty, non-string or over-200-character name is refused (400); unreferenced keys are dropped. Tests `refuses a map sent as %s`, `refuses a referenced name that is %s`, `drops names of entities the contribution does not reference`.
- [x] The export output is byte-identical with and without names. Test `leaves the export byte-identical` compares the raw export text before and after the row's names are cleared.

## Landed

**Not verified**

- Nothing left unticked. The migration on production's real database runs at deploy: step `corefEntityNames` adds `entity_names` (default `{}`) to the existing table, tested on an old-shape table.

**For you**

- Deploy the server before ticket 17 ships.
