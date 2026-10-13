# 13: Guide Links

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A link table plus Tools doc headings. Sonnet at medium.

## What to build

A card on a global shows Read in the Guide. One table maps each global to a page and heading. Stat code globals target the Stat Code Guide: `#self`, `#stats` and `#owner` for those three, and the existing sections for `clock`, `traits`, `placeholders`, `entities`, `persona` and `dictionaries`. The Tools doc gains one heading per Tool global, and Tool cards link there. Links go through the docs opener, which falls back to the wiki.

Spec: Q29, Q32; Implementation Decisions: Guide links.

## Acceptance criteria

- [ ] Every global's card links to its heading
- [ ] The Tools doc has one heading per Tool global
- [ ] A test resolves every table row through the docs link checks
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
