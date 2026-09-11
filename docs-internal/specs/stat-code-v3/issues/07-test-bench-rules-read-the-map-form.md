# 07: Test Bench Rules Read The Map Form

Status: ready-for-human
Base: 7959d7a1
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Two static Test Bench rules parse stat names out of code with a regex over `s.name === "X"`. Extending that scan to the map form and fixing a pre-existing false positive on `self` is narrow, so Sonnet at medium effort.

## What to build

The Test Bench's stat-name scan recognizes the map form beside the comparison form: `stats.Vigour` and `stats["Vigour"]` name the stat `Vigour`, with brackets accepting any quote style. Two rules build on it.

The unknown-stat rule (`stat-code-unknown-stat`) reports a map lookup of a name no stat has, so it does not go quiet once the migration rewrites the comparison form away. A bracket key that is not a plain literal is skipped, as a template literal with `${}` is today.

The overrides-trait rule's "does the code read itself" check (`codeReadsSelf`) counts a `self` reference and a map lookup of the stat's own name as reading self. Today it sees only `currentStatId` and the name literal, so it warns falsely on `self.value` and would warn falsely on `stats.Own.value`.

## Acceptance criteria

- [x] `stats.Vigour` and `stats["Vigour"]` with a typo raise the unknown-stat row; the correct name raises nothing
- [x] A computed bracket key raises nothing
- [x] `codeReadsSelf` is true for `self.value`, `stats.Own.value`, and `stats["Own"].value`, and false for a lookup of another stat
- [x] The overrides-trait rule no longer warns on code that reads `self`
- [x] Rule tests cover each criterion; existing comparison-form cases still pass
- [x] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map

## Comments

**2026-09-11, implementation notes.**

- `statNamesInCode` gained a dot regex and a bracket regex for the map form; both feed the same unknown-stat check and the same own-name check `codeReadsSelf` already used, so neither rule needed its own map-aware logic.
- The dot regex excludes a call (`stats.find(`) so the pre-migration array API in older comparison-form fixtures isn't misread as a stat named "find" — caught by a mutation test on the guard, which backtracked past a naive `(?!\s*\()` lookahead onto a truncated identifier until a trailing `\b` was added.
- `codeReadsSelf` also gained a bare `/\bself\b/` check, matching the existing unguarded style of its `currentStatId` check in the same function.
- **Review folded in.** The new comment above the map-form regexes used the British "Vigour" spelling while the surrounding tests use "Vigor"; reworded to "Vigor" and trimmed from four lines to two, matching the file's existing comment length for a regex pair.
- **Known limit, not fixed.** `/\bself\b/` matches the bare word anywhere in the code text, including inside a string or comment, so code that never touches the sandbox's `self` but happens to contain the word could suppress a real overrides-trait warning. Judged acceptable: it mirrors the pre-existing `currentStatId` check's same unguarded style, and no world's stat code plausibly writes "self" outside that usage.
