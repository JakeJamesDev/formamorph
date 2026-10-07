# 05: Availability rule layout

Status: ready-for-human
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: editor layout and copy over fields that already exist; the design is settled by the prototype.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

The top of the trait panel's Availability tab reads as three rows and a sentence (Q2): **Mode** (Optional / Automatic / Hidden), **Starts** (Off / On), **In Game** (Fixed / Toggleable), then one line that states the rule they make. Under Automatic and Hidden, Starts and In Game are disabled, not hidden (Q4). Automatic is the editor's name for the Always On mode (Q3); the stored value does not change. The picker skips the bearer page when only one bearer can hold the target (Q20). Prototype: `prototype.html` beside the spec, top variant "rule".

## Acceptance criteria

- [ ] Three labeled rows of segmented controls, bound to the existing mode, default and toggle fields. No world changes because of the layout (story 24).
- [ ] Starts and In Game disable under Automatic and Hidden. Nothing appears or disappears when Mode changes.
- [ ] The summary sentence: for Optional it names the start state and whether the player can switch it; for Automatic and Hidden it states the mode's rule. The copy follows the Writing Guide.
- [ ] Mode labels read Optional / Automatic / Hidden in the editor and in the link override UI. Editor hints that say Always On say Automatic.
- [ ] Each row keeps its per-field **Reset** on a linked trait, as today.
- [ ] The Requires picker adds for the only bearer when exactly one can hold the target, and shows the bearer page when two or more can (Q20).
- [ ] The dev-router showcase for the trait panel shows the new layout. Verified in the preview at a realistic viewport in both themes (`verify-ui`).
- [ ] Component tests on the trait panel: the three rows, the disabled state and the sentence under each Mode, Reset on a link, the picker's single-bearer skip and two-bearer page. Each guard is shown to bite.
- [ ] Changelog fragment names the layout and the Automatic label.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
