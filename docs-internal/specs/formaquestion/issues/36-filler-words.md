# 36: Filler words do not match

Status: done
Base: 42e291ed
Blocked by: 34
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Words like "here" and "this" stop pulling sections into the answer (Q60). In ticket 26, "what am I looking at here?" in the AI Context dialog sent the right section first, but a hit on "here" also sent the Help for This Screen section, and the model answered from it.

- The search ignores filler words that carry no topic, in the question and in the authored keyword lines.
- A section can still match its own control name when that name holds such a word, for example **Help for This Screen**.

**Probe.** Run ticket 26's harness on the here and task kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: a word list with one exception rule.

## Acceptance criteria

- [x] "What am I looking at here?" with no surface sends no Formaquestion section; a test asserts it
- [x] "How do I use Help for This Screen?" still finds that section; a test asserts it
- [x] Probe numbers, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

**Built.** `FILLER_WORDS` (`am`, `here`, `looking`, `there`, `these`, `those`) drop from the question and from body text. A heading or keyword line keeps them. A section whose heading or keyword phrase holds a filler word matches when the question holds that phrase as whole words. `this` stays a stop word, so **Help for This Screen** matches on `help` and `screen`. `createDocsIndex({ fillerWords: false })` turns the rule off, and `--unfiltered` runs that index as the probe control.

**Probe.** `npm run probe:help -- --runs 5 --kinds here,task,followUp --unfiltered`, default cloud model, one batch (`testing/baseline/runs/help-baseline-2026-10-02T06-40-36-525Z.json`). Fixed vs control:

| Kind | Answers | Grounded-correct, fixed | Grounded-correct, control |
|---|---|---|---|
| Task | 375 | 51% | 50% |
| Here | 60 | 85% | 88% |
| Follow-up | 50 | 18% | 32% |

Read it as no measurable change. The cloud model drifts, and each arm has only 5 runs. The sources differ in 15 of 97 questions, and most differences swap one distractor section for another. `here-ai-context` is the ticket's case: the fixed build sends only its own section, and the control sends four more. Only 1 of 10 follow-up questions changes its sources (`follow-require-count` loses one section), so the follow-up gap is model drift, not retrieval.

**Review folded in.** The phrase test matched substrings, so a section named "Here" matched "there". It now matches whole words. Tests added for the keyword-line case and the whole-word case. Each fails when its rule is removed.
