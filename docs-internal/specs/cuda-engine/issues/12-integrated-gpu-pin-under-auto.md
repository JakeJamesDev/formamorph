# 12: Integrated GPU Pin Under Auto

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a backend-choice rule in main with no harness today; the fix needs a test seam for the choice.

## What to build

A player who pins the integrated GPU, with Backend on Auto, keeps that pin. Today NVIDIA plus an integrated GPU is not "mixed" (ticket 05 ruling), so Auto picks CUDA. The CUDA listing has no integrated GPU, so the pin silently falls back to the NVIDIA card. Q14's intent is that the device pin steers Auto. Found in the close review.

Rule to settle in triage, with the spec session: when the device setting pins a device that only Vulkan lists, Auto starts on Vulkan, and the Backend reason says so.

## Acceptance criteria

- [ ] Auto with a pin on a device that only Vulkan lists starts on Vulkan with that pin, and the reason names the pin.
- [ ] Auto with a pin on the NVIDIA card, or no pin, still starts on CUDA when supported.
- [ ] The backend choice for a start is testable without Electron, and these cases run through it.
