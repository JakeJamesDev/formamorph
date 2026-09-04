# Prompt Editor Rail, Read-Only UX & Sample Preview — Spec

Status: ready-for-agent
Status note: (2026-08-06), not yet built. Follow-up to the shipped split view (prompt-editor-split-spec.md), closing the three gaps found on first real use: no rail (B3 was shelved but the B2 mockup had implied one), built-in presets read as broken in fullscreen, and Preview/split being inert outside a game.

## Decisions (interviewed & confirmed)

| Question | Decision |
|---|---|
| Rail on narrow screens | **Dropdown on mobile** — rail at desktop widths, collapsing to a single dropdown row below the threshold. This deliberately revives the previously-excluded M1 and kills the 106px wrapped tab bar on mobile. |
| Rail structure | **Grouped tree.** Prompts grouped (Story / Trackers / Memory / Images), each expanding to its surfaces (System Prompt / User Message / Messages / Options). The two chrome rows — 13 wrapped prompt tabs and the view toggle — disappear entirely. |
| Read-only built-ins | **Notice + duplicate button.** A visible "Built-in presets can't be edited" line with a button that clones the active preset as a user preset, selects it, and lands in editing. |
| Out-of-game preview | **Generic sample data**, labeled. Hand-written neutral snippets shaped like real context (never real world content — see [[prompt-examples-generic-only]]'s spirit: placeholder-form, not lifted values). Preview shows a "sample data" badge so nobody mistakes it for their world. |

## Design

### 1. Rail (Settings → Prompts)

- Left rail (~200–220px) inside the Prompts tab, replacing the prompt-tab rows and the System/User/Messages/Options toggle. The preset selector row stays above both columns.
- **Groups** (entries keep their existing feature-gating — a disabled feature's prompt doesn't appear):
  - *Story*: Narration, Planning (precall), Director/Character/Storyboard (staged), Choices
  - *Trackers*: Stat Updates, Location Change, Clock, Opening
  - *Memory*: Summary, Diary
  - *Images*: Scene Tags
- Each prompt expands to its surfaces; surfaces map 1:1 to today's `promptTab` + view-toggle state, so the dev-router's `subtab=` targets keep working (extend the ledger if the surface becomes addressable).
- **Narrow fallback**: below the width where rail + editor fit, the rail renders as one dropdown row (prompt + surface in one control, e.g. "Narration — System Prompt"). Container-width gated like the split, not device-gated.
- The editor column reclaims the freed rows; with S1's 1100px width this puts the inline editor near the B3 estimate (~520px tall).

### 2. Read-only messaging

- When `activePresetIsBuiltIn`, the editor area shows a slim notice row: "**{name} is a built-in preset and can't be edited.**" with a **Duplicate & Edit** button.
- The button uses the existing `addPreset` (which copies the active values and selects the new preset — and under a world pin, re-pins instead; that path already exists). Name: `{name} (copy)`.
- Appears in inline and fullscreen alike; fullscreen is where the dead cursor hurt most.

### 3. Sample preview values

- New `src/lib/samplePreviewValues.ts`: a static map covering every token the prompt vocabulary can render — world description, stats (all three variants), traits, notes, locations (current/sublocations/reachable + name/parent forms), entities (all variants), dictionary before/after, time, player action, narration, in-frame, character name, length/markdown guidance.
- Content rules: **generic placeholder-form** ("Ash Hollow — a river town…" style is out; "Sample Town — a small settlement by a river" naming itself as sample is the register), short (2–4 lines per block), shaped like the real renders so section styling reads correctly.
- Wiring: SettingsModal falls back to the sample map when its `previewValues` prop is absent (main menu). In-game values win unchanged.
- **Label**: the Preview pane shows a small "Sample data" badge whenever it's rendering the fallback (a `sample` flag on PromptField), so the same pane in-game shows nothing new.
- Consequence: the **split now engages outside a game** — `hasPreview` becomes true everywhere in Settings — which is the actual complaint being fixed.

## Out of scope

- Rail elsewhere (world editor, dictionary editor) — Settings prompts only.
- Editing sample values or deriving them from a library world.
- Prompt text changes: none; no probe run.

## Build checklist

- [ ] `samplePreviewValues.ts` + fallback wiring + "Sample data" badge
- [ ] Read-only notice + Duplicate & Edit (inline + fullscreen)
- [ ] Rail: grouped tree, feature gating, surface selection state, narrow-width dropdown fallback
- [ ] Dev-router: prompt subtab targets still resolve; ledger/drift guard updated if the shape changes
- [ ] Tests: sample-map coverage of the vocabulary (every palette token resolves), rail gating, duplicate-and-edit flow
- [ ] verify-ui: desktop split-with-samples from the **main menu** (the failing case), mobile dropdown fallback, both read-only states
- [ ] Changelog In-Progress entry (👤); no export-shape change
