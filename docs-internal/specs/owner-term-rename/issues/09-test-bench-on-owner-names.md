# 09: Test Bench on Owner Names

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical migrate batch.

## What to build

A migrate batch of the wide refactor. Call sites and tests in the Test Bench rules and lens move from the bearer/holder names to the owner names. Local variables, comments and test names move too. The Test Bench warnings say owner (story 13).

Every existing assertion stays unchanged. Renaming a test file or a describe line is fine; changing an expected value is not (S1).

Spec: Q6, S1.

## Acceptance criteria

- [ ] No call site in this area uses an old alias
- [ ] Moved suites keep every expected value
- [ ] Four gates green

## Blocked by

- 02
