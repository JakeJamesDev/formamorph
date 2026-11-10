# 12: Batched Location Request

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change: it ships with probe numbers. Added after ticket 09's probe (Q103).

## What to build

The location request asks about every character in one call, not one call per character. The subjects, the replies, the clock line, the JSON schema with its text fallback and the gate all stay as ticket 09 built them.

Ticket 09's probe is the reason. On the cloud default, an action that names one character out of three moved only that one in 24 of 24 batched runs, and in 16 of 24 per-character runs. "Corvin, come with me" also brought the two others along in every per-character run. One call also cuts the requests per turn from one per character to one.

Two known costs to measure and report:

- A batched call ran about twice as long as one per-character call. Per-character calls run side by side, so the turn's wall-clock time may go up or down.
- "As long as it takes" and "until night falls" picked the end of this daypart, not the next, in both forms (Q8 says the next). Try to fix it here; if the probe does not move, record it.

Read `docs-internal/notes/prompt-writing-guide/notes.md` before writing the prompt.

Spec rulings: Q8, Q103–Q108. The spec's "Entity location request" section and ticket 09's Landed section are the contract and the baseline.

## Acceptance criteria

- [ ] One request per turn covers every subject, and each subject gets exactly one reply. A reply that omits a subject, or names one that was not asked, leaves that character where they are.
- [ ] Turn pipeline tests with recorded replies cover both reply forms, three subjects with mixed replies, an omitted subject and an unknown one.
- [ ] The per-character path is removed, not kept beside the batched one.
- [ ] Probe on the cloud default with ticket 09's cases and the per-character form as the in-batch control: the one-named bar, right answers, false moves, wrong waits, and the turn's wall-clock time for both forms. The landing states the numbers.
- [ ] The batched form lands only if it meets the one-named bar and is not worse than the control on right answers.
- [ ] The prompt reference doc and a changelog fragment cover the change.

For you: with three characters in a room, ask one by name to come along, and check the others stay.
