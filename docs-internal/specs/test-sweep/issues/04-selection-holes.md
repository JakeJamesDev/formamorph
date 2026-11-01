# 04: Selection Holes

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: A small code change; the judgment is in auditing the hand-kept lists.

Parent: [Test Sweep spec](../spec.md)

## What to build

Known gaps in affected-test selection close before anything else changes it (Q2). A deleted file must count toward path triggers: today, deleting a doc or world fires none. Audit the always-run, graph-covered and path-trigger lists against what each test really reads, and fix or remove wrong entries.

Check the working tree before editing the selection scripts, because another session had uncommitted edits there on 2026-11-01. This ticket does not narrow selection.

Rulings: Q2, Q21, Q26.

## Acceptance criteria

- [ ] Deleting a file matched by a path trigger selects that trigger's tests; a test proves it, and removing the fix turns it red.
- [ ] Each audited list entry was checked, and the changes are listed in the ticket.
- [ ] No test that was selected before leaves the selection for an unchanged input, except a listed wrong entry.
