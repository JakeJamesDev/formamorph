# 06: Stat Code on Owner Names

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: the batch overlaps freshly landed hover-card code. **Start only after code-hover-cards ticket 16 has landed**; it edits the same files.

## What to build

A migrate batch of the wide refactor for stat code, the code world lookup and the code cards. It also folds in the hover-card spec review's naming findings (Q11):

- The hover-card "holder" names and records get owner names.
- The use-row type named for stats, though it carries every kind, gets a kind-neutral name.
- The shared row builder moves out of its stats-only home.

Every existing assertion stays unchanged. Renaming a test file or a describe line is fine; changing an expected value is not (S1).

Spec: Q6, Q11, S1.

## Acceptance criteria

- [ ] No call site in this area uses an old alias
- [ ] The three review naming findings are resolved
- [ ] Moved suites keep every expected value; four gates green

## Blocked by

- 02
