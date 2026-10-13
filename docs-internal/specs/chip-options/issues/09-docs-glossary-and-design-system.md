# 09: Docs, Glossary And Design System

Status: done
Blocked by: 05, 06, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: prose and a showcase entry against finished surfaces; the copy rules in the Writing Guide do the work.

Parent: [Chip Options spec](../spec.md)

## What to build

The Guide, the glossary, in-app copy and the Design System describe Chip Options.

- Guide pages that describe the chip pop-out, the Entities Stats checkbox and Persona content now describe the dialog, its rows and the What the AI Reads pane: Prompts, Persona Authoring, World Editor, World Editor Placeholders and World Editor Entities. In-app copy that says "pop-out" changes too.
- The glossary gains **Chip Options**, covering prompt and placeholder chips, and names the rows Only With, Include and Stat Detail. The Chip Values entry drops "a value for every chip token the registry defines".
- The Design System gains a section for the Chip Options dialog and its live-sample pane, with the production mapping and a showcase reference. The user approves the pattern before it is added.
- The unreleased changelog entry that names the Stats checkbox and the Here and In Scene scopes is folded to describe the dialog, the filter and the stat detail pieces; no second entry is added. The release note carries the forward-compatibility line from the spec.

Rulings: Q11, Q23, Q29.

## Acceptance criteria

- [ ] No Guide page or in-app string still says "pop-out" or "Stats checkbox" for a chip.
- [ ] The help window answers "how do I send only entities with stats" from the Guide.
- [ ] The glossary entries read as above.
- [ ] The Design System section exists with a showcase entry that renders.
- [ ] One changelog entry covers the effort.
