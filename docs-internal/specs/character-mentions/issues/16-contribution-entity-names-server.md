# 16: Contribution Entity Names (Server)

Status: ready-for-agent
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

- [ ] A submit with names stores them, and the queue returns them; a submit without names still works.
- [ ] Oversized or malformed maps are refused or trimmed, each case tested.
- [ ] The export output is byte-identical with and without names.
