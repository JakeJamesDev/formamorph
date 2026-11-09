# 01: Low-VRAM Lead for Every Vendor

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: new pure policy in the desktop shell with several machine shapes, an IPC answer, and a rule change in AI setup.

**What to build:** AI setup leads with Formamorph AI on every low-VRAM desktop, not only on NVIDIA. The desktop shell answers one question for the renderer: the VRAM class of the device the built-in engine uses (`low`, `ok` or `unknown`). AI setup shows the lead on `low` and keeps today's layout on `ok` and `unknown`. This ticket owns the VRAM class type, its renderer accessor, and the single 8,500 MB limit; ticket 03 imports them.

- [ ] The shell policy answers `low` for: one discrete card at or under 8,500 MB, an integrated GPU alone, a CPU-only machine (a listing that succeeded with no GPU device).
- [ ] It answers `ok` for: one discrete card over 8,500 MB, and a large discrete card beside an integrated GPU.
- [ ] It answers `unknown` when the device listing failed and when the app is not the desktop build. A failed listing and an empty listing are told apart.
- [ ] An integrated GPU with a large reported total still answers `low`. The test fails when the name rule is removed (run once with the rule removed, then restore).
- [ ] Two discrete cards with no pin add their totals before the limit applies.
- [ ] A discrete card that matches an `nvidia-smi` row uses the `nvidia-smi` total, so an NVIDIA machine gets the same answer at 8,500 and 8,501 MB as before.
- [ ] The answer reuses the cached device listing. No second listing runs for it.
- [ ] AI setup shows the lead from the VRAM class and no longer from the `nvidia-smi` total. Every other condition of the lead stays (First-Time Flow Q52).
- [ ] The 8,500 MB limit has one definition that the shell policy and the renderer facts both read.
- [ ] The lead's body no longer says "your GPU" in a way that is wrong for a CPU-only machine. The new wording follows the Writing Guide and is written from a facts list.
- [ ] The AI setup dev route can show the lead for a named VRAM class. Frames at `.scratch/frames/ai-setup-lead-class-low-1280-dark.png` and `-light.png`.
- [ ] `docs/` pages that describe the low-VRAM lead are current, and a changelog fragment states what changed for the player.

For you: the lead card's new body wording, in AI setup on the dev route.
For you: a real AMD, Intel or CPU-only machine shows the lead. No such machine is available to the session.
