# 01: Tree Resolver For Stat Code Names

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Prefactor. Rewrites how the editor works out what a name is, which every later ticket reads. Opus at high: it replaces completion's regex chain without changing what completion offers.

## What to build

One tree-based resolver answers "what does the code name at this position". It returns the kind (global, member, stat, trait, placeholder, entity, dictionary, declared name, slot), the owner, the key and its range. It grows from the tree path the diagnostics already use for entries and owner stats. It covers dot and bracket forms on every owner-route route: `stats`, `owner.stats`, `entities[x].stats`, `persona.stats`, and the trait, placeholder, entity and dictionary maps.

Completion moves onto it. What completion offers does not change. A string that is not a map key, such as `x === "Health"`, resolves to nothing. Completion's catch-all that offers stat names inside any string stays a completion-only branch.

Spec: S1, O1; Implementation Decisions: One resolver, Card identity, Routes.

## Acceptance criteria

- [ ] The resolver returns kind, owner, key and range for every route and form above, dot and bracket
- [ ] `stats.X` in an entity's box resolves to the world stat; `owner.stats.X` to the owner's stat
- [ ] A non-key string resolves to nothing
- [ ] Completion's existing tests pass unchanged on the resolver
- [ ] The `stats.X` guard is proven by reinstating owner-scoped resolution once
- [ ] No changelog entry (no visible change); four gates green

## Blocked by

- None (can start immediately)
