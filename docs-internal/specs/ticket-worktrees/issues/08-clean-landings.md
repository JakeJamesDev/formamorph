# 08: Clean Landings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: ~/.claude (global hooks), plus this repo's local git hooks
Spec: ../spec.md (Rulings Q13, Q23, Q34; Testing Decisions)

Model rationale: race diagnosis across git hooks, Windows file handles, and the landing hook, plus a slow-suite investigation.

## What to build

Found in the review before ticket 07: two real landings both left leftovers behind, and ticket 07's bar requires that nothing is left.

- **Ticket 06** landed as `fad28b2b`. Its worktree folder came back with only `graphify-out/` in it. Its `ticket/` branch and state file remain.
- **formaquestion-settings 14** landed as `6c9a72e3`. Its worktree, `node_modules` junction, branch, and state file remain.

The suspected cause is the repo's graphify `post-commit` and `post-checkout` git hooks. Linked worktrees share them, so they run inside the worktree in the background, and one wrote `graphify-out/` after the removal.

After this ticket:

1. **Every landing ends clean.** Find the real cause of each leftover from runtime evidence before you fix anything. The fix must hold against background work that is still writing in the worktree.
2. **Graphify skips linked worktrees.** The graphify git hooks don't run in a linked worktree. Graph updates happen in the main checkout after the landing. If the hook text comes from `graphify hook install`, check whether a reinstall overwrites the fix, and say so.
3. **Orphan state files are swept.** A state file whose unit has no worktree, no branch, and no prepared marker gets removed. That covers claims that never entered a worktree. Five exist now: `ticket-worktrees-01`, `-03`, `-04`, `-05`, and `formaquestion-settings-17`. Choose a sweep point that never deletes a live claim.
4. **The hook suites are fast.** Today they take 157 s for 103 tests: landing 81 s for 15 tests, prepare 42 s, worktree entry 15 s, guards 12 s. Measure where the time goes. The suspected cause is the free-port check, because on Windows a connection attempt to a closed localhost port takes about 2 s. That would also slow real worktree setup.
5. **The two leftovers are cleaned through the flow.** Ticket 06 and formaquestion-settings 14 are cleaned with the recovery path (re-enter, then exit with `keep`, per Q32 and Q34), not by hand. Ask the user before you touch formaquestion-settings 14, because it belongs to another effort.

## Acceptance criteria

- [ ] The cause of each leftover is stated with the evidence that shows it.
- [ ] A test reproduces "background writer recreates the worktree folder after removal" and passes with the fix. It's proven by mutation.
- [ ] The graphify git hooks do nothing in a linked worktree and run as before in the main checkout.
- [ ] Orphan state files are removed, a live claim's state file survives, and both are covered by tests.
- [ ] The hook suite total is reported before and after, with the cause named. No test was deleted or weakened to get there.
- [ ] The ticket 06 and formaquestion-settings 14 leftovers are gone, and `git worktree list` and `git branch --list 'ticket/*'` show none of them.
