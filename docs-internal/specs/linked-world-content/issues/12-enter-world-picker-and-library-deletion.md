# 12: Enter World picker dedup and library deletion

Status: ready-for-agent
Status note: PAUSED with the linked-world-content effort. Ticket 03 removes the `LINKING_ENABLED`
flag and is the resume point.
Blocked by: 01, 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: two contained rules over existing pickers and storage services, each with a clear test.

## Parent

[spec.md](../spec.md) — Settled follow-up decisions (Local library), open questions 8 and 12.

## What to build

Linked content never activates twice, and removing a library item never breaks a world.

In the Enter World step, a library dictionary or Entity that a world already holds as a linked copy is hidden from the library rows, and the world's row carries a **Linked** mark. Independent copies keep today's behavior of two rows labeled World and Library. Picker rows show author and source under the name so duplicate names stay distinct.

Deleting a library item leaves every world copy that followed it as an independent copy with content kept. The world copies lose their link record the next time the world opens, so no world scan runs at deletion time. Duplicate names remain allowed.

## Acceptance criteria

- [ ] A world with a linked copy of a library dictionary shows one row for it, marked Linked, and no library row; an independent copy shows the two rows as today.
- [ ] Two library items with the same name show distinct author and source lines in the Enter World rows.
- [ ] Deleting a linked library item, then opening the world, shows the copy as independent with its content intact and no error.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.
- 02 — Save to Library and Add from Library with links.
