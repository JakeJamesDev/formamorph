# 06: Mode override on trait links

Status: ready-for-human
Base: 514bf3a6
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one more field through the existing link-override machinery.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

A trait link can override a trait's mode per bearer (Q12). One bearer can have a linked trait as Always On or Hidden while another picks it as Optional. An unset override reads the original's mode live, like the other link fields.

## Acceptance criteria

- [ ] `TraitLinkFields` gains `mode`. Overrides store and resolve it like `isDefault`. This is a world export shape change.
- [ ] The link override UI offers the mode control. Always On and Hidden hide the Default and Player Can Toggle overrides.
- [ ] In play and in Test Bench, each bearer follows its own resolved mode.
- [ ] Tests: resolution per bearer; an unset override reading the original live; a Hidden override absent from that bearer's player-facing list. Each guard is shown to bite.
- [ ] The changelog line is in In Progress. The response carries the export-shape reminder.
