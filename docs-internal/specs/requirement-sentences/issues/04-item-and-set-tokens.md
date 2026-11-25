# 04: Item and Set Tokens

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Item, time, weather and Opening Conditions get their own tokens in the Requires field, in place of the one-token form ticket 02 left.

**Item:** `[Albus] [owns] [Lantern] ([lit, identified])`

- Owner: a list token (Q7). Ticket 02 kept the add picker's owner page for item picks only; remove it here, so a new item Condition starts with no owner.
- Verb: a list token with four forms: owns, doesn't own, has equipped, doesn't have equipped (Q21). "Has equipped" is offered only for an item that fits a slot.
- Target: a list token with items of the same status. Its popover also holds the State word and the identity choice (Q16).
- The checks show in the sentence only when set, as a token that opens the same controls.

**Sets:** `It [is] [morning or evening]`, `The weather [is] [rain or snow]`, `The opening [is] [Harbor or Ruins]`

- Verb: a flip token, "is" / "is not".
- Set: one token that lists the picks (Q15). Its popover holds today's toggles or pick list.
- An empty set is a broken token (Q14). Its text comes from the clause builder.

Use the token types and the Condition box from ticket 02. Today's controls for item checks, parts of the day, weather kinds and Openings move into popovers; they are not rewritten.

## Acceptance criteria

- [x] An item Condition reads as the grammar table's sentence with and without checks; tokens found by label. (item test: sentences with and without checks, found by label)
- [x] Each of the four verb forms writes its status and Not; "has equipped" is disabled for an item with no slot. (item tests: four forms; has equipped disabled for a slotless item)
- [x] A State word and an identity pick each write their field; clearing one removes it from the sentence. (item test: State and identity write and clear)
- [x] Time, weather and Opening Conditions read as sentences; a toggle writes the set; the verb flip writes Not. (time, weather, Opening tests: toggles and verb flip)
- [x] An empty set shows as a red token with a warning icon and a tooltip. (time, weather, Opening tests: broken description)
- [x] A row still holds at most one time, one weather and one Opening Condition. (time, weather tests: a row takes one)
- [x] A toggle in a set popover does not move or resize the other toggles; measured across every toggle of the time set. (Playwright: all six time toggles measured after each click)
- [x] The field's item, time, weather and Opening tests move to the tokens. (field tests rewritten)
- [x] Frames `.scratch/frames/requires-item-dark-1280.png` and `.scratch/frames/requires-time-dark-1280.png`, each with its popover open. (frames stored in `.scratch/frames`)
- [ ] A changelog fragment, folded into ticket 02's entry when that entry is still unreleased.

## Landed

**Not verified**
- The changelog fragment lands as its own entry; prepare never folds into ticket 02's entry (fragment rule), so it carries a Topic-less Major / Added line beside it.

**For you**
- The item verb is a four-button list with no search box. Check it reads as a list in the Requires field.
- The Checks controls (State, identity) sit at the top of the item's target popover. Check they are easy to find when no check is set.
