# 05: Game Lean

Status: ready-for-agent
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

- [ ] A game request's body holds no unmet name, AI description, diary text or hidden stat
- [ ] A dictionary entry fires when its keyword is in the question, and when it is in the story so far
- [ ] An entry whose keyword appears nowhere in the fed context stays out
- [ ] With memory digests off, the story so far is the recent turns
- [ ] World sources in game have no editor link
- [ ] After an undo, a fact the undone turn showed is gone from the body
- [ ] Each leak test fails when the Player View is swapped for the full world
- [ ] Guide page updated

For you: play a bundled world for a few turns and ask Formaquestion about who and what you met, and about someone you haven't.
