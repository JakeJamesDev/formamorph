# 01: Prototype Link Looks

Status: ready-for-agent
Type: prototype
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q20, Q21, Q16, Q18, Q22)

## What to build

A throwaway `/prototype` that shows each link form inside a real feedback thread, in both themes, so the user can settle Q20. Show the variants side by side in a comment body:

- Resolved `#N`: as typed with a hover card (title, type, status); `#N` plus the title inline; a titled chip.
- `@username` link, and the "unknown user" form.
- Listing chip (title, kind, thumbnail) and the unavailable chip.
- The unavailable form for a thread.

Use fixed fake data. Nothing ships from the prototype branch.

## Acceptance criteria

- [ ] Each variant renders in a feedback thread view, light and dark, at desktop and mobile width. Frames: `.scratch/frames/links-<variant>-<theme>-<width>.png`.
- [ ] The user's pick for Q20 and any look changes for the other forms are recorded in the spec's rulings.

For you: pick the `#N` look and approve the chip and unavailable forms from the prototype frames.
