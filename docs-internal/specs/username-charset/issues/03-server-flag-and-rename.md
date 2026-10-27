# 03: Server Flag and Rename

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q11, Q14, Q17, Q18); server spec: Flag, Account payload, Rename route

Repo: FormamorphServer

## What to build

A schema step flags every account whose name breaks the rule. It also flags every account in a case-folded group except the oldest. The signed-in account payload carries `usernameRename` with a cleaned suggestion. A rename route lets a flagged account pick a valid, free name and clears its flag. This ticket owns the flag column and the payload shape that tickets 04, 05 and 06 build on.

## Acceptance criteria

- [ ] On a seeded database, the step flags a spaced name, a dotted name and the newer account of a case-twin pair. It leaves the oldest twin, a valid name and the deleted-account placeholder unflagged.
- [ ] The step is safe to run again on a database where it already ran.
- [ ] Sign-in and the current-account read carry `usernameRename: { required: true, suggestion }` for a flagged account and `null` otherwise.
- [ ] The suggestion trims, turns whitespace runs into `_`, drops other characters and cuts to 20. It is `null` when shorter than 3 or taken ignoring case.
- [ ] The rename route applies ticket 01's check and codes, writes the name, clears the flag and returns the account payload.
- [ ] The rename route refuses an unflagged account.
- [ ] After a rename, the old name gives a profile "not found", and staff log rows keep the old name.
- [ ] The server README documents the rename route and the payload field.
