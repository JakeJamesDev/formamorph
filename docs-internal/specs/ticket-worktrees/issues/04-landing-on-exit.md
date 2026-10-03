# 04: Landing on Exit

Status: ready-for-human
Status note: Built in the ~/.claude repo, commit 9b23992 (hooks/worktree-landing.py, tests in hooks/test_landing.py, mutation runner hooks/verify_landing.py, one settings.json entry).
Base: 15075bd3
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: ~/.claude (global hooks)
Spec: ../spec.md (Rulings Q4, Q10, Q12, Q13; Implementation Decisions › Landing hook, Payload contract)

Model rationale: a hook that moves `main` and removes directories in a checkout that peers share.

## What to build

A ticket session calls `ExitWorktree` with `keep`. When the branch is `ticket/*` and its HEAD matches the prepared marker, the hook lands it from the main checkout. In order:

1. Check that `main` still equals the marker's `main` sha.
2. Revert the claim edit in the ticket file, but only if it is the file's only working-tree change.
3. Fast-forward `main`.
4. Cut the junction, remove the worktree, and delete the branch and the `launch.json` entry.
5. Report the landed sha.

Any other exit is a pause and changes nothing. Every refusal names the recovery: re-enter with `EnterWorktree` and the worktree `path`, then run prepare again. If git refuses the fast-forward because of a peer's uncommitted file, the hook reports it and forces nothing.

## Acceptance criteria

- [ ] A prepared ticket lands on `main` as one fast-forward commit. Its worktree, branch, junction, and launch entry are gone.
- [ ] The sentinel file in the main checkout's `node_modules` survives the removal.
- [ ] A moved `main` is refused with the recovery text, and nothing changes.
- [ ] An unprepared exit, a stale marker, or a non-ticket branch changes nothing.
- [ ] The claim edit is reverted only when it is the ticket file's only change. Otherwise the landing refuses and says why.
- [ ] A peer's uncommitted file that blocks the fast-forward is reported, and nothing is forced.
- [ ] Two parallel tickets that both add changelog lines both land, and the `union` driver keeps both lines.
- [ ] Tests drive the hook as a subprocess with the probe's `ExitWorktree` payload shape. Two bugs are proven by mutation: a missing `main` check, and a missing junction cut. The suite time is reported.
