# 14: Template tie fixes

Status: done
Base: 85587aab
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

From the review of ticket 13. A saved v3.1.2 template with a `trait(x)` slot must stay insertable, and a slot the template declares must win over the persona tie (Q42 as amended).

## Acceptance criteria

- [ ] A `trait(x)` slot whose `x` is not an `entity` slot reports no parse error, keeps **Insert** on and lists the world's traits, as on v3.1.2.
- [ ] In a template that declares an `entity` slot named `persona`, `trait(persona)` lists that slot's entity's traits. Without such a slot, it lists the persona traits.
- [ ] The Test Bench summary for entities with no code name matches the per-entity finding's wording ("no code name").
- [ ] Tests for both tie cases and the summary copy, each shown to bite. The changelog stays folded into this effort's In Progress entry.
