# 07: Code Probe Cases And Bar

Status: done
Blocked by: 01 — Quick Reference Section; 02 — Pin The Quick Reference On Code Turns; 05 — Code Rider Names And Typo
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: harness cases plus a multi-arm probe campaign on a drifting cloud model; judgment on numbers.

## What to build

The help-code harness gains five known cases from the source transcript: a daypart-gated trait, a day-count-gated trait, a persona trait switch, a threshold check on a named stat from another stat's Code tab, and a multi-condition placeholder pin. Each asserts the real member names and the absence of `clock.time`, `clock.days` and a whole stat compared to a number. The bar run on the cloud default, with the Quick Reference pinned, passes the five cases on 80% of runs at 5 or more runs each, and the existing code cases do not drop. A second arm, rider names on versus off, decides whether ticket 05's `entities`/`persona` names stay; on no gain, this ticket removes them.

## Acceptance criteria

- [ ] Five new cases in the harness, each asserting presence of real names and absence of the invented ones
- [ ] Bar run: 80% pass across the five cases, 5+ runs each, existing code cases not lower, with an in-batch control
- [ ] Rider arm run; numbers recorded in the spec; names kept or removed per the result
- [ ] Changelog fragment written if the rider changes

## Results (2026-10-05)

Model `default` on `api.lyonade.net`, root `/home/fiery/gemma_deploy/model`. Each batch: 17 cases (13 code, 4 prose) × 3 arms × 8 runs = 408 questions, 0 failed. A known case passes when every fence runs, the fences hold its real names, and they hold no invented one.

❌ **Q9 missed.** The configuration that lands (the rider without names, the guide as it was) passes the five cases on **65%** in both batches, against 80%. The reverted persona wording reached 73%. Q29 (user): the ticket lands with the bar unmet, and ticket 08 measures the five cases again after the code test function lands.

### Batch 1: the bar and the rider names (Q10)

| Known case | rider | rider + names | no Quick Reference |
|---|---|---|---|
| prowler-at-night | 100% | 88% | 0% |
| seasoned-after-two-weeks | 100% | 100% | 0% |
| seasoned-on-persona | 0% | 0% | 0% |
| brave-at-courage | 100% | 100% | 0% |
| quotes-pin | 25% | 63% | 0% |
| **All five** | **65%** | **70%** | **0%** |

- Other code cases run: rider 92%, no Quick Reference 84%. Q7 holds: fence 99%, runs 89%.
- **Q10: no gain from the names**, so the rider no longer names `entities` and `persona`. The names arm's 70% against 65% is noise: 40 answers per arm on a drifting model, and the quotes-pin gap is the slot-tag drift, not names. The persona case, the names' target, stays at 0% on both arms. The spec session dropped ticket 05's changelog entry on main; no fragment.
- Raw answers: `testing/baseline/runs/help-code-probe-2026-10-05T19-51-19-415Z.json` (gitignored).

### Batch 2: the persona wording

The Quick Reference's owner rule now says the character you play, custom or not, is `persona` (spec-session ruling). The `qr-before` arm runs the guide without that line.

| Known case | new wording | qr-before | no Quick Reference |
|---|---|---|---|
| prowler-at-night | 88% | 75% | 0% |
| seasoned-after-two-weeks | 75% | 100% | 0% |
| seasoned-on-persona | 0% | 0% | 0% |
| brave-at-courage | 100% | 88% | 0% |
| quotes-pin | 100% | 63% | 0% |
| **All five** | **73%** | **65%** | **0%** |

- The wording did not move the persona case: 8 of 8 answers on both arms write the world `traits.Seasoned`. With no gain on its target case, the line is reverted (spec-session ruling).
- Other code cases run: new wording 91%, qr-before 97%, no Quick Reference 95%. Q7 holds: fence 95%, runs 87%.
- Raw answers: `testing/baseline/runs/help-code-probe-2026-10-05T20-08-54-787Z.json` (gitignored).

### What fails

- **seasoned-on-persona, 0 of 32 answers on Quick Reference arms.** She never maps "custom character" to `persona`, with either wording.
- **The slot tag on its own line.** Some answers open the fence with ` ```javascript ` and put `before` on the next line, so the code throws. It cost quotes-pin 5 of 8 in batch 1. A format miss, not a names miss: the spec Backlog holds it as a rider follow-up.
