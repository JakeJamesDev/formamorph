# 03: Unique Names for Dropped Groups

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: pure library-organization operations with an existing test suite, plus one picker that switches to the shared check.

## What to build

On the main-menu Library board, dropping one tile onto another makes a Group named *New Group*, even when a Group already has that name. **Create New Group** refuses a duplicate, and Rename allows one. Build one name-taken check (trimmed, case-insensitive) beside the library organization operations, and use it for the Group picker, Group creation and Rename. A drop takes the first free name: New Group, New Group 2, New Group 3 (Q10). Make the operations' comment about how a folder starts true.

Spec: Q10, Implementation Decisions "Group names". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [ ] A test that makes two Groups by drop fails today (two Groups named New Group), then passes with New Group and New Group 2
- [ ] Rename to a taken name is refused, compared trimmed and case-insensitive (pure test)
- [ ] The Group picker uses the shared check and still shows its duplicate-name error (existing test green)
- [ ] The Library page says what a drop names its Group; the docs tests are green
- [ ] The library-drag-parity spec gets a one-line note under its R10 that a tile drop makes a Group
- [ ] A changelog fragment under Minor / Fixed / 👤
