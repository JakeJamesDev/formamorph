# 03: Docs for Entities, Openings, Dictionary, Locations, Stats and Overview

Status: done
Base: 6f6228d7
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can follow the other World Editor pages step by step, and every statement matches the app. The matching **?** help topics agree with the pages.

Verify each claim against the code. Audit leads:

| Page | Claim to check |
|---|---|
| World-Editor-Entities, The panel | Lists four tabs. The panel also has **Traits** in Advanced mode |
| World-Editor-Entities, In the library | Says the library editor has two tabs. It has three |
| World-Editor-Entities, SillyTavern cards | Says `{{char}}` becomes plain text. It becomes a Character Name chip |
| World-Editor-Entities, The panel | Shows Profile as the same in Simple and Advanced. Aliases, Type, 3D Model and the persona control are Advanced only |
| World-Editor-Dictionary, Semantic Lore | Calls the setting experimental. It no longer is |
| World-Editor-Openings vs the runtime Entities page | The two pages disagree on whether the world's switch turns off Library Additions openings. Find the truth in code and make both agree. Ticket 04 owns the Entities page; send it the ruling |
| WorldEditor index | Says every tab has a **?** button. Overview has none |
| Help topic: dictionary | Says keywords are comma-separated. The field takes Enter after each keyword |
| Help topic: entities | Leaves out pronouns, the persona control, and the Traits and Openings tabs |
| Help topics: aliases, location pins | No docs link |
| Overview tab | No help topic. Add one |

Add "How to…" sections (Q20). At least: add an entity, import a SillyTavern card, give an entity an Opening, add an Others and a Self opening, set a Starting Location, add a location and nest it, connect two locations, pin a placeholder to a location, add a stat, hide a stat, add a dictionary entry, set world images.

Recommended model rationale: six pages, each claim traced through a different editor panel.

## Acceptance criteria

- [ ] Every row above is fixed or recorded as correct, with the code location that proves it in the commit body
- [ ] Each page has "How to…" sections with numbered steps; reference text stays
- [ ] Control names in the steps match the UI labels exactly
- [ ] The help topics for these areas agree with the pages and link a docs heading
- [ ] The Overview tab has a help topic that follows the help-copy rules
- [ ] The known-gaps entries for these surfaces and topics are removed, and the coverage test passes
- [ ] Four gates green
