# 02: Junction Guard for Worktree Removal

Status: ready-for-human
Status note: Built in the ~/.claude repo, commit 2a6ce3c (hooks/junction-guard.py, tests in hooks/test_guards.py, one settings.json entry).
Base: abd4cf3b
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: ~/.claude (global hooks)
Spec: ../spec.md (Ruling Q14; Implementation Decisions › Junction guard)

Model rationale: one small guard that follows the pattern of the existing hard-delete guard.

## What to build

The guard refuses a Bash command that runs `git worktree remove` on a worktree that holds a junction or symlink. The refusal names the safe path: cut the link first, or exit through `ExitWorktree`. A worktree without links is removed as usual. Each block is logged the same way as the hard-delete guard's blocks.

## Acceptance criteria

- [ ] `git worktree remove` on a worktree with a junction is refused, and the message names the safe path.
- [ ] `git worktree remove` on a worktree without links is allowed.
- [ ] Each block is appended to the existing hook block log.
- [ ] Tests follow the existing guard tests. The guard is proven by mutation, and the suite time is reported.
