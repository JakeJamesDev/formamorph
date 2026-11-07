# 03: Narrated Move Prompt Split

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one prompt edit judged by a probe A/B, with no code path change.

## What to build

The Narrated Move user prompt states each answer rule in its own short line (R1).

- The last sentence of the Narrated Move user prompt holds three conditions: the current location when the body is still there, a listed place whose description fits, and Elsewhere when no listed place fits. It becomes three short lines, written by the prompt-writing guide.
- The location-narrated probe runs the current text as an in-batch arm beside the new text.
- The new text ships only if no bar is worse than the current text in the same batches. If it is worse, the ticket lands the probe numbers only and keeps the current text.
- Docs that quote the prompt match what ships.

## Acceptance criteria

- [ ] The probe on the cloud default model, 10 runs per scene, reports far, unlisted (scored by the ticket 02 ruling), carried, stay and router controls for both arms, plus first-token and total time. The numbers go in the ticket's `## Landed` section.
- [ ] The shipped text is no worse than the current text on any set in the same batches.
