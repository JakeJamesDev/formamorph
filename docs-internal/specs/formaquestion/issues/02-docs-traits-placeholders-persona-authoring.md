# 02: Docs for Traits, Placeholders and Persona Authoring

Status: done
Base: 6f6228d7
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author can follow the Traits, Placeholders and Persona Authoring pages step by step, and every statement matches the app. The matching **?** help topics agree with the pages.

Verify each claim against the code, not against the changelog. The audit found these; treat the list as leads, not as proof:

| Page | Claim to check |
|---|---|
| World-Editor-Traits, Requirements | Says **Requires** is on the Details tab. Its own table and the app put it on Availability |
| World-Editor-Traits, Links | Says **Link To…** is at the top of Details. The app shows it in the footer, on Blueprint items only |
| World-Editor-Traits, Overrides | Describes a link to a top-level original. Links point only at Blueprint items now |
| World-Editor-Traits, Pick Count | Names a **Begin** button. No such button exists |
| World-Editor-Traits, Custom Persona | Says its traits have no separate heading in play. Unverified |
| World-Editor-Traits, Test Bench Checks | Two bullets are merged into one line |
| World-Editor-Placeholders | No mention of the **Values** tab on text fields, or of the built-in **Character Name** chip |
| Persona-Authoring | Calls the persona control a checkbox. It is a segmented control with four choices |
| Persona-Authoring | Says "the two chips". Character Name is a third built-in chip |
| Help topic: traits | Leaves out Mode from the override list. Leaves out Availability, Always On, Hidden, Requires and Pick Count |
| Help topics: stat changes, stat availability, placeholder pins, pins on placeholder | No docs link |

Add "How to…" sections with numbered steps and exact control names (Q20). At least: make a trait, require another trait, set a pick count, make a Blueprint, link to a Blueprint, override a Copy, make a placeholder, weight its values, pin a value, make an entity playable, make a Custom Persona.

Recommended model rationale: Traits is the largest and most drifted page, and each step must be traced through the editor code.

## Acceptance criteria

- [x] Every row above is fixed or recorded as correct, with the code location that proves it in the commit body
- [x] Each page has "How to…" sections with numbered steps; reference text stays
- [x] Control names in the steps match the UI labels exactly
- [x] The help topics for these areas agree with the pages and link a docs heading
- [x] The known-gaps entries for these surfaces and topics are removed, and the coverage test passes
- [x] Pages follow the writing guide
- [x] Four gates green
