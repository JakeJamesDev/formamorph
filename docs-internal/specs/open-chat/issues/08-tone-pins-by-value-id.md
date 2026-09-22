# 08: Tone Pins by Value Id

Status: ready-for-human
Base: 802d6172
Blocked by: 02, 07
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

## What to build

The tone groups become three: Reply Length, Prose Style, and Pacing. Narration Share and its placeholder go, because a chat message has no narration to share. Each remaining placeholder lists all three of its values. Each trait pins a listed value by its value id, so a pin follows an author edit of the value text. The middle trait of each group is the default trait, so Quick Start and a skipped picker both apply the middle setting.

Rewrite every value for a first-person message. Prose Style is the voice of the message: casual, plain, or literary. Reply Length counts sentences or short paragraphs of one message. Pacing says whether the entity drives the conversation or waits for the player.

Author the file with a script, as before. Keep the placeholder ids and trait ids that survive, so a session from revision 1 still resolves.

## Acceptance criteria

- [x] The world has three placeholders, three exclusive groups, and nine traits
- [x] Every pin carries a value id that its placeholder lists, and the content test asserts it for every trait
- [x] The middle trait of each group is the default trait, and the content test asserts one default per group
- [x] A Quick Start on a clean profile shows the three middle values in the AI context, checked live
- [x] The tone-resolution test asserts the default-trait set resolves to the middle values and that each trait changes only its own placeholder
- [x] Editing a value's text in the World Editor changes what the pinned trait resolves to, checked live
- [x] The content test adds no Test Bench finding
- [x] Four gates green

## Comments

**Values.** Each placeholder lists three values, low to high, and stays a uniform Wildcard. A trait pin names its value by `valueId`; the middle trait of each group carries `isDefault`. With every trait of a group switched off, the placeholder rolls one of its three values. No draw weights: benching two values would raise `wildcard-single-value`. The revision 1 value id survives as the middle value.

**Authored by script.** The script also dropped the Narration Share chip line from the narration override, so the prompt names no deleted placeholder. Ticket 09 rewrites the rest. It trimmed the intro readme to three groups, and updated the group and trait copy (Chat is now Casual). Ticket 10 owns the full readme pass.

**Live, Playwright on a clean profile** (`e2e/open-chat.spec.ts`, mocked model, desktop):
- Quick Start, one turn: the narration system prompt holds the three middle values and none of the others. Moving the default to Short fails it.
- World Editor, Placeholders tab: rewrite the Medium value, save, Quick Start, one turn. The request holds the new text and not the old. Making `pinText` prefer the stored text over the value id fails it.
- The fixture test now expects one listed value per chip, since the fixture starts with no traits.

**Mutation proof, content and tone tests:** a pin id the placeholder does not list, a missing default, a pin on the wrong value of its own placeholder, and a pin aimed at another placeholder each fail the suite.

**Found, not fixed:** in portrait the **Quick Start** button shows only its icon and has no accessible name. The Quick Start spec runs on desktop only for that reason.

**Not probed here.** The nine values are prompt text, and this ticket carries no probe criterion. Ticket 09 probes the narration prompt with these values in context, and its Short and Long cases cover Reply Length.

**Ruling, 2026-09-21: a group with no active trait rolls, and that is fine.** The picker is a radio group, so a new game always has a default. A group can still be empty if the player switches its trait off mid-game, or in a revision 1 save that skipped a group. There the chip draws one of its three values at random, where revision 1 read the middle. The user kept the roll: a new game always starts with a default, and revision 1 saves never shipped.
