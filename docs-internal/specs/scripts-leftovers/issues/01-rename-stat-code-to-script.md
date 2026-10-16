# 01: Rename Stat Code To Script

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical rename with one existing guard to carry across.

## What to build

"Stat code" leaves the code that checks scripts (Q6). The Test Bench check, its runner and its component take script names, and so do their files and tests. The help window's offered code-test function takes a script name, and its purpose and use-when lines say "script." The help rider line that says stat code says script. Behavior does not change.

## Acceptance criteria

- [ ] The bench check, its runner, its component and their files and tests use script names. No identifier or file in those paths says stat code.
- [ ] The help code-test function name, its purpose line, its use-when line and the rider say "script."
- [ ] The name-drift test still guards the one name producer under the new names, and it still fails when a consumer derives its own name.
- [ ] No player-visible string in the touched paths says "stat code."
- [ ] The four gates are green.
