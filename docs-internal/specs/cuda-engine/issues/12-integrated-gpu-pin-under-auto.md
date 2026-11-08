# 12: Integrated GPU Pin Under Auto

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: a backend-choice rule in main with no harness today; the fix needs a test seam for the choice.

## What to build

A player who pins the integrated GPU, with Backend on Auto, keeps that pin. Today NVIDIA plus an integrated GPU is not "mixed" (ticket 05 ruling), so Auto picks CUDA. The CUDA listing has no integrated GPU, so the pin silently falls back to the NVIDIA card. Q14's intent is that the device pin steers Auto. Found in the close review.

Rule (settled in triage, 2026-11-07): when the device setting pins a device that only Vulkan lists, Auto starts on Vulkan, and the Backend reason says so.

## Acceptance criteria

- [x] Auto with a pin on a device that only Vulkan lists starts on Vulkan with that pin, and the reason names the pin. `llmEngine.test.mjs` "a pin on the integrated GPU keeps Auto on Vulkan…" (`--device Vulkan0`, origin manual); `LocalModelPanel.test.tsx` "names the pinned device…".
- [x] Auto with a pin on the NVIDIA card, or no pin, still starts on CUDA when supported. `engineBackendChoice.test.mjs` and the precedence case in `llmEngine.test.mjs`.
- [x] The backend choice for a start is testable without Electron, and these cases run through it. Main's input gathering moved to `electron/engineBackendChoice.cjs`; `engineBackendChoice.test.mjs` runs it over fakes. Both guards went red with the rule or the `gpuDevice` pass-through removed.

## Landed

**Not verified:** none.

**For you:**
- On a machine with an iGPU and an NVIDIA card, with CUDA installed: Local Model → GPU Device = the iGPU, Backend = Auto. The row reads "Auto uses Vulkan because **GPU Device** is set to <name>…".

**For the spec session:**
- Add `device-pin` to Eligibility's reason list ("a reason when CUDA is not used: …"), checked after not installed / updating and before failed last time. Q14 or a new ruling can carry the 2026-11-07 triage rule.
- Gap, not built here: once Auto picks CUDA, the device picker lists only CUDA's devices, so a player can't newly pick the iGPU there. The rule only fires for a pin set while the picker listed Vulkan.
