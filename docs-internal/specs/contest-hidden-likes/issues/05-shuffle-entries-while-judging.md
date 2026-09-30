# 05: Shuffle contest entries while judging

Status: ready-for-human
Base: 859c77f1
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Implementation Decisions › Client ordering)

Model rationale: a small change to one ordering function and its existing tests.

## What to build

A player opens the contest tab while the contest is judged, and entries appear in shuffled order, as they do while it is live. Order by likes, with the podium first, starts only once results are announced. This supersedes the contest-events ruling that judging orders by likes.

## Acceptance criteria

- [ ] The judging phase shuffles entries the same way as the live phase.
- [ ] The decided phase is unchanged: podium first, then by likes.
- [ ] The staff Podium dialog is unchanged.
- [ ] The contest-order tests gain a judging-phase case. The guard bites when the old judging order is restored.
- [ ] Changelog line in In Progress.
- [ ] Four gates green.
