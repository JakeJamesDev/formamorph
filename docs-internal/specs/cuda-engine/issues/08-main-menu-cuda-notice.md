# 08: Main-Menu CUDA Notice

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one small UI surface plus a device flag. The design approval is the slow part.

## What to build

The first time the built-in engine starts on a machine that ticket 03 rules supported, and CUDA isn't installed, the main menu shows a one-time notice that a faster engine is available for the NVIDIA card. It offers Download, which starts the install from ticket 04, and Not now (Q9, Q18). Either choice sets a device-local "CUDA prompt seen" flag, and the notice never shows again. The row in the engine area stays either way.

This is a new pattern. Before you build it, show the proposed form through the design-system flow and get the user's approval, routed through the spec session. Copy follows the Writing Guide.

The main menu is a shared file: stage it through a filtered patch.

## Acceptance criteria

- [ ] The notice shows once on the first engine start with a supported card and no CUDA install. (main menu test)
- [ ] It never shows on an unsupported machine, on a machine without an NVIDIA card, or when CUDA is installed.
- [ ] Download starts the CUDA install, and progress shows in the engine area's row.
- [ ] Download or Not now sets the flag, and the notice doesn't show on a later start.
- [ ] The user approved the notice's form before the build. The approval is recorded in the ticket.
- [ ] Frames: `.scratch/frames/cuda-notice.png` in light and dark, at a realistic desktop width.

For you: check that the notice reads well and doesn't get in the way at boot. Main menu, first engine start.
