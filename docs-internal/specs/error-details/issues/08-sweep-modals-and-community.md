# 08: Sweep: modals, community and Community Creations

Status: ready-for-human
Base: 0b6d271f
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The same sweep for the modal components, the community components and the Community Creations browser, about 32 sites. Caught-error toasts move to the shared helper with their current message as the headline; validation and refusal toasts stay plain. No wording changes. Ticket 04 already converts the delete, quarantine and release toasts in the Community Creations browser; leave those three as they are.

Recommended model rationale: same mechanical sweep as ticket 07 over a second directory set.

## Acceptance criteria

- [ ] Every caught-error toast in the modals, community components and Community Creations browser goes through the shared helper and offers **View Details →**
- [ ] Every validation or refusal toast in those files stays plain with no link
- [ ] No toast's visible words changed; a test that asserted a plain string may switch to reading the toast's visible text, with the asserted words identical
- [ ] The sweep touches no file outside those directories
- [ ] Four gates green
