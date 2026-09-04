# Placeholder UX Polish — Spec

Status: done
Status note: shipped in commit 228d734 (2026-09-01); open points listed in the session report

Five improvements to how placeholders read and behave in the World Editor: a preview dice on the
placeholder panel, chips colored by draw chance, a reroll button on placeholder-capable editboxes, the
placeholder palette on the Placeholders tab, and an audit of surfaces that still print raw
placeholder tokens.

## Problem Statement

An author who builds a placeholder cannot see what it does without placing it in world text and
opening a Preview tab somewhere else. The values list shows odds only behind an eye toggle, and every
chip looks the same whether it rolls 90% of the time or never. Nested placeholders inside values
carry an identity color but say nothing about how likely they are to appear. A field's Preview
re-draws every time it opens, so the same placeholder shows different text from one field to the
next and there is no way to draw again on purpose. On the Placeholders tab the click-to-insert
palette is hidden, even though values now accept chips. Finally, the Test Bench's Location picker,
its Placeholder Rolls lines, and a handful of editor surfaces print raw `{{ph:...}}` tokens.

## Solution

- A **dice button** on the placeholder panel, between Kind and Values, draws once and shows the
  fully resolved text inline. Each click draws again. Nothing persists.
- **Chips carry their draw chance in color, always.** Plain-text value chips run a ramp from muted
  (0%) through the current secondary tone (50%) to primary (100%). Reference chips keep their
  identity hue and vary saturation by *effective* chance: parent chance times own chance, multiplied
  down the chain. The eye toggle keeps gating only the numeric percent suffix, which on nested chips
  shows the effective percent.
- A **Reroll button** on every placeholder-capable editbox toolbar, left of undo/redo behind a
  hairline separator, visible only when the text contains a placeholder. It redraws the contained
  placeholders, transitively, in a new **editor preview-roll store** shared by every field. Field
  Previews read that store, so they stay stable across opens and agree across fields. The Test
  Bench's Opening store stays separate.
- The **placeholder palette shows on the Placeholders tab** and over the placeholder editors
  embedded in the Entity and Dictionary library modals. The palette omits the focused value's own
  placeholder and its ancestors, so a value can never reference itself.
- **Raw-token audit.** Bench surfaces render the bench's rolled value; un-drawn reference options in
  a pool line render the referenced placeholder's name, chip-styled. Editor surfaces outside the
  bench use the existing pretty-print convention.

## User Stories

1. As a world author, I want a dice button on a placeholder's panel, so that I can see what the placeholder produces without placing it anywhere.
2. As a world author, I want each dice click to draw again, so that I can sample several outcomes quickly.
3. As a world author, I want the dice result to resolve nested references, so that I see a real final string rather than tokens.
4. As a world author, I want the dice result to disappear when I leave the placeholder, so that stale samples never look like saved state.
5. As a world author, I want the dice hidden when a placeholder has nothing rollable, so that the button never produces an empty result.
6. As a world author, I want value chips colored by draw chance at all times, so that I can read a placeholder's shape at a glance.
7. As a world author, I want a benched value (weight 0) to look muted, so that I can spot values that never fire.
8. As a world author, I want a certain value (100%) to look primary, so that a single-value placeholder reads as fixed.
9. As a world author, I want a 50% chip to look like chips do today, so that the change does not make my existing worlds look wrong.
10. As a world author, I want nested reference chips to keep their identity hue, so that I can still match a chip to its placeholder across the editor.
11. As a world author, I want a nested reference chip's saturation to reflect its effective chance, so that a 10% branch inside a 50% branch reads as unlikely.
12. As a world author, I want the eye toggle to keep gating the percent numbers, so that the list stays clean unless I ask for numbers.
13. As a world author, I want a nested chip's percent number to match its color, so that the number and the color never disagree.
14. As a world author, I want the coloring wherever value chips appear, including shared read-only rows and the library modals, so that the rule is consistent.
15. As a world author, I want a Reroll button on any editbox that supports placeholders, so that I can draw again without leaving the field.
16. As a world author, I want the Reroll button to sit left of undo/redo behind a separator, so that it reads as a distinct toolbar group.
17. As a world author, I want the Reroll button hidden when the field contains no placeholder, so that the toolbar stays uncluttered.
18. As a world author, I want a reroll to redraw every placeholder the field references, including ones reached only through nested values, so that the whole preview changes together.
19. As a world author, I want a rerolled placeholder to show the same new value in every other field's Preview, so that one placeholder never shows two values at once.
20. As a world author, I want opening a field's Preview to keep the current rolls, so that previews are stable until I choose to reroll.
21. As a world author, I want the editor's preview rolls to never touch a game save or a live session, so that authoring cannot corrupt play.
22. As a world author, I want the Test Bench's Opening rolls to stay independent of field previews, so that its trait pins never silently override what a field shows.
23. As a world author, I want the placeholder palette visible on the Placeholders tab, so that I can click a placeholder into a value.
24. As a world author, I want the palette visible over the placeholder editor inside the Entity and Dictionary library modals, so that those editors work the same way.
25. As a world author, I want the palette to hide the focused value's own placeholder and its ancestors, so that I cannot create a reference loop.
26. As a world author, I want the Test Bench Location picker to show a location's rolled name, so that the picker matches what the prompt would contain.
27. As a world author, I want the Test Bench PC picker and its group headings to show rolled trait names, so that no raw token appears in the dropdown.
28. As a world author, I want a Placeholder Rolls row's drawn result to show its rolled text even when that text contains a nested chip, so that the header is readable.
29. As a world author, I want un-drawn reference options in a pool line to show the referenced placeholder's name, so that branches that did not fire never display invented text.
30. As a world author, I want trait pin lines and broken-pin notes in the bench to show resolved values, so that pins are legible.
31. As a world author, I want dictionary book names to render resolved in the tree, the editor modal title, and the add pickers, so that book names can use placeholders like everything else.
32. As a world author, I want the trait conflict note to show the resolved trait name, so that conflicts read correctly.
33. As a world author, I want the dictionary export label and filename to use the resolved book name, so that exports match entities.
34. As a world author, I want all of this to work in both editor modes where the underlying surface exists, so that nothing depends on a mode I do not use.

## Implementation Decisions

- **One-shot draw helper** in the placeholder library: takes a placeholder, the placeholder set, and merged weights; returns fully resolved text using a throwaway resolve context with no roll persistence. The dice button and nothing else calls it. Reuse the existing weighted picker; export it rather than duplicating it.
- **Effective chance** is a pure function over the ownership tree: a value's local chance times the chance of every ancestor value on the path. Top-level chips in world text are 100%. The values list computes it once per placeholder render and passes it to chips.
- **Chance→color mapping** is one pure function with two modes. Plain-text chips: a three-stop interpolation over the theme's muted, secondary, and primary background tokens, in a perceptual color space, with foreground contrast preserved at every stop. Reference chips: the existing identity hue with saturation scaled by effective chance, floor at a neutral gray. Applied as inline style, the same mechanism reference chips use today.
- **Eye toggle semantics unchanged**: it gates the percent suffix only. The suffix on a reference chip shows effective percent.
- **Editor preview-roll store** is a new context provided at the World Editor and the library modals. It holds one drawn value per World-mode placeholder and one per placement chain for Unique-mode, the same shape the session store uses. It primes lazily on first read and stays stable until a reroll. Reroll takes a set of placeholder ids, redraws them and every placeholder reachable through their values, and leaves all others untouched. Field Previews read from it instead of minting rolls on open; the per-field roll nonce goes away.
- **Reroll button** lives in the placeholder-capable field's toolbar chrome as a fourth group with its own hairline separator, using the shared toolbar button style and a dice icon. Visible when the field's text contains at least one placeholder token. It collects the field's tokens and calls the store's reroll.
- **Palette gating**: the World Editor stops excluding the Placeholders tab from the shared palette bar; the stale comment justifying the exclusion is removed. The library modals move their embedded placeholder editor inside the insert-target provider so the existing bar reaches it. The per-field palette row stays suppressed when a shared bar exists, as today.
- **Cycle filter**: the palette computes the excluded set from the focused insert target's owning placeholder and its ancestors via the ownership tree module. A value box exposes its owning placeholder id to the insert target. Fields outside the Placeholders tab exclude nothing.
- **Bench display**: the lens option builders resolve names with the existing bench text resolver. The Opening builder resolves stored roll texts and pin values with the bench's rolls, and maps pool options to display labels: plain text as-is, a lone reference to the referenced placeholder's name marked as a reference so the row can chip-style it. The Placeholder Rolls row renders that label with the reference's identity color.
- **Non-bench audit fixes** switch each raw string to the existing pretty-print function or the rich placeholder text component, matching the adjacent surfaces that already resolve.
- **No export-shape change.** The preview-roll store is editor UI state only. Nothing in the world or save JSON changes.

## Testing Decisions

- A good test exercises behavior through the seam an author or a caller sees: a function's output for a given world, or a rendered control's presence, text, and style. No test asserts internal state, hook call order, or intermediate values.
- **Pure placeholder library**: draw helper resolves nested references and respects weights; effective chance multiplies down the chain and is 100% for top-level chips; color mapping hits the three stops and clamps; cycle filter excludes self and ancestors and nothing else. Prior art: the existing placeholder and placeholder-tree test suites.
- **Bench builders**: lens option names resolve; opening pool lines label references by name and mark them; stored roll texts and pin values resolve. Prior art: the existing lens and opening test suites.
- **Editor preview-roll store**: two reads return the same value; reroll of one id changes that id and its transitive references and no others; the store never writes to the session context. Prior art: the placeholder session context test suite.
- **Component seams**: the placeholder panel shows the dice only when rollable and renders a result on click; chips carry the expected inline color for 0%, 50%, 100%; the toolbar shows the reroll button only with a placeholder present and calls reroll; a library modal renders the palette over its placeholder editor. Prior art: the placeholder manager, keyword chips, and prompt-field history test suites.
- Each guard is proven by reinstating the bug once (reverting the resolve call, removing the filter) and watching the test fail.

## Out of Scope

- Any change to gameplay rolls, the session store, save files, or world export shape.
- Unifying the bench's Opening store with the editor preview store.
- A dice animation or shuffle effect; the result appears immediately.
- Coloring in the multiline values style beyond its existing always-visible numbers.
- Prompt text changes; no AI-call text is touched.
- Rendering the app's own changelog or community changelogs; those are not world text.

## Further Notes

- Grilling settled: ephemeral dice result; shared preview rolls; multiplied effective chance with the
  identity hue's saturation as the nested channel; effective percent in labels; referenced name for
  un-drawn pool options; filter-the-menu cycle guard; all four audit groups; palette in both the tab
  and the modals; separate roll stores.
- The bench display rule respects the Test Bench ADR: every shown value is computed by the harness.
- Suggested ticket order: audit fixes, preview-roll store and reroll button, chip coloring, palette
  gating and cycle filter, dice button.
