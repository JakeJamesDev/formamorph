# 08: Main-Menu CUDA Notice

Status: ready-for-human
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one small UI surface plus a device flag. The design approval is the slow part.

## What to build

The first time the built-in engine starts on a machine that ticket 03 rules supported, and CUDA isn't installed, the main menu shows a one-time notice that a faster engine is available for the NVIDIA card. It offers Download, which starts the install from ticket 04, and Not now (Q9, Q18). Either choice sets a device-local "CUDA prompt seen" flag, and the notice never shows again. The row in the engine area stays either way.

This is a new pattern. Before you build it, show the proposed form through the design-system flow and get the user's approval, routed through the spec session. Copy follows the Writing Guide.

The main menu is a shared file: stage it through a filtered patch.

## Acceptance criteria

- [x] The notice shows once on the first engine start with a supported card and no CUDA install. (main menu test) — `MainMenu.cudaNotice.test.tsx`, "shows once the engine first starts…".
- [x] It never shows on an unsupported machine, on a machine without an NVIDIA card, or when CUDA is installed. — same file, "never shows for …" (also stale, and no bridge). Re-broke the state check: the installed and stale cases went red.
- [ ] Download starts the CUDA install, and progress shows in the engine area's row. — `install()` call tested; the row's progress is ticket 04's, not run against a real download.
- [x] Download or Not now sets the flag, and the notice doesn't show on a later start. — both remount tests.
- [x] The user approved the notice's form before the build. The approval is recorded in the ticket. — see Approval.
- [x] Frames: `.scratch/frames/cuda-notice.png` in light and dark, at a realistic desktop width. — 1440x900, Playwright, `cuda-notice.png` and `cuda-notice-dark.png`.

For you: check that the notice reads well and doesn't get in the way at boot. Main menu, first engine start.

## Approval

2026-11-07, via the spec session: the user chose the card form (bottom-right, non-modal) over the strip under the top bar. The user saw it cover the footer's Patreon and GitHub icons and chose it anyway. Copy: "Copy is fine". Mock frames: card and strip, light and dark.

## Landed

**Not verified**
- Download starts the CUDA install, and progress shows in the engine area's row: no real download ran. The install call is tested; the row is ticket 04's.

**For you**
- Check that the notice reads well and doesn't get in the way at boot. Main menu, first engine start. Frames: `.scratch/cuda-engine-08/frames/cuda-notice.png` and `cuda-notice-dark.png`.
- The notice arms when the engine reaches `loading` or `ready`, not `loading` alone. A menu that mounts after the load began still offers it.
- It waits for the intro, the age gate, the AI setup gate and the first-run step, and while the AI's reachability is still unknown. In practice it shows once the engine is `ready`, not at `loading`. It does not wait for other dialogs.
