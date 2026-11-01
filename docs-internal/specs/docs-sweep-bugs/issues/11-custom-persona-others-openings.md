# 11: Mark the Custom Persona's Others Openings

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: new editor copy under the Writing Guide, the world openings view and the panel hint, all for one entity kind.

## What to build

The Custom Persona entity shows an Others/Self switch, but its Others openings never draw, and nothing says so. Ruling Q5: the switch stays. Each Others row on the Custom Persona carries a mark that it never draws. The world openings view drops its draw chance for those rows. The panel hint that says an entity's openings join at its locations is made true for the Custom Persona.

Spec: Q5, Implementation Decisions "Custom Persona openings". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] An Openings panel test with an Others row on the Custom Persona fails today (no mark), then passes: "marks an Others row with a dash for its chance", red then green; nine guards mutation-tested
- [x] The world openings view shows no draw chance for those rows (pure test); a Self row keeps its chance: "marks its Others rows and drops their chance"; DOM read in the preview, dash and 100%
- [x] The switch still shows on the Custom Persona (the existing switch test stays green): "shows on the Custom Persona entity" unchanged and green
- [x] The mark and hint copy follow the Writing Guide (copy-sweep on the changed strings): `copy:sweep` has no notice on the new strings; review fold-in unified the tip to "draws"
- [x] World-Editor-Openings describes the mark; the docs tests are green: `src/lib/docs` tests green, 412/412 with the opening suites
- [x] A changelog fragment under Minor / Fixed / 👤: `docs-internal/changelog.d/docs-sweep-bugs-11.md`

## Landed

Spec-session rulings for this ticket: a dash on the entity's own Openings tab too, no **No Starting Location** badge on the Custom Persona, a picked start hides these rows, and library entities stay as they are.

**Not verified:**

- The Never Draws tip's text in a live hover: no test or preview check hovered it.

**For you:**

- Look at the mark on a Custom Persona Others opening in the World Editor. Frame: `.scratch/docs-sweep-bugs-11/frames/never-draws-mark.png`.
- Left out by ruling, your call: an unpicked Persona-Only entity's Others rows have the same gap (the world panel shows a chance and no mark, though they never draw).
- Left out by ruling, your call: the Openings checkbox and the panel's footer hint count Custom Persona Others rows, but the game counts only its Self rows. A world whose only text is on those rows shows "Draws one opening by weight", but its game starts on the default opening.
