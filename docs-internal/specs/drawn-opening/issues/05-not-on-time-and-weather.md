# 05: Not on Time and Weather

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Time Condition and the Weather Condition take the existing Not flag (Q18). Not inverts the set test: "Weather is not Rain or Storm". Their editor rows show the Not control, and their line text and player lines read the negated form. Code that assumes Time and Weather are never negated (row simplification, contradiction checks, gate lines) learns the flag.

Ticket 06 builds the Opening Condition's Not on the set-Condition paths this ticket generalizes.

Ships its own docs: the **Condition**, **Time Condition** and **Weather Condition** glossary entries lose "no Not", the authoring wiki's Conditions section, and a changelog fragment.

## Acceptance criteria

- [ ] A trait gated on "Weather is not Rain" holds under Clear and fails under Rain, through gate states.
- [ ] A trait gated on "Time is not night" holds at morning and fails at night.
- [ ] An image Visibility rule with a negated Weather Condition shows and hides to match.
- [ ] The editor row shows the Not control on Time and Weather, and the "Shown while" and gate lines read the negated form.
- [ ] Row simplification and contradiction checks treat a negated Time or Weather row correctly; for example, "Rain" and "not Rain" in one row never both hold.

⚠️ World `.json` shape change: Not on Time and Weather Conditions.
