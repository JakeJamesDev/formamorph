# 11: Remove Bearer Names and Guard the Term

Status: done
Blocked by: 03, 04, 05, 06, 07, 08, 09, 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: delete aliases and add one guard test.

## What to build

The contract step of the wide refactor.

- Delete every old-name alias and the re-exports at old paths.
- Add one term guard test. It scans the docs and app strings for bearer or holder in the owner sense. It allows HTTP `Authorization: Bearer` and the parent-tree `holderOf`.
- Prove the guard bites: put "Same Bearer" back once, see the guard fail, then remove it.

Spec: Q6, S1; stories 20, 22, 23.

## Acceptance criteria

- [ ] No old-name alias or re-export remains
- [ ] The term guard passes and allows the HTTP header and `holderOf`
- [ ] Guard bites: reinstating "Same Bearer" fails it
- [ ] Sign-in still sends `Authorization: Bearer`; four gates green

## Blocked by

- 03, 04, 05, 06, 07, 08, 09, 10
