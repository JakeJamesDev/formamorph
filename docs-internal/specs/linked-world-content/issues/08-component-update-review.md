# 08: Component update review

Status: ready-for-agent
Status note: PAUSED with the linked-world-content effort. Ticket 03 removes the `LINKING_ENABLED`
flag and is the resume point.
Blocked by: 02, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: revision comparison across several worlds with four outcomes, a content diff, suppression state, and per-world failure handling; the correctness of local replacements depends on it.

## Parent

[spec.md](../spec.md) — Player edits and update conflicts, Review Updates dialog, Settled follow-up decisions (Updates and repairs).

## What to build

A player checks a library item for source updates and decides, per linked world, what to do.

**Check for Updates** on a library item or a linked world copy compares the source's revision marker with each linked world's held revision. When something changed, an **Update available** dialog lists one row per affected world with its state: Linked, or Local replacement with edits protected. Each row has an action dropdown: **Update**, **Keep Mine**, **Use Author's**, and **Unlink**. Unmodified copies default to Update; local replacements default to Keep Mine. **View Changes** shows changed fields first, added and removed dictionary entries grouped, and unchanged content behind a disclosure. Selecting an action changes nothing until **Apply Updates**, one confirmation for the batch.

Keep Mine stores the reviewed revision on that world copy, so the same revision does not return; the row comes back only when the source changes again. Unlink keeps content and clears the record. A failed world update keeps its previous content and offers Retry while the others' results stand. Checks are user-initiated only; nothing runs on open, launch, or in the background.

## Acceptance criteria

- [ ] With no source change, Check for Updates reports up to date and opens no review.
- [ ] With a change, the dialog lists each linked world; unmodified copies default to Update and local replacements to Keep Mine.
- [ ] View Changes shows the changed entry pair, added and removed entries, and unchanged entries behind a disclosure.
- [ ] Apply Updates applies each row's action; Unlink leaves an independent copy with unchanged content.
- [ ] After Keep Mine, a second check with the same source revision omits that world; a newer revision lists it again.
- [ ] One world failing to update keeps its content and shows Retry; the other worlds' updates persist.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 02 — Save to Library and Add from Library with links.
- 04 — Server: listing relationships and Unlisted.
