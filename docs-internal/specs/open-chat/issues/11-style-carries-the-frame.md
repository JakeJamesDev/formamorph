# 11: Style Carries the Frame

Status: ready-for-human
Base: a3212692
Blocked by: 08, 10
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

## What to build

The Style trait group (Chat, Plain, Literary) carries the frame of a turn. Each Style trait pins three placeholders by value id: the voice block the narration prompt reads, the choice shape the choices prompt reads, and the opening text the world opening draws. The narration and choices overrides lose their own voice and shape rules; they keep the role line, the context chips, the tone chips, and the output contract. The world opening's text becomes the opening chip. Reply Length and Pacing values are rewritten frame-neutral.

First step: prove that a multi-line placeholder value reaches the model intact through the chip render in the narration prompt, the choices prompt, and the opening draw. Record the result under Comments. If lines are lost, record how the value must be written and follow it.

Write the three voice blocks, three choice shapes, and three openings as draft text in this ticket. Tickets 12 and 13 probe and tune them. Chat: text messages, entity in first person, no narration, no quotation marks. Plain: entity in third person with quoted speech, the player's typed line stands as the first beat and is not restated. Literary: the built-in narration prompt's voice rules, second person, the player's action narrated first. Choice shapes: bare message for Chat; a first-person line with quoted words for Plain and Literary. Openings: a message-shaped greeting for Chat; a narrated first-person line for the other two.

Author the file with a script. Keep surviving ids.

## Acceptance criteria

- [x] The multi-line proof is recorded under Comments for all three surfaces
- [x] Five placeholders, three groups, nine traits; each Style trait carries three pins, every pin by a listed value id, one default trait per group (Medium, Plain, Shared)
- [x] Neither override holds a voice or shape rule outside its chip, and the content test asserts the chips are present in the right prompt
- [x] A style-resolution test renders the narration prompt, the choices prompt, and the drawn opening under each Style trait and asserts each differs from the other two, no chip resolves empty, and a multi-line value keeps its lines
- [x] Each guard fails when its bug returns, per the test bar
- [x] Quick Start on a clean profile draws the Plain opening and shows the Plain voice block in the AI context, checked live
- [x] Switching Style mid-game changes the voice block and the choice shape on the next turn, checked live
- [x] The picker copy for the three Style traits says what each reads like, in the player-facing voice
- [x] The content test adds no Test Bench finding
- [x] Four gates green

## Comments

**Multi-line proof, all three surfaces.** A scratch test set one placeholder value to five lines: a plain line, a bullet, a blank line, a `##` header, and an indented line with quotation marks and asterisks. It rendered the value through the app's own seams:
- Narration: `buildNarrationPrompt` over the world override, with the chips keyed by `worldPromptChipValues`. The value arrived whole.
- Choices: `choicesSystemPrompt` over a template holding the chip on its own line. The value arrived whole.
- Opening: `resolvePlaceholders` with the opening player kind, the call `resolveOpening` makes. The value came back byte for byte.

No line is lost. **One rule follows:** the chip must stand on its own line. Inline after a bullet (`- {{chip}}`), the bullet prefixes only the first line of the block. Both overrides place their frame chip alone under its own header. The style-resolution test asserts the block sits between two newlines, so an inline chip fails it. The World Editor already switches a placeholder to its Multiline style when a value holds a newline, so an author can edit the blocks.

**Layout.** The narration override keeps the role line, a four-line Guidelines list (pacing chip, context, bracket direction, reply length chip), the context chips, then `## Voice` with the voice block chip, then the output contract. The voice block sits just before the output contract, because small models weight the end of the prompt (guide, section 4). The choices override keeps the role line, the context chips, one line that "I" is the player, the list contract, `## Option shape` with the choice shape chip, and the rules. Option length moved into each shape, since a quoted line runs longer than a bare message. The entity headers read "Where this happens" and "Who is here", since "you" means a different person under each Style.

**Ids.** The revision 2 prose style placeholder became the voice block, and its three value ids carry Chat, Plain, Literary. Casual became Chat under its old trait id. The Style group, the Reply Length and Pacing placeholders, their value ids, their chip placements, and the opening row id all survive. The choice shape and opening placeholders are new.

**Guards, mutation-proved.** Each fails the content test: a voice rule typed into the narration override, a shape rule typed into the choices override, the voice chip inline after a bullet, two Styles sharing a voice value, the shape pin dropped from every Style trait, a Style trait pinning another trait's value, a literal opening, the voice chip removed, an empty shape value, and the shape chip replaced by literal text. The live checks each failed too: Chat pinning the Plain voice fails the switch test, and Chat as the default fails the Quick Start opening check.

**Live, Playwright on a clean profile** (`e2e/open-chat.spec.ts`, mocked model, desktop):
- Quick Start: the action box holds the Plain opening, and the first turn's narration prompt holds the middle value of reply length, voice block, and pacing.
- Style switch: turn one sends the Plain voice block and the Plain choice shape. Close the readme, open **Style** in the Traits tab, switch on **Chat**, play again. Turn two sends the Chat voice block and choice shape and neither Plain one.

**Gates:** typecheck 0 errors · lint 0 errors (1 existing warning) · test 12495 passed, 97 s wall against a 94.8 s run · build succeeds. Open Chat e2e: 5 passed, 3 mobile skips as before.

**Not probed here.** Every value below is draft prompt text. Tickets 12 and 13 probe and tune it. The two probes still score the revision 2 metrics.

### Draft text

**Voice block**

Chat:

```text
You are the entity, chatting with the player by text message.
- Type as yourself, in your own first person: "I", "me", "my". The player is "you".
- Your message is your own typed words, sent as plain text: you speak for yourself, and the words you send stand on their own with no quotation marks around them.
- When you do something, type it between asterisks, in the shape *action*, in the same first person, and keep typing after it.
- A message has one shape: *what I do*, then what I say, typed bare as myself in first person.
- When two or more entities are listed, you are each of them: every message starts with its sender's name and a colon, and each entity that answers sends a message of its own.
- When no entity is listed, you are a stranger the player meets here: give your name in your first message, and stay that person for every message after.
```

Plain:

```text
You tell the chat as a plain back-and-forth, in clear, simple prose.
- Write the entity in third person, present tense: by name, or as "he", "she", or "they". The player is "you".
- The entity's spoken words sit inside quotation marks, with a short plain line of what it does around them.
- The player's line already stands on the page as they typed it: open the reply with the entity's answer to it.
- When two or more entities are listed, each one answers in its own quoted lines, named as it speaks.
- When no entity is listed, a stranger the player meets here answers: the stranger gives a name in the first reply and stays that person after.
```

Literary:

```text
You tell the chat as an interactive novel, in vivid prose.
- Write in second person, present tense ("You ..."): the player is "you", and the entity is written in third person.
- The player's line is the turn's first beat, written as it happens: a line that speaks reaches the page as the player's own quoted sentences, carrying the feeling the line names.
- Then the entity answers in its own quoted voice, woven into what it does, with something of its own that carries the scene onward.
- Advance the scene, then stop, ending on a spoken line or concrete image that lands what this turn changed.
- When two or more entities are listed, each one speaks and acts as itself.
- When no entity is listed, a stranger the player meets here answers: introduce the stranger by description, and let a name reach the page once the stranger gives it.
```

**Choice shape**

Chat:

```text
- Each option is a message I could send, typed in my own first person.
- A typed option is the message itself: the exact words I send, as plain text, with no quotation marks around them and nothing before them.
- A deed option is something I do instead of typing: it sits between asterisks, in the shape *what I do*, in first person.
- In a chat, sending a message is the action I take: when someone is with me, the first option is a typed option, most options are typed options, and each takes a different stance toward what was just said. When I am alone, every option is a deed option.
- Keep every option short, roughly 3 to 10 words.
```

Plain:

```text
- Each option is one plain line of what I do and say, in my own first person, in the shape: I <do something> and say, "<my words>".
- A speaking option carries my exact words inside quotation marks, after a short lead in the shape I <verb>, "<my words>".
- A deed option is I and a verb, with no spoken words.
- When someone is with me, the first option speaks, most options speak, and each takes a different stance toward what was just said. When I am alone, every option is a deed option.
- Keep every option to one plain sentence, roughly 6 to 16 words.
```

Literary:

```text
- Each option is one line of a novel told by me, in my own first person: a gesture that carries a feeling, then my words inside quotation marks, in the shape: I <gesture>, "<my words>".
- Make the gesture specific: a look, a movement, a pause, a touch.
- A deed option is I and a vivid verb, with no spoken words.
- When someone is with me, the first option speaks, most options speak, and each takes a different stance toward what was just said. When I am alone, every option is a deed option.
- Keep every option to one sentence, roughly 8 to 20 words.
```

**Opening**

Chat:

```text
Hey, are you there?
```

Plain:

```text
I look up and say, "Hello."
```

Literary:

```text
I set down what I was holding, look up, and say, "Hello there."
```

**reply length**: `Keep each reply brief: two or three sentences at most.` · `Give each reply a medium length: about four to eight sentences.` · `Give each reply its full length: about ten to fifteen sentences.`

**pacing**: `The entity drives the conversation: it brings up new topics, asks questions, and suggests what to do next.` · `The entity answers the player and adds one thought or question of its own when it fits.` · `The entity answers what the player said, then waits for the player to lead.`


**Picker copy.** Style: Chat "Reads like a text thread" · Plain "Reads like a short story with dialogue" · Literary "Reads like a novel, and you're the lead". Reply Length: "A few sentences" · "Several sentences" · "Long, full replies". The group lines read "How long each reply runs" and "How the whole chat reads".

**Review, folded in.** The content test reads chip ids through `directChipTargets` and the chip-free text through `parsePlaceholderText`, not a regex copy of the token grammar. The Output line ends on "answer it, and stop when the reply ends": its old "with something of the entity's own" was a pacing rule that fought **You Lead**. The per-Style test checks reply length and pacing directly. The Style group line names the whole chat, since the group sets the choices and the opening too.

**Open for the user.**
- The choices override keeps `In these instructions, "I" is the player.` outside the chip. It frames the prompt's own wording, and every shape is first person, so it stayed.
- Medium Reply Length asks for four to eight sentences, which runs long for one Chat message. Ticket 12 measures it.
