# 05: Avatar Details Window Empty Description

Status: ready-for-human
Base: 5b313104
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Avatar Portrait Cards](../spec.md)

**What to build:** The listing details window draws no description line for an Avatar with an empty credit line (Q12), as the cards already do (Q10). Worlds, entities and dictionaries keep the "No description available." fallback.

## Acceptance criteria

- [ ] An Avatar listing with an empty description shows no description line in the details window.
- [ ] An Avatar with a credit line still shows it.
- [ ] A world with an empty description still shows the fallback.
- [ ] The details-window layout test gains these cases. The guard is proven by reverting the opt-in.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Fold into the effort's existing changelog entry when it is still unreleased.
