# 05: Client: Supporter Copy library entries

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: wires ticket 04's rule into library records and the add-to-world paths.

Scope note (R20): ticket 04 owns the library-entry marker type and the rule for it, add-to-world included. This ticket wires the surfaces.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Save to Library from a Supporter Copy writes a library entry with its own local-only Supporter Copy marker and the source world's id (R7). The entry's export and publish are disabled with a tooltip, in the library editors and the Main Menu publish paths, and an Avatar carried over with it follows the same rule. The entry can be added only to its source world; every other world's add path shows it disabled (R9). Formaquestion's AI Context export is disabled with the reason while the open world is a Supporter Copy (R24).

## Acceptance criteria

- [ ] Saving an entity and a dictionary from a Supporter Copy writes marked library entries; saving from a plain world writes none.
- [ ] A marked entry's export and publish are disabled with a tooltip; an Avatar carried with it is blocked the same way.
- [ ] A marked entry can be added to its source world and is disabled in every other world's add path.
- [ ] Formaquestion's AI Context export is disabled with the reason while a Supporter Copy is open, and enabled otherwise.
- [ ] Each guard is shown to bite by reinstating the bug.
