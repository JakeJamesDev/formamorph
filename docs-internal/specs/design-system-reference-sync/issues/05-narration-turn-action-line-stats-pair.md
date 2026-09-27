# 05: Narration Turn shows the Pages action line and the Stats panel pair

Status: ready-for-human
Base: dce417d8
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Two inline Pages pieces become production components that the game and the reference both render: the action line, which is the player's text with its left rule and its own menu fed by the production player action list; and the Stats panel action pair, Edit Stats and Re-generate Stats with tooltips, bound to the viewed turn and disabled on past turns and while a reply or scene render runs. The Pages layout and the Stats panel behave exactly as before.

The reference's latest page shows the action line above the narration, with its own menu separate from the card's menu. The Stats panel pair appears twice: on the latest turn with both actions enabled, and on a past turn with Re-generate Stats disabled. Actions write to the existing status line. The guide describes both.

Check for parallel sessions on the Pages host before starting. Another session had it mid-edit when this ticket was written.

Recommended model rationale: extracts from the game's largest panel file under concurrent edit and must keep game behavior identical; needs careful reasoning.

## Acceptance criteria

- [x] The game renders the action line and the Stats pair through the new components with no behavior change
- [x] The existing Pages parity test and the Pages and Chat game tests pass unchanged
- [x] The reference's latest page shows the action line; its menu lists the production player actions
- [x] A right-click on the action line does not open the card's menu, asserted by test
- [x] Re-generate Stats is enabled on the latest turn and disabled on the past turn, asserted by test
- [x] Both tooltips show on the pair
- [x] The guide's Narration Turn section describes the action line and the pair; new copy has a Writing review entry
- [x] The showcase registry test passes
- [x] Four gates green; verified in the showcase at desktop and 375px, both themes
