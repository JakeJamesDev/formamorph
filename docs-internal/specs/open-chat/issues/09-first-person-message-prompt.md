# 09: First-Person Message Prompt

Status: ready-for-human
Status note: built and probed; two acceptance boxes are open for a product ruling, the two-entity name prefix and the Cydonia empty room (see Comments)
Base: c646b365
Blocked by: 08
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A reply in Open Chat is one chat message from the entity, in first person, as the entity would type it. There is no narrator, no scene prose, and no quotation marks around the message. An action the entity needs sits inside the message between asterisks, the SillyTavern convention. The reply stops when the message ends.

Rewrite the narration override from the revision 1 text. Keep the context chips: memory, persona, dictionary, notes, entities, location, and language. Remove the length guidance chip; the Reply Length chip is this world's only length control. Read the three tone chips from ticket 08. With two or more entities present, each message starts with the entity's name and a colon; with one, there is no prefix. This is a smoke case only. With no entity present, the model introduces a speaker by name and that speaker sends the message.

The one location's AI description and the neutral world system prompt line are in the probed context; keep or rewrite them on the numbers.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [x] The rendered narration prompt holds no length guidance text, and the content test asserts it
- [x] A/B probe with the revision 1 prompt as the baseline arm, on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [x] Cases: greeting as page one, question, banter, task, Short and Long reply length, and the no-entity guard
- [x] Metrics with numbers per arm under Comments: first-person message held (no narrator sentence, no third-person reference to the entity, no quotation marks around the message), reply length per Reply Length setting, asterisk actions well formed
- [ ] A two-entity smoke case shows name-prefixed messages on at least one tier — **not met: 0/24 cloud and 0/6 Cydonia after the greeting, 0/12 and 1/6 without one; see Comments**
- [ ] The regression check from the guide passes on the other metrics — **one guard moves the wrong way: the Cydonia empty room, 1/6 → 0/6 held; see Comments**
- [x] An imported greeting as page one, followed by one turn, keeps one voice, checked live in the Chat layout — **the voice is Maren's in first person; the greeting's quoted-speech shape carries over, see Comments**
- [x] Four gates green

## Comments

**2026-09-21, what shipped.**

- The narration override is a first-person message prompt. The role frame is "You are the entity listed for this location, chatting with the player by message." The rules: type as yourself in first person, the words go on the page with no quotation marks around them, an action sits between asterisks in the shape *action* in the same first person, the Prose Style and Pacing chips, continuity, the bracket channel, the two-entity name prefix, the empty-room stranger, and the Reply Length chip as the last guideline. The Output section is the format contract: the message only, no menu, the player's message already read, stop when the message ends.
- Every context chip of the built-in prompt stays. `<LENGTH GUIDANCE>` is gone, and the content test asserts both the chip's absence and that the rendered prompt holds no length guidance text. Three chip headers changed to fit the role frame: "Who you are", "Where you are", "Who the player is".
- The location text and the neutral world system prompt line are unchanged. Both were in the probed context on every run, and no alternative wording of either was measured, so the keep rests on the arm B numbers as a whole, not on a comparison.
- Authored by a script that writes the draft into `promptOverrides.systemPrompt`.

**Probe.** `testing/baseline/harness/open-chat-probe.mjs`, rewritten for revision 2. Arm A is the revision 1 prompt read from `c646b365` (`--a-world-rev`, the default; `--a-builtin` gives the preset instead). Arm B is the world file. Tone `none` is every group's default trait, and a picked tone replaces its own group's default, as the picker does. Cases: `solo` (the greeting is page one, then a question, banter, and a task), `cold` (no greeting, the Opening Action, then a question), `duo` (two entities after the greeting), `duocold` (two entities, no greeting), `empty` (no entity). Held means first person present, no third-person reference to the entity by name or pronoun anywhere in the reply, no quotation marks anywhere in the reply, and not the player's message read back. The quotation-mark term is stricter than the ticket's "around the message": a message that quotes a third party fails it too. The quote share column shows what the marks wrap; at 45 to 55 percent of the reply they wrap the entity's own speech, as in the greeting. Tiers: the cloud default endpoint at 12 runs per arm, Cydonia 24B (`cydonia-24b-v4.3@q4_k_m`) at 3. `n` is replies per cell.

| Tier | Case | n | Held A → B | First person A → B | Third person A → B | Quoted A → B | Words A → B |
|---|---|---|---|---|---|---|---|
| Cloud | solo | 36 | 0/36 → 0/36 | 16/36 → 26/36 | 36/36 → 36/36 | 36/36 → 36/36 | 119 → 84 |
| Cloud | cold | 24 | 0/24 → 0/24 | 3/24 → 16/24 | 24/24 → 20/24 | 21/24 → 14/24 | 161 → 72 |
| Cloud | duo | 24 | 0/24 → 0/24 | 5/24 → 14/24 | — | 24/24 → 24/24 | 120 → 86 |
| Cloud | duocold | 12 | 4/12 → 7/12 | 0/12 → 2/12 | — | 8/12 → 4/12 | 165 → 56 |
| Cloud | empty | 24 | **1/24 → 24/24** | 9/24 → 24/24 | 17/24 → 0/24 | 22/24 → 0/24 | 95 → 38 |
| Cydonia | solo | 9 | 0/9 → 0/9 | 8/9 → 9/9 | 9/9 → 3/9 | 9/9 → 9/9 | 115 → 110 |
| Cydonia | cold | 6 | **0/6 → 4/6** | 3/6 → 6/6 | 6/6 → 2/6 | 6/6 → 2/6 | 101 → 115 |
| Cydonia | duo | 6 | 0/6 → 0/6 | 6/6 → 6/6 | — | 6/6 → 6/6 | 137 → 130 |
| Cydonia | duocold | 6 | 0/6 → 0/6 | 2/6 → 6/6 | — | 6/6 → 6/6 | 101 → 98 |
| Cydonia | empty | 6 | 1/6 → 0/6 | 2/6 → 6/6 | 1/6 → 1/6 | 5/6 → 6/6 | 118 → 79 |

Third person is not read with two entities, where a pronoun may point at the other one, so the `duo` and `duocold` held rates lack that term and read easier than the others. In the empty room the speaker gives its name in 0/24 → 0/24 replies on the cloud tier and 0/6 → 1/6 on Cydonia. Difference B − A with a 95% interval from a bootstrap that resamples whole chains (4000 draws); bold intervals leave out zero:

| Tier | Case | Held, points | Quoted, points | Words |
|---|---|---|---|---|
| Cloud | solo | 0 | 0 | **−35 [−44, −26]** |
| Cloud | cold | 0 | −29 [−63, 0] | **−89 [−106, −72]** |
| Cloud | duo | 0 | 0 | **−34 [−45, −24]** |
| Cloud | empty | **+96 [+88, +100]** | **−92 [−100, −79]** | **−57 [−76, −37]** |
| Cydonia | solo | 0 | 0 | −6 [−30, +18] |
| Cydonia | cold | +67 [0, +100] | −67 [−100, 0] | +14 [−9, +34] |
| Cydonia | duo | 0 | 0 | −7 [−31, +18] |
| Cydonia | empty | −17 [−50, 0] | +17 [0, +50] | −39 [−77, +1] |

Reply length per Reply Length setting, `solo`, words (paragraphs). Cloud n = 36 per cell, Cydonia n = 9. Both arms read the same revision 2 values; arm A also carries `<LENGTH GUIDANCE>`.

| Tier | Arm | Short | Medium | Long | Long − Short |
|---|---|---|---|---|---|
| Cloud | A | 97 (2.1) | 119 (2.2) | 181 (3.2) | +84 [+72, +95] |
| Cloud | B | 55 (2.0) | 84 (2.1) | 120 (2.4) | +65 [+51, +79] |
| Cydonia | A | 110 (4.1) | 115 (4.4) | 129 (3.9) | +19 [−11, +44] |
| Cydonia | B | 87 (4.0) | 110 (4.6) | 107 (3.7) | +19 [−23, +63] |

Asterisk actions: every reply on both tiers and arms has balanced asterisks except one Cydonia arm A `duo` reply (5/6) and one arm A `Long` reply (8/9); arm B is 100%. Actions per reply rise on arm B (cloud solo 1.0 → 2.2, cold 0.8 → 1.3, empty 0.1 → 1.1). Other metrics, both tiers, both arms: menu 0 everywhere, cut 0, chip leak 0, bold at most 0.2 per reply, a heading or a note about the model's own job 0 on every case with an entity (cloud empty 0/24 → 1/24).

**Reading.**

- **The no-entity guard is the clear win on the cloud tier** (1/24 → 24/24 held, quotation marks 22/24 → 0/24). A speaker says "I" and answers, with no narrator. The spec's "introduces a speaker by name" is not met, though: the name comes in 0/24 replies on the cloud tier and 1/6 on Cydonia.
- **A cold start with an entity holds first person in speech on both tiers** (cloud 3/24 → 16/24, Cydonia 3/6 → 6/6), and Cydonia holds the whole message 4/6. The cloud model still writes the entity's asterisk actions in third person (20/24 replies), and half its replies keep quotation marks around the speech.
- **An imported greeting locks the reply format on both tiers.** After Maren's greeting (third-person actions between asterisks, speech in quotation marks) every reply on both arms keeps that shape: 0/36 cloud and 0/9 Cydonia held, quotation marks in every reply. Arm B moves the speech itself to first person (cloud 16/36 → 26/36, Cydonia third person 9/9 → 3/9) and cuts the narration around it (words 119 → 84), but the shape stays the greeting's. Removing the player preset's user-message rider (`--no-rider`) changed nothing (0/9), so the greeting is the cause, not the rider.
- **The Reply Length chip works alone on the cloud tier** (Long − Short +65 words [+51, +79]), and arm B is shorter across the board. On Cydonia the setting is inside the noise on both arms, as in revision 1.
- **The two-entity name prefix is not followed.** Neither tier writes `Name:` after the greeting (0/24, 0/6), and without one the cloud tier writes it 0/12 and Cydonia 1/6. Both models switch speaker the way a card does, with the second entity's action in third person. Five wordings of the rule were tried, including the literal shape `Name: *what I do* what I say`; none moved it.
- **The Cydonia empty room is the guard that moves the wrong way.** Held 1/6 → 0/6 because arm B keeps quotation marks in 6/6 replies (arm A 5/6). Both arms top 4/6 replies with a heading such as `# Here`, as revision 1 recorded. In 1 of 3 arm B chains the model broke character as an AI assistant and asked what to do. The stranger wording ("a stranger the player meets here") measured the same as "someone new" on both tiers and shipped for its lower quote count.

**Wording search.** Ten drafts were measured on the cloud tier before the text was locked, each against the previous in one batch (6 to 12 chains per cell), since the endpoint drifts between batches. The role frame ("You are the entity") took the empty room from 0/4 to 12/12 and the cold case into first person; nothing after it moved the greeting or the cold third person. A positive "the way a text message is typed" rewording measured worse than the plain "no quotation marks around them" rule (cold quotes 12/12 against 4/12). Dropping the Formatting chip measured worse (cold quotes 12/12). A shape line at the end, a `*I do this*` shape, and a continuity sentence all measured level or worse. Prose dumps for every batch are under `testing/baseline/runs/open-chat-probe-*`.

**Live check.** `e2e/open-chat.spec.ts` now runs in the Chat layout. With `OPEN_CHAT_LIVE` on Cydonia, the greeting was page one and the next turn came back as Maren in first person ("I lean against the counter and pull the kettle off its burner", "'The Winthrops,' I say"), with speech in quotation marks as the greeting has it. With the mock model the three specs pass on desktop; the first asserts the world prompt's opening words and one listed value per tone chip.

**Seen, not fixed.**

- The Prose Style and Pacing values say "the entity" in third person while the prompt says "you are the entity". They are ticket 08 content and were left as measured.
- A picked tone trait still shows under the "Traits" heading as a bare name beside its instruction sentence.
- The probe reads the second entity's name from the fixture for the prefix metric; a card whose name holds a space or a hyphen would need the regex widened.
- `VariableNode.label.test.tsx` failed once in the full suite (a radio named "World" not found) and passed alone; not this ticket's file.
