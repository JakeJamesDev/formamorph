# Spec: Focused Thinking

Status: ready-for-agent
Spec session: focused-thinking — spec

## Problem Statement

Authors put most of a world's context into entities. The narration request carries every entity here and in sublocations as a full block: description, relationships, traits and stats. A location with four entities, where one matters to this turn, pays for four full blocks. Small local models lose instruction-following as context grows, so the three idle blocks cost quality as well as tokens.

The narrator is left to decide for itself whom the turn is about. No pass tells it. The planner casts a scene, but its cast never filters the narration's entity roster.

## Solution

A new Thinking Mode, **Focused (Experimental)**. Before narration, a **Focus Classifier** reads the player's action, the last narration and a short roster of the entities here and in sublocations. It gives each entity one **Focus Tier**:

- **Focus**: the turn is about it. The narration gets its full block, as today.
- **Background**: it is here but not the point of the turn. The narration gets its summary render.
- **Offstage**: it is not part of this scene. The narration gets its name in one short list.

Code builds the narration request from the tiers. The narration prompt never asks the narrator to pick whom to use. A failed call or an unreadable reply sends the full roster, so the worst turn equals today's.

The mode is experimental. No player on another mode is affected, and the pipeline and prompts in this mode may change or go away. A probe proves the classifier and the trimmed narration before the mode is built.

## Rulings

Settled with the user on 2026-11-06 in the grill.

| # | Ruling |
|---|---|
| Q1 | Focused is a new Thinking Mode value, not a toggle that stacks on other modes |
| Q2 | The first version runs the Focus Classifier and narration only. No planner pass |
| Q3 | Only entities here and in sublocations are classified. The reachable and known rosters, the dictionary and locations render as today |
| Q4 | Three tiers |
| Q5 | The classifier sees each entity's name and AI summary. An entity with no summary sends its full description |
| Q6 | Entities in sublocations are classified too |
| Q7 | Background renders as today's summary roster does: summary over description, trait names only, no stats |
| Q8 | Offstage entities appear by name in one short list |
| Q9 | No code-side floors in the first version. The classifier decides alone, so the probe shows what it misses |
| Q10 | A failed call or a parse failure sends the full roster |
| Q11 | The Focus Classifier is its own prompt kind with its own sampler pins. Its endpoint defaults to the narration endpoint |
| Q12 | Ticket 01 is a probe, and it gates the build |
| Q13 | Bar: Focus recall at least 95%, tier match at least 85%, and narration no worse than with the full roster on the continuity rubric. It holds on the cloud default model and on Cydonia |
| Q14 | The agent drafts the hand labels from bundled worlds and Sedge Landing (scenes with 3 or more entities here). The user reviews a sample before the probe counts |
| Q15 | The classifier runs after the location decision, so it classifies the roster the narration gets |
| Q16 | The classifier sends native reasoning off. Narration follows the player's Native Reasoning setting, as Native mode does |
| Q17 | The classifier reads the player's action and the last narration |
| Q18 | Post-narration passes keep their own rosters |
| Q19 | The tiers show only in the request inspector |
| Q20 | The picker label is "Focused (Experimental)" |
| Q21 | Tier names: Focus, Background, Offstage. "Present" belongs to In Scene's _Avoid_ list |
| Q22 | One test seam: the turn runner with scripted AI replies. The probe harness covers model quality outside the gates |
| Q23 | The continuity rubric has two parts. Objective counts per turn: Focus facts kept, Background entities kept in the scene, Offstage entities wrongly put onstage, and invented strangers who duplicate an existing entity. Plus a blind 1–5 continuity score on shuffled, label-stripped full/trimmed pairs. "No worse" means the trimmed mean is within the full arm's confidence interval on both parts |
| Q24 | The probe sends the classifier temperature 0.2 and repetition penalty 1. Ticket 02 copies these as the pins. A sweep runs only if 0.2 misses the bar |
| Q25 | The Offstage list follows the sublocation roster under a provisional header. Ticket 02 sets the final wording |
| Q26 | Ticket 01 may land after the cloud numbers, with the Cydonia criterion unticked. Ticket 02 stays blocked until the Cydonia numbers meet the bar |
| Q27 | Ticket 01 may revise the classifier prompt up to 3 times. It tunes on a fixed half of the cases and reports the held-out half beside the full set. If the held-out half misses the bar after 3 revisions, the ticket lands with the failing numbers and the spec returns to the grill |

## User Stories

1. As a player, I want a Focused (Experimental) entry in the Thinking Mode picker, so that I can try the trimmed pipeline without changing my other modes.
2. As a player on a small local model, I want narration to get full detail only for the entities the turn is about, so that the model follows its instructions better.
3. As a player, I want the narrator to still know who else is in the room, so that background characters do not vanish from the scene.
4. As a player, I want the narrator to know the names of entities outside the scene, so that it does not invent a stranger who is already here.
5. As a player, I want a turn to finish normally when the classifier fails, so that the experimental mode never breaks my game.
6. As a player, I want the classifier to read my action and the last narration, so that a character I address gets full detail.
7. As a player who moves to a new place, I want the classifier to sort the entities at my destination, so that the narration sees the right roster.
8. As a player using a reasoning model, I want the classifier to run with native reasoning off, so that it answers fast and does not spill thinking into its reply.
9. As a player, I want narration in Focused mode to follow my Native Reasoning setting, so that it behaves as Native mode does.
10. As a player with one endpoint, I want the classifier to use my narration endpoint by default, so that the mode works with no extra setup.
11. As a player with a cheap second endpoint, I want to point the classifier at it, so that the extra call costs less.
12. As a player, I want the classifier's temperature and penalty pinned for its job, so that its labels stay stable.
13. As a player who edits prompts, I want the Focus Classifier as its own prompt in the prompt editor, so that I can read and tune it.
14. As a player debugging a turn, I want the request inspector to show each entity's tier, so that I can see why a character got little detail.
15. As a player on Native, Inline, Planning or Staged, I want my turns unchanged, so that the experiment cannot affect me.
16. As a player in Focused mode, I want choices, stats, inventory, diary and discover to keep their usual rosters, so that game state stays correct.
17. As an author, I want my entities' AI summaries used for Background entities, so that the summary I wrote has a clear job.
18. As an author whose entity has no summary, I want the classifier to read its description, so that the entity is still sorted.
19. As an author, I want entities in sublocations sorted the same way as entities here, so that one rule covers both.
20. As a developer, I want a probe with hand-labeled turns to pass before the mode is built, so that we do not build a pipeline that does not help.
21. As a developer, I want the probe to report Focus recall, tier match and tokens saved, so that the cost and the gain are both visible.
22. As a developer, I want the probe to compare narration with the full roster against narration with the trimmed roster, so that we know whether quality holds.
23. As a developer, I want the probe to run on the cloud default model and on Cydonia, so that the result holds where most players play.
24. As a developer, I want the first version to have no code-side floors, so that the probe shows the classifier's own misses.
25. As the user, I want to review a sample of the drafted labels, so that the probe's ground truth matches my judgment.

## Implementation Decisions

- **Thinking Mode.** A fifth value, `focused`, joins the Thinking Mode setting. The picker lists it as "Focused (Experimental)". It is a setting, not part of a save or a world, so no export shape changes.
- **Turn plan.** In Focused mode, the turn plan runs the location passes, then the Focus Classifier, then narration. No planning-stage pass runs. Other modes plan exactly as today.
- **Focus Classifier pass.** A new pre-narration turn pass with its own prompt kind. It has sampler pins in the per-prompt sampler table, an endpoint setting that defaults to the narration endpoint, and native reasoning off. It is due only in Focused mode, and it waits for the location decision.
- **Classifier request.** The system prompt states the task and the reply contract. The user turn carries the player's action, the last narration, and one line per entity here and in sublocations: a letter, the name, and the AI summary (the full description when the summary is blank). Letters come from the existing placement-letter helper, so the parse never matches names.
- **Reply contract.** One line per letter with a tier word. The parser reads the reply into a map from entity id to Focus Tier. A missing letter, an unknown tier word, or no readable line at all counts as a parse failure for the whole reply, and the turn falls back to the full roster. Partial fills are not used.
- **Roster render.** The entity roster builder takes an optional tier map. Focus renders today's full block. Background renders today's summary block (`preferSummary` with stats off). Offstage entities leave the roster and join a one-line name list. With no tier map, the builder renders exactly as today. The narration's two full-detail scopes (here and sublocations) read the map; every other scope ignores it.
- **Narration prompt.** Focused mode uses the Native narration path. The prompt says nothing about tiers. It only receives the trimmed roster and the Offstage list.
- **Request inspector.** The AI Context view shows each classified entity with its tier, and says when the turn fell back to the full roster.
- **Glossary.** CONTEXT.md gains **Focus Classifier**, **Focus Tier** (Focus, Background, Offstage) and **Focused** as a Thinking Mode. Each entry notes that In Scene is a separate idea: In Scene is who took part in recent turns, a Focus Tier is what the narration gets this turn.
- **Probe (ticket 01).** A harness script under `testing/baseline/harness/` with a labeled case file. Each case is a turn: world, location, the entities here, the action, the last narration, and the expected tier for each entity. The script reports Focus recall, tier match, parse failures and the entity tokens saved. A second arm sends narration with the full roster and with the hand-labeled trimmed roster for the same turns, and scores both on the continuity rubric. It replicates the sampler pins and sends `reasoning_effort: "none"` to the classifier. Runs follow the probe skill's run counts and in-batch controls.

## Testing Decisions

- A good test drives a turn and reads the narration request the turn sends. It never inspects parser internals or the tier map directly.
- **One seam: the turn runner** with scripted AI replies, as the turn runner tests do today. Each test scripts the classifier's reply and asserts on the narration request:
  - A Focus entity's full block is in the request; a Background entity's summary is in it and its stats are not; an Offstage entity is only in the name list.
  - A sublocation entity follows its tier the same way.
  - A garbled reply, a reply missing a letter, and a failed classifier call each send the full roster.
  - A move to a new location makes the classifier see the destination's entities.
  - In every other Thinking Mode, no classifier call is made and the narration request is unchanged. The turn-plan parity suite covers the unchanged modes.
- Guards must bite: each fallback test fails when the fallback is removed.
- Prior art: the turn runner tests and their parity suite, the narration prompt tests, and the roster option tests for the summary render.
- Model quality is the probe's job, outside the gates (ticket 01).

## Out of Scope

- Code-side floors (an entity named in the action, recent In Scene entities). The probe's misses decide whether a later version adds them.
- A planner pass in Focused mode, or merging the classifier into the planner.
- Trimming the reachable and known rosters, the dictionary, locations, or the post-narration passes' rosters.
- Any game UI for tiers outside the request inspector.
- Making Focused the default or removing the Experimental label.

## Further Notes

- The bundled worlds give a fair test bed: all 127 entities have an AI summary, with a median of 79 characters against a median description of 334.
- The planner already parses a cast, but its cast does not filter the narration roster today. That stays true in the other modes.
- If the probe misses the bar, the spec returns to the grill before any build ticket starts.
