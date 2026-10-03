# 03: Prepare Command

Status: ready-for-human
Status note: Built in the ~/.claude repo, commit a9267fa (hooks/ticket-prepare.py, tests in hooks/test_prepare.py, mutation runner hooks/verify_prepare.py).
Base: b3907384
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: ~/.claude (global hooks)
Spec: ../spec.md (Rulings Q2, Q11, Q15; Implementation Decisions › Prepare command)

Model rationale: rebase, squash, and gate orchestration, where a wrong state lands on `main`.

## What to build

Inside a ticket worktree, one command makes the ticket ready to land. It takes the commit subject and body from a file. In order:

1. Refuse a dirty working tree.
2. Rebase onto local `main`.
3. Squash everything since the merge base into one commit.
4. Set the ticket's `Status:` to `ready-for-human` inside that commit.
5. Run the gate commands from the project's gate config file. Log their output, time each one, and print the totals.
6. Print the changelog hunk.
7. Write the prepared marker (branch, HEAD sha, and `main` sha), but only when every gate exits 0.

A rebase conflict stops the command and lists the conflicted files. A red gate names the failing command and its exit code, and no marker is written.

## Acceptance criteria

- [ ] After the command, the branch has exactly one commit on top of local `main`, and that commit holds the ticket's `Status: ready-for-human`.
- [ ] A dirty working tree is refused, and nothing changes.
- [ ] A red gate writes no marker and names the command and its exit code.
- [ ] Without a gate config file, no gates run and the marker is written.
- [ ] A rebase conflict stops the command and lists the conflicted files.
- [ ] The command prints the changelog hunk.
- [ ] Tests run against a temporary git repo through the command's CLI. Two bugs are proven by mutation: a marker written on red gates, and a missing squash. The suite time is reported.
