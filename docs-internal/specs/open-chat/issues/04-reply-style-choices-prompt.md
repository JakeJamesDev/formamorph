# 04: Reply-Style Choices Prompt

Status: ready-for-human
Status note: built in 9398f4c3 plus the review follow-up; the length and asterisk notes under Open are the user's to weigh
Base: dce3833b
Blocked by: 01
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Open Chat supplies its own choices prompt. Choices read as short replies or actions in the voice of the player: things the player could say or do next in the conversation. Start from the built-in choices prompt and keep its chips and its output contract, so the choices parser still works. Sampler pins stay as they are.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [x] The override is present and enabled on the world, and the per-world opt-out still restores the preset of the player
- [x] The choices parse with the existing parser on every probe run
- [x] A/B probe against the built-in prompt on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [x] Metrics with before and after numbers are recorded under Comments: choices in the voice of the player, choice length, parse success
- [x] The regression check from the guide passes on the other metrics
- [x] The probe context holds the AI description of the one location as the world ships it; ticket 03 owns any rewrite
- [x] The content test asserts the choices override is present
- [x] Four gates green

## Comments

**Ruling, 2026-09-21.** A spoken choice is direct speech: the line itself in quotation marks. A deed choice stays "I" and a verb. The user picked this over the reported form of the built-in prompt ("I ask her whose estate it was").

**Probe.** `testing/baseline/harness/open-chat-choices-probe.mjs`, under `vite-node`. Arm A is the built-in choices prompt over the world, which is what the per-world opt-out gives. Arm B is the override. Both arms go through the world migration, the world-prompt seam, `choicesSystemPrompt`, and `parseChoices`. The context holds the AI description of the one location as the world ships it. The fixture is the Maren Holt card from `open-chat-cards.json`. Six cases: `greeting` (the imported greeting as page one), `question`, `banter`, `task`, `duo` (two entities), and `empty` (no entity, the guard case). The test pair is the one the guide names: the cloud default endpoint and Cydonia 24B. Choices carry no sampler pin, so the probe sends no temperature.

**Numbers, one paired batch per tier, 6 runs per case, 36 runs per arm.** "With an entity" covers the five cases that have one, 30 runs per arm.

| Metric | Cloud A | Cloud B | Cydonia A | Cydonia B |
|---|---|---|---|---|
| Parse success (3 or more lines, no junk line) | 36/36 | 36/36 | 36/36 | 36/36 |
| Count in 3 to 5 | 36/36 | 36/36 | 36/36 | 35/36 |
| Choices in the voice of the player, with an entity | 100% | 100% | 100% | 100% |
| Spoken choices (direct speech), with an entity | 0% | 45% | 0% | 49% |
| Spoken choices that carry a deed after the quote, with an entity | 0% | 0% | 0% | 19% |
| Reported speech ("I ask her..."), with an entity | 20% | 1% | 54% | 2% |
| Runs with a spoken choice: `greeting`, `question`, `banter`, `duo` | 0/24 | 24/24 | 0/24 | 24/24 |
| Words per choice, with an entity | 10.3 | 6.6 | 13.8 | 9.2 |
| Choices over 10 words, with an entity | 38% | 2% | 86% | 27% |
| Longest choice, words | 16 | 11 | 26 | 30 |
| Cut at the 256-token cap | 0/36 | 0/36 | 0/36 | 0/36 |

Words per choice, B minus A, with a 95% interval over the choices: cloud -3.7 (-4.2 to -3.2), Cydonia -4.7 (-5.6 to -3.8). The spoken share goes from 0 to 45% and 49%, so it needs no interval. The table is the output of `--rescore` on the two final run files with the metrics as committed.

**Regression check.**

- Guard case `empty`: spoken choices 0% on the cloud and 4% on Cydonia (one "I call out" line in 6 runs). Voice 100% on both.
- Distinct choices: mean word overlap between two choices of one run is 0.00 to 0.03 in B and 0.00 to 0.07 in A.
- "I notices": the cloud model sometimes writes the verb after "I" in third person. Arm A does it (1 of 92 lines in one batch). Earlier drafts did it more (7 of 60 lines, then 3 of 90). The shipped text shows 0 in three cloud batches, about 340 lines.
- The verb stems in the deed rule are not parroted: 1 of 111 B lines opens with one against 2 of 115 A lines on the cloud, and 7 of 162 against 9 of 167 on Cydonia.
- `task`: the entity hands the player a job, and most choices stay deeds (spoken 0% cloud, 28% Cydonia). That is the correct reading of the scene.

**What the iteration found.**

- The user message of the choices pass is a player preset, not world text. It ends "each a single action I take", which pulls against speech. The line "In a conversation, speaking is the action I take" answers it.
- The cloud model wrapped deeds in quotation marks ("I move to the chair.") until the prompt named two shapes, one for speech and one for deeds. The shapes took quoted deeds from 8 of 68 lines to 0.
- "Most options are spoken" left 3 of 10 cloud `banter` runs with no spoken choice. "The first option is a spoken option" fixed it: 40/40 against 37/40 in one paired batch of 10 runs per case. Cydonia did not move (31/32 against 32/32 at 8 seeds).
- A sentence that allowed "a few words of deed" after the closing quotation mark cost length on Cydonia. In one draft batch of 4 runs per case it gave 12.9 words per choice and five choices over 25 words, against 9.4 and none without it. The shipped prompt leaves the sentence out.
- "At least 2 options are spoken" changed nothing on the cloud (42% both ways).

**Open.**

- Cydonia still adds a deed after the quote on its own: 25 of its 66 spoken choices in the final batch. The cloud model adds none. The ruling allows the tail, so this is a length cost, not a voice break.
- Cydonia reads "roughly 3 to 10 words" as a target it passes: 27% of its choices run over 10 words, against 86% with the built-in prompt. One of its 36 runs (`question`) drifted into narrated prose, with choices of 18 to 30 words. Another run gave 6 good choices, which the parser keeps.
- The cloud model puts `*emphasis*` inside some spoken choices (2 of 111 lines). A choice button shows single asterisks as typed.
- The probe copies the context assembly of `open-chat-probe.mjs`. A shared helper would stop the two probes from drifting apart.
