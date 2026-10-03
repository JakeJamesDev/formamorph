# 05: Global Workflow Doc and Config

Status: ready-for-human
Status note: Built in the ~/.claude repo, commit 1c06362 (hooks/implement-workflow.md; the /implement hook names it and resumes by path). The allow-list entry was dropped by Q35. Open for the user: the MEMORY.md / parallel-sessions-same-repo.md link edits, left uncommitted for the next sync.
Base: fb6a5467
Blocked by: 01, 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: ~/.claude (global doc, settings, CLAUDE.md) and this project's memory
Spec: ../spec.md (Rulings Q1, Q5, Q16; Implementation Decisions › Global workflow doc, Global settings, Memory and global CLAUDE.md)

Model rationale: instructions that a smaller model must follow exactly. The wording decides whether ticket 07 passes.

## What to build

**Workflow doc.** A global workflow doc, the twin of the prototype workflow doc, that a small model can follow step by step:

- It covers claim, enter, build, review, prepare, exit, pause, resume, and the recovery for each refusal.
- Every step names the exact tool call or command.
- It sends the model to the project's Implement protocol for gates and project files, and never names one project's gates or files.

**Settings.** The global settings allow-list the prepare command, so worktree sessions don't ask for permission on Windows.

**Global CLAUDE.md.** The Git section gets one line: tickets run in worktrees, and quick changes stay on the checked-out branch.

**Memory.** In this project's memory:

- Delete the branching-preference file.
- Trim `commit-granularity-rule` to main-checkout work.
- Move the Windows lessons from the junction and dev-server memories into the workflow doc.
- Update the memory index.

## Acceptance criteria

- [ ] The `/implement` hook output points at the workflow doc.
- [ ] Every step in the doc names its exact call or command, with placeholders filled from hook output.
- [ ] The doc names no Formamorph-specific gate, file, or path.
- [ ] The prepare command runs in a worktree session without a permission prompt.
- [ ] The global CLAUDE.md branching line is present, and the memory changes are made with the index updated.
- [ ] The doc tells the session to write the prepare message file in its scratchpad, because prepare refuses a message file inside the worktree (Q31).
- [ ] The `Status:` regex is defined once and shared by the `/implement` hook and the ticket worktree module. Before you edit the `/implement` hook, check `git -C ~/.claude status`: another session had uncommitted edits in it on 2026-10-03.
