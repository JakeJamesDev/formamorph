# 03: Stat and World Option Tokens

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Stat and World Option Conditions get their own tokens in the Requires field, in place of the one-token form ticket 02 left.

**Stat:** `[Albus]'s [Health] [is] [at least] [50%]`

- Owner: a list token. A stat's owners are the owners that hold a stat with that id.
- Target: a list token with the same owner's stats.
- Verb: a flip token, "is" / "is not" (Q19).
- Comparison: a list token with six words: above, below, at least, at most, exactly, different from (Q12).
- Value: an editor token. Its popover holds the number and the Raw / % switch.

**World Option**

- Choice: `[Difficulty] [is] [Hard]`. The verb flips Not; the value token opens the value list.
- On/off: `[Permadeath] is [on]`. The value token flips between on and off on one click.
- Number: `[Party Size] is [at least] [3]`. The comparison list and a value token; no Not.
- The Option token swaps for another World Option, which starts on its own default value.

Use the token types and the Condition box from ticket 02. The comparison token is shared by stats and number Options, and this ticket owns it.

One open point from the spec's Further Notes belongs here; send it to the spec session before the first edit: the stat value and its unit as one token ("50%"), as the prototype shows, or two.

## Acceptance criteria

- [ ] A stat Condition reads as the grammar table's sentence, in raw and in percent; tokens found by label.
- [ ] A comparison pick writes that operator; the number and the unit each write their field; the verb flip writes Not.
- [ ] A stat's owner list holds only owners that have that stat.
- [ ] Each World Option type reads and edits as above; a number Option offers no Not.
- [ ] An edit that would repeat another Condition in the row is refused: the list row is disabled and a typed number stays a draft.
- [ ] A selection in the comparison list does not move or resize its choices; measured across all six.
- [ ] The field's stat tests and World Option tests move to the tokens.
- [ ] Frames `.scratch/frames/requires-stat-dark-1280.png` and `.scratch/frames/requires-option-dark-1280.png`, each with its popover open.
- [ ] A changelog fragment, folded into ticket 02's entry when that entry is still unreleased.
