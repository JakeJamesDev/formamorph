# 01: Low-VRAM Lead for Every Vendor

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: new pure policy in the desktop shell with several machine shapes, an IPC answer, and a rule change in AI setup.

**What to build:** AI setup leads with Formamorph AI on every low-VRAM desktop, not only on NVIDIA. The desktop shell answers one question for the renderer: the VRAM class of the device the built-in engine uses (`low`, `ok` or `unknown`). AI setup shows the lead on `low` and keeps today's layout on `ok` and `unknown`. This ticket owns the VRAM class type, its renderer accessor, and the single 8,500 MB limit; ticket 03 imports them.

- [x] The shell policy answers `low` for: one discrete card at or under 8,500 MB, an integrated GPU alone, a CPU-only machine (a listing that succeeded with no GPU device). `engineVramClass` tests in `electron/engineDevice.test.mjs`.
- [x] It answers `ok` for: one discrete card over 8,500 MB, and a large discrete card beside an integrated GPU. Same suite.
- [x] It answers `unknown` when the device listing failed and when the app is not the desktop build. A failed listing and an empty listing are told apart. `readServerDevices` tests (non-zero exit, spawn error, timeout vs clean empty) in `electron/llamaServer.test.mjs`; `readVramClass` off-desktop test in `src/lib/vramClass.test.ts`.
- [x] An integrated GPU with a large reported total still answers `low`. The test fails when the name rule is removed (run once with the rule removed, then restore). With the `isIntegrated` branch removed, 2 tests went red (integrated alone at 87,722 MB; All GPUs); restored and re-run green.
- [x] Two discrete cards with no pin add their totals before the limit applies. Test at 8,600 vs 8,500 MB combined.
- [x] A discrete card that matches an `nvidia-smi` row uses the `nvidia-smi` total, so an NVIDIA machine gets the same answer at 8,500 and 8,501 MB as before. Boundary test plus exact-name-first test (mutation-checked).
- [ ] The answer reuses the cached device listing. No second listing runs for it.
- [x] AI setup shows the lead from the VRAM class and no longer from the `nvidia-smi` total. Every other condition of the lead stays (First-Time Flow Q52). `aiSetupLeadsWithHostedAi` tests; existing `AiSetupGate.test.tsx` lead cases now drive the class, and a 6,144 MB nvidia-smi read on an `ok` class shows no lead.
- [x] The 8,500 MB limit has one definition that the shell policy and the renderer facts both read. `LOW_VRAM_LIMIT_MB` in `electron/engineDevice.cjs`, imported by `src/lib/vramClass.ts`; grep finds no other copy.
- [x] The lead's body no longer says "your GPU" in a way that is wrong for a CPU-only machine. The new wording follows the Writing Guide and is written from a facts list. DOM read on the dev route; the words wait for your approval (For you).
- [x] The AI setup dev route can show the lead for a named VRAM class. Frames at `.scratch/frames/ai-setup-lead-class-low-1280-dark.png` and `-light.png`. `#dev?modal=aiSetup&vramClass=low`; Playwright read 0 leads on `ok` and `unknown`.
- [x] `docs/` pages that describe the low-VRAM lead are current, and a changelog fragment states what changed for the player. `docs/Connect-Your-Own-AI.md` table row; `docs-internal/changelog.d/built-in-engine-offer-01.md`.

For you: the lead card's new body wording, in AI setup on the dev route.
For you: a real AMD, Intel or CPU-only machine shows the lead. No such machine is available to the session.

## Landed

**Not verified**

- The answer reuses the cached device listing (criterion 7). By inspection only: `llm-vram-class` reads `enumerationOf`, the picker's cache, and `electron/main.cjs` has no test seam. Two known re-reads: a failed listing is no longer cached, so the next ask lists again; an empty CUDA listing was already re-asked on every call (existing picker rule), so a CUDA-installed machine whose CUDA build lists nothing re-lists on each AI setup open.
- No real AMD, Intel, integrated or CPU-only machine, and no Electron run of the IPC.

**For you**

- For you: the lead card's new body wording, in AI setup on the dev route (`#dev?modal=aiSetup&vramClass=low`). Draft body: "Formamorph AI writes better narration and keeps characters more consistent than the models that fit your machine. Your support also helps fund new updates." Frames: `.scratch/built-in-engine-offer-01/frames/ai-setup-lead-class-low-1280-dark.png`, `-light.png`.
- For you: a real AMD, Intel or CPU-only machine shows the lead. No such machine is available to the session.
- NVIDIA behavior change: the class judges the device the engine uses, not nvidia-smi's first GPU, and a failed device listing on an NVIDIA machine now shows no lead (spec rule 1), where the shipped code led from nvidia-smi alone.
- `src/lib/localModels.ts` keeps its own 8,500 MB model-tier boundary. That is the recommendation tier, out of scope here.
