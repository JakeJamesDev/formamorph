# 09: Contribution Queue (Server)

Status: ready-for-human
Base: 090652c
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The server side of contributed corrections.

- **Table:** one row per contribution, with these fields:
  - account, world id and passage text;
  - model id and version;
  - original clusters and the correction;
  - created time, review state (pending, accepted, rejected) and reviewed by.
- **Submit:** a `POST` route for a contribution. Only signed-in, age-attested accounts can submit. It is rate-limited and caps the passage size. It refuses banned accounts.
- **Staff routes:** queue, count, accept and reject, behind the existing staff gate.
- **Export:** a staff export of accepted contributions in the training kit's corpus format. Agree on the format with ticket 01, or read it from the kit's README if 01 has landed.
- **Deletion:** account deletion drops pending and rejected rows and keeps accepted ones (spec Q15, Q37).

## Acceptance criteria

- [x] Controller tests cover submit, queue, accept, reject and export end to end. Server `tests/corefContributions.test.js`: 27 tests through the real routes. Each guard was mutation-tested: 20 mutations, all caught.
- [x] Submits from unauthenticated, non-attested, banned and over-limit accounts are refused. The "who may submit" tests check 401, 403 `AGE_GATE_REQUIRED`, 403 for a suspended account, and 429 after 60 in an hour.
- [x] Account deletion removes pending and rejected rows only. Test "drops pending and rejected contributions and keeps accepted ones" runs the real `eraseUser`.
- [x] The export reproduces each accepted correction applied to its clusters. The "the export" tests cover a move, nobody, a merge, a new cluster, an overlap (Q38), a skipped quote (Q36) and code-point offsets.

## Landed

**Not verified**

- The real corpus build has not read the export. `corpus.py` from ticket 01 has not run on a line from `GET /api/coref-contributions/export`. The tests check the documented annotation format only.

**For you**

- Before contribution ships, get the legal check on keeping accepted passages after account deletion (Q15). The server keeps them with the account set null.
- Account merge leaves a duplicate pending row unowned when both accounts hold a pending row for the same world and passage. It then shows in the queue with no contributor. It is rare; reject it if you see it.
- Refresh the corpus with the PowerShell command in the server's `docs-internal/server.md`, under "Character Mentions contributions".
