# 11: Style Carries the Frame

Status: ready-for-agent
Blocked by: 08, 10
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

## What to build

The Style trait group (Chat, Plain, Literary) carries the frame of a turn. Each Style trait pins three placeholders by value id: the voice block the narration prompt reads, the choice shape the choices prompt reads, and the opening text the world opening draws. The narration and choices overrides lose their own voice and shape rules; they keep the role line, the context chips, the tone chips, and the output contract. The world opening's text becomes the opening chip. Reply Length and Pacing values are rewritten frame-neutral.

First step: prove that a multi-line placeholder value reaches the model intact through the chip render in the narration prompt, the choices prompt, and the opening draw. Record the result under Comments. If lines are lost, record how the value must be written and follow it.

Write the three voice blocks, three choice shapes, and three openings as draft text in this ticket. Tickets 12 and 13 probe and tune them. Chat: text messages, entity in first person, no narration, no quotation marks. Plain: entity in third person with quoted speech, the player's typed line stands as the first beat and is not restated. Literary: the built-in narration prompt's voice rules, second person, the player's action narrated first. Choice shapes: bare message for Chat; a first-person line with quoted words for Plain and Literary. Openings: a message-shaped greeting for Chat; a narrated first-person line for the other two.

Author the file with a script. Keep surviving ids.

## Acceptance criteria

- [ ] The multi-line proof is recorded under Comments for all three surfaces
- [ ] Five placeholders, three groups, nine traits; each Style trait carries three pins, every pin by a listed value id, one default trait per group (Medium, Plain, Shared)
- [ ] Neither override holds a voice or shape rule outside its chip, and the content test asserts the chips are present in the right prompt
- [ ] A style-resolution test renders the narration prompt, the choices prompt, and the drawn opening under each Style trait and asserts each differs from the other two, no chip resolves empty, and a multi-line value keeps its lines
- [ ] Each guard fails when its bug returns, per the test bar
- [ ] Quick Start on a clean profile draws the Plain opening and shows the Plain voice block in the AI context, checked live
- [ ] Switching Style mid-game changes the voice block and the choice shape on the next turn, checked live
- [ ] The picker copy for the three Style traits says what each reads like, in the player-facing voice
- [ ] The content test adds no Test Bench finding
- [ ] Four gates green
