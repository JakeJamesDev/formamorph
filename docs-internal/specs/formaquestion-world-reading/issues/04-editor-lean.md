# 04: Editor Lean

Status: ready-for-human
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a second retrieval pool through keyword, AI pick and semantic ranking, a new request block, and live rebuilds.

## What to build

In the World Editor, Formaquestion answers about the open world as well as the docs.

- A **world index** turns every authored part into sections in the docs-index shape: entities, places, items, traits, stats and their code, scripts, World Tools, dictionary entries and the world prompts. Placeholders stay as authored chips. It rebuilds from live editor state, debounced. If rebuilds are too slow on large worlds, it reads the last saved world instead (Q8).
- World sections rank through the same keyword, AI pick and semantic sources as guide sections, as a second pool. The two pools fill separate budgets.
- The request gains a **world block** beside the docs block, and sends ticket 03's world rules. The block and its budget are this ticket's; ticket 05 feeds the game side into them.
- The lean comes from the open-world registry: an editor world gets the editor lean. The in-game World Editor counts as the editor. No world, or the switch off, sends the request as today.
- Each world source opens its item in the editor, the way Take Me There opens a docs target.

Docs: the guide's Formaquestion page gains a world-reading section for the editor. The CONTEXT.md Formaquestion entry says a request carries world text from the open world.

Spec: Q2, Q3, Q8, Q14, Q16, Q17, Q24; stories 1–10, 35, 36.

## Acceptance criteria

- [x] An editor question about a world item puts that item's section in the world block (`helpSession.editorWorld.test.ts`)
- [x] An unsaved edit appears in the next answer's world block (same file, "reads an unsaved edit")
- [x] Every dictionary entry is reachable by keyword and by meaning, triggered or not (`worldIndex.test.ts` disabled entries; editorWorld "reaches a dictionary entry by meaning")
- [x] Scripts, stat code, World Tools and world prompts are indexed (`worldIndex.test.ts` "every kind")
- [x] Guide and world hits fill separate budgets; a full world pool does not drop a guide hit (editorWorld "fills a world budget of its own")
- [x] The switch off, or no open world, sends a body equal to today's (editorWorld "sends the body of today"; the guide pick body is equal too)
- [x] A world source opens its item in the editor (`WorldEditor.worldSourceOpen.test.tsx`, `Formaquestion.worldSource.test.tsx`)
- [x] A rebuild on the largest bundled world stays under a set time, and the time is recorded in the ticket: bar 50 ms; emberwatch (111,166 chars) rebuilds in a 4.4 ms median
- [x] Guide page and CONTEXT.md updated

For you: ask a few editor questions on a bundled world and judge whether the answers explain your world.

## Landed

Guide recall@5 (`probe:help-recall --ai --arms shipped,world-open --sets known --runs 5`, cloud `default`, 103 questions):

| Pick request | No world | Emberwatch open |
|---|---|---|
| One request over both lists (dropped) | 81.9% (79.6–84.5) | 78.3% (76.7–80.6) |
| A world pick request of its own (shipped) | 80.4% (79.6–81.6) | 81.0% (80.6–81.6) |

Not verified:
- World-pool recall and answer quality have no probe; ticket 07's baseline measures them.
- The world pick request reuses the guide pick system prompt with a lead line naming the world list; no probe measured how the model reads that pairing.
- An item over 6,000 characters splits into parts, so the world block can carry one item as several sections.
- A prompt source opens the Overview tab but does not scroll to the prompt field.
- No live check in the app; the shipped section vectors need `npm run build:help-vectors` for the new guide section before release.

For you: ask a few editor questions on a bundled world and judge whether the answers explain your world.
