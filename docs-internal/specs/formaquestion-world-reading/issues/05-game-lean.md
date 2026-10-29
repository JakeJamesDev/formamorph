# 05: Game Lean

Status: ready-for-human
Blocked by: 01, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the in-game leak boundary at the request, dictionary activation reuse and the story-so-far assembly.

## What to build

In the game, Formaquestion answers about the lore and story so far, never beyond what the player has met.

- The world block (ticket 04) holds the **Player View** (ticket 01), the **story so far**, and the dictionary entries that fire.
- The story so far is milestone memories plus recent verbatim turns, assembled the way the narration assembles them, without diaries or script memory lines. With memory digests off, it is the recent turns only.
- Dictionary entries activate with the narration's keyword and semantic activation, over the story so far, the Player View text and the player's question. Script toggles apply. Nothing new is saved.
- The docs stay in the request (Q6). World sources show as plain names, with no editor link.
- Open Chat worlds follow the same rules.

- Ticket 06 leaves each dictionary book's `entries` empty in the in-game help Tool's script state. Fill it with the entries this question fired, if the activation runs before the Tool snapshot is built.

Docs: the guide's Formaquestion page gains the in-game section.

Spec: Q1, Q6, Q9, Q12, Q13, Q15, Q17, Q21; stories 11–27, 33.

## Acceptance criteria

- [x] A game request's body holds no unmet name, AI description, diary text or hidden stat (`helpSession.gameWorld.test.ts` "sends no …" cases)
- [x] A dictionary entry fires when its keyword is in the question, and when it is in the story so far ("fires an entry whose keyword is in the question / story so far"; mutation: dropping the story scan turns the story case red)
- [x] An entry whose keyword appears nowhere in the fed context stays out ("leaves out an entry …")
- [x] With memory digests off, the story so far is the recent turns ("sends the recent turns alone with memory digests off")
- [x] World sources in game have no editor link (`GameViewer.helpWorld.test.tsx`: the game registration has no `open`; `Formaquestion.worldSource.test.tsx` renders a plain name without one)
- [x] After an undo, a fact the undone turn showed is gone from the body ("forgets what an undone turn showed", with a before-undo arm)
- [x] Each leak test fails when the Player View is swapped for the full world (each name, AI text and hidden stat case runs a full-world arm that must leak)
- [x] Guide page updated (`docs/Formaquestion.md` "How to Ask About Your Story")

For you: play a bundled world for a few turns and ask Formaquestion about who and what you met, and about someone you haven't.

## Landed

**Request size** (spec session ask): an Emberwatch save with 4 met characters, 4 places and 20 turns (narration about 1,000 characters, memories about 250), keyword search only, built at the `askHelp` seam:

| Question | Guide | World | Story | User message | System | Body |
|---|---|---|---|---|---|---|
| "Who is Sylvie Thornwhistle?" | 3,118 | 2,113 | 7,088 | 13,000 | 684 | 14,024 |
| "What happened so far?" | 4,171 | 2,113 | 7,088 | 14,047 | 684 | 15,076 |

All 20 memories and the 3 floor turns fit inside the 12,000-character story budget here. Ticket 07 tunes the three budgets.

**Not verified**
- The diary case has no full-world arm: the story reads each turn's narration only, so no swap of the Player View reaches a diary. It guards the story builder, not the view.
- No live run on a model; the probe is ticket 07's.

**For you**
- Play a bundled world for a few turns and ask Formaquestion about who and what you met, and about someone you haven't.
- Ask "what should I do next?" and check that the answer reads as an opinion.
