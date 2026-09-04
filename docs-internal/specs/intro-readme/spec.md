# Spec: Introduction / Gameplay Readme Tabs

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

World authors have exactly one readme surface, and it shows only *after* the player has finished the entire enter-world setup flow (traits, starting location, entities, dictionaries, avatar). There is no place to introduce the world or explain trait selection *before* the player makes those choices. The world description doesn't fill this role — in practice authors use it as advertising copy for the world browser, not as a readme.

## Solution

Split the readme into two authored documents under one "Readme" concept, edited as tabs in the World Editor:

- **Introduction** (new) — shown as a modal overlay at the very start of the enter-world setup flow, before trait selection. Introduces the world and explains the choices the player is about to make.
- **Gameplay** (existing `readme`, behavior unchanged) — shown on entering gameplay, after setup completes.

Players never see tabs — each phase shows only its own readme, so content written for a post-customization audience can't be read pre-trait. Worlds with an empty Introduction behave exactly as today.

## User Stories

1. As a world author, I want a readme that appears before trait selection, so that I can introduce my world and explain the trait choices before the player commits to them.
2. As a world author, I want the pre-trait and post-setup readmes edited as two tabs of one Readme section, so that authoring both feels like one coherent feature.
3. As a world author, I want the Introduction readme to support markdown, so that I can format it as richly as the existing readme.
4. As a world author, I want placeholder chips to work in the Introduction readme, so that rolled/pinned placeholder values appear in it like they do in the Gameplay readme.
5. As a world author, I want to leave the Introduction empty and get exactly today's behavior, so that my existing worlds are unaffected.
6. As a world author, I want the Introduction readme included in editor search, so that find/replace reaches it like every other text field.
7. As a player, I want the Introduction readme to open automatically when I start setting up a new game, so that I get the world's context before choosing traits.
8. As a player, I want the Introduction to appear even in worlds with no traits, so that world context isn't lost just because there's nothing to pick.
9. As a player, I want the Introduction readme not to appear when loading a save, so that I'm not re-onboarded into a game I'm already playing.
10. As a player using Quick Start, I want the Introduction skipped along with every other setup step, so that Quick Start stays frictionless.
11. As a player, I want the Gameplay readme to keep showing on entering gameplay exactly as before, so that nothing I rely on changes.
12. As a player, I want "Don't Show This Again" on both readme modals to hide readmes for that world with one flag, so that once I know a world I'm not nagged by either.
13. As a player, I want the existing "Show Readme on entry" checkbox in the world details panel to govern both readmes, so that there's one obvious switch.
14. As a player, I want to see only the readme for my current phase (no tabs), so that post-customization content isn't spoiled before I've built my character.
15. As a player, I want the Introduction rendered with the same markdown quality (GFM, code fences) as the Gameplay readme, so that both feel first-class.
16. As a world importer/exporter, I want worlds with an Introduction to round-trip through world JSON export/import, so that sharing keeps both readmes.
17. As a player of an older exported world, I want the world to load with no Introduction and no errors, so that back-compatibility holds.

## Implementation Decisions

- New optional string field `introReadme` on the world overview, alongside the untouched existing `readme`. **Additive world-export-shape change** — the user decides whether this forces a version bump; no migration of shipped worlds is required (absent field = feature off).
- Editor: the World Editor Overview tab's existing "Readme" field becomes a "Readme" section with **Introduction / Gameplay** tabs switching a single markdown placeholder-field slot. Both tabs keep markdown preview and placeholder chips. Both fields registered in editor search.
- Player-side Introduction trigger: fires at the very start of the enter-world setup flow — as a **modal overlay on top of the first setup screen** (mirroring how the Gameplay readme overlays gameplay). It is not a discrete flow step.
- It fires for zero-trait worlds too (setup flow with the traits step skipped still opens the overlay on whatever the first step is).
- **Quick Start skips the Introduction** entirely, consistent with it bypassing all setup steps.
- Save loads never show the Introduction (they bypass the setup flow by construction).
- Gating: the existing single per-world "hidden" flag is **shared** by both readmes. "Don't Show This Again" appears on both modals; either one (or the world-details "Show Readme on entry" checkbox) hides both.
- The Gameplay readme's behavior is untouched: shows on entering gameplay (new game and save load), same flag, same modal.
- Sequencing logic (Introduction first · skipped when empty · skipped on Quick Start · never on save load) is extracted from the main menu's inline step construction into a **pure step-builder function** — the one new seam.
- Placeholder resolution: the Introduction renders placeholder-resolved text; implementer must verify roll timing (placeholders roll at Enter World) puts resolved values ahead of the Introduction display, and surface any ordering conflict rather than shipping unresolved text.
- Normalization on world load resets/falls back the new field the same way `readme` is handled, so a previously loaded world's Introduction can't leak into the next.

## Testing Decisions

- Good tests here assert **external behavior**: what the player sees and when, and what the persisted flag does — never internal state or render internals.
- **Pure step-builder** (new seam): unit-test the sequencing rules directly — Introduction first when non-empty; absent when empty; absent on Quick Start; traits step still skipped for zero-trait worlds; save-load path excluded.
- **Introduction modal** (existing per-modal seam, prior art: the trait-selection and starting-location modal tests): renders markdown content, "Don't Show This Again" writes the shared per-world flag, close behavior.
- **Visibility hook** (existing seam, prior art: the readme-visibility hook tests): shared-flag semantics — unchanged logic, extend only if the flag surface changes.
- Editor tabs: verified in the live preview (both tabs, chips, preview, both themes) — no jsdom render test, per Radix-in-jsdom cost.
- Guards must bite: each new test proven to fail with its rule reverted (e.g. remove the Quick Start skip, watch the step-builder test go red).

## Out of Scope

- Any change to the world description field or its role.
- Player-facing tabs or a combined readme view; re-opening either readme mid-play from a button/menu (today's behavior — no reopen surface — stands).
- Per-tab hide flags or new settings.
- Version bump / changelog finalization (user-owned release signals).
- Migrating or back-filling Introductions for existing/bundled worlds.
- ST import mapping for the new field.

## Further Notes

- Names settled by grilling: tabs are **Introduction** and **Gameplay**; the JSON field for the new tab is `introReadme`; `readme` keeps its name to avoid churn.
- The shared-flag choice means ticking "Don't Show This Again" on the Introduction suppresses a Gameplay readme the player hasn't seen yet — accepted deliberately (one concept: "show readmes for this world").
- Changelog: append a 👤 entry to the In-Progress bucket when implemented.
