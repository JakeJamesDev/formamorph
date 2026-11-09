# 03: Built-In Engine Story Card

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: follows the Demo AI card's pattern end to end, with new facts, two new records and new copy.

**What to build:** a low-VRAM player whose narration runs on the built-in engine sees a story card once, after 10 completed turns. It sits where the Demo AI card sits, in the Chat and Pages layouts. Its copy compares Formamorph AI with the model on the player's machine. **Not Now** hides it. **See Levels** opens The Road. The card sends the `local_offer_shown` funnel step. The VRAM class comes from ticket 01.

- [ ] Settings exposes whether narration resolves to the built-in engine. Only the narration route decides.
- [ ] The card is due at a count of 10 and not at 9, and only when all hold: narration on the built-in engine, VRAM class `low`, hosted AI available, not pledged, card not seen.
- [ ] VRAM class `ok` or `unknown` never shows the card.
- [ ] A counted turn follows a player action with narration on the built-in engine. The opening, a regenerate and a loaded save never count. A Demo AI turn never counts.
- [ ] The count and the seen record are new per-install records. The Demo AI card's seen record does not block this card, and this card's record does not block the Demo AI card.
- [ ] The seen record is written when the card first renders after the turn's reveal ends. A reload or a later game never brings the card back.
- [ ] The card hides when narration moves off the built-in engine while it shows.
- [ ] The card has its own title and body, written from a facts list under the Writing Guide. The body states the comparison with a local model and reads correctly for a CPU-only machine.
- [ ] The card sends `local_offer_shown` once per install. See Levels still sends `see_levels`.
- [ ] The staff Usage view labels the new step.
- [ ] A dev route shows the card in the game view. Frames at `.scratch/frames/engine-card-chat-1280-dark.png`, `engine-card-chat-1280-light.png` and `engine-card-pages-1280-dark.png`.
- [ ] `docs/` pages that describe the Formamorph AI offer are current, and a changelog fragment states what changed for the player.
- [ ] No world or save export gains a field.

For you: the card's title and body wording, on the dev route.
For you: whether 10 turns feels right in real play on the built-in engine.
