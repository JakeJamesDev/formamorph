# 04: Staff audit and removal for Anonymous Likes

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (User Stories › Moderating)

Model rationale: the address grouping is a union-find keyed by account id. Adding a second node kind without breaking the existing groups needs care.

## What to build

Staff see how many Anonymous Likes a listing has, see them grouped by shared address beside the accounts that share it, and can remove them.

## Acceptance criteria

- [ ] The Likers list response carries the anonymous count.
- [ ] The audit response carries Anonymous Like rows with a group id and a linked-to-author flag. Account rows keep their shape.
- [ ] An Anonymous Like joins a group through its hash. Rows with a blank hash are listed ungrouped.
- [ ] A single Anonymous Like that shares the author's address is reported, even though a group of one is otherwise dropped.
- [ ] Account rows carry the claimed marker from ticket 03 and the original time.
- [ ] The audit route still writes no audit entry.
- [ ] One staff route removes one address group's Anonymous Likes from a listing. One removes all Anonymous Likes from a listing.
- [ ] Each removal writes a new audit action, only when rows went, behind the same moderation check as the existing removal.
- [ ] Tests: mixed account and anonymous groups; the lone author match; blank-hash rows; both removals with their audit entries; a non-staff refusal.
- [ ] Fixtures use the repo's neutral names. Nothing names a real account or listing.
