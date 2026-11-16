# 14: Persona Speaker and Pick-List Portraits

Status: done
Blocked by: 08, 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Three changes to who can be colored, linked and picked, from the user's review after tickets 04–13 landed.

- **The played persona (Q61):**
  - The Mention Reading resolves "you", "I" and the persona's name to the persona, reversing Q32 for display.
  - Its quotes get a speaker color and "Wrong character?". On Auto, the color is the player's Quote Color setting for the current mode.
  - Its mentions link to a card.
  - It appears in the pick list, first.
  - In Scene and memory keep handling the player as they do today.
- **Pick-list portraits (Q62):** each row shows the entity's image as a square crop, anchored to the top like the persona square in the clock bar, with the initial as fallback. Visibility follows Q51.
- **Speakers the player cannot name (Q48, Q63):**
  - Colors, speaker marks, links and cards follow the naming standard in `presence.ts`: the name once met or when it is not hidden, else the Stranger Name, else nothing.
  - An entity with nothing to show gets no color, no `data-speaker` and no link.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] The persona's quotes and mentions are colored, linked and correctable. Its Auto color equals the player's Quote Color in both modes. — `MentionCards.test` "the played persona (Q61)" and `mentionReading.test` persona cases; the color is `var(--dialogue-custom, hsl(var(--dialogue)))`, read in the showcase as the theme dialogue color per mode (`.scratch/character-mentions-14/frames/persona-quote-both.jpg`).
- [x] The Mention Reading gold scores are rerun with the persona rule and reported against Q34's numbers. The ff-13 case is named. — identical with and without the rule: blind name 75/81, descriptor 24/43, pronoun 110/136 (7 wrong), traps 34/44, presence 27/29; hard 15/16, 8/15, 40/50, 8/8, 9/11; real pronoun 119/153, traps 41/41, presence 18/25; quotes 65/73, 0 wrong. The rule moves 311 player spans and 15 quotes to the persona, all labeled no-one in the gold. ff-13: e120 merges "You/your" into Keshari's cluster; the cluster stays unnamed (Q67's every-mention rule), a miss either way. `mentionReading.gold.test` now runs both.
- [x] A speaker the player has no label for gets no color, no `data-speaker` and no link. The test is proved by reinstating the leak. — `MentionCards.test` Q48/Q63 cases; ungated `cardColors` and a no-label row each turned them red.
- [x] A speaker with a Stranger Name shows that label on the card and in the pick list, never the true name. — `MentionCards.test` "shows a speaker known only by its Stranger Name…".
- [x] Pick-list rows show square, top-aligned portraits, with the initial as fallback. Frames in light, dark and mobile. — `MentionCards.portrait.test` "pick list portraits (Q62)"; DOM read 24×24, `object-position: 50% 0%`; frames `.scratch/character-mentions-14/frames/pick-list-portraits-both.jpg` and `pick-list-portraits-mobile.jpg`.
- [x] In Scene and memory output is unchanged for the player. — `mentionMemory.test` "the played persona in a reading (Q61)".

## Landed

**Not verified**
- The real game view: frames come from the design-system showcase, since the `speakerQuotes` fixture needs Character Mentions on, which downloads the model. The fixture now has a persona and portraits for a later look.
- GameViewer's wiring of the Stranger Description resolver and of the turn pick list is inline; the pure functions are tested.

**For you**
- The persona's quotes use your Quote Color, so they look like unresolved quotes until clicked. Check this reads right in a played turn.
- The pick list now shows only the persona, the met, scene-alias strangers and anyone this turn links (Q68). Open "Wrong character?" in a world with many strangers.
