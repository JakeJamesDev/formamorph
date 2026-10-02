# 51: Answer from the right section

Status: ready-for-agent
Blocked by: 46
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the right section is sent, the answer uses it instead of a sibling section that was also sent (Q79). In ticket 46, four questions got the keyed section and still failed every run:

- `follow-backup-restore`: keyed section first in all 10 runs; the answer used the save-import section on the same page
- `saves-and-backup-2`: also used a world-import section from another page
- `statcodeguide-3`: copied an example section instead of the how-to
- `formaquestion-1`: used another sent section

This is a prompt change, so read `docs-internal/notes/prompt-writing-guide/notes.md` first.

- Find what draws the model to the sibling: section order, section titles, how the prompt frames the sections, or the follow-up history.
- Options to measure include the section order in the block, a short label per section, or a positive line in the help prompt about matching the question to a section. Give no example values a small model can copy.
- Measure at least two variants. Do not fit the wording to the four questions.

**Probe.** Ticket 26's harness on all kinds, default cloud model, 5 runs per arm, the current build as the in-batch control. A prompt change needs 5–12 runs per arm on cloud; run more if the arms are within drift.

Recommended model rationale: a prompt change whose value only a careful probe can show.

## Acceptance criteria

- [ ] The handover names what drew the model to the sibling in each of the four
- [ ] At least two variants measured against the current build in the same batch
- [ ] The shipped variant does not drop any kind by more than the 5-point drift
- [ ] Four gates green
