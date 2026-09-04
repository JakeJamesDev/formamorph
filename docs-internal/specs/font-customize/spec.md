# Font Customize Dialog

Status: done
Status note: verified shipped in the 2026-08 status sweep (Customize… beside both font pickers, changelog In-Progress)

## Problem Statement

Fonts differ in how they render weight and style. In JetBrains Mono, markdown bold barely reads as bold (the app renders bold at weight 600 while the font's axis goes to 800, where ink coverage is +24% higher), and its true italic is a shallow slant that reads as subtle. Players who pick a font have no way to compensate for that font's quiet bold, tight rhythm, or overall size — the only knobs are narration-wide, not font-aware.

## Solution

A "Customize..." button beside both font selectors (the global app Font in Presentation and the Narration Font in Accessibility) opens a dialog of per-font tuning sliders — font scale, bold weight, italic skew, line height, letter spacing — with live-updating sample text inside the dialog. Save applies the tunings app-wide; Cancel discards. Each font (including the System default) carries its own saved tunings plus shipped defaults, with a per-font Reset. JetBrains Mono ships pre-tuned with bold weight 800 so the fix lands without anyone opening the dialog.

## User Stories

1. As a player, I want a Customize button next to the font picker, so that I can tune the font I chose without hunting elsewhere in Settings.
2. As a player using the Narration Font selector, I want the same Customize button there, so that tuning is reachable from wherever I picked the font.
3. As a player, I want a font scale slider (0.7–1.5, step 0.1, default 1.0), so that I can make my chosen font larger or smaller than the app's normalized size.
4. As a player, I want a bold weight slider, so that bold text actually stands out in fonts whose 600 weight is quiet.
5. As a JetBrains Mono user, I want bold pre-set to 800 out of the box, so that markdown bold is legible without my configuring anything.
6. As a player, I want an italic skew slider (0–10°, default 0), so that I can exaggerate italics in fonts whose true italic is subtle.
7. As a player, I want a line height slider, so that I can loosen or tighten a font's vertical rhythm.
8. As a player, I want a letter spacing slider, so that I can open up dense fonts or the accessibility fonts.
9. As a player, I want sample lines in the dialog (regular, bold, italic) that update live as I drag sliders, so that I can judge the effect before committing.
10. As a player, I want Save to apply my tunings to the whole app and Cancel to discard them, so that experimenting is risk-free.
11. As a player, I want each font to remember its own tunings, so that switching fonts switches to that font's saved look.
12. As a player, I want tunings shared between the global and narration uses of the same font, so that one tuning job covers both.
13. As a System-font user, I want the OS-stack default to be tunable like any other font, so that I'm not excluded from the feature.
14. As a player, I want a Reset to Defaults button in the dialog, so that I can return the current font to its shipped tuning (not a blank slate).
15. As a player who has tuned bold weight, I want semibold and bold UI text to stay visually distinct, so that raising bold doesn't flatten the type hierarchy.
16. As a player using the narration Reading Scale and Line Height sliders, I want per-font tunings to compose with them, so that my accessibility preferences survive font tuning.
17. As a player, I want tunings persisted locally across sessions, so that my setup survives a reload.
18. As a player on mobile, I want the dialog usable at small viewports, so that tuning isn't desktop-only.
19. As a player, I want slider changes inside the dialog to leave the app untouched until Save, so that a game in progress doesn't flicker while I experiment.

## Implementation Decisions

- **Per-font storage, one set per font value** (including `system`), persisted in the settings context / localStorage. No world or save export shape change.
- **Shipped defaults live in the font registry** alongside the existing per-font `fsa` override; JetBrains Mono ships `boldWeight: 800`. Reset restores the registry defaults for that font.
- **Font scale multiplies the font-size-adjust target** — it rides the existing x-height normalization pipeline rather than root font-size, so layout spacing is untouched.
- **Bold weight is a CSS variable read by all semibold and bold utility usage app-wide** (per the user's call: everything semibold+, not just prose). The slider sets the semibold value; bold rides +100 above it, clamped to the font's available axis. Known consequence: at JBM's seeded 800, semibold and bold coincide (the axis tops out at 800) — accepted, since 800 is the fix.
- **Italic skew is an additive `skewX` transform on italic/emphasis elements**, default 0 everywhere. The variable face has no `slnt`/`ital` axis, so transform is the only lever beyond the real italic face.
- **Line height and letter spacing are per-font CSS variables**; line height composes multiplicatively with the existing narration Line Height slider, letter spacing is em-based tracking.
- **Dialog modeled on the narration reveal animation menu**: draft state local to the dialog, live sample text (regular/bold/italic) rendered from the draft, Save commits to the settings context, Cancel/close discards. Application to the document happens only via the settings context's existing root-CSS-variable effects.
- **Both selector locations open the same dialog** for whichever font that selector currently has active; tunings are keyed by font, not by selector.
- New settings defaults follow the project convention (defaults module; no `VITE_DEFAULT_*` twins expected).

## Testing Decisions

- **Seam: document-root CSS variables under the real settings provider** — the same seam the settings context already uses to apply fonts. Tests render the dialog inside the real provider, drive sliders, and assert root variable values.
- Good tests assert external behavior only: after Save the root variables reflect the draft; after Cancel they do not; switching fonts swaps to that font's stored tunings; JetBrains Mono yields the seeded 800 with no user action; Reset restores registry defaults; bold clamps at the font's axis maximum.
- Persistence round-trip: tunings survive a provider remount (localStorage), and an invalid stored value falls back to defaults (matching the existing codec-validation pattern).
- Prior art: the existing settings modal alignment tests and the GamePanels test harness (real providers, no GameViewer); Radix-in-jsdom portal caveats apply.
- One live check in the preview via the dev-router for the dialog itself; no motion or timing assertions.

## Out of Scope

- Raising Streamdown's markdown-bold from 600 to 700 as a separate global change (subsumed by the bold-weight variable).
- Word spacing and paragraph spacing sliders.
- `font-style: oblique` angle control (rejected in favor of additive skew).
- Any per-selector (narration vs global) independent tunings for the same font.
- OS text-scaling / reduced-motion interactions beyond what existing settings already handle.
- Export of tunings with worlds or saves.

## Further Notes

- Ink-coverage measurements motivating the feature (same string, 40px): 600 → 817, 800 → 1013 (+24%). The variable face loads at `100 800`, so 800 is the ceiling.
- The italic face is real, not synthesized (`font-synthesis` changes would be a no-op); skew is exaggeration, not repair.
- Sliders in the dialog must not write the settings context while dragging — the live preview is scoped to the dialog's sample text.
