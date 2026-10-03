# 38: Demote hub sections

Status: done
Base: aabf1297
Blocked by: 37
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Broad overview sections stop filling the slots that a specific section should take (Q68). In ticket 37, `Glossary#building-a-world` reached 13 bar questions and `Settings#output` reached 11, nearly always as a wrong section.

- Sections that mention many features in passing rank below a specific section with the same match strength. Find these sections by a rule you can state (for example, how many other pages a section names), not a hand list of the two ids.
- A question that asks for the overview or the glossary term itself still finds it.
- The Search tab, the help session and the lookup use the same ranking.

**Probe.** Run ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report grounded-correct and right source per kind.

Recommended model rationale: one ranking rule with a probe check.

## Acceptance criteria

- [x] The rule that marks a hub section is in the code, and a test shows both ticket 37 sections are marked by it
- [x] For a task question that matches both, a specific section ranks above a hub section; a test asserts it
- [x] "What does Settings → Output hold?" still finds `Settings#output`; a test asserts it
- [x] Probe numbers, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

**The rule.** `otherPagesLinked` in `src/lib/docs/docsIndex.ts` counts the other docs pages a section links to. A section with 5 or more (`HUB_PAGE_COUNT`) is a hub, and its score is multiplied by 0.5. The weight is a product with the Q64 page weight, so it applies after it. A query that holds the hub's heading as a whole phrase skips the demotion ("What does Settings → Output hold?").

- The bundled docs have 8 hubs: `Home#where-to-go` (33 pages), `Glossary#building-a-world` (11), `WorldEditor#world-editor` (9), two more Glossary sections, `Settings#output` (5) and two "Related" lists.
- A first version skipped the demotion when the query held every heading word. "I finished building my world…" held "building" and "world", so the hub stayed first. The phrase test fixes that; a test covers it.
- Search-only check on the 75 task questions: the right section is in the top 5 for 45, was 43. No question lost it.
- The Search tab, the help session and the lookup call the one `search`, so they share the rule.

**Probe.** `npm run probe:help -- --runs 5 --hub-old`, default cloud model, 125 questions × 5 runs, current build against `--hub-old` (no demotion) and the no-docs control, in one batch. The batch ran twice: the first run used the heading-words exemption, the second the final rule. Grounded-correct, final rule against control:

| Kind | Answers | Final rule | Control (`hub-old`) | Right source, final / control |
|---|---|---|---|---|
| Task | 375 | 54% | 51% | 59% / 55% |
| Here | 60 | 90% | 90% | 100% / 100% |
| Follow-up | 50 | 38% | 30% | 50% / 50% |
| **Bar (all three)** | 485 | **56.8%** | **53.6%** | |

- First run, heading-words exemption: bar 54.6% against 52.6%.
- The gain is 3 points in both batches. The 80% bar still fails; ticket 37's 5-point drift note applies, so read it as a small gain, not a proof.
- Outside the bar, batch two: language with the setting and the changelog are unchanged within noise.
- `linkedcontent-1` (ticket 40): 80% against 20% in the same batch. Recovered.
- `follow-publish-update` (ticket 40): 0% in both arms, right source 100%, flagged 100%. The first answer now leads with `Community-Creations#how-to-publish-a-world`, not the Glossary hub, but the follow-up is still flagged. The hub was not the whole cause. That cause stays with ticket 40.

**Changes.** `createDocsIndex` takes `hubDemotion` (default on) for the probe's control arm. The harness has the `--hub-old` arm. The changelog has one sentence in the Formaquestion entry and the probe entry.

**Gates.** typecheck, lint, test (965 files, 16,304 tests, 125 s) and build all exit 0. A mutation that removes the weight fails the bundled-docs ranking and fixture ranking tests; a mutation that always skips the demotion fails three tests.
