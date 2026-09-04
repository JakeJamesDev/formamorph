# Spec: Stat Row Descriptor Display + Typeable Value

Status: done

## Problem Statement

During play, a stat is shown only as a number and a bar. The descriptor bands the author wrote — the words the AI is actually told ("Winded", "Flush") — are invisible to the player, so the player never sees the status the narrator is reacting to, and the moment a stat crosses into a new band passes silently.

Separately, manually editing a stat mid-game offers only a slider. On a wide-range stat, landing an exact value with a slider is fiddly; there is no way to just type the number.

## Solution

Each visible stat row in the in-game Stats tab gains a descriptor line under its bar: the band the current value falls in, in muted small text, live-updating with the value and flashing brighter when the band changes. In edit mode, the numeral in the row's readout becomes a small number field — type a value and it commits on every keystroke, clamped live to the stat's range, with the slider still below for coarse adjustment.

Validated by prototype: variant A ("Settled") won against an inline-descriptor/blur-commit variant and an in-bar-overlay variant.

## User Stories

1. As a player, I want to see the descriptor word for each stat's current value, so that I know the status the AI narrator is being told about me.
2. As a player, I want the descriptor to sit in its own quiet line under the bar, so that it reads as a gloss on the stat without competing with the name or number.
3. As a player, I want the descriptor to update live while I drag the edit slider, so that I can discover where the band boundaries are by feel.
4. As a player, I want the descriptor to flash brighter when a turn moves a stat into a different band, so that "I just became Winded" is legible without reading every number.
5. As a player paging back through past turns, I want each turn's descriptor shown and its band change flashed in, so that history reads the same way live play does.
6. As a player, I want no placeholder text when a stat has no band, so that authoring gaps aren't presented to me as UI noise.
7. As a player of a world with no descriptors at all, I want the compact stat list I have today, so that the feature costs nothing when unused.
8. As a player of a world with descriptors, I want every stat row the same height whether or not its value currently has a band, so that the list doesn't reflow as values move.
9. As a player, I want a long descriptor truncated with the full text on hover, so that a paragraph-length band can't push other stats off screen.
10. As a player in edit mode, I want to type an exact value in place of the readout numeral, so that I don't have to land precise numbers with a slider.
11. As a player typing a value, I want each valid keystroke applied immediately, so that the bar, descriptor, and morphs track what I type the way they track the slider.
12. As a player typing a value, I want out-of-range input clamped as I type, so that the stat's range is never violated even transiently.
13. As a player, I want focusing the field to select the whole number, so that overwriting is one gesture.
14. As a player who clears the field, I want the stat to hold its last value and the text to snap back on blur, so that an empty field never commits garbage.
15. As a player on mobile, I want the field to raise a numeric keyboard, so that typing a value isn't a hunt through a full keyboard.
16. As a player using a mouse, I want wheel-stepping on the focused field, so that fine adjustment works the same as other number inputs in the app.
17. As a player in edit mode, I want the slider kept below the field, so that coarse and fine adjustment coexist.
18. As a player in edit mode, I want the delta chip and range suffix unchanged, so that the row reads identically except the numeral is typeable.
19. As a screen-reader player, I want band changes announced politely and the field labeled with the stat's name, so that the feature isn't visual-only.
20. As a player with reduced motion enabled, I want no flash animation but everything else intact, so that motion preferences are respected.
21. As a player viewing a past turn, I want editing (field and slider) unavailable, so that history stays read-only.
22. As a world author, I want the in-game band lookup to be the same one the AI prompt uses, so that the player and the narrator can never disagree about a status.
23. As a world author, I want hidden stats to stay hidden and contribute nothing to the layout rule, so that the hidden flag keeps meaning hidden.

## Implementation Decisions

- **Single band lookup.** The descriptor shown is computed by the existing active-descriptor function in the stat context module — the same lookup the AI prompt and the Test Bench use. No second banding implementation.
- **Placement and style.** Own line under the bar (or slider, in edit mode), left-aligned, meta text size, muted foreground, truncated with the full text as a title tooltip.
- **No-band rendering.** Nothing — no em dash, no "no status".
- **Reserved-line rule.** If any visible stat in the world carries descriptors, every visible stat row reserves the line's height; if none do, no row does. Hidden and trait-disabled stats don't count.
- **Flash.** On band change from turn advance, paging to a past turn, and slider scrubbing — not from typing, not from toggling edit mode, not on first render. Suppressed under reduced motion. The animation is a brightness flash, not a fade-in — text jumps to full foreground color, holds briefly, decays to muted. From the prototype (keyframes encode the accepted feel):

  ```css
  @keyframes stat-band-flash {
    0%   { color: hsl(var(--foreground)); }
    25%  { color: hsl(var(--foreground)); }
    100% { color: hsl(var(--muted-foreground)); }
  }
  /* 1.2s ease-out both */
  ```

- **Band-change detection.** Previous-band tracked per row (a ref), mount-suppressed; a typing flag suppresses the flash for field-driven changes. Prototype-validated shape.
- **Field form.** In edit mode the readout numeral becomes a compact number input; the suffix (`/ max` or `%`) stays static text; the delta chip stays. The slider remains below, unchanged.
- **Commit model.** Every keystroke that parses to a number commits through the existing manual-stat-edit path (same as the slider). Clamp to `[min, max]` live on both bounds. Integers, step 1, tracking the rounded readout. Empty (or unparseable) input is the one allowed transient: field may read blank, stat holds, blur snaps the text back to the committed value. Select-all on focus.
- **Shared input component.** Use the app's shared number input so wheel-stepping and spinner clamping come for free; `inputMode` numeric for the mobile keyboard.
- **Accessibility.** Descriptor line is a polite live region, debounced so a scrub announces once on settle, not per band crossed. Field gets an aria-label naming the stat; native min/max carry the range semantics.
- **Deliberately untouched.** Coded stats stay editable with no hint (their next-turn recompute is pre-existing behavior, noted as a separate item). Prompt building, world shape, and save shape are unchanged. Max/min/regen are not editable in play. Past turns stay read-only.
- **Changelog.** Two player-facing entries (descriptor display; typeable value) — separately noticeable changes.

## Testing Decisions

- **Good tests here assert external behavior**: what the row renders, what a keystroke commits, which class the flash span carries — never internal refs or state names.
- **Seam 1 — RightPanel through the existing GamePanels test harness** (real providers, no GameViewer): descriptor text for a banded value; nothing rendered above every band; reserved line present in a descriptor-carrying world and absent in a bare one; field appears in edit mode and commits typed values; flash class present after a paged band change and absent after a typed one.
- **Seam 2 — a new pure function in lib** owning the typed-field step contract (input text + previous value + range → next text + commit-or-hold). Table-tests the clamp matrix: both bounds, min-above-zero prefix typing, empty, junk, decimals. Precedent: the stat bar's pure geometry function extracted from the same panel.
- Each new guard is proven by reinstating its bug and watching it fail (project test bar).
- Prior art: existing RightPanel describe blocks in the GamePanels test file; the stat context unit tests for band lookup (untouched, already cover the lookup).

## Out of Scope

- Editing max, min, or regen during play.
- Any hint or lock on coded stats (formula recompute overwriting manual edits is pre-existing).
- Prompt or AI-context changes of any kind.
- The Test Bench's Opening instrument (already has its own band display).
- World or save export-shape changes.
- The B and C prototype variants (inline descriptor, in-bar overlay) — rejected.

## Further Notes

- Prototype lives in the working tree: a throwaway variants module beside the game panels, a DEV-gated branch in the stats tab, and descriptor bands + a min-10 Warmth stat added to the whiteRoom dev fixture. The fixture enrichment is worth keeping for verification (it exercises bands, truncation, and the low-bound clamp); the variants module and the panel branch are torn out when the real implementation lands.
- Verification recipe: boot `whiteRoom` via the dev router; Warmth (min 10) is the low-clamp case, Coin's top band is the truncation case, paging Previous crosses real band changes on all three stats.
- The prototype surfaced one trap for any future global key handling: arrow keys bubble from slider thumbs, which aren't inputs — guard `[role="slider"]`, not just input tags.
