# 08: Narration Pull Rule

Status: ready-for-agent
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the narration names a character who is not at the player's place, the game brings them over only when all of these hold:

- They are an Individual. Groups are never pulled.
- They stand in a place one Nearby link from the player's place.
- The player's place is allowed for them: their current row uses it, or their Traversable list has it.
- Their current row is not Strict.
- They are neither Following nor Waiting.

The pull no longer looks at siblings and children directly. A pulled character goes back by the engine's hold rule: a Stay-row character when the player leaves, a Wander or Patrol character when its idle runs out.

This fixes the playtest cases: the farrier who was the focus of the scene at the inn now counts as present, and characters seen through a window do not.

Spec rulings: Q23, Q26, Q36, Q40, Q46, Q59, Q61. Stories 35, 39–42, 51. The spec's "Narration pull" and "Reach" sections are the contract.

## Acceptance criteria

- [ ] Turn pipeline tests with recorded replies cover: the inn case (a named character next door comes over, and an item change for them lands), the window case (characters only seen are not present), a mention across a Far link (no pull), a Strict character next door (no pull), a Following or Waiting character (no pull), a Group (no pull), and a place that is not allowed (no pull).
- [ ] Each refusal is proven by reinstating the old rule.
- [ ] A character pulled from a Stay row returns after the player leaves. One pulled from a Wander or Patrol row returns when its idle runs out.
- [ ] A migrated one-place character that was Free is not pulled to a sibling place until the author adds it to Traversable.
- [ ] The locations wiki page says who can be called over. A changelog fragment covers the change.

For you: in a world you know, call someone over from the next room and from across a Far link, and check both read right in the story.
