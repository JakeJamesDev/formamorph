# 15: Cards For Routes That Reach Several Entities

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Applies Q34's rule to trait and placeholder cards. Opus at medium: the every-holder lookup from ticket 12 already exists.

## What to build

A route can reach a different trait or placeholder on each entity: `persona.traits.X` with several playable entities, or `owner.traits.X` and `owner.placeholders.X` in a Blueprint box. Today its card shows the first holder's item only, which reads as the only item the code reaches.

The card follows Q34. When every reached entity holds the same item (the same world trait, or Copies of one Blueprint placeholder), the card shows that item, plus a Bearers list of the reached entities. Otherwise it shows only the Bearers list of who holds an X, with no trait or placeholder rows. With no reached holder, no World Details. Ticket 12's every-holder lookup supplies the holders.

Spec: Q34, Q37, T12-4.

## Acceptance criteria

- [ ] `persona.traits.Brave` where every playable entity holds the world Brave shows the Brave card with a Bearers list
- [ ] `persona.traits.Brave` where Tom links the world Brave and Ann owns her own shows only the Bearers list, with no trait rows
- [ ] `owner.traits.X` and `owner.placeholders.X` in a Blueprint box follow the same rule
- [ ] Guard bites: reinstating the first-holder card fails the mixed-holder test
- [ ] Changelog fragment; four gates green

## Blocked by

- None (can start immediately)
