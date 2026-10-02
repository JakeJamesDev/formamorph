# 06: Remove old routes

Status: done
Base: 788e5fdf
Blocked by: 04, 05, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Parent: [Stat Code Entities spec](../spec.md)

## What to build

The contract step. Remove `placeholders.Owner.Name`, the six flat clock globals and `currentStatId` (Q12, Q15, Q16). Released worlds keep working because `migrateWorld` rewrites their stat code to the new routes at load (Q19).

## Acceptance criteria

- [ ] `placeholders` holds only the world's own placeholders. The bare-name and owner-name claim rules are gone (Q12).
- [ ] The flat clock globals and `currentStatId` are no longer injected.
- [ ] `migrateWorld` rewrites old routes in every stat's code through the rename tooling. The rewrite is idempotent and runs at every import boundary.
- [ ] A world written for v3.1.2 that uses each old route loads and runs with the same results. The one exception is an owner out of play, which reads blank (Q38).
- [ ] The bare-name shortcut to nested world rows is gone, and the rewrite gives each one its full path (Q36). An owned bare name is rewritten to its owner's path (Q37).
- [ ] Templates, snippets and the stat code help use only the new routes. This includes the built-in templates that read flat `deltaHours` and `elapsedHours`, and the `Date` and `now` completion text that points at "deltaHours and friends".
- [ ] Tests for the rewrite and for the removed routes, each shown to bite. The changelog line is in In Progress.
