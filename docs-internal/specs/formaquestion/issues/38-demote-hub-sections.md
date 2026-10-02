# 38: Demote hub sections

Status: ready-for-agent
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

- [ ] The rule that marks a hub section is in the code, and a test shows both ticket 37 sections are marked by it
- [ ] For a task question that matches both, a specific section ranks above a hub section; a test asserts it
- [ ] "What does Settings → Output hold?" still finds `Settings#output`; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
