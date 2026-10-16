# 03: Trait Gates and Requirements on Owner Names

Status: done
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical migrate batch.

## What to build

A migrate batch of the wide refactor. Call sites and tests in trait gates, requirements and the owner resolver move from the bearer/holder names to the owner names. Local variables, comments and test names move too.

Every existing assertion stays unchanged. Renaming a test file or a describe line is fine; changing an expected value is not (S1).

Spec: Q6, S1.

## Acceptance criteria

- [ ] No call site in this area uses an old alias
- [ ] Moved suites keep every expected value
- [ ] Four gates green

## Blocked by

- 01, 02
