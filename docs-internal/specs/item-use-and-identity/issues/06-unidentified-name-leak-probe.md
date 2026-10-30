# 06: Unidentified Name Leak Probe

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Measurement only. The user rules the ceiling from its numbers (Q24).

## What to build

A probe that measures how often the narrator names an unidentified item's true face before a reveal. It runs narration turns that show the item without revealing it, with an in-batch control where Items Here holds only the unidentified face. It reports the leak rate per arm.

Spec: Testing Decisions (Probes); Q14, Q24.

## Acceptance criteria

- [x] A probe CLI under the baseline harness runs narration turns over a fixture with an unidentified item and scores true-face mentions (`inventory-leak-probe.cli.ts`, `--dump` read, full run)
- [x] Two arms, paired by run index: both faces (as shipped) and the unidentified face only (control) (`--dump` of both arms, worn case)
- [x] Cloud, 12 runs per arm per case; the leak rate per arm goes in the landing for the user's ruling (run on api.lyonade.net, 120 completions, 0 failed)
- [x] The developer tooling changelog names the probe (fragment `item-use-and-identity-06.md`)

## Blocked by

- 03

## Landed

Leak rate per arm, cloud default, 12 runs per arm per case, 0 failed requests. Name = the item's true name; nature = keywords from its true AI text.

| Case | Name: both | Name: control | Nature: both | Nature: control |
|---|---|---|---|---|
| carried | 0/12 | 0/12 | 0/12 | 0/12 |
| handled | 0/12 | 0/12 | 0/12 | 0/12 |
| worn | 0/12 | 0/12 | 0/12 | 0/12 |
| lying | 0/12 | 0/12 | 0/12 | 0/12 |
| **Pooled, unprompted** | **0/48** | 0/48 | 0/48 | 0/48 |
| baited ("what is this?") | 0/12 | 0/12 | 0/12 | 0/12 |

- No control hit to hand-check. A loose grep of every `both` text for partial names and nature words (veil, hollow, hunger, crown, tideglass, curse, drain, memory, vision, the dead, grave) found none tied to an item; "ferryman" hits name Bram.
- With 0 of 48, the 95% upper bound on the unprompted name rate is about 7%. With 0 of 12 on the baited case, it is about 24%.
- Limits: the cloud endpoint ignores `seed`, so the pairing is nominal. Narration ran at 600 tokens (replies were about 100 words, so none ran out). Name regexes need the full name, so a partial name ("the compass") is not counted.

**Not verified**
- None.

**For you**
- Rule the leak ceiling (Q24) from the table above. A ceiling of 0 cannot be proven from 12 runs per case; the bound above is what the data supports.
- Q48 is not yet in `spec.md`; the spec session gave it by message.
