# 26: Help probe baseline

Status: ready-for-agent
Blocked by: 13, 22, 23, 24, 27, 28, 29, 30
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The user gets real numbers on how well Formaquestion answers, and sets the pass bar from them (Q24). This ticket sets no bar.

**Question set.** A fixed set, kept in the repo beside the other probe harnesses:

- at least two task questions for each docs page, in a player's words, not the page's words
- "here" questions that depend on the Surface
- follow-up pairs
- questions the docs do not cover, to measure the flag
- questions in another language, to measure the AI Language directive

Each question has keyed facts: the control names and steps a correct answer must contain, and facts it must not contain. Scoring is objective: keyed facts present, forbidden facts absent, sources include the right section, flag correct. No model judges the answers.

**Runs.**

- The default cloud model, 5 to 12 runs per arm, every batch with its own in-batch control (the same model with no docs).
- Arms: retrieval mode, lookup mode where the model supports it.
- A local arm on Cydonia only if the user agrees to a window. Ask; do not start one.
- Requests replicate the app's sampler pins and send reasoning off.

**Report.** A table per arm: grounded-correct rate, wrong-step rate, flag errors in both directions, source accuracy, tokens per question. List the ten worst questions with the cause of each: a docs gap, a search miss, or a model error.

Then the user sets the bar. Record it as a ruling in the spec. If the numbers are under the bar, write the follow-up tickets (docs fixes, search fixes or prompt changes) from the worst-question list; do not tune the prompt in this ticket.

Recommended model rationale: the question set and the scoring keys decide whether the numbers mean anything.

## Acceptance criteria

- [ ] The question set covers every docs page with at least two task questions, with keyed facts for each
- [ ] The harness scores from keyed facts and sources only, and runs with one command
- [ ] Every batch has an in-batch no-docs control
- [ ] The report table and the ten worst questions with causes are handed to the user
- [ ] No pass bar is invented; the user's bar is recorded in the spec as a ruling
- [ ] Follow-up tickets exist for the gaps under the bar, or the handover says none are needed
- [ ] Status moves to `ready-for-human` for the user's ruling
