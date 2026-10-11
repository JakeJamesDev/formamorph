# 16: Entity Stat Morph Bindings

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: adds morph targets to the entity model viewer, a separate 3D lane from the player's VRM, and a picker that reads the entity model's own shape keys.

Parent: [Entity Stats spec](../spec.md)

## What to build

An entity stat's morph bindings drive that entity's own model, as a player stat's bindings drive the player's VRM. The entity model viewer applies morph influences by shape-key name, with the alias rule the VRM uses. The in-game entity view and its model dialog pass that entity's live stat morphs, or its paged-back ones. On an entity stat, the Body Sliders picker lists the entity model's own shape keys. Ruling Q43, and the derived morph ruling from Q7.

## Acceptance criteria

- [ ] The entity model viewer applies morph influences by shape-key name, with the VRM's alias rule, on every mesh that carries the key.
- [ ] The in-game entity view and its model dialog show the entity's stat morphs for the turn on screen, live or paged back.
- [ ] On an entity stat, the Body Sliders picker lists that entity model's shape keys. A player stat's picker is unchanged.
- [ ] An entity with no model, or a model with no shape keys, shows no morph options and no errors.
- [ ] Verified in the preview with static frames on a model that has shape keys.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
