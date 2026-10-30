# 06: Player View for Tools and the Code Test

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a narrow change at the open-world registration, on a leak path.

## What to build

In the game, a Formaquestion Tool and the code test read the **Player View** (ticket 01), not the full world. The game registers a Tool Snapshot and an authored world built from the Player View; the World Editor keeps registering the full world. A Tool's script state holds only visible stats. This holds whether or not the Read the World switch is on.

Spec: Q20; stories 37, 38.

## Acceptance criteria

- [x] In game, a Formaquestion Tool that looks up an unmet entity gets nothing: `GameViewer.helpWorld.test.tsx` "gives a Tool nothing for an unmet entity or place"
- [x] In game, a Tool returns player description, never AI description: "gives a Tool the player description…", plus the `playerViewScene` cases for chips
- [x] In game, a Tool's script state has no hidden or disabled stat: "keeps hidden and disabled stats out of a Tool's script state", plus the `playerViewState` cases
- [x] In game, the code test's names hold no unmet entity or hidden stat or trait: "keeps unmet entities and hidden stats and traits out of the code test's names", and the hidden stat comes back as notInWorld
- [x] In the World Editor, the Tool and the code test still read the full world: `WorldEditor.helpWorld.test.tsx`
- [x] Each test fails when the game registers the full world again: with the old `useHelpWorldSource(toolWorld, getWorldData)` call restored, all five game tests fail. The 23 filter mutations in `playerViewWorld.ts` each fail a test

## Landed

**Not verified**

- None.

**For you**

- In a game, open Formaquestion's **Tools** tab and run a lookup Tool on someone you haven't met. Expect no match.
- Spec session rulings for this ticket: aliases keep only the names the player saw. Recall reads digests only. Tool chips render from Player View rows. In a Tool script, dictionary books list no entries; ticket 05 fills them with the fired set.
