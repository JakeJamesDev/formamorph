# 03: Server Flag and Rename

Status: done
Base: 977dcc1
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q2, Q11, Q14, Q17, Q18); server spec: Flag, Account payload, Rename route

Repo: FormamorphServer

## What to build

A schema step flags every account whose name breaks the rule. It also flags every account in a case-folded group except the oldest. The signed-in account payload carries `usernameRename` with a cleaned suggestion. A rename route lets a flagged account pick a valid, free name and clears its flag. This ticket owns the flag column and the payload shape that tickets 04, 05 and 06 build on.

## Acceptance criteria

- [x] On a seeded database, the step flags a spaced name, a dotted name and the newer account of a case-twin pair. It leaves the oldest twin, a valid name and the deleted-account placeholder unflagged. `tests/usernameRename.test.js`: `flags rule-breaking names and every case twin but the oldest` (also a same-second tie on id); twin, placeholder and order mutations each turned it red.
- [x] The step is safe to run again on a database where it already ran. `changes nothing on a second run, even after a flag was cleared`; `bootSchema` fresh/legacy shape tests green.
- [x] Sign-in and the current-account read carry `usernameRename: { required: true, suggestion }` for a flagged account and `null` otherwise. `the account payload` block: login under the old name and `/me`, flagged and unflagged.
- [x] The suggestion trims, turns whitespace runs into `_`, drops other characters and cuts to 20. It is `null` when shorter than 3 or taken ignoring case. `suggestion: …` table, `suggests nothing when … taken ignoring case`, newer twin, own name; mutation-checked.
- [x] The rename route applies ticket 01's check and codes, writes the name, clears the flag and returns the account payload. `writes the name, clears the flag…` (then signs in with the new name), `USERNAME_INVALID`, `USERNAME_TAKEN` cases.
- [x] The rename route refuses an unflagged account. `refuses an unflagged account`, `…before it judges the name`, `refuses a second rename`; pre-check mutation turned red.
- [x] After a rename, the old name gives a profile "not found", and staff log rows keep the old name. `leaves the old name reaching no profile`, `keeps the old name in earlier staff log rows and records the rename`.
- [x] The server README documents the rename route and the payload field. Endpoint line, refusals table and a "Rename flag" paragraph; read, not run.

## Landed

**Not verified**

- None unticked. The server spec's "the next write passes" after a rename needs ticket 04's gate; ticket 04 should assert it.
- The flag counts on live data are unchecked until deploy. The step logs `Schema: applied usernameRename` and writes no count.

**For you**

- None. Rename-flag payload, route path (`POST /api/auth/username`) and audit action `username_changed` are in the server README for tickets 04–07.
