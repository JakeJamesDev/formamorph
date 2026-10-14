# 10: Owner in the Glossary, Wiki and Help

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: docs prose, checked with `copy-sweep`.

## What to build

The docs say owner.

- The glossary's Bearer entry merges into Owner: the entity or dictionary whose tree holds a trait, stat or placeholder, own or through a Link or Copy. The world is never an owner, and the persona is **You**. Its _Avoid_ line lists bearer and holder. The `owner` global entry drops "the one exception". Condition, Stat Condition and Copy move to owner.
- The Traits, Placeholders, Entities, Persona Authoring and Stat Code Guide wiki pages say Owner. The heading "Whose trait counts" keeps its text and anchor.
- The player Glossary page swaps its Bearer row for Owner.
- Formaquestion help content says owner (story 24).
- Released changelog sections stay as they are.

Spec: Q1, Q2, Q12; stories 12, 24.

## Acceptance criteria

- [ ] The glossary has one Owner entry and no Bearer entry
- [ ] The named wiki pages and help content say owner
- [ ] The "Whose trait counts" anchor is unchanged
- [ ] `copy-sweep` run on the changed docs; four gates green

## Blocked by

- None (can start immediately)
