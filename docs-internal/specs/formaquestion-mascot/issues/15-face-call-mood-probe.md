# 15: Face call mood probe

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Numbers that say whether the AI's face follows the mood of its answer, or just the first name in the list.

- Ticket 04's first run had every face call pick Happy. All six cases were friendly how-to or thanks answers, so Happy fit each time, and the run cannot tell a fitting pick from a first-in-list pick. The follow-up extended the face probe with case groups by answer mood: how-to, outside the guide, missing feature, no fix, thanks. Per arm (the app's description against a one-line control) and per group it reports the call rate, the not-in-guide flag rate and the face each answer ended on. No model run exists yet.
- Run the full probe: every case, both arms, at least three runs per arm, with the in-batch control. It needs a local model, because the cloud endpoint takes no functions. Ask the user for a window before any local run; MeroMero locks the PC, Cydonia is the lighter arm. Check what is loaded first, so a second model does not spill the target to CPU.
- Put the per-group table in this ticket's Probe results, with a reading: does the face follow the answer's mood? If it does not, name the next lever (the description wording, or the face list order) and change nothing in the prompt.

Spec: Q1, Q12, Q26; Testing Decisions → the face call's description is new prompt text.

Recommended model rationale: a harness run with a fixed done-state; the reading is a comparison, not a design.

## Acceptance criteria

- [ ] The run went out in a window the user agreed to, on a model named in the results, with the loaded-model check recorded.
- [ ] The per-group table for both arms is in this ticket, with the run count per arm.
- [ ] The ticket states whether the face follows the mood, with the evidence, and names the next lever if not.
- [ ] No prompt text changed in this ticket.
