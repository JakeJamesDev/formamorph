# 09: First-Person Message Prompt

Status: ready-for-agent
Blocked by: 08
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A reply in Open Chat is one chat message from the entity, in first person, as the entity would type it. There is no narrator, no scene prose, and no quotation marks around the message. An action the entity needs sits inside the message between asterisks, the SillyTavern convention. The reply stops when the message ends.

Rewrite the narration override from the revision 1 text. Keep the context chips: memory, persona, dictionary, notes, entities, location, and language. Remove the length guidance chip; the Reply Length chip is this world's only length control. Read the three tone chips from ticket 08. With two or more entities present, each message starts with the entity's name and a colon; with one, there is no prefix. This is a smoke case only. With no entity present, the model introduces a speaker by name and that speaker sends the message.

The one location's AI description and the neutral world system prompt line are in the probed context; keep or rewrite them on the numbers.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] The rendered narration prompt holds no length guidance text, and the content test asserts it
- [ ] A/B probe with the revision 1 prompt as the baseline arm, on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [ ] Cases: greeting as page one, question, banter, task, Short and Long reply length, and the no-entity guard
- [ ] Metrics with numbers per arm under Comments: first-person message held (no narrator sentence, no third-person reference to the entity, no quotation marks around the message), reply length per Reply Length setting, asterisk actions well formed
- [ ] A two-entity smoke case shows name-prefixed messages on at least one tier
- [ ] The regression check from the guide passes on the other metrics
- [ ] An imported greeting as page one, followed by one turn, keeps one voice, checked live in the Chat layout
- [ ] Four gates green
