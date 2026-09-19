# 06: World Personas

Status: ready-for-human
Base: 759e80df
Blocked by: 03, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Persona](../spec.md)

**What to build:** An author marks world entities as playable, and the player can play as one. The picker lists the world's own personas under their own heading, apart from library personas. The played entity leaves the cast for that playthrough and returns when the player switches away. The Persona chip tells the AI that the other entities of this world know this person. Picking a world persona preselects the starting location.

**Rationale for the model:** the ticket joins the picker, the cast filter, and new prompt text with its own probe run. A strong model at high effort.

## Acceptance criteria

- [ ] Only world entities that carry the mark appear in the picker. The reference stores the world source.
- [ ] The played entity is absent from the roster at every one of its locations, and from every other reader, through the module from ticket 02. A test at the roster builder, fed by the module's cast, proves it. The Test Bench is not the seam: it has no persona.
- [ ] A switch away from a world persona returns that entity to the cast on the next turn.
- [ ] The Persona chip adds the known-person line for a world persona only. A library persona gets no such line. Builder tests cover both.
- [ ] The known-person line follows the prompt writing guide and ships with probe numbers on both reference tiers, recorded in the ticket's comments.
- [ ] The known-person line also says that the persona's name in world text means the player, so free text that names the played entity reads as a tie to the player. A builder test covers it, and the probe run measures it.
- [ ] When one of the entity's locations is a starting location, the step preselects the first such location. The player can change it. Tests cover an entity with no starting location among its locations.
- [ ] The opening pool takes its authored entities from the module's cast, so a played entity's openings leave the pool: at the first draw, at page-one regenerate, and in the pool a loaded save rebuilds. Tests run through the Openings module with a seeded random source. The guard is proven by passing the raw entity list and watching the test fail.
- [ ] A world persona's own placeholders resolve as they do today. A test proves it.
- [ ] The picker with both headings is checked in the preview through the dev-router.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

The Test Bench opening lens has no persona and keeps showing the pool as the world defines it. The author owns entity text that names "the player" as a separate person. This ticket does not rewrite it; ticket 11 documents it. No new export-shape change: the mark shipped in ticket 01.

## Comments

### Rulings from the spec session (2026-09-19)

- **Relationships.** No structured tie exists. The known-person line also says that the persona's name in world text means the player. The criterion above is rewritten to match.
- **Location preselect.** A world persona preselects its first starting location when the step opens on it, at every pick, and at Quick Start. A location the player picked by hand in this step stays; Random counts as a hand pick. A library persona, None, or an entity with no starting location keeps the current location. Nothing restores a remembered location today, so the "remembered location wins" exception has no case yet.
- **Change picker.** It lists world personas too. Order: None, **From This World**, **Your Personas**. A heading shows only when its group has a persona.

### Probe numbers (2026-09-19)

`testing/baseline/harness/world-persona-probe.mjs`. Both arms use the working-tree prompts and the same world persona block. **A** = the block alone; **B** = the block plus the known-person line, read from `personaContext.ts`. Four scenes, each with one NPC whose text names the persona with a tie (brother, a debt, a usual table, a lost post). Each action invites a reply. Means per run; flags are rates.

**Cloud default endpoint** (narration 16 runs/arm, director and planning 12):

| Stage | Metric | A | B |
|---|---|---|---|
| Narration | NPC says the persona's name | 0.06 | 0.13 |
| Narration | prose shows recognition | 0.13 | 0 |
| Narration | output names the authored tie | 0.06 | 0 |
| Narration | NPC treats the player as new | 0 | 0 |
| Narration | narrator names the player outside a quote | 0 | 0 |
| Narration | NPC spoke / words | 0.94 / 93.4 | 0.88 / 88.2 |
| Director | Cast opens with Player Character / persona recast | 1.00 / 0 | 1.00 / 0 |
| Planning | Cast opens with Player Character / persona recast | 1.00 / 0 | 1.00 / 0 |

**Cydonia 24B** (LM Studio, q4_k_m, seeded per run; narration 12/arm, director and planning 8):

| Stage | Metric | A | B |
|---|---|---|---|
| Narration | NPC says the persona's name | 0.33 | 0.67 |
| Narration | prose shows recognition | 0.33 | 0.33 |
| Narration | output names the authored tie | 0.33 | 0.33 |
| Narration | NPC treats the player as new | 0 | 0 |
| Narration | narrator names the player outside a quote | 0 | 0 |
| Narration | NPC spoke / words | 1.00 / 117.5 | 1.00 / 98.5 |
| Director | Cast opens with Player Character / persona recast | 1.00 / 0 | 1.00 / 0 |
| Planning | Cast opens with Player Character / persona recast | 1.00 / 0 | 1.00 / 0 |

**Read.** No metric regressed on either tier. Stranger treatment, third-person narration and persona recasts stay at 0 in both arms. On Cydonia, NPCs used the persona's name twice as often with the line (4/12 → 8/12). That difference is not significant at n=12 (95% CI on the difference about −0.04 to +0.71). On cloud every narration metric is 0–2 hits in 16, inside the noise. The authored text already names the persona in both arms, so the line adds little that the model cannot infer. It is a guard for the case where it cannot. An earlier batch whose actions did not invite a reply was discarded: cloud NPCs spoke in 0 of 12 turns, so the name metric could not move.

### Build notes

- `buildPersonaContext` takes the resolved persona, so the builder knows the source. The line follows the Full and Summary blocks only; Name sits inside a sentence and stays bare.
- The draft's persona and location updates live in `withPersonaPick` / `withLocationPick` (`entryDraft.ts`). The main menu and the workspace test harness call the same functions.
- The opening pool at regenerate and at load is proven through the Openings module with a seeded source; the raw-list swap turns both tests red. A reader-guard row pins the game view's `sessionPool` to the cast.
- A world with no flagged starting location has no preselect: "starting location" means `isStarting`, as the step's location list does.
- Preview check through the dev-router on a throwaway world copy with two marked entities and one library persona: the picker read None, **From This World**, the two entities, **Your Personas**, the library persona. Picking an entity moved the location to its starting location. The throwaway records were removed afterwards. Screenshots timed out in the pane, so the evidence is the DOM read.

### Review follow-up

- **Menu wiring now has tests.** `MainMenu.entry.test.tsx` covers a world persona pick (location, handoff, remembered pick in a world with no library persona), a step that opens on a remembered world persona, and Quick Start at its location. Each was mutation-checked: dropping the Quick Start location, the world-persona remember condition, or the step's preselect turns one test red.
- **Standards fixes.** `personaOption` in `persona.ts` builds the picker option in both callers. `PersonaPickContext` lives in `personaPick.ts`, and the hand-pick flag has one name, `locationChosen`. The picker's source type derives from `PersonaRef`.
- **Kept as is.** The "any persona offered" count still appears in the workspace, the menu and the preselect rule, because each reads a different shape. The two-sentence known-person line is the ruled wording, with probe numbers above. The in-game list keeps out a library persona that the played world entity copies, which is the one-role rule the step already applies.
- **Full suite.** All 11,382 tests pass, but every full run ends with one unhandled rejection: a provider's async state update lands after jsdom teardown (`SettingsContext`, `useCatalogSync`), in a different file each run. It is outside this ticket's code and is flagged as its own task.
