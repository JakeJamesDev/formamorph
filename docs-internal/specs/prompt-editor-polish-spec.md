# Prompt Editor Polish — Spec

**Status: SPECED (2026-08-06), not yet built.** Second follow-up to the split view (`prompt-editor-split-spec.md`, `prompt-editor-rail-spec.md`), from the first round of real use of the rail + samples. Four fixes, agreed in discussion; build order **2 → 4 → 1 → 3** (the value-pool refactor first since caret-follow builds on the preview it feeds; the fullscreen ownership refactor last, it touches the most structure).

## 1. Rail group headers read as dead items

The Story/Trackers/Memory/Images labels are styled like small tree entries but aren't clickable — they invite a click and ignore it.

**Fix: divider treatment, CSS only.** Headers become structure, not items: a hairline rule with the label sitting on/above it, extra top spacing, no hover state, `aria-hidden` on the rule. Collapse/expand was considered and rejected — 13 entries don't need folding, and it adds persistent state for nothing. Revisit only if the prompt count grows.

## 2. One preview-value pool; real values where derivable

Two maps exist today and will drift: `samplePreviewValues.ts` and GameViewer's `promptPreviewValues` (which carries its own ad-hoc placeholder strings for `<PLAYER ACTION>`, `<NARRATION>`, `<DICTIONARY>`, `<CHARACTER NAME>`).

**Fix: one module, two layers.**

- **Derived layer** — computed from live settings, no game needed, real everywhere (menu and in-game):
  - `<LENGTH GUIDANCE>` ← `lengthGuidance(paragraphLimit, maxTokens)`
  - `<MARKDOWN GUIDANCE>` ← `restyle(markdownGuidance(markdownOutput), activeSectionStyle)`
  - `<ACTIVE CHARACTER GUIDANCE>` ← `activeCharacterGuidance(limitActiveCharacters, activeCharacterLimit)`
- **Sample layer** — tokens that genuinely need a world: world description, stats, traits, locations, entities, notes, time, dictionary, action/narration/in-frame/character/subject. Stays invented (current sample content), shared by both consumers.
- Composition: `sample ⟵ derived ⟵ live game values` (rightmost wins). GameViewer's map is rebuilt on the shared pool so its ad-hoc strings disappear; SettingsModal's fallback uses `sample + derived`.
- **Badge rule changes**: "Sample data" keys on *sample-layer tokens being in use* (i.e. no live game), not on "previewValues prop absent" — guidance tokens are real on the main menu and must not be called samples. Practically the flag stays "no game running", but the wording/logic is documented as "world-state tokens are stand-ins".
- Coverage test extends: derived tokens must NOT appear in the sample layer (they'd shadow real values), and the union must still cover the full vocabulary.

## 3. Rail must show in fullscreen (Settings)

`PromptField` owns fullscreen, so the overlay can only contain the field itself — the rail lives a level up.

**Fix: Settings-owned fullscreen for the Prompts tab.**

- `PromptField` gains controlled-fullscreen props (`fullscreen`, `onFullscreenChange`); uncontrolled behavior (internal state) remains for call sites without chrome of their own (world editor, dictionary entries).
- The Prompts tab intercepts the field's maximize: fullscreen becomes a Settings-level overlay (nested Radix dialog, same as the field uses today) containing the **whole rail + editor layout** — rail on the left, field filling the rest, preset row included so Duplicate & Edit and preset switching work without leaving fullscreen.
- Mobile fullscreen keeps the field-only presentation (a rail has no room there; the dropdown row rides along instead).
- Auto-fullscreen-on-focus (mobile) keeps working through the same controlled path.

## 4. Caret-follow in the preview

While the caret is in the editor, the preview follows *the caret*, not the viewport center; plain scrolling behaves as today.

- A Lexical selection-change listener reads the caret's DOM rect, builds a `ScrollAnchor` from the caret's Y (the anchor math already takes a position — it just always receives the viewport center today), and applies it to the preview pane.
- Precedence: caret-follow wins while the editor has focus and the selection is changing; the scroll handler's center-sync applies otherwise. The existing `applying` gate arbitrates — caret applies set it exactly as scroll applies do, so the two can't fight.
- Typing re-renders the preview; the follow re-applies after the re-render settles (same settle loop the tab-switch apply uses).
- Applies in split and in mobile swipe (landing pane honors the last caret anchor when focus was in the editor).

## Out of scope

- Collapsible rail groups; editing sample content; caret-follow from preview back into the editor (preview has no caret).

## Build checklist

- [ ] `previewValuePool.ts` (rename/absorb `samplePreviewValues.ts`): sample layer + derived-layer builder; GameViewer + SettingsModal both consume it
- [ ] Coverage tests: union covers vocabulary; derived tokens absent from sample layer; live values override
- [ ] Caret-follow: selection listener, caret anchor, precedence via `applying`; works in split + swipe
- [ ] Rail headers → divider styling
- [ ] Controlled fullscreen on PromptField; Settings-level fullscreen overlay with rail; mobile keeps field-only
- [ ] verify-ui: main-menu guidance tokens show real settings values; caret-follow live check; fullscreen-with-rail desktop, field-only mobile
- [ ] Changelog In-Progress entry (👤); no export-shape change
