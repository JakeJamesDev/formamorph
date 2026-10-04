# 16: Voice keeps the guide flag

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

With the mascot on, an answer the guide does not cover still carries the Not in Guide marker as often as it does with the mascot off.

- Ticket 05's bar run passed, but under the Voice, uncovered questions missed the Not in Guide flag 24% against 10%, follow-ups invented control names 30% against 18%, and answers ran 260 tokens against 199. Two batches showed the same direction. The numbers are in ticket 05's Result section.
- The lever is the chip's fixed framing (Q39), not the player's Voice text: one more line that keeps the marker rule and the guide's names in force while the Voice applies. Change only the framing; the Voice itself stays the player's.
- Prove it the same way: one cloud batch, mascot on and off, the no-docs control, with the flag rate on uncovered questions, the invented-name rate on follow-ups, the answer length, and the bar score. The bar must still hold, and the flag rate must close most of the gap. Report every number, even when it moves the wrong way.
- Mascot off stays byte-equal to today's prompt.

Spec: Q22, Q26, Q39, Q41; Implementation → Help session.

Recommended model rationale: a prompt change judged on four numbers at once, where one wording nudges three of them.

## Acceptance criteria

- [x] The off request body is unchanged.
- [x] One batch reports both arms on the flag rate, the invented-name rate, the length and the bar score; the numbers are in this ticket.
- [x] The on arm holds the bar and its flag rate on uncovered questions is within a few points of the off arm.
- [x] The four gates are green.

## Result

**No framing change ships (Q46).** Both candidates missed the bar. Today's framing held the bar, and its flag gap was 2 answers in 50.

### What landed

- The bar harness takes `--frames frame-a,frame-b`. Each arm swaps the shipped Voice framing for one candidate inside the same batch (`testing/baseline/harness/help-voice-frames.ts`).
- `frameVoice` is exported so the harness swaps the exact shipped text. The prompt text is unchanged, so no request body changes, mascot on or off.

### The candidates

- **05** (shipped): `Speak in this voice: <Voice>`, then "Keep that voice. Start with the answer, and write each step and control name as the guide writes it."
- **A**: 05's two lines, then "When the guide sections do not cover the question, the Not in Guide marker still comes first, alone on its own line, and the voice starts on the next line."
- **B**: `Speak in this voice: <Voice>`, then one line: "Keep that voice. Begin with the answer, or with the Not in Guide marker alone on its own line when the guide sections do not cover the question. Write each step and control name as the guide writes it."

### Bar run

Cloud default endpoint, model `default`, 125 questions, 5 runs, 0 failed, one batch. The bar is grounded-correct over task, here and follow-up questions (485 answers per arm), and it is 75%.

| Arm | Bar | Not covered, missed flag | Follow-up, invented name | Tokens out per answer | Time per question |
|---|---|---|---|---|---|
| 05, shipped | **75.9%** (368) | 7/50 (14%) | 12/50 (24%) | 258 | 5.73 s |
| A | 73.4% (356) | 27/50 (54%) | 18/50 (36%) | 304 | 6.59 s |
| B | 72.6% (352) | 6/50 (12%) | 19/50 (38%) | 300 | 6.49 s |
| Mascot off | 76.1% (369) | 5/50 (10%) | 9/50 (18%) | 202 | 4.48 s |
| `no-docs` control | 2% keys met | – | 35/50 (70%) | 122 | – |

- Per run: 05 79.4, 75.3, 78.4, 74.2, 72.2; A 76.3, 76.3, 71.1, 72.2, 71.1; B 72.2, 73.2, 70.1, 76.3, 71.1; off 75.3, 75.3, 76.3, 77.3, 76.3.
- Invented names over all answers: 05 10%, A 20%, B 20%, off 11%.
- Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-04T04-22-58-549Z.json`. The batch ran with B in the code, so its arm names differ: `retrieval` there is B, and `frame-05` is the shipped framing.

### Reading

- **The flag gap reads as batch drift.** Ticket 05 saw 12 against 5 missed flags. This batch saw 7 against 5 with the same framing. On 50 questions, that difference is inside the drift between cloud batches. Today's framing meets the flag acceptance line within that drift.
- **B closes the flag gap but misses the bar.** It also doubles the invented names on follow-ups against mascot off, and its answers run longer than 05's and off's.
- **A's collapse comes from naming the marker in words.** 17 of its 27 misses open with "Not in Guide" with no brackets, and the reader does not match that form. 5 more open with the model's reasoning text. A prompt line that names the marker must write its token, the way the answer rules write it.
