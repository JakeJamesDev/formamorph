# 05: Route-accuracy probe

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An offline report of how often the keyed section's route matches the surface a question is about, so the user can set a bar.

- The keyed task and here questions gain an expected-surface field, authored once.
- A new probe in the baseline harness scores, with no model run: for each question, the keyed section's route against the expected surface. Output is a table per kind with hit, miss and no-route counts, and the misses by name.
- The first run's table goes in the ticket's Answer. The bar is the user's to set after (Q20).

Spec: Q20; Implementation → Probe.

Recommended model rationale: a pure scorer and a data field, with the harness's rescore path as prior art.

## Acceptance criteria

- [x] Every keyed task and here question has an expected surface.
- [x] The scorer is tested on a fixture: hit, miss, no-route and the table shape.
- [x] The first report is in the Answer; no bar is asserted.
- [x] The four gates are green.

## Answer

Run it with `npm run probe:help-route`. No model runs. Code: `testing/baseline/harness/help-route-score.ts` (pure scorer) and `help-route-probe.cli.ts`.

**The field.** `expectSurface` on each task and here question in `testing/baseline/help-baseline-cases.json`: the deepest surface id that holds the control the question is about, or `null` when the steps have no single surface (Q34). I authored all 87 from the questions and the control names, before I ran the probe, never from the docs' route lines. A source test refuses an unknown or excluded id, and refuses a here question whose expected surface is not one the player has open.

**Scoring.** A surface is expected: `hit` when the route equals it, `miss` when it differs, `no-route` when the section has none. `null` expected: `hit` when the section has no route, `miss` when it carries one. Each kind prints a "surfaced" line and a "no surface" line, so the bar can cover surfaced questions only or all of them.

**First run (2026-10-04, after ticket 03).**

```
task (75 questions)
  surfaced    hit  48  miss   4  no-route   7
  no surface  hit  14  miss   2

here (12 questions)
  surfaced    hit   6  miss   0  no-route   6
  no surface  hit   0  miss   0
```

| Kind | Surfaced hit rate | No-surface hit rate | All questions |
|---|---|---|---|
| task | 48 / 59 (81%) | 14 / 16 (88%) | 62 / 75 (83%) |
| here | 6 / 12 (50%) | none | 6 / 12 (50%) |

Misses and no-routes by name:

| Question | Expected | Route | What it shows |
|---|---|---|---|
| library-1, library-2 | `mainMenu.worlds` | `mainMenu` | Tile menu steps; the route is the screen, not the Worlds tab |
| prompts-1 | `settingsPromptSurfaces.options` | `settings.prompts` | Steps start in a surface one level down |
| world-editor-openings-4 | `worldEditorEntity.openings` | `worldEditor.entities` | Steps end on the entity's Openings tab |
| worldformat-1 | no surface | `mainMenu.worlds` | The JSON edit is outside the app; the Export and Import buttons are on the Worlds tab |
| linkedcontent-1 | no surface | `mainMenu` | The steps run in the library and in the editor |
| formaquestion-2, world-editor-entities-1 | `formaquestion`, `worldEditor.entities` | none | How-tos with no route line |
| world-editor-openings-1, -2 | `worldEditor.overview`, `worldEditorLocation.openings` | none | Reference sections |
| world-editor-entities-2 | `worldEditorEntity.profile` | none | Reference section (Aliases) |
| world-editor-dictionary-2, statcodeguide-2 | `worldEditorEntry.matching`, `worldEditorStat.code` | none | Reference sections |
| here-output-tab, here-memory-tab, here-trait-availability, here-backup-dialog, here-ai-context, here-bench-issues | the open surface | none | Six of the 12 here questions key a tab or dialog reference section; only a how-to carries a route, so these can never route |

Readings for the bar (the bar is yours, Q20):

- Four of the 13 task problems are one level of granularity: the route is the parent of the control's surface (library-1, library-2, prompts-1, world-editor-openings-4).
- Seven of the 13 are a section with no route line. Five of those are reference sections (world-editor-openings-1 and -2, world-editor-entities-2, world-editor-dictionary-2, statcodeguide-2), so a how-to-only route rule leaves them without a button by design. The other two are how-tos ticket 03 left without a line (formaquestion-2, world-editor-entities-1).
- The here kind scores 50% because half its keyed sections are reference sections. If the button should serve a "what is this panel" question, those sections need a route line; today they have none.
- Two no-surface misses (worldformat-1, linkedcontent-1) carry a route that points at the first screen of a flow. Decide whether that button helps or misleads.
