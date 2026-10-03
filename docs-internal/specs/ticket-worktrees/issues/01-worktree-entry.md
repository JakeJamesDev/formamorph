# 01: Worktree Entry for /implement

Status: ready-for-human
Base: abd4cf3b
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: ~/.claude (global hooks and settings)
Spec: ../spec.md (Rulings Q6–Q10, Q16; Implementation Decisions › `/implement` hook, Worktree setup hook, Payload contract)

Model rationale: two hooks with git and NTFS-junction edge cases on Windows, plus a payload contract that must survive harness changes.

## What to build

A session runs `/implement <ticket>` and gets one exact instruction: call `EnterWorktree` with `name: "ticket-<ticket slug>"`. The claim (`in-progress`, `Base:`) lands in the main checkout, even when the session already runs inside a worktree. After the call, the worktree is ready without any model step:

- The branch is `ticket/<slug>`.
- `node_modules` is a junction to the main checkout's `node_modules`.
- The main checkout's `launch.json` has an entry for this worktree on a free port.

The hook output names that port, the branch, and the next step.

The global `worktree.baseRef` setting is `"head"`, so the worktree starts at the same commit as `Base:`.

## Acceptance criteria

- [ ] The `/implement` hook output contains the exact `EnterWorktree` call, with the ticket slug filled in.
- [ ] Run from a worktree cwd, the claim is written to the main checkout's ticket file, and the worktree's copy is unchanged.
- [ ] `Base:` equals the main checkout's `HEAD`.
- [ ] When the session is already in this ticket's worktree, the output says so and skips the enter step.
- [ ] The setup hook acts only on `worktree-ticket-*` branches. A prototype or ad hoc worktree is untouched.
- [ ] After the setup hook runs, the branch is `ticket/<slug>`, the junction points at the main `node_modules`, and exactly one `launch.json` entry exists with the worktree as cwd.
- [ ] Running the setup hook a second time repairs a missing junction or entry and changes nothing else.
- [ ] A payload with a missing field is a no-op with a stderr note.
- [ ] `worktree.baseRef: "head"` is in the global settings.
- [ ] Tests drive both hooks as subprocesses against a temporary git repo, with fixtures that copy the probe's payload shapes. Each guard is proven by mutation, and the suite time is reported.
