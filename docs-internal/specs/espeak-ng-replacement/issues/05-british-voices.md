# 05: British Voices

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

No measurement exists yet for this path, so expect the listening pass to decide it.

## What to build

The eight British voices speak through rules applied to the American result. `phonemize` is MIT and ships such rules, so they may be adapted with its notice. Its data stays out, and `ipa-dict` `en_UK` stays out because it is GPL-derived.

Word table entries are American today. Decide how the rules treat them, and test that decision.

Rulings: Q7. Spec section: British rules.

## Acceptance criteria

- [ ] On the seam: a British accent gives the expected result for non-rhotic words, the bath vowel, the lot vowel, and the goat vowel.
- [ ] On the seam: American output does not change.
- [ ] British phoneme error against WikiPron UK is quoted next to the eSpeak number stored in Ticket 01, and it is within 0.5 points.
- [ ] Any adapted rule keeps the MIT notice, and the notices list it.

For you: a rating page in a British voice over the strange words, with at least 30 of 40 acceptable.
