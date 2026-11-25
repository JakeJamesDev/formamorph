# 03: Stat and World Option Tokens

Status: ready-for-human
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

The stat value and its unit are one token, "50%" (Q27). A stat Condition that reads global scope has no owner token and no possessive: `[Gold] [is] [at least] [5]` (Q25).

## Acceptance criteria

- [x] A stat Condition reads as the grammar table's sentence, in raw and in percent; tokens found by label. (stat test "lists each owner's stats…", "reads a percent value as one token")
- [x] A comparison pick writes that operator; the number and the unit each write their field; the verb flip writes Not. (stat tests "writes the picked comparison…", "writes the number and the unit…", "flips to Not…")
- [x] A stat's owner list holds only owners that have that stat. (stat test "lists only the owners that hold the stat…")
- [x] Each World Option type reads and edits as above; a number Option offers no Not. (`RequirementRowsField.option.test.tsx`)
- [x] An edit that would repeat another Condition in the row is refused: the list row is disabled and a typed number stays a draft. (stat and option tests; bit when the comparison guard was disabled)
- [x] A selection in the comparison list does not move or resize its choices; measured across all six. (Playwright "a selection in the comparison list never moves or resizes its six choices", desktop and mobile)
- [x] The field's stat tests and World Option tests move to the tokens. (World Option had no field tests; new file)
- [x] Frames `.scratch/frames/requires-stat-dark-1280.png` and `.scratch/frames/requires-option-dark-1280.png`, each with its popover open.
- [x] A changelog fragment, folded into ticket 02's entry when that entry is still unreleased. (fragment lands as its own entry under the Requirement Sentences topic, as the fragment rules require)

## Landed

**Not verified**
- The stat target swap resets the number and unit to the new stat's default. The spec session is asking the user; the choice lives in one function, `statSwapped` in [RequirementClause.tsx](src/components/editor/RequirementClause.tsx).
- A broken on/off World Option value shows no red token; only the choice list and number value carry the warning.

**For you**
- Look at `.scratch/requirement-sentences-03/frames/requires-stat-dark-1280.png` and `.scratch/requirement-sentences-03/frames/requires-option-dark-1280.png`: the value popovers read well beside their sentences.
- Add a stat to a Condition in the Requires field with a stat that two owners hold, and judge whether the Owner list reads clearly.
