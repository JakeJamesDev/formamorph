# 05: Not on Time and Weather

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Time Condition and the Weather Condition take the existing Not flag (Q18). Not inverts the set test: "Weather is not Rain or Storm". Their editor rows show the Not control, and their line text and player lines read the negated form. Code that assumes Time and Weather are never negated (row simplification, contradiction checks, gate lines) learns the flag.

Ticket 06 builds the Opening Condition's Not on the set-Condition paths this ticket generalizes.

Ships its own docs: the **Condition**, **Time Condition** and **Weather Condition** glossary entries lose "no Not", the authoring wiki's Conditions section, and a changelog fragment.

## Acceptance criteria

- [x] A trait gated on "Weather is not Rain" holds under Clear and fails under Rain, through gate states. (traitGates.weather.test: "holds under every kind outside its set")
- [x] A trait gated on "Time is not night" holds at morning and fails at night. (traitGates.time.test: "holds at every daypart outside its set")
- [x] An image Visibility rule with a negated Weather Condition shows and hides to match. ("shows a Not-ruled image while it is not raining")
- [x] The editor row shows the Not control on Time and Weather, and the "Shown while" and gate lines read the negated form. (RequirementRowsField time and weather flip tests; "reads the negated form in the Shown while and gate lines")
- [x] Row simplification and contradiction checks treat a negated Time or Weather row correctly; for example, "Rain" and "not Rain" in one row never both hold. (deadRows, complementary and sameRequirement tests; a mutation of the Not fold-in turned 7 weather tests red)

⚠️ World `.json` shape change: Not on Time and Weather Conditions.

## Landed

**Not verified**
- The editor chip in the live Browser pane: component tests cover the flip button and the NOT mark, no frame was taken.
- The negated update-diff text in `componentUpdates.ts` ("Not Night", "Not Rain"): no test reads it.
- FormamorphServer: whether it validates the world shape was not checked.

**For you**
- Open a trait's Availability tab, add Time of Day and Weather, and select Require it to be off: the chip should show NOT with a dashed border and keep its toggles.
