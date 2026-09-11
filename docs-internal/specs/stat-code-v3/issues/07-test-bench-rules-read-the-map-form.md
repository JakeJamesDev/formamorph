# 07: Test Bench Rules Read The Map Form

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Two static Test Bench rules parse stat names out of code with a regex over `s.name === "X"`. Extending that scan to the map form and fixing a pre-existing false positive on `self` is narrow, so Sonnet at medium effort.

## What to build

The Test Bench's stat-name scan recognizes the map form beside the comparison form: `stats.Vigour` and `stats["Vigour"]` name the stat `Vigour`, with brackets accepting any quote style. Two rules build on it.

The unknown-stat rule (`stat-code-unknown-stat`) reports a map lookup of a name no stat has, so it does not go quiet once the migration rewrites the comparison form away. A bracket key that is not a plain literal is skipped, as a template literal with `${}` is today.

The overrides-trait rule's "does the code read itself" check (`codeReadsSelf`) counts a `self` reference and a map lookup of the stat's own name as reading self. Today it sees only `currentStatId` and the name literal, so it warns falsely on `self.value` and would warn falsely on `stats.Own.value`.

## Acceptance criteria

- [ ] `stats.Vigour` and `stats["Vigour"]` with a typo raise the unknown-stat row; the correct name raises nothing
- [ ] A computed bracket key raises nothing
- [ ] `codeReadsSelf` is true for `self.value`, `stats.Own.value`, and `stats["Own"].value`, and false for a lookup of another stat
- [ ] The overrides-trait rule no longer warns on code that reads `self`
- [ ] Rule tests cover each criterion; existing comparison-form cases still pass
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map
