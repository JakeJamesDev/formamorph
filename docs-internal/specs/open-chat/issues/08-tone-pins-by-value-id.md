# 08: Tone Pins by Value Id

Status: ready-for-agent
Blocked by: 02, 07
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

## What to build

The tone groups become three: Reply Length, Prose Style, and Pacing. Narration Share and its placeholder go, because a chat message has no narration to share. Each remaining placeholder lists all three of its values. Each trait pins a listed value by its value id, so a pin follows an author edit of the value text. The middle trait of each group is the default trait, so Quick Start and a skipped picker both apply the middle setting.

Rewrite every value for a first-person message. Prose Style is the voice of the message: casual, plain, or literary. Reply Length counts sentences or short paragraphs of one message. Pacing says whether the entity drives the conversation or waits for the player.

Author the file with a script, as before. Keep the placeholder ids and trait ids that survive, so a session from revision 1 still resolves.

## Acceptance criteria

- [ ] The world has three placeholders, three exclusive groups, and nine traits
- [ ] Every pin carries a value id that its placeholder lists, and the content test asserts it for every trait
- [ ] The middle trait of each group is the default trait, and the content test asserts one default per group
- [ ] A Quick Start on a clean profile shows the three middle values in the AI context, checked live
- [ ] The tone-resolution test asserts the default-trait set resolves to the middle values and that each trait changes only its own placeholder
- [ ] Editing a value's text in the World Editor changes what the pinned trait resolves to, checked live
- [ ] The content test adds no Test Bench finding
- [ ] Four gates green
