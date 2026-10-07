# 01: In Game copy sweep

Status: ready-for-human
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: a mechanical copy pass across labels, hints, docs and glossary entries; no logic.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

One term for "after the game has started": **In Game** (Q24). Today the app says In Play, In-Game, In Game and during play for the same moment. Sweep every user-facing string and the wiki so the label form is **In Game**, the adjective form is **in-game** (hyphen only before a noun: "in-game date"), and prose uses "in game" or "during the game". The Authoring Tour pane and the Entities wiki page are renamed too: "In Game" pane, "Entities in Game".

Independent of the other tickets. The editor's new rows take their labels from the spec.

## Acceptance criteria

- [ ] Trait panel: **Player Can Toggle In Game** and its hint read with the new term (the hint says "during the game", not "during play").
- [ ] Authoring Tour pane title and its tour step copy read **In Game**. Its dev route and `aria` ids may keep their names.
- [ ] Wiki: the Entities page title reads "Entities in Game"; the Personas headings "How to Change Persona During Play" and "Change It in Game" agree on the term; every "in play", "during play" and "in-game" in prose follows the hyphen rule. The surface map anchors follow any heading change, and the surface tests pass.
- [ ] Glossary and `CONTEXT.md`: the **In Play** term becomes **In Game**, with "In Play", "in-play" and "during play" under Avoid.
- [ ] Settings copy, the AI setup gate and the reveal demo use the term where they name the moment.
- [ ] Released changelog entries keep their text. Code identifiers are not renamed.
- [ ] The ticket's comments list every file changed, grouped by surface.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments

Files changed, by surface. Code identifiers, test titles, comments that already follow the hyphen rule and released changelog text are unchanged.

**Editor and tour copy**
- `src/managers/TraitManager.tsx`: label, reset label and hint (Player Can Toggle In Game; "during the game")
- `src/components/authoringTour/InPlayPane.tsx`: pane title
- `src/views/WorldEditor.tsx`: mobile sheet title
- `src/lib/authoringTour/steps.ts`: Dictionary step body
- `src/components/editor/OpeningInstrument.tsx`: start pool line
- `src/lib/builtinPlaceholders.ts`: Player Name hint

**Settings, setup and reveal copy**
- `src/components/modals/settingsCopy.ts`
- `src/components/AiSetupGate.tsx`
- `src/components/RevealAnimationDemo.tsx`

**Code and tool references (help and editor surfaces)**
- `src/lib/statCodeSurface.ts`, `src/lib/statCodeTemplates.ts`, `src/lib/statCodeTestRun.ts`, `src/lib/statCodeTurn.ts`
- `src/lib/tools/toolScriptSurface.ts`, `src/lib/testBench/rules.ts`
- `src/lib/helpTopics.ts`: topic title and wiki anchor; Trait label in the code reference
- `src/lib/formaquestion/helpCodeTest.ts`: pending-write line
- `docs-internal/changelog.d/trait-gate-rows-01.md`: the changelog fragment

**Wiki anchors and help index**
- `src/lib/docs/surfaceMap.ts`: Entities anchor
- `testing/baseline/help-baseline-cases.json`, `testing/baseline/help-recall-blind-cases.json`: Personas anchor
- `src/lib/formaquestion/sectionVectors.json` is not edited. A stale section drops out of Semantic search until the release rebuilds the vectors.

**Wiki and glossary**
- `docs/Entities.md` (title), `docs/Personas.md` (heading and body), `docs/Glossary.md`, `docs/Home.md`, `docs/_Sidebar.md`, `docs/How-to-Play.md`, `docs/Settings.md`, `docs/Starting-a-Game.md`
- `docs/Memory.md`, `docs/StatCodeGuide.md`, `docs/World-Editor-Traits.md`, `docs/WorldEditor.md`, `docs/WorldFormat.md`, `docs/Writing-Guide.md`
- `CONTEXT.md`: **In Game** replaces **In Play**; Avoid lists In Play, in-play, during play

**Tests and comments that name the pane or label**
- `e2e/authoring-tour.spec.ts`
- `src/views/WorldEditor.inPlay.test.tsx`, `WorldEditor.inPlayMobile.test.tsx`, `WorldEditor.tour{Dictionary,Entities,Locations,Stats,Traits}.test.tsx`, `WorldEditor.traitPanel.test.tsx`
- `src/managers/TraitLinkPanel.test.tsx`, `src/lib/statCodeTurn.test.ts`, `src/lib/statCodeTurn.owners.test.ts` (warning text), `e2e/tools-during-play.spec.ts`
- Comments and TSDoc: `src/types/world.ts`, `src/types/gameplay.ts`, `src/lib/persona.ts`, `src/lib/statCodeTraits.ts`, `src/lib/devRoutes.ts`, `src/components/modals/SettingsModal.tsx`
- `src/lib/authoringTour/{inPlay,inPlay.test,testLine}.ts`, `src/components/authoringTour/TourStepNote.tsx`, `src/lib/testBench/lens.ts`, `src/lib/traitRuntime.ts`
- Header comments in six component tests (`EntityCard`, `EntityListRow`, `LocationTabBody`, `SetupTraitList`, `StatRow`, `WorldCardFace`)

**Left alone, for a ruling**
- `src/components/game/ExperimentalPrompts.ts` says "changes during play" inside an AI prompt. A prompt change needs probe numbers, so the sweep skips it.
