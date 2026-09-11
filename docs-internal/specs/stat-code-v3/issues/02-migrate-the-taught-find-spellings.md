# 02: Migrate The Taught Find Spellings

Status: ready-for-agent
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
