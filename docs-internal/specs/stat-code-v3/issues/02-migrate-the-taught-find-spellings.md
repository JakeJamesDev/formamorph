# 02: Migrate The Taught Find Spellings

Status: ready-for-human
Base: f8b199db
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

A source rewrite over arbitrary author code has to match every spelling the app taught and nothing else, and stay idempotent. The edge cases are the whole ticket, so Opus at high effort.

## What to build

A world migration rewrites, inside every stat's `code`, the two lookup spellings the templates and the guide ever taught. A `find` on `name` against a string literal becomes a bracket index with that literal, keeping the author's quotes: `stats.find(s => s.name === 'Stamina')` becomes `stats['Stamina']`. A `find` on `id` against `currentStatId` becomes `self`. Whitespace, the arrow parameter's name, `===` versus `==`, and an optional-chain or field tail are all matched; anything else is left alone. A declaration named `self` whose initializer the rewrite turned into bare `self` is deleted whole, for `const`, `let`, and `var`; a declaration of any other name keeps the alias, so `const me = …` becomes `const me = self;`.

The migration is idempotent, lives with the other world migrations, and runs at the import boundary and at world load, gated on a world version the user sets at release. Bundled worlds are edited by hand to the map form and ship that way. Code the migration cannot rewrite fails at run time and the Test Bench's execution row names the stat.

## Acceptance criteria

- [ ] The `name` form rewrites to a bracket index with the original literal and quotes, with and without a `?.value` or `.value` tail
- [ ] The `id` form rewrites to `self`; `const self = …` is deleted whole and `const me = …` becomes `const me = self;`, for `const`, `let`, and `var`
- [ ] Whitespace, parameter name, and `==` variants all match; unrelated code is untouched byte for byte
- [ ] Running the migration twice equals running it once
- [ ] The migration is version-gated; the gate value is left for the user's release call and named in the closing response
- [ ] Bundled worlds carry the map form and run in the sandbox
- [ ] A migrated sample from each bundled world runs and returns the same value as before the rename
- [ ] Migration tests beside the version module cover every criterion above
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map

## Comments

**2026-09-11, implementation (commits `f1678794` and the review-findings follow-up).**

Scope changes, agreed with the user and the sibling sessions:

| Criterion | Where it landed |
|---|---|
| Bundled worlds carry the map form and run in the sandbox | Ticket 01 hand-edited the four code strings, in the dot form (`stats.Power.value`). |
| A migrated sample from each bundled world returns the same value | Kept here. The test migrates each 2.14.0 string and compares the returned values, because the migration emits the bracket form. |
| Saves | Out of scope. Ticket 08 makes saves read stat code from the world, so saves never need a rewrite. |
| Version gate | The existing `world.version === APP_VERSION` block in `migrateWorld`. The gate value is `APP_VERSION`, which the user bumps at release. |

How it works:

- `src/lib/statLookupMigration.ts` walks the lezer JS tree, so it never touches strings, comments, or regex literals. The parser already ships in the main bundle through the editor.
- A `self` declaration inside a `for` header is kept, because deleting it would break the loop. The code then fails at run time.

Untaught shapes the rewrite does not make safe (from the spec review):

- `let self = <lookup>; self = …` loses its declaration by the spec's rule. The reassignment then throws, because the sandbox's `self` is a `const`.
- `const self = (<lookup>)` and `if (x) var self = <lookup>` keep their declarations and fail at run time.
- A local variable named `stats`, or a user variable named `self`, is not scope-checked.
- `<id lookup>.value = 5` becomes a real `self.value` write.
