# AI Setup Gate Redesign (Desktop First-Run)

Status: ready-for-agent

## Problem Statement

A new desktop player meets the AI setup popup before anything else. The recommended-model view works, but the "Show all models" branch fails them: the dialog grows past the viewport and cannot scroll, the list is a flat unordered dump, and no row explains what a model is or why it would be a good choice. After a download starts, the experience degrades further: the player cannot close the dialog, the progress view vanishes the moment the file lands while the engine silently loads weights for tens of seconds, and the copy promises the game "starts on its own" when nothing of the sort happens. The player's first minutes with the product are confusing at the exact moment they have the least context.

## Solution

Redesign the setup gate as one coherent first-run flow. The all-models view becomes a scrollable, sectioned list organized by fit against the detected GPU, with each model's character note visible. The download becomes dismissible, handing progress to a toast in the app's one shared notification region. The engine-load window gets an explicit state, and completion gets a short success step with a clear next action. The same component serves the in-game "AI unreachable" entry point.

## User Stories

1. As a first-time desktop player, I want the setup popup to recommend one model sized to my GPU, so that I can start without understanding the model landscape.
2. As a first-time desktop player, I want to see which GPU and how much VRAM was detected, so that I trust the recommendation is for my machine.
3. As a curious player, I want to expand the recommendation into a full model list, so that I can choose for myself.
4. As a player browsing the full list, I want it to scroll inside the dialog, so that no row or button is clipped off-screen.
5. As a player browsing the full list, I want models grouped into "best for my GPU", "also fits", and "too big", so that fit is obvious at a glance.
6. As a player browsing the full list, I want the recommended model to appear as the first row of its section with a Recommended badge, so that the pick stays visible without a duplicate card.
7. As a player browsing the full list, I want each row to show the model's one-line character note alongside its size figures, so that I have a reason to pick one over another.
8. As a player browsing the full list, I want reasoning-capable models marked with a badge, so that I know they behave differently.
9. As a player with a small GPU, I want models that will not fit shown dimmed in their own section, so that I am warned without being forbidden.
10. As a player who expanded the list, I want a way back to the single recommendation, so that I can un-clutter the choice.
11. As a player, I want the list free of search boxes and filters, so that the first-run choice stays simple.
12. As a downloading player, I want to close the setup dialog while the download runs, so that I can browse worlds in the meantime.
13. As a downloading player who closed the dialog, I want a persistent toast showing live download progress, so that I know the download is still going and when it will finish.
14. As a downloading player, I want the progress toast in the same corner as every other app notification, so that the app has one consistent notification region.
15. As a downloading player, I want the toast to show the model name and the byte progress on separate lines, so that long model names wrap cleanly.
16. As a player whose download just finished, I want the gate to show a "loading your model" state until the engine is ready, so that the silent weight-load window does not look like a stall or a finished setup.
17. As a player who dismissed the gate during the load window, I want a completion toast when the engine is ready, so that I know I can start playing.
18. As a player reading the completion toast, I want an Open Settings button on it, so that I can jump straight to the endpoint settings.
19. As a player whose setup completed with the gate open, I want a short "you're ready" step with one clear action, so that the flow ends with an invitation instead of a vanishing dialog.
20. As a player mid-world whose AI came up, I want the success action to read as continuing my session, so that the same gate makes sense at both entry points.
21. As a player who clicks Later, I want one line telling me where setup lives in Settings, so that I can find it again on my own.
22. As a player who clicked Later, I want the gate to reappear when I enter a world without a working AI, so that I am caught at the moment of need rather than nagged on the menu.
23. As a player, I want honest copy — no promise that the game starts on its own — so that the gate never claims something the app does not do.
24. As a player who pauses a download, I want the paused state treated as a choice rather than an error, so that resuming later feels safe.
25. As the developer, I want the section grouping derived by a pure function from the catalog and the detected tier, so that the grouping is testable without rendering anything.
26. As the developer, I want the catalog's order to remain the single quality ranking, so that no separate score field can drift from the screen results.

## Implementation Decisions

- Scope is the local (bundled engine) branch of the setup gate on desktop, both entry reasons (first-run and in-game). The custom-endpoint, unknown-model, engine-down, and embed-blocked branches keep their current behavior and copy.
- No cloud option in the gate. Desktop first-run stays local-only; the hosted endpoint remains discoverable through Settings.
- No quality scores, letter tiers, or quality labels in the UI. Catalog order (already best-first within each VRAM tier) is the only ranking signal, expressed by row order.
- Section derivation is a new pure function beside the local model catalog: given the detected VRAM tier, it returns the best-fit group (the detected tier, first entry = recommended), the also-fits group (lower tiers, nearest first), and the too-big group (higher tiers). The existing "order is load-bearing" contract is the input; the function is the one consumer of it for the gate.
- Collapsed view: current single recommended card, plus a detected-hardware line (GPU name, VRAM, tier class) and the existing "Show all models" link, now reversible.
- Expanded view: fixed-height flex-column dialog with a scroll area (the pattern the full catalog modal already uses). Three titled sections; too-big rows render dimmed but remain downloadable. Rows show name, params · quant · size, the catalog note, a Recommended badge on the pick, and a Reasoning badge where flagged. This stays a simplified list — the full catalog browser (downloads, license, release date, tier tabs) remains the Local Model modal's job.
- Untested catalog entries get no special treatment; their array position already places them last.
- Download becomes dismissible: the close/escape/outside-click locks are removed. On dismissal with a download or engine load in flight, the gate hands off to a persistent toast in the shared themed toast container (top-right — deliberately the same region as all other notifications; a second region was considered and rejected as an app-invented inconsistency). The toast follows the existing optimize-images pattern: persistent, progress strip, updated in place. Body is two lines — "Downloading {name}…" then "{received} / {total} ({pct}%)" in muted meta text — confirmed in the prototype so long names wrap alone.
- The window between file-landed and engine-ready becomes an explicit gate state (spinner, "loading into your GPU" copy, dismissible with the same toast handoff). This replaces today's behavior of re-showing the catalog during the load.
- On engine ready with the gate open: a success step (title, model name, one primary action — Start Playing from the menu, Continue in-game). The gate no longer auto-closes on ready; the caller's ready callback fires from the success action instead. On engine ready with the gate dismissed: the progress toast is replaced by a completion toast with an Open Settings button that deep-links the endpoints tab.
- The "keep browsing — the game starts on its own" line is removed everywhere; new copy states what actually happens.
- The Later button keeps its one-shot persistence; a helper line beside it names Settings → Endpoints as the permanent home.
- The Pause affordance and resume-across-restarts download behavior are unchanged.
- All copy follows the player-facing voice rules and title case for labels.

## Testing Decisions

- Tests assert external behavior only: what renders, what the player can click, what callbacks fire — never internal state names or step indices.
- Seam 1: the pure section-derivation function, asserted in the existing catalog test file next to the current order-contract guards. Cases: each detectable tier produces the right membership and ordering; the recommended pick is the best-fit group's first entry; every catalog entry appears in exactly one group.
- Seam 2: behavior tests on the gate component with the desktop IPC hooks (VRAM stats, engine status, download subscribe/start) and the toast module mocked. The walk under test: recommended view renders the detected-tier pick → expanding shows three sections with the badge on the pick → starting a download shows progress → dismissal mid-download fires the progress toast and closes → engine-ready-while-open shows the success step and only then fires the ready callback → engine-ready-while-dismissed swaps in the completion toast.
- No seam inside the Electron main process; download and engine internals stay covered by their existing arrangements.
- Prior art: the existing component test suite (dialog-portal handling in jsdom), the catalog order-contract tests, and the mocked-toast patterns already used around the themed container.
- Guards must bite: each new test is checked by reinstating the bug it guards (for example, removing the scroll container or re-adding the auto-close-on-ready) and watching it fail.

## Out of Scope

- Any cloud/hosted-endpoint path inside the gate.
- Quality scores or labels in any UI, and any new catalog fields for them.
- Search, filtering, or hiding of models in the first-run list.
- Changes to the Local Model modal, the custom-endpoint branches, the embed-blocked branch, or the legacy "Potato PC" dialog.
- Multi-GPU tier selection (the gate keeps reading the first GPU; noted as a separate follow-up).
- Electron main-process changes; the download and auto-load pipeline is untouched.
- Rating the three untested catalog models.
- Web build behavior (the local branch is desktop-only by construction).

## Further Notes

- A throwaway visual prototype of every state exists in the tree (component named AiSetupGatePrototype, mounted dev-only, opened via the `#proto-aisetup` hash). It encodes the agreed section names, copy drafts, and toast layouts; delete it as part of the fold-in.
- The design decisions were settled in a grilling session (2026-08-27): full-flow scope, fit-grouped sections, no quality display, grayed too-big section, simplified list, local-only, dismissible download with toast handoff, success step, one-shot Later.
- The gate's ready-callback timing change (fire on success action, not on engine ready) touches both callers; their current handlers only close the gate, so the change is copy-level for them.
- Changelog: user-facing entry in the In-Progress bucket when implemented.
