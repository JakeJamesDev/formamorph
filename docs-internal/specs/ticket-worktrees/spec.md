# Spec: Ticket Worktrees

Status: ready-for-agent
Spec session: ticket-worktrees — spec
Status note: 9 tickets in issues/. 01–06 are ready-for-human. 08 (clean landings) and 09 (affected-only gates) came out of the pre-07 review and block 07. 07 is the Sonnet 5.5 acceptance run on formaquestion-settings 19. The spec session closed on 2026-10-03, so intent questions for 07 and 09 go to the user. The full-suite safety net is a separate effort.

Every `/implement` ticket runs in its own git worktree and lands on `main` as one commit. Hooks do the mechanical steps, so a smaller model such as Sonnet 5.5 can run the flow without hand-built git commands. Designed in a discussion session on 2026-10-02. A live probe in this repo checked the Claude Code behavior that the design depends on.

## Problem Statement

Commits per effort roughly tripled after 2026-09-17. Sept 1–16 averaged about 22 commits a day. The last four days averaged about 125. About 450 of the 1,277 commits since 2026-09-17 are bookkeeping: 167 "Fold … Review Findings", 143 "Record … Ruling", 66 "Hand … Over", and about 75 "Rule"/"Settle".

Three rules cause most of it:

- **The guarded amend almost always fails.** All sessions share one checkout and one `main`. A review takes minutes, and a peer commits in that time, so the HEAD-subject guard fails. The fallback is a follow-up commit, and the rules call that "correct, not a failure".
- **The handover is a separate step.** The `Status: ready-for-human` change comes after the fold-in, so it gets its own commit.
- **The shared index forces commit-at-once.** Staging and committing must happen in one command, so nothing collects related changes before a commit.

The user reads history in GitHub Desktop, so a unit split over three commits is noise. The safety rules behind this (the guard, the stage guard, the shared-index traps) exist because sessions share one working tree. They treat the symptom, not the cause.

## Solution

A ticket session works in its own worktree on a private `ticket/<slug>` branch. Inside it, the session commits, reviews, and amends freely, because no peer commits there. When the ticket is done, it lands on `main` as one commit with the code, tests, changelog line, review fold-ins, and the `Status:` change.

Hooks do the mechanical work:
- The `/implement` hook claims the ticket in the main checkout and gives the exact next tool call.
- A hook after `EnterWorktree` sets up the worktree.
- A prepare command squashes and checks the ticket.
- A hook after `ExitWorktree` lands it.

The model's manual steps are: enter the worktree, build, run the review, prepare, and exit.

Quick changes and spec-session work stay on the main checkout as today.

The workflow is global. It lives in `~/.claude` and works in any repo with a `docs-internal/specs/` tracker. Project-specific steps (gates, changelog, shared files) stay in each project's Implement protocol.

## Rulings

| # | Ruling |
|---|---|
| Q1 | `/implement` tickets run in a worktree. Spec-session work, rulings, and quick fixes stay on the main checkout. |
| Q2 | A ticket lands on `main` as exactly one commit. It holds the code, tests, changelog line, review fold-ins, and `Status: ready-for-human`. |
| Q3 | The closing review runs inside the worktree against `Base:`. Fold-ins amend freely on the private branch, with no HEAD guard. |
| Q4 | Landing is a fast-forward of `main` from the main checkout. If `main` moved, landing refuses and the session prepares again. It never merges and never force-moves `main`. |
| Q5 | The workflow is global (`~/.claude` hooks and a workflow doc). Project-specific steps stay in the project's Implement protocol. This is not a skill: a hook fires every time, and a skill fires only when the model chooses it. |
| Q6 | Claude Code's own `EnterWorktree` creates the worktree, so the session keeps its native protections: the exit check for unsaved work, junction-safe removal on Windows, `.worktreeinclude` copies, the lock, and resume into the worktree. Hooks do the steps before and after it. A `WorktreeCreate` hook is not used, because it replaces git creation and turns off `.worktreeinclude`. |
| Q7 | `worktree.baseRef` is `"head"` globally, so a worktree starts from local `HEAD`, and that commit becomes `Base:`. |
| Q8 | The `PostToolUse` hook on `EnterWorktree` creates the `node_modules` junction. The native `worktree.symlinkDirectories` setting is not used, because the probe showed it creates nothing on this machine. |
| Q9 | The same hook renames the branch from `worktree-ticket-<slug>` to `ticket/<slug>`. |
| Q10 | The claim (`in-progress`, `Base:`) is written in the main checkout before the session enters the worktree, so peers see it. Landing reverts that uncommitted claim edit before the fast-forward, because the landing commit carries the final `Status:`. |
| Q11 | The prepare command rebases onto local `main`, squashes to one commit, sets `Status: ready-for-human`, and runs the project's declared gate commands. It writes a prepared marker only when every gate exits 0. |
| Q12 | The `ExitWorktree` hook lands only a `ticket/*` branch whose HEAD matches its prepared marker. Any other exit is a pause and changes nothing. An `ExitWorktree remove` on an unlanded ticket is refused by Claude Code itself, because the branch has commits. |
| Q13 | Landing cuts the junction before it removes the worktree, then deletes the branch and the ticket's `launch.json` entry. |
| Q14 | A `PreToolUse` guard refuses a raw `git worktree remove` on a worktree that holds a junction. |
| Q15 | The changelog gets git's built-in `union` merge driver, so parallel changelog lines rebase without conflicts. The prepare command still shows the changelog hunk, because union can reorder lines. |
| Q16 | Every hook output names the exact next tool call or command, with all arguments filled in. The model never builds a git command for the worktree flow. |
| Q17 | The acceptance gate is one end-to-end run on Sonnet 5.5, on a real Formamorph ticket, with peers running as usual. |
| Q18 | This spec lives in the Formamorph tracker. Tickets that edit `~/.claude` commit in the `~/.claude` repo. |
| Q19 | The unit slug is `<spec slug>-<NN>` for a ticket and `<spec slug>` for a spec without tickets. The worktree name is `ticket-<unit slug>`, and the branch is `ticket/<unit slug>`. `EnterWorktree` names are capped at 64 characters, so the hook shortens the spec part to fit and never leaves a trailing dash. The setup hook records the branch → unit path mapping in a state file. Tickets 03 and 04 read that file and never parse the slug back. (Ticket 01) |
| Q20 | One per-project config file in the main checkout's `.claude/` folder holds the gates (ticket 03) and the dev-server template. The template is a command string with `{port}` and `{worktree}` placeholders and a base port. The hook builds the launch entry by running `cmd /c "cd /d <worktree> && <command>"`, and records `cwd` on the entry so the tests and ticket 04 can match it. The hook adds no tool-specific flags, so a project that needs `--force` puts it in its template. Without a config or a template, no launch entry is made, and the output says so. (Ticket 01) |
| Q21 | The port is the lowest one above the template's base port that no launch entry uses and nothing listens on. (Ticket 01) |
| Q23 | The config file is `.claude/ticket-worktrees.json` in the main checkout, shaped `{"gates": [...], "devServer": {"command", "basePort"}}`. Each unit has a state file at `<git common dir>/ticket-worktrees/<unit slug>.json`. The `/implement` hook writes `unit` and `base` at claim time. The setup hook adds `branch`, `worktree`, `main`, `port`, and `launchName`. Tickets 03 and 04 find the file from the branch (`ticket/<slug>` → `<slug>.json`), and ticket 04 deletes it on landing. (Ticket 01) |
| Q24 | A claim refreshes `Base:` to the main checkout's `HEAD` when the unit has no state file yet. Once the state file exists, `Base:` and the state file's `base` stay fixed, so a resume never moves the review's fixed point under existing commits. (Ticket 01 review) |
| Q25 | When `/implement` runs from another ticket's worktree, the instruction to exit with `keep` stands. If that branch is prepared, the exit lands it. A prepared marker means the ticket is ready to land, so this is the intended outcome. Ticket 04 reports the landed sha. (Ticket 01 review) |
| Q26 | Tickets 01–05 build directly in the `~/.claude` repo, not in a Formamorph worktree. The worktree flow is not live until ticket 06. (Ticket 03) |
| Q27 | Prepare prints the diff of each changed file whose git `merge` attribute is `union`, and adds no config key. That is exactly the set of files where union can reorder lines. (Ticket 03) |
| Q28 | Prepare squashes first, then rebases, so a conflict replays one commit. On a conflict, the rebase stays in progress, and the output names the files and the exact next commands: resolve, `git add <files>`, `git rebase --continue`, then run prepare again. (Ticket 03) |
| Q29 | The marker is a `prepared: {branch, head, main}` field in the unit's state file. Prepare clears it before doing anything else. The gate log is `<git common dir>/ticket-worktrees/<slug>.log`. "main" means whatever branch the main checkout has checked out. A detached main checkout is refused. (Ticket 03) |
| Q30 | Untracked files that git doesn't ignore count as dirty. Gates are command strings, run through the shell in the worktree root. The allow-list entry for prepare belongs to ticket 05. (Ticket 03) |
| Q31 | Prepare clears the marker before any refusal, a dirty tree included. A refusal never changes git state. The marker is written only when the gates are green, the branch has exactly one commit on top of main, and no gate edited a tracked file. `prepared.head` and `prepared.main` are full shas. Prepare also refuses these cases: the message file inside the worktree, a rebase already in progress, running in the main checkout, an unclaimed branch, a malformed `gates` list, and nothing to land. A failed squash restores the old head. (Ticket 03 review) |
| Q32 | Already landed: the marker matches the branch HEAD, main has moved, and main already contains that HEAD (`merge-base --is-ancestor`). In that case the landing skips the fast-forward, runs the full cleanup, and reports the landed sha. (Ticket 04) |
| Q33 | On a refusal, the landing hook writes the prepared commit's message to `<git common dir>/ticket-worktrees/<slug>.message` and names that path in the full prepare command it prints. Ticket 03 doesn't change. (Ticket 04) |
| Q34 | Cleanup that fails after a successful fast-forward reports the landed sha and the failed step, and keeps the state file. The recovery it names is to re-enter with `EnterWorktree` and the path, then `ExitWorktree` with `keep`. Under Q32, that second exit finishes the cleanup. The hook reads the worktree's real branch from git, not from `worktreeBranch` in the payload. If the fast-forward fails after the claim revert, the hook writes the claim edit back. (Ticket 04) |
| Q35 | No allow-list entry for prepare. The user's sessions run in auto mode, where the classifier approves the command. The Windows per-worktree approval note matters only in a mode that prompts. Ticket 07's audit shows any prompt that does appear. (Pre-07 review) |
| Q36 | One sweep also finishes a landed leftover: the state file has a prepared marker, main contains `prepared.head`, and git lists no worktree for the branch. The sweep cuts any link inside the folder before deleting it, then runs `branch -d`, drops the launch entry, and deletes the state file. (Ticket 08) |
| Q36a | The sweep decides liveness from files, not git. A folder is live when its `.git` is a directory, or a pointer whose gitdir still exists. A folder that git dropped fails that check even when its `.git` file survived. So a claim with nothing to sweep costs zero git calls. The landing's own listing check fails closed: a failed `git worktree list` counts as listed. The `post-merge` graphify trigger runs a full `update .`, so a pull of several commits is covered. (Ticket 08) |
| Q37 | When git has already unregistered the worktree, the landing still deletes the branch, the launch entry, and the state file. It retries the folder delete for about 5 s, and if the folder is still held, the next sweep removes it. There is no detached reaper process. With graphify skipping linked worktrees (Q39), this path is only a fallback. (Ticket 08) |
| Q38 | The sweep runs in both the `/implement` hook and the landing hook. An orphan claim is a unit with no worktree, no branch, and no prepared marker, whose ticket file in the main checkout is not `Status: in-progress`. (Ticket 08) |
| Q39 | Graphify's git hooks do nothing in a linked worktree. A `post-merge` graphify trigger in the main checkout only updates the graph after a landing's fast-forward. Sessions don't run `graphify update .` inside a ticket worktree. (Ticket 08) |
| Q40 | The slow suites come from process-spawn cost, not leaked handles. The hook suites take 157 s with no gap between the suite total and the sum of the tests, and the free-port theory was wrong. The fix is to cut redundant git calls in the hooks and the test helpers, which also speeds real use. There's no numeric target. Report before and after, both measured with no peer gates running. No parallel test runner. (Ticket 08) |
| Q41 | Ticket gates run only what the change can affect. Tests run with `vitest run --changed {base}` plus an always-run list for tests outside the module graph. Lint runs on changed files only. Typecheck and build stay full. Prepare fills in `{base}` with the `main` sha it rebased onto. The Implement protocol runs the gates once. The full suite runs at release time. (Pre-07 review: ticket 16's gates took 199 s, 137 s of it the full test suite.) |
| Q42 | Vitest 3.2.6's `--changed` has holes in this repo: a crash on an unqueried `.md` glob, `?query` imports dropped from the dependency walk, narrow full-suite triggers, and fixtures read by path. The test gate keeps a literal `vitest run --changed {base}` and closes the holes declaratively, without vitest internals. (1) Fix the crash in the test. (2) Widen `forceRerunTriggers` to the config's imports, `.env*`, and tsconfig. (3) Add a path trigger map in one file: a changed-path glob → the test files to add. It covers query-import targets (docs, default worlds) and committed fixtures read by path. A source-scan check fails when a `?query` import glob or a fixture path read by a test has no map entry. The gate runs `--changed` plus the map's hits plus the always-run list in one vitest run. (Ticket 09) |
| Q43 | Vitest intersects positional files with `--changed`, so the gate runs `vitest related --run <changed files> <map hits> <always-run tests>`. That is vitest's own selection path, and a listed test selects itself. Changed files come from `git diff --name-only --diff-filter=d {base}...HEAD`. Deleted files are left out, because their importers are themselves changed or fail typecheck. Map values may be any file, and hits expand until nothing new is added. CommonJS `require('./…')` edges are computed: the script adds the transitive closure of `.cjs` files that require a changed `.cjs`, with the same scan the completeness check uses. The check fails on a non-literal relative `require` in a `.cjs`. (Ticket 09) |
| Q22 | On a resume through `EnterWorktree` with `path`, a `ticket/*` branch counts as the same ticket. The setup hook repairs the worktree and changes nothing else. (Ticket 01) |

Verified by the probe on 2026-10-02 (Claude Code 2.1.284, Windows):

| Fact | Result |
|---|---|
| `PostToolUse` fires for `EnterWorktree` | ✅ `tool_response` has `worktreePath` and `worktreeBranch` |
| `PostToolUse` fires for `ExitWorktree` | ✅ `tool_response` has `action`, `worktreePath`, `worktreeBranch`, `originalCwd`, `discardedFiles`, `discardedCommits` |
| `baseRef: "head"` | ✅ The worktree started at local `HEAD`, not `origin/main` |
| Default branch name | `worktree-<name>`. The desktop branch prefix did not apply. |
| `symlinkDirectories` | ❌ No link was created, either nested or at the top level |
| `.worktreeinclude` | ✅ `CLAUDE.md` and `docs/agents/` were present |
| Session lock | Claude Code locks a worktree while a session is in it (`locked claude session <name> (pid N)`). `ExitWorktree keep` releases the lock before the tool returns, so a plain `git worktree remove` in the landing hook works. (Ticket 04) |
| Isolation | Inside the worktree, Claude Code refused a Bash command that ran `cmd`. Hooks run outside these checks. |

## User Stories

1. As the user, I want one commit per ticket on `main`, so that GitHub Desktop history reads as units of work.
2. As the user, I want review fold-ins inside the ticket's commit, so that "Fold … Review Findings" commits stop.
3. As the user, I want the `Status:` handover inside the ticket's commit, so that "Hand … Over" commits stop.
4. As the user, I want several tickets to run in parallel, so that worktrees don't cost the throughput that shared-checkout work gives today.
5. As the user, I want quick fixes and spec-session work to stay on `main`, so that small changes don't pay for worktree setup.
6. As the user, I want the workflow to work in every project with the same tracker, so that I don't set it up per repo.
7. As the user, I want Sonnet 5.5 to run a ticket end to end without errors, so that I can use a cheaper model for ticket work.
8. As the user, I want hooks to do the mechanical steps, so that a smaller model has fewer chances to get a tool call wrong.
9. As the user, I want my `node_modules` safe when a worktree is removed, so that the 2026-09-08 loss doesn't happen again.
10. As the user, I want to push only `main` from GitHub Desktop, so that ticket branches never need my attention.
11. As the user, I want ticket branches gone after landing, so that branches don't pile up like the 13 stale prototype worktrees.
12. As a ticket session, I want the claim written for me in the main checkout, so that peers see the ticket is taken.
13. As a ticket session, I want the hook to tell me the exact `EnterWorktree` call, so that I don't choose names or paths.
14. As a ticket session, I want the worktree to start at local `HEAD`, so that `Base:` matches what peers see on `main`.
15. As a ticket session, I want the junction and branch name set up after I enter, so that I can build right away.
16. As a ticket session, I want my own dev-server entry and port, so that my preview doesn't collide with a peer's.
17. As a ticket session, I want to commit as often as I like, so that I don't have to plan commits around peers.
18. As a ticket session, I want the review to see only my changes, so that peer commits don't add noise to the findings.
19. As a ticket session, I want to amend freely, so that fold-ins don't need a guard.
20. As a ticket session, I want one prepare command to rebase, squash, set the status, and run the gates, so that the landing state is right by construction.
21. As a ticket session, I want prepare to stop and say what failed, so that I fix the cause and not the process.
22. As a ticket session, I want landing to happen when I exit the worktree, so that I don't run git in the main checkout by hand.
23. As a ticket session, I want a landing refusal to say exactly how to recover, so that a moved `main` costs one re-prepare.
24. As a ticket session, I want a plain exit to keep my worktree, so that I can pause and resume a ticket.
25. As a ticket session, I want the changelog to rebase without conflicts, so that parallel tickets don't block each other on one file.
26. As a spec session, I want to keep working on the main checkout, so that rulings and spec edits stay visible to every ticket at once.
27. As a peer session, I want a landing never to rewrite or drop my commits, so that my `Base:` and history stay valid.
28. As a peer session, I want a landing to refuse when it would overwrite my uncommitted files, so that my edits are never lost.
29. As a future maintainer, I want each hook tested at its CLI seam, so that a Claude Code update that changes payloads shows up as a red test.
30. As a future maintainer, I want the guards proven by mutation, so that each test fails when its bug returns.

## Implementation Decisions

**Global workflow doc.** A new workflow doc next to the prototype one in the global hooks folder. It holds the worktree mechanics, which every project shares: claim, enter, build, review, prepare, exit, and recovery. It tells the model to follow the project's Implement protocol for gates and project files. It never names Formamorph's gates, changelog, or shared files.

**`/implement` hook (existing, extended).** It keeps the current claim, title, `Base:`, spec-session routing, and dirty-file warning. Changes:
- The claim always resolves the main checkout, even when the session already runs in a worktree. Hooks run outside the isolation checks.
- `Base:` is the main checkout's `HEAD`. With `baseRef: "head"`, the worktree starts at the same commit.
- The output names the workflow doc and gives the exact call: `EnterWorktree` with `name: "ticket-<ticket slug>"`.
- If the session is already in a worktree for this ticket, it says so and skips the enter step.

**Worktree setup hook (new, `PostToolUse` on `EnterWorktree`).**
- It acts only when `worktreeBranch` is `worktree-ticket-*`. Prototype and ad hoc worktrees pass through untouched.
- It renames the branch to `ticket/<slug>`, creates the `node_modules` junction to the main checkout, and adds a `launch.json` entry in the main checkout with a free port and the worktree as cwd.
- It returns context that names the port, the branch, and the next step.
- It is idempotent. On a resume it repairs a missing junction or entry and changes nothing else.

**Prepare command (new).** One command, run inside the worktree. It takes the commit subject and body from a file. In order:
1. Refuse when the working tree has uncommitted changes.
2. Rebase onto local `main`.
3. Squash everything since the merge base into one commit.
4. Set the ticket's `Status:` to `ready-for-human`.
5. Run the project's declared gate commands from a per-project config file. No file means no gates.
6. Print the changelog hunk.
7. Write the prepared marker (branch, HEAD sha, `main` sha) only when every gate exited 0.

On a rebase conflict, it stops and prints the conflicted files. The union driver keeps the changelog out of that list. Gate output goes to a log file, and the command prints the failing command and its exit code. The command times each gate and prints the totals.

**Landing hook (new, `PostToolUse` on `ExitWorktree`).**
- It acts only when `action` is `keep`, the branch is `ticket/*`, and the marker matches the branch HEAD. Otherwise it returns nothing.
- When it acts, it runs in the main checkout:
  1. Verify that `main` still equals the marker's `main` sha.
  2. Revert the claim edit to the ticket file in the working tree, but only if that is the only change to that file.
  3. Fast-forward `main`.
  4. Cut the junction, remove the worktree, delete the branch and the `launch.json` entry.
- It reports the landed sha.
- Every refusal names the recovery: re-enter with `EnterWorktree` and the worktree `path`, then prepare again.
- A fast-forward that git refuses because of a peer's uncommitted file is reported, and nothing is forced.

**Junction guard (new, `PreToolUse` on Bash).** It refuses `git worktree remove` when the target holds a junction or symlink, and names the safe path. It lives next to the existing hard-delete guard and follows its block-log pattern.

**Global settings.**
- `worktree.baseRef: "head"`.
- Allow-list entries for the prepare command, so worktree sessions don't prompt on Windows. Approvals given inside a worktree stay with that worktree.

**Project side (Formamorph).**
- Implement protocol steps 4–7 are rewritten around prepare and exit. The guarded amend stays only for main-checkout work.
- A gate config file lists the four gates.
- `.gitattributes` gets `docs/Changelog.md merge=union`.
- The project CLAUDE.md "Parallel sessions" and "Commits" sections need the user's edit. The ticket drafts the text in chat.

**Memory and global CLAUDE.md.**
- The branching preference moves into the global CLAUDE.md Git section as one line: tickets run in worktrees, quick changes stay on the checked-out branch. The project memory file for it is deleted.
- `commit-granularity-rule` is trimmed to main-checkout work.
- The Windows lessons in `worktree-junction-trap` and `worktree-dev-server-cwd` move into the global workflow doc.

**Payload contract (from the probe).** `EnterWorktree` → `tool_response.worktreePath`, `tool_response.worktreeBranch`. `ExitWorktree` → `tool_response.action`, `worktreePath`, `worktreeBranch`, `originalCwd`. The hooks read only these fields. A missing field is a no-op with a stderr note, never a crash.

## Testing Decisions

**What a good test is here.** Each test drives a hook or command the way the harness does: JSON on stdin, JSON on stdout, against a real temporary git repo. It asserts what is on disk and in git afterwards: branches, refs, files, the junction, the claim line. No test calls internal functions to check how they are built. Payload fixtures copy the real shapes recorded by the probe.

**Seams (agreed with the user):**
1. **`/implement` hook and worktree setup hook.** Covers: the claim lands in the main checkout when the cwd is a worktree; `Base:` matches; the exact `EnterWorktree` call is in the output; the branch is renamed; the junction exists and points at the main `node_modules`; the `launch.json` entry is added once; prototype worktrees are untouched. Prior art: the implement hook tests in the global hooks folder.
2. **Prepare command and landing hook.** Covers: squash to one commit; `Status: ready-for-human` in that commit; a red gate writes no marker; a dirty tree refuses; a fast-forward lands; a moved `main` refuses with the recovery text; a pause exit changes nothing; the claim edit is reverted only when it is the only change; the junction is cut before removal and the main `node_modules` sentinel survives; a peer's uncommitted file blocks the fast-forward safely; a changelog rebase with parallel lines resolves through union. Prior art: the ticket workflow tests and their mutation runner.
3. **Junction guard.** It refuses a raw remove with a junction present and allows one without. Prior art: the guard tests in the global hooks folder.
4. **End to end on Sonnet 5.5 (acceptance).** One real Formamorph ticket, chosen by the user, with peers running as usual. Pass means all of these:
   - one commit on `main` for the ticket
   - zero manual git commands in the worktree flow, audited from the transcript
   - zero failed tool calls caused by the workflow
   - no peer file touched
   - the worktree, branch, junction, and launch entry are gone afterwards

   Each deviation in the transcript becomes a hook or doc fix, then the run repeats.

Guards are proven by mutation: reinstate each bug (no junction cut, no `main` check, marker written on red gates) and confirm a named test fails. Each suite run is timed and the time is reported. Tests run on Windows, because the junction behavior is Windows-specific.

## Out of Scope

- Changes to spec-session commit batching ("Record … Ruling" commits). This was discussed and not chosen.
- GitButler, Jujutsu, or any tool that replaces git or GitHub Desktop.
- Cloud sessions and remote execution.
- Cleaning up the existing stale prototype worktrees. That is a separate task for the user to decide on.
- Landing through pull requests. Landing is a local fast-forward of `main`.
- Prototype worktrees. They keep their own workflow, apart from the shared junction guard.

## Further Notes

- The landing hook runs git in the main checkout from a hook. That works because hooks run outside the worktree isolation checks. A future Claude Code version could close that path, and the setup hook's tests would show it.
- `symlinkDirectories` may work on a machine with Windows Developer Mode on. If a later probe shows it working here, the junction step can be retired.
- Gate runs double per ticket (before review and in prepare), and parallel tickets each run their own suite. Watch machine load during the end-to-end run, and say so if it hurts.
- The landing hook cuts every link in the worktree before removal. A tracked symlink would be cut too and would then block the removal. This machine can't create symlinks (`core.symlinks` is false), so the case can't happen here. Revisit it before using the flow on a machine that can.
- On Windows, approvals given inside a worktree stay with that worktree. Missing allow-list entries show up as repeated prompts in the end-to-end run.
