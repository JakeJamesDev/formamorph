# 05: Voice chip

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The answers sound like the character while the mascot is on, and the prompt is exactly today's while it is off.

- The rig's text field is the Voice (Q35). Ticket 01 landed it under the old name; rename the field, its default and its codec line in this ticket. Nothing shipped, so no compat.
- A new help chip stands for the Voice. With the mascot on it sends the rig's Voice text; with it off, or the Voice empty, it sends nothing and leaves no blank line, as Markdown Guidance does.
- The Default help preset's answer prompt gains the chip. A custom preset without the chip sends no Voice.
- The question carries the Voice with the switch; the session reads no context.
- The probe harness gains the mascot switch and the Voice as inputs. The help bar run goes out twice on cloud, on and off, with its in-batch control. The on run must hold the bar.

Spec: Q22, Q25, Q26; Implementation → Help session.

Recommended model rationale: a prompt change with a bar run; the byte-equal guard decides whether default on is safe.

## Acceptance criteria

- [x] With the mascot off, the answer request body is byte-equal to today's.
- [x] With it on, the body holds the Voice text at the chip's place; an empty Voice adds nothing.
- [x] A custom preset without the chip sends no Voice.
- [x] Bar run numbers, on and off, are in the ticket and the on run holds the bar.
- [ ] The four gates are green.

## Result

**Pass.** With the framed Playful Voice, the bar is 77.9% with the mascot on and 76.7% with it off, in one batch. The bar is 75%.

### What landed

- The `<VOICE>` chip (label **Mascot Voice**) is its own paragraph after the intro line of the Default **Answer** and **Lookup** prompts (Q37). **Picks** has none.
- With a Voice, the chip sends two lines (Q39): `Speak in this voice: <Voice>`, then a line that keeps the guide's steps and control names exact. With the mascot off, or a blank Voice, its line and one blank line drop.
- The rig field `persona` is now `voice` (Q35). The default Voice is the user's pick: "Playful and cheerful, with a light touch of humor. Keep the fun in your word choice."
- The bar harness takes `--mascot on|off`, `--voice TEXT` and `--mascot-off`, an in-batch arm with the mascot off. The variant arms find the answer request by its intro line, because the Voice changes the old prefix.

### Byte-equal proof

Every request body that the help tests build was logged at Base and again after the change: 615 bodies. With the default Voice paragraph removed, all 615 came back byte-equal. The 22 extra bodies come from the new tests.

### Bar runs

Cloud default endpoint, model `default`, 125 questions, 5 runs, 0 failed. The bar is grounded-correct over task, here and follow-up questions (485 answers per arm).

| Run | Voice | On | Off |
|---|---|---|---|
| 1, two batches | ticket 01's draft, bare | 74.4% (361) | 77.1% (374) |
| 2, one batch | Playful, framed | **77.9%** (378) | 76.7% (372) |

- Run 1 missed the bar. All 10 questions that lost two or more runs missed their keys: the answers opened with chatty lines and paraphrased the guide's control names. Its arms ran in separate batches, so they don't compare (the cloud model drifts between batches).
- Run 2 per run: on 76.3, 75.3, 81.4, 75.3, 81.4; off 76.3, 77.3, 77.3, 77.3, 75.3. Per question, the Voice gained 24 correct answers and lost 18.
- The `no-docs` control has 2% keys met and carries no Voice.
- Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-04T01-46-37-237Z.json`. Run 1: `…T00-46-54-236Z.json` (on) and `…T01-03-22-307Z.json` (off).

### Outside the bar

| Run 2 | On | Off |
|---|---|---|
| Not covered, missed flag | 24% | 10% |
| Follow-up, invented name | 30% | 18% |
| Tokens out per answer | 260 | 199 |
| Time per question | 5.32 s | 4.12 s |

The Voice more than doubles the missed **Not in Guide** flags: 12 of 50 uncovered answers against 5 of 50. Run 1 showed the same direction, 16% against 8%. This ticket does not fix it.
