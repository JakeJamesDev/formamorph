# 09: Contribution Queue (Server)

Status: ready-for-agent
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
- **Deletion:** account deletion drops pending rows and keeps accepted ones (spec Q15).

## Acceptance criteria

- [ ] Controller tests cover submit, queue, accept, reject and export end to end.
- [ ] Submits from unauthenticated, non-attested, banned and over-limit accounts are refused.
- [ ] Account deletion removes pending rows only.
- [ ] The export reproduces each accepted correction applied to its clusters.
