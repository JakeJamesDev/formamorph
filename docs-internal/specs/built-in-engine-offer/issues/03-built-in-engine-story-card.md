# 03: Built-In Engine Story Card

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: follows the Demo AI card's pattern end to end, with new facts, two new records and new copy.

**What to build:** a low-VRAM player whose narration runs on the built-in engine sees a story card once, after 10 completed turns. It sits where the Demo AI card sits, in the Chat and Pages layouts. Its copy compares Formamorph AI with the model on the player's machine. **Not Now** hides it. **See Levels** opens The Road. The card sends the `local_offer_shown` funnel step. The VRAM class comes from ticket 01.

- [x] Settings exposes whether narration resolves to the built-in engine. Only the narration route decides. (`narrationIsBuiltInEngine`; routing test "reports narration on the built-in engine from the narration route alone")
- [x] The card is due at a count of 10 and not at 9, and only when all hold: narration on the built-in engine, VRAM class `low`, hosted AI available, not pledged, card not seen. (`engineCardDue` tests; hook test "shows once at 10 settled turns")
- [x] VRAM class `ok` or `unknown` never shows the card. (facts and hook tests; mutation of the `low` check fails 6 tests)
- [ ] A counted turn follows a player action with narration on the built-in engine. The opening, a regenerate and a loaded save never count. A Demo AI turn never counts. (`countsAsEngineTurn` tests cover the rule; the GameViewer call site is checked by reading only)
- [x] The count and the seen record are new per-install records. The Demo AI card's seen record does not block this card, and this card's record does not block the Demo AI card. (store test and hook test "is not blocked by the Demo AI card"; mutation to a shared key fails 3 tests)
- [x] The seen record is written when the card first renders after the turn's reveal ends. A reload or a later game never brings the card back. (hook tests: unsettled turn holds it; "never comes back after a reload")
- [x] The card hides when narration moves off the built-in engine while it shows. (hook test "hides when narration moves off the built-in engine")
- [ ] The card has its own title and body, written from a facts list under the Writing Guide. The body states the comparison with a local model and reads correctly for a CPU-only machine. (draft in `ENGINE_CARD_COPY`; the words wait for approval)
- [x] The card sends `local_offer_shown` once per install. See Levels still sends `see_levels`. (hook test counts one POST to `/funnel/local_offer_shown`; See Levels uses the same `openRoadScene` path as the Demo AI card)
- [x] The staff Usage view labels the new step. (UsageTab test "labels the built-in engine offer step")
- [x] A dev route shows the card in the game view. Frames at `.scratch/frames/engine-card-chat-1280-dark.png`, `engine-card-chat-1280-light.png` and `engine-card-pages-1280-dark.png`. (`#dev?modal=storyCard&tab=engine&fixture=writtenOpening`; Playwright frames)
- [x] `docs/` pages that describe the Formamorph AI offer are current, and a changelog fragment states what changed for the player. (How-to-Play "The Formamorph AI Offer"; fragment `built-in-engine-offer-03.md`)
- [x] No world or save export gains a field. (only localStorage keys `FORMAMORPH_engineTurnCount` and `FORMAMORPH_engineCardSeen`)

For you: the card's title and body wording, on the dev route.
For you: whether 10 turns feels right in real play on the built-in engine.

## Landed

**Not verified**

- The turn count's call site in GameViewer: the rule is tested, but the call inside the turn commit is checked by reading only, the same as the Demo AI count. No real game ran 10 turns on the engine.
- The card's words: they are a draft until the user approves them.
- The `local_offer_shown` send against the real server: the server change (ticket 02) must deploy before this client build, or the one-time send is lost.

**For you**

- For you: the card's title and body wording, on the dev route. Draft: "Want a Bigger Model for This Story?" / "Your computer runs a small model that fits its memory. Formamorph AI runs a larger one on our servers, for sharper narration and characters who stay consistent. Your support includes it, and it helps fund new updates." Frames: `.scratch/built-in-engine-offer-03/frames/engine-card-chat-1280-dark.png`, `engine-card-chat-1280-light.png`, `engine-card-pages-1280-dark.png`.
- For you: whether 10 turns feels right in real play on the built-in engine.
- Deploy FormamorphServer with `local_offer_shown` before a client build ships this card.
