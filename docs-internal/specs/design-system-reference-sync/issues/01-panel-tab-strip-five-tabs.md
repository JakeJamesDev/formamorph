# 01: Panel Tab Strip shows five entity tabs and the guide matches

Status: ready-for-human
Base: c8a7f81d
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

The Panel Tab Strip reference renders the entity strip from its production registry with a body for every tab, so Traits and Openings open text that says what they hold. The section heading reads "Five Tabs", and the sections stay in descending tab count.

The guide's tab table lists Profile, Descriptions, Traits, Openings, and Placeholders for the entity panel. It says Openings and Placeholders are Advanced-only, and that the library entity editor lifts Traits and Placeholders onto its own top strip so its sub-strip shows fewer. The width figures are measured again at 375px and in the half-width pane between `md` and `xl`, and replace the three-tab figures. The label breakpoints change only if the measurements show a label now fits or overflows where it did not before. The sentence that leaves the stat strip out names the trait strip as its width twin, three equal columns.

Two guards protect the reference: every tab in every registry the reference renders opens a non-empty body, and every heading's tab count equals its registry's length.

Recommended model rationale: reference and guide edits against settled registries; the width measurement is the only open-ended step.

## Acceptance criteria

- [x] Every tab in the entity, location, trait, and dictionary entry strips opens a body with text
- [x] The entity section heading says "Five Tabs" and the sections run five, four, three, two
- [x] The guide's tab table, Advanced-only note, library top-strip note, width figures, and stat-strip sentence match the registries and the new measurements
- [x] A test fails when a registry gains a tab with no body entry, proven by removing one entry
- [x] A test fails when a heading's count disagrees with its registry, proven by changing one heading
- [x] The reference description still says what it shows and where to act; new copy has a Writing review entry
- [x] The existing width e2e specs and the showcase registry test pass
- [x] Four gates green; verified in the showcase at desktop and 375px, both themes

## Comments

- Width figures come from Playwright in the World Editor. Every drawn label fits: at `xl` the trigger is 114px and "Placeholders" draws 106px with its icon. So the breakpoints stay. The two-tab 157px figure is derived from the measured 314px strip interior.
- The location `Meta` line lost "where each tab has less room", which became false; the entity line now says it.
