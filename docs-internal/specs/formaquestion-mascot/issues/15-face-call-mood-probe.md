# 15: Face call mood probe

Status: ready-for-human
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

- [x] The run went out in a window the user agreed to, on a model named in the results, with the loaded-model check recorded.
- [x] The per-group table for both arms is in this ticket, with the run count per arm.
- [x] The ticket states whether the face follows the mood, with the evidence, and names the next lever if not.
- [x] No prompt text changed in this ticket.

## Probe results

`testing/baseline/harness/help-face-probe.cli.ts`, 2026-10-03, local arm on MeroMero 31B (`g4-meromero-v2-31b-i1`). The user agreed to a run on MeroMero in the session. Loaded-model check before the run: LM Studio `/api/v0/models` showed MeroMero as the only loaded model, and Ollama on 11434 was not running. 13 cases, 3 runs per case per arm (39 answers per arm), arms interleaved. Default settings with the Mascot on. Control: the same request with the description cut to "Sets your face." No errors in either arm.

| Group (answers per arm) | App: set | App: flagged | App: face the answer ended on | Bare: set | Bare: flagged | Bare: face the answer ended on |
|---|---|---|---|---|---|---|
| How-to (15) | 15/15 | 0/15 | Excited 7, Happy 5, Wink 3 | 15/15 | 0/15 | Happy 8, Excited 6, Wink 1 |
| Outside the guide (6) | 6/6 | 6/6 | Confused 4, Pondering 2 | 6/6 | 6/6 | Confused 6 |
| Missing feature (6) | 6/6 | 6/6 | Pondering 3, **Happy 3** | 6/6 | 6/6 | Pondering 3, Unimpressed 3 |
| No fix (6) | 6/6 | 0/6 | Happy 6 | 6/6 | 0/6 | Happy 6 |
| Thanks (6) | 6/6 | 0/6 | Happy 3, Smitten 3 | 6/6 | 0/6 | Happy 3, Smitten 3 |

Per arm: the face call came first, before any answer text, in 39/39 answers (both arms). Each answer made 1.00 calls. The answer text named a face of the rig in 5/39 (app) and 4/39 (bare); the match is a plain word test, and "Happy adventuring!" is one visible hit, so UNVERIFIED: I haven't checked every hit.

### Reading

**Partly.** The face follows positive and uncertain moods and is not a first-in-list pick. For negative moods it is untested (Sad) or wrong (paperback).

- Happy is first in the rig, yet the model chose Confused or Pondering for every answer outside the guide, and a flagged answer ended on Happy only for the paperback case below. It chose Smitten for the love-this-app thanks, Wink for the "give that pesky character the boot" answer, and Excited for the beginner and custom-function answers. The picks track the tone of the answer text.
- Gap 1, the no-fix group: **Sad was never set in 78 answers**, and the group ended on Happy 12/12. These two cases do not test the Sad face. The answers were cheerful ("Don't panic!", "bring it right back"), so Happy fits them. In runs 1 and 3, the deleted-world answers describe a restore path for bundled worlds. That is an answer-content question, not a face question. A case with a sad answer needs a question whose true answer is a flat no.
- Gap 2, the missing-feature group: for the paperback question the app arm set **Happy 3/3**, and the control set **Unimpressed 3/3**, on answers that say no button exists. All six answers open with "Oh, a ... book" and then say there is no magic button. Four of them say "Sadly". The answer text differs between arms, so the arms are not a clean pair here. The two arms agree on every other case. Only this group separates them. Each cell holds only 3 answers, so treat this as a lead to test, not a measure.
- Ticket 04 measured a call rate of 67% for the control and 100% for the app. In this run the control also reached 100%, so the rate gap did not repeat. Expect run-to-run drift on this model.

### Next lever

The description wording is the first lever to test. The face list order is the second. Neither is measured: this run varied only the description's length, and never the order. The order does not look like the driver, because Happy is first and the model picked Confused, Pondering and Smitten over it for answers with those moods.

- The description says "the mood of your answer" and the model reads that as the cheerful voice of the persona. A wording to test: name the mood of the *news* in the answer ("the mood of the news in your answer: good, bad, or not known").
- Add a sad-answer group to the probe first (a question whose true answer is a flat no, for example a feature the app cannot do and no workaround exists), so Sad has a case to be picked on.
- Change nothing in the prompt until that group exists. Then probe the new wording against this description as the control.
