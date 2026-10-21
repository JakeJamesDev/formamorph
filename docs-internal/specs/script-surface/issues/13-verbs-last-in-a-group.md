# 13: Verbs Last In A Group

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one ordering rule in the tree builder, with a test that walks every group.

## What to build

Every Variable menu group lists its fields first and its verbs last, each set in its existing order (R7). The rule lives in the tree builder, so entities, `location`, `clock`, `memories[0]`, the Memory group and every group with a method follow it without a per-group edit. A verb is a leaf whose insert ends in a call or whose detail is a function type. Nothing else about the menu changes.

Spec: R7.

## Acceptance criteria

- [ ] A test builds the tree for a world script and a user Tool script and asserts that in every group no verb precedes a field
- [ ] The entity entry group reads the fields, then `move`, `follow`, `unfollow`, `diary`; the `memories[0]` group reads the eleven fields, then `pin`, `forget`, `edit`, `remove`; the Memory group reads `add`, `pin` after any field it has
- [ ] A static frame of the entity group open in the menu is stored at `.scratch/frames/verbs-last.png`, dark theme, desktop width
- [ ] Four gates green

## Blocked by

- None (can start immediately)
