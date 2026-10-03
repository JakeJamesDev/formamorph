# 19: Docs and glossary pass

Status: done
Blocked by: 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Each ticket wrote its own docs section. This ticket closes the docs for the effort as one read.

- **The Formaquestion docs page.** Read every section of the settings against the shipped controls: each label, each default, each tab. Fix what drifted between tickets.
- **How-to sections.** One for each common task, with the steps in order and each control name in bold:
  - how to use a different AI for help
  - how to turn on reasoning for help
  - how to turn on Semantic Search
  - how to write your own help prompt
  - how to add a Tool to Formaquestion
  - how to move a custom preset to another device
  - how to see what the app sent for a question
  - how to use Formaquestion as a plain chat
- **Player keywords.** Each how-to section gets its keyword line, in the words a player uses.
- **The glossary.** Confirm the entries for Formaquestion, Tool and Search Source match the shipped behavior: a Tool the player turns on can read the open world; Formaquestion Tools are a separate list switched on the device; the source switches are player settings.
- **The Formaquestion spec.** Add a pointer at its Q9, its Q71 and its out-of-scope line to this spec. Change no ruling text.
- **The ranking guard.** The bundled-docs ranking test for the Settings Output section sits one rank from its edge; new text with "settings", "output" or "hold" can push it out of the top five (ticket 18 hit it). If the test fails, report the ranks before and after. Do not reword a correct section only to make it pass; a fix to the ranking is a ruling for the spec session.
- **The help vectors.** The section vectors of the semantic source are built from the docs. Rebuild them, or name the rebuild as a step for the user before a release, as the Formaquestion effort does.

Recommended model rationale: reading and writing docs against shipped controls, with the coverage test as the check.

## Acceptance criteria

- [ ] Every setting of the four tabs is named in the docs with its shipped label and default.
- [ ] Each how-to in the list exists, and a help question in player words finds it in the top 5 of the keyword search.
- [ ] The docs coverage test and the link check pass.
- [ ] Docs copy follows the writing guide.
- [ ] The glossary entries match the shipped behavior.
- [ ] The Formaquestion spec points to this spec at the three places.
- [ ] The four gates are green.
