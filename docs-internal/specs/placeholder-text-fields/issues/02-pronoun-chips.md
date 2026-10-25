# 02: Pronoun Chips

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One entity string field joins lists that already hold its siblings (descriptions, aliases). The pattern exists at every step, so Sonnet at medium.

## Parent

`docs-internal/specs/placeholder-text-fields/spec.md`

## What to build

An entity's Pronouns box becomes a single-line chip field that offers the entity's own placeholders (spec Q6). Pronouns accept chips and nothing more; matching pronouns to a name roll is out of scope (Q5).

- **Play.** Pronouns resolve in the entity's scope: its owned placeholders and its own trait pins. Entity context and persona context send the resolved text.
- **Code.** Play-time stat code reads resolved pronouns through the entity's play fields. Editor runs read the placeholder-name form, like names (Q4).
- **Lists.** This ticket owns adding pronouns to the entity text list, the entity chip mapper in placeholder homes, and the entity text resolver. Ticket 03 adds relationship labels to the same three after this lands. The entity text list feeds priming, placement letters, Test Bench rules, card export, blueprint copies and library placeholders, so pronouns reach all of them from this one entry.
- World search marks Pronouns chip-capable.
- An exported entity card carries the placeholders its pronouns use; import remaps them.

Ship with it: the supported-fields list in the World Editor Placeholders help page names pronouns. A changelog fragment.

- [ ] A chip lands in Pronouns by typeahead, palette and drag, and the menu offers the entity's owned placeholders.
- [ ] Entity context and persona context show resolved pronouns, with the entity's own trait pin winning over the roll.
- [ ] A play-time Sandbox Snapshot gives code resolved pronouns; an editor run gives the placeholder name.
- [ ] World search finds and replaces inside pronouns without breaking a chip.
- [ ] An exported card bundles the pronoun's placeholder; importing it into another world remaps the chip.
- [ ] Removing pronouns from the entity text list or the chip mapper fails a test.
- [ ] The help page lists pronouns.

## Comments
