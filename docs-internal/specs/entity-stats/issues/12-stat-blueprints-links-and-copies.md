# 12: Stat Blueprints, Links and Copies

Status: done
Blocked by: 04, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the Link model with live reads, per-field Overrides and stale detection, resolved per bearer through to runtime.

Parent: [Entity Stats spec](../spec.md)

## What to build

An author defines a stat once and gives it to many entities. The Stats tab gets a **Blueprints** group; a stat there is not a player stat. On an entity's Stats tab, **Link Stat** links a Blueprint and **Copy** copies one. A Link reads its Blueprint live and can override any field except the name, each with its own **Reset**, plus **Reset to Blueprint**; an Override is marked stale when the Blueprint changed that field since. An owner holds at most one Link per Blueprint, and each entity keeps its own value. Rulings Q6, Q17, Q18, Q19.

## Acceptance criteria

- [ ] The Stats tab has a system Blueprints group. A Blueprint stat is never a player stat: not seeded, not requested, not in chips, the panel or stat code.
- [ ] **Link Stat** links a Blueprint onto an entity; the Link reads the Blueprint live.
- [ ] A Link overrides any field except the name; each Override has **Reset**, and **Reset to Blueprint** drops them all.
- [ ] An Override whose Blueprint field changed since is marked stale.
- [ ] An owner can't hold two Links to one Blueprint.
- [ ] **Copy** creates a detached owned stat from a Blueprint.
- [ ] Linked stats resolve per bearer through to runtime: seeding, the stat request, the panel, chips and stat code.
- [ ] Migration and export round-trip Blueprints, Links and Overrides.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
