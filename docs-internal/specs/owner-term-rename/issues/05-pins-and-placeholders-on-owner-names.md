# 05: Pins and Placeholders on Owner Names

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical migrate batch.

## What to build

A migrate batch of the wide refactor. Call sites and tests in placeholder pins and chip values move from the bearer/holder names to the owner names. Local variables, comments and test names move too. A placeholder's parent is called the "parent placeholder" in prose; the saved `ownerId` key stays (Q7). A dictionary owns the placeholders it holds (Q12).

Every existing assertion stays unchanged. Renaming a test file or a describe line is fine; changing an expected value is not (S1).

Spec: Q6, S1.

## Acceptance criteria

- [ ] No call site in this area uses an old alias
- [ ] Moved suites keep every expected value
- [ ] Four gates green

## Blocked by

- 02
