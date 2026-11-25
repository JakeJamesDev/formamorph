# 07: Close Review Gaps

Status: ready-for-agent
Blocked by: None
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The close review compared the landed code with the spec and found four places where the text is wrong. Each is a small change in the clause code.

**1. A world target on a location's image rule (Q25).**

- Today: a Condition with no owner on a world trait, group or stat reads "The player has Paladin", in the field and in the "Shown while" summary.
- The gate reads global scope for that Condition, so the text names the wrong subject.
- After: it reads "Paladin is active", with no subject, as on a world host. The row then shows the Owner list in the target popover (Q31).
- A Condition that reads the persona keeps "The player" there. An item's image rule keeps "The item's owner" (Q32).
- One clause test pins the wrong text today; it changes with the fix.

**2. The comma rule on the refused-equip note.**

- Today: "X requires that A and B or C".
- After: "X requires that A and B, or C", through the lock line's joining rule and not a second join.

**3. The reason on a broken World Option value (Q14).**

- Today: every broken value says "This value is no longer a choice."
- A number Option or an on/off Option has no choices, so the reason is wrong when the Option's type changed.
- After: the reason fits the Option's type. Write the text from the Writing Guide.

**4. "Shown while" takes a final period (Q36).**

- Today: "Shown while Paladin is active".
- After: "Shown while Paladin is active." No colon.

## Acceptance criteria

- [ ] On a location's image rule, a no-owner Condition on a world trait reads "Paladin is active" in the author's view and the player's view; a clause test covers it and goes red when the persona host wins again.
- [ ] That row offers the Owner list in its target popover, and a pick gives the sentence its subject.
- [ ] A persona-reading Condition on that host still reads "The player ..."; an item host still reads "The item's owner ...".
- [ ] A refused equip with a row of two Conditions and a second row reads with a comma before "or".
- [ ] A broken number Option value and a broken on/off Option value each give a reason that fits; a broken choice value keeps today's reason.
- [ ] An image rule's summary ends with a period; its test is updated.
- [ ] A changelog fragment only when a player or author can see the change in released text.
