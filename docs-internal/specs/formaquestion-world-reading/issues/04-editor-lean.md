# 04: Editor Lean

Status: ready-for-agent
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

- [ ] An editor question about a world item puts that item's section in the world block
- [ ] An unsaved edit appears in the next answer's world block
- [ ] Every dictionary entry is reachable by keyword and by meaning, triggered or not
- [ ] Scripts, stat code, World Tools and world prompts are indexed
- [ ] Guide and world hits fill separate budgets; a full world pool does not drop a guide hit
- [ ] The switch off, or no open world, sends a body equal to today's
- [ ] A world source opens its item in the editor
- [ ] A rebuild on the largest bundled world stays under a set time, and the time is recorded in the ticket
- [ ] Guide page and CONTEXT.md updated

For you: ask a few editor questions on a bundled world and judge whether the answers explain your world.
