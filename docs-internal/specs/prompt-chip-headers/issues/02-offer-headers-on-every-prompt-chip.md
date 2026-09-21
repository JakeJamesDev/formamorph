# 02: Offer Headers on Every Prompt Chip

Status: ready-for-human
Status note: Implemented and verified; closing review corrected Subject request rendering and found no remaining issues.
Base: 9dc76c89
Blocked by: 01 — Author Headers on Format-Capable Chips
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

Parent: [Prompt Chip Headers](../spec.md)

Model rationale: This extends the shared Header path to the remaining chip capabilities. The main work is preserving raw bodies and remembered format state consistently across the registry, editor, and serialization boundaries.

## What to build

Authors can use Header on every registered prompt-variable chip, including Notes, World, Time, and other chips whose bodies have no Format choice. Adding Header reveals a Format selector initialized to Simple. Formatting affects the Header only; the chip's resolved body stays unchanged.

Build on ticket 01's shared representation, renderer, editing, and sharing behavior. The prerequisite supplies a complete working Header path; this ticket extends its capability coverage without creating a parallel implementation.

## Acceptance criteria

- [x] Every registered prompt-variable chip offers optional Header in both Settings prompts and World Editor custom prompt fields. Inventory the registry so less prominent chip families are covered. World Editor Placeholder Chips remain outside scope.
- [x] On a chip without body formatting, adding its first nonblank Header reveals Format initialized to **Simple**, regardless of the custom prompt's style metadata or origin. Do not infer an initial value from a preset.
- [x] Format changes affect only the generated heading/wrappers for these chips. Existing content/scope choices retain their meanings, and the resolved body is unchanged. No artificial formatted-body variants are introduced.
- [x] Clearing Header removes generated structure and hides the now-ineffective Format selector while preserving its selection and any existing affixes. Restoring Header restores that selection, including after saving, reopening, copying, moving, and export/import.
- [x] Whitespace-only Header behaves as absent. Existing chips without Header retain their output, options, fallback behavior, and stored text.
- [x] All newly covered chips use ticket 01's casing, affix order, contextual spacing, empty-value omission, XML boundaries, and unresolved-token behavior. No family-specific rendering rules are duplicated.
- [x] Generated headings and closing tags use the same conditional highlight, options access, read-only protection, and single-placement ownership as the format-capable chips.
- [x] Ordinary/blank-line moves, self-drop rejection, cancellation, undo/redo, clipboard, and persistence preserve Header and its remembered Format on both real editing screens. Header-only format state survives each token mutation that can reconstruct a placement.
- [x] Preview, gameplay assembly, and request-anatomy runs remain consistent for the newly covered chips. Production JSON and share-code round trips retain native editable data, including remembered Format while Header is cleared.
- [x] Existing custom prompts are not converted or rewritten. Any actual export-envelope shape change is explicitly reported; no version bump or migration is added.

## Verification and completion

- Check Header availability across the complete prompt-variable registry. Use representative raw-text and variant-bearing chips to exercise the production renderer and token mutations, including text containing its own line breaks and markup.
- Assert exact body preservation while Format changes. Test Simple initialization independently of surrounding prompt style, and the clear/save/reopen/restore lifecycle for remembered Format. Keep the existing format-capable and Name behavior from ticket 01 covered.
- Through **both real screens**, add/edit/clear/restore Header, change Format and any existing variant, save/reopen, and verify the serialized content. Exercise highlighted syntax, read-only protection, keyboard/mobile/full-screen editing, drag/history, and clipboard behavior for the new capability shape.
- Use production preset JSON and share-code functions for sharing checks, and compare the shared rendering boundary with gameplay assembly and run tiling. Parse representative XML output and cover empty values without changing the body to make the test pass.
- Extend the production Prompt Chips reference with Header-only Format behavior. Inspect static DOM and desktop/mobile screenshots in both themes.
- Measure changed-module coverage, demonstrate relevant regression checks fail when the defect returns, and record test runtimes. Complete the four code gates, changelog entry, graph refresh, and live UI evidence required by the parent spec.

## Scope boundary

This completes Header availability and editing for custom prompts. Built-in conversion belongs to ticket 03. It does not add body formatting to raw-text chips or change Placeholder Chip behavior.

## Comments

All 22 registered chip families share Header authoring and rendering. [Verification evidence](../verification-02.md) records the four green gates, measured coverage, seven regression mutations, both-screen browser checks, and the closing Standards/Spec reviews. The review's Subject request-builder finding is fixed and regression-tested.

Export envelopes, versions, and existing custom prompt strings are unchanged. Sharing the extended token syntax requires an updated parser.
