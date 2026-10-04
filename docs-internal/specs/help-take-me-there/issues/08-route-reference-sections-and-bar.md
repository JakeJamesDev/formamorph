# 08: Route reference sections and meet the bar

Status: done
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A "what is this panel" answer and the four parent-routed how-tos get a button on the exact surface, and the route probe meets its bar.

- Every section the surface map ties to a screen, dialog or tab gets a route line equal to that surface id (Q40). A source test keeps the two in step: a surface-map target without a route line, or with a different one, fails.
- Four how-tos route one level deeper (Q41): the Worlds-tab tile menus, a preset's Options, and an entity's Openings, as ticket 05's miss table names them.
- Route changes from the grill (Q44–Q47): "How to Turn On Tools" → the Output tab; "How to Add a Self Opening" → the entity's Openings tab; "How to Enter a Contest" and "How to Publish a Prompt Preset" stay as chosen.
- The two how-tos ticket 03 left without a line (formaquestion-2, world-editor-entities-1 in the miss table) get one.
- The route probe reruns. Bar (Q39): surfaced task questions at 90% or better. The here kind is reported, not gated. The Answer carries the full table.
- Route lines add no text, so the recall probe runs once after, and the Answer reports it.

Spec: Q39–Q47; Implementation → Route tags in the docs; Probe.

Recommended model rationale: docs lines guided by two source tests and an offline probe.

## Acceptance criteria

- [x] Every surface-map target section carries its surface's route; the source test fails on a missing or different one, proven by removing a line.
- [x] The four granularity misses and the two unrouted how-tos route as the spec says.
- [x] Route probe: surfaced task hit rate ≥ 90%; the table is in the Answer.
- [x] Recall probe reported; a moved pick is named.
- [x] The four gates are green.

## Answer

**Route lines.** 90 new lines, 4 retargeted, 2 removed. Every surface-map section the index cuts out now carries its surface's route. A section tied to several surfaces takes one of their ids (the first tab, or the dialog itself): Library tabs `mainMenu.worlds`, Prompts list `settingsPrompts.narration`, Community tabs `community.world`, the entity panel, descriptions, openings and owned placeholders `worldEditorEntity.*`, the tour `worldEditorTour.world-name`, the library entity and dictionary editors `entityEditor` and `dictionaryEditor`.

**Q48 (spec session): a route line sits only at the index's section level.** 37 surface-map targets are `###` headings inside a `##` section, so each is no index section of its own. A line there folded into the parent, which adopted its first child's route (16 parents). Now `takeTagLines` takes a route line only from directly under the section's own heading; a deeper line stays in the text, and the bundled index test "shows no route line in a section" fails on it (proven by adding one). `surfaceRouteProblems` reads the real index, so it skips those 37. Two `####` how-to lines from ticket 03 in Formaquestion were the same case and are gone.

Parents given their own line on purpose (the common ancestor of their children):

| Section | Route |
|---|---|
| Library · Groups | `mainMenu` |
| How to Play · The Side Panel Tabs | `gameViewer` |
| Community Creations · Browsing | `community` |
| Community Creations · Profiles and Following | `profile` |
| Community Creations · Publishing | `publish` |
| Prompts · Prompt Presets | `settings.prompts` |
| Prompts · The Surfaces of a Prompt | `settings.prompts` |
| Tools · The Tool Editor | `settings.tools` |
| World Editor Dictionary · The Entry Panel | `worldEditor.dictionary` |

Left without a line, because their children sit on different screens or the app raises them itself: Community Creations · Your Account, App Updates, and the five LinkedContent parents (Linked Copies, Updates, Publishing, Downloading, Repairs).

**Routes moved (Q41, Q44, Q45).** How to Make a Group and How to Change a Tile's Size → `mainMenu.worlds`; How to Route a Prompt to Another Endpoint → `settingsPromptSurfaces.options`; How to Add a Self Opening → `worldEditorEntity.openings`; How to Turn On Tools → `settings.output`. Q46 and Q47 stand: How to Enter a Contest `publish.world`, How to Publish a Prompt Preset `settingsPromptPreset.overview`. The two how-tos with no line: How to Get Help for the Screen You Have Open → `formaquestion`; How to Import a SillyTavern Card → `worldEditor.entities` (the key's surface; its steps start in the library).

**Guard.** `surfaceRouteProblems` fails a section with no line or a line outside its surfaces. Proven on the real docs: removing the `settings.tools` line fails with `Tools#-tools is the section of settings.tools but has no route line`; changing one Tools line to another id fails with `but its route is …`.

**Route probe** (`npm run probe:help-route`, no model), before then after:

| Kind | Before | After |
|---|---|---|
| task, surfaced | 48 / 59 (81%) | **55 / 59 (93%)** |
| task, no surface | 14 / 16 | 14 / 16 |
| task, all | 62 / 75 (83%) | 69 / 75 (92%) |
| here, surfaced | 6 / 12 (50%) | 12 / 12 (100%) |

Bar (Q39): surfaced task 93% ≥ 90%. Remaining problems:

| Question | Expected | Route | Why |
|---|---|---|---|
| world-editor-openings-1 | `worldEditor.overview` | none | Keyed section "Weights and Chances" is a `###` reference section, not a surface-map target |
| world-editor-entities-2 | `worldEditorEntity.profile` | none | "Names and Aliases", same |
| world-editor-dictionary-2 | `worldEditorEntry.matching` | none | "What Gets Scanned", same |
| statcodeguide-2 | `worldEditorStat.code` | none | "The Story Clock", same |
| worldformat-1 | no surface | `mainMenu.worlds` | Reported only |
| linkedcontent-1 | no surface | `mainMenu` | Reported only |

**Recall probe** (cloud, `shipped` arm, 5 runs, 191 questions, 507 headings; run before the Q48 edits, which change no section text): known 85.8% (85.6–86.6), blind 86.6% (85.1–87.2). Ticket 06's run read 84.7 and 87.7. The sections the pick request lists are text-identical to Base, so no pick is named as moved; the differences are cloud drift.

**Notes for you.** The changelog's Take Me There lead now says the button also shows for the section that describes one screen, dialog or tab. `docs/Changelog.md` and the bundled-docs test for How to Turn On Tools changed with Q44.
