# 08: Clean Landings

Status: ready-for-human
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

- [x] The cause of each leftover is stated with the evidence that shows it.
- [x] A test reproduces "background writer recreates the worktree folder after removal" and passes with the fix. It's proven by mutation.
- [x] The graphify git hooks do nothing in a linked worktree and run as before in the main checkout.
- [x] Orphan state files are removed, a live claim's state file survives, and both are covered by tests.
- [x] The hook suite total is reported before and after, with the cause named. No test was deleted or weakened to get there.
- [x] The ticket 06 and formaquestion-settings 14 leftovers are gone, and `git worktree list` and `git branch --list 'ticket/*'` show none of them.

## Findings

Rulings Q36–Q40 came from this ticket. The hook code is in the `~/.claude` commit "Make Ticket Landings End Clean".

**Ticket 06.** The landing output said "Removing the worktree failed: error: failed to delete '…/ticket-ticket-worktrees-06': Permission denied". Graphify job `4c0ae37a` (cwd: that worktree) started at 11:35:39 from the prepare commit's `post-commit` hook. It ran until 11:39:55. The landing ran at 11:39:32. Git deleted the contents and its own record of the worktree, but not the folder that the job held as its cwd. The job then wrote `graphify-out/`. Cleanup stopped before `branch -d`, so the branch and state stayed. The "Uncommitted files" list ran `git status` in a folder git no longer knew, so it listed the main checkout's files. Formaquestion-settings 18 hit the same failure at 12:27 ("Directory not empty").

**Formaquestion-settings 14.** No hook failed. Its session ran `git merge --ff-only ticket/formaquestion-settings-14` by hand at 07:28:02. The landing hook did not exist until 11:13. No cleanup ran.

**Fix.**
- The graphify `post-commit` and `post-checkout` hooks exit in a linked worktree (`$GIT_DIR/commondir` exists). A new `post-merge` hook rebuilds the graph after a landing, in the main checkout only. The guard sits outside graphify's markers. A real `graphify hook install` (0.9.55) run on copies of these hooks kept it, and the 0.9.55 template also skips linked worktrees on its own. That install writes only `post-commit` and `post-checkout`, so it leaves `post-merge` alone.
- When git drops the worktree but a process still holds the folder, the landing still deletes the branch, the launch entry, and the state. It retries the folder for 5 s. The next sweep removes a folder that stays held.
- A sweep runs at every claim and every landing. It finishes landed units, drops orphan claims, and removes held folders. It never touches an in-progress ticket, or a folder whose `.git` still points at a git record. Its deletes never follow a link. These checks read files, so a claim with nothing to sweep runs no git.

**Leftovers.** The first landing on the new code (formaquestion-settings 17, 12:41) swept ticket 06, formaquestion-settings 18, and the orphan claims `ticket-worktrees-01`, `-03`, `-04`, and `-05`. Formaquestion-settings 17 was live by then and landed clean. Formaquestion-settings 14 was cleaned with the user's approval: `EnterWorktree` with its path, then `ExitWorktree` with `keep`.

**Suite speed.** The free-port check was not the cause. It binds and never connects, at 0.25 ms per port. The cost is process spawns: about 2,000 per full run, at 45 ms each when the machine is idle and over 100 ms while peer gates run. The same suite took 60 s, 105 s, and 293 s in three loaded runs. Measured back to back, with no peer session busy:

| | Before | After |
|---|---|---|
| Shared 108 tests | 116.9 s | 107.4 s |
| Full run | 117.7 s (108 tests) | 127.3 s (112 tests) |
| Process spawns | 2,033 | 2,045 |

The four new tests take 19.1 s, mostly the held-folder waits. No test was deleted or weakened.
