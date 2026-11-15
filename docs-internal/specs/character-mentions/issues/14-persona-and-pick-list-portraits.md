# 14: Persona Speaker and Pick-List Portraits

Status: ready-for-agent
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

- [ ] The persona's quotes and mentions are colored, linked and correctable. Its Auto color equals the player's Quote Color in both modes.
- [ ] The Mention Reading gold scores are rerun with the persona rule and reported against Q34's numbers. The ff-13 case is named.
- [ ] A speaker the player has no label for gets no color, no `data-speaker` and no link. The test is proved by reinstating the leak.
- [ ] A speaker with a Stranger Name shows that label on the card and in the pick list, never the true name.
- [ ] Pick-list rows show square, top-aligned portraits, with the initial as fallback. Frames in light, dark and mobile.
- [ ] In Scene and memory output is unchanged for the player.
