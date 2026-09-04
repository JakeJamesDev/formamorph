# Settings Simple Mode

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

The settings popup exposes roughly sixty controls across five tabs. A normal player opening it to change the theme, connect a model, or bump the text size wades through reasoning strategies, memory tuning, sampler numbers, and raw prompt editors they will never touch — and could break their experience by touching. The World Editor already solved the same problem with its Simple/Advanced switch; settings has no equivalent.

## Solution

A Simple/Advanced mode switch in the settings popup header, defaulting to Simple. Simple hides the tabs, sections, and rows a normal user is unlikely to touch while keeping everything needed for everyday play: appearance, scene, narration feel, the core generation toggles, endpoint connection essentials, and all of Accessibility. Hidden settings keep applying; a dot on the Advanced switch signals when hidden settings hold non-default values. The switch mirrors the World Editor's mode in look, wording, persistence style, and behavior.

## User Stories

1. As a new player, I want the settings popup to open in Simple mode by default, so that my first impression is a small, understandable set of options.
2. As a player, I want a Simple/Advanced toggle in the settings header, so that I can reveal the full option set when I need it.
3. As a player, I want my chosen mode remembered on this device, so that I don't re-flip the switch every session.
4. As a power user, I want to set Advanced once and never see Simple again, so that the feature costs me nothing.
5. As a casual player, I want the Prompts tab hidden in Simple, so that I never face raw prompt editing surfaces.
6. As a casual player, I want the image Tag Prompt sub-tab hidden in Simple, so that prompt engineering stays out of sight.
7. As a player in Simple mode, I want Theme, Theme Color, Font, and all Scene and Narration rows except Paragraph Limit and Markdown Formatting, so that everyday presentation choices stay reachable.
8. As a player in Simple mode, I want the Turn Extras checkboxes and the Thinking mode picker visible, so that I can still control the core shape of a turn.
9. As a player in Simple mode, I want the Reasoning details, Memory, Performance, and Inspection sections hidden, so that curated defaults just work without tempting me to fiddle.
10. As a player in Simple mode, I want the Text endpoint preset picker, Endpoint URL, API Token, and Model Name visible, so that I can connect a model without switching modes.
11. As a player in Simple mode, I want Context Window and Max Output Tokens hidden, so that auto-detection handles them invisibly.
12. As a player in Simple mode, I want the image endpoint's preset picker, Connection section, Prompt Prefix, Negative Prompt, Steps/CFG, Sampler, and Face Fix visible, so that everyday image tweaking still works.
13. As a player in Simple mode, I want the image sizes, ComfyUI workflow editor, and InvokeAI board/encoder/VAE plumbing hidden, so that provider internals stay out of the way.
14. As a player who relies on Accessibility settings, I want that tab untouched in Simple, so that readability options are never harder to reach.
15. As a player with customized advanced settings, I want those settings to keep applying while hidden, so that switching to Simple never changes behavior.
16. As a player with customized advanced settings, I want a dot marker on the Advanced switch item, so that I know Simple is hiding non-default state.
17. As a player using the bundled local engine, I want the local model panel to keep its own Simple/Advanced toggle independently, so that its existing behavior is unchanged.
18. As a first-time user of the switch, I want a tutorial popover introducing it, so that I understand what Simple hides.
19. As a mobile player, I want the tab Select (the small-screen tab strip replacement) to omit hidden tabs, so that Simple works at every viewport.
20. As a developer, I want dev-router forcing of the settings mode, so that UI verification can land in either mode deterministically.
21. As a developer, I want the mode read to treat anything but the literal advanced value as Simple, so that corrupt or missing storage degrades safely.

## Implementation Decisions

- Mode is `'simple' | 'advanced'`, stored under its own localStorage key (`formamorph.settingsMode` style), read/written by a small module mirroring the World Editor's editor-mode module. Anything other than the literal `'advanced'` reads as Simple; storage failures are swallowed. Not part of the Settings context, not part of any export shape.
- Simple is the default for everyone, including existing users — no seeding by install age.
- UI: a Radix ToggleGroup labeled Simple / Advanced in the settings dialog header, styled and worded exactly like the World Editor's, wrapped in a TutorialPopover with one new tutorial entry.
- Hiding mechanism copies the editor pattern: a per-tab `advancedOnly` flag on the settings tab data (Prompts tab; Tag Prompt sub-tab similarly gated) plus inline conditionals on rows/sections at their call sites. No central field registry; this spec's table is the source of truth.
- Hidden set: Presentation hides Paragraph Limit and Markdown Formatting. Generation hides Native Reasoning, Limit Active Characters, and the whole Memory, Performance, and Inspection sections. Text endpoint hides Context Window and Max Output Tokens (preset management and the Reset button stay). Image endpoint hides Portrait/Landscape sizes, the ComfyUI workflow editor, and the InvokeAI board/encoder/VAE overrides. Prompts tab and Tag Prompt sub-tab hide entirely. Accessibility hides nothing.
- Hidden settings continue to apply; mode is purely a visibility filter.
- Dot hint: a pure function computes whether any hidden setting differs from its default (per the settings defaults module) or a non-built-in prompt preset is active. Auto-detected endpoint fields (Context Window) are excluded. When true, the Advanced toggle item shows the editor's dot marker with an explanatory title.
- The local model panel's existing Simple/Advanced toggle (the separate `advancedMode` boolean) stays fully independent.
- Dev-router: the settings route accepts a mode-forcing param, mirroring the editor's forced-mode mechanism, so both modes are reachable in one goto.
- Changelog gets an In-Progress entry (user-facing).

## Testing Decisions

- Good tests assert external behavior: which labeled tabs/rows are visible in each mode, not which conditionals ran.
- Seam 1: render the settings modal with the mode forced via its provider and assert tab list contents and representative row visibility in Simple vs Advanced (both directions: hidden in Simple, present in Advanced). Prior art: the World Editor mode tests and the GamePanels harness pattern of rendering with real providers and stubbed heavy views.
- Seam 2: unit-test the dot-hint pure function — default settings yield no dot; each category of hidden non-default value (a hidden toggle, a custom prompt preset) yields a dot; excluded fields (context window) never do. Prior art: the `worldUsesAdvancedFeatures` unit tests.
- Guard tests must bite: reinstating the bug (e.g. removing a row's conditional) must fail the test.

## Out of Scope

- Folding the local model panel's `advancedMode` into the new mode.
- Hiding preset management actions or the Reset AI Endpoint button.
- Any change to what hidden settings do, to defaults, or to export/save shapes.
- A docs-internal spec doc (declined; this file is the record).
- Migrating or seeding mode by user tenure.

## Further Notes

- The World Editor Simple-mode internal doc still carries a stale "Spec only — nothing built yet" header despite being shipped; fix in passing if convenient.
- Simple-mode wording is exactly "Simple" / "Advanced" everywhere, matching the editor.
