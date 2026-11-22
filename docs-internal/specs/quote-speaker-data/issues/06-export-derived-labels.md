# 06: Export Derives Labels and Skips No-Change Rows

Status: ready-for-human
Base: 2d56e60
Blocked by: 04
Repo: FormamorphServer
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The export stops shipping raw model output, and quote fixes start to feed coref training.

**Derived labels:**
- A derived label comes from a quote correction that names an individual character. The entity's kind comes from the row's `cast`.
- The export labels that entity on two kinds of mention:
  - the rule's mention, when the rule is one of the speech-verb rules;
  - each of the quote's own first-person mentions.
- Beat and fallback mentions make no label.
- Player words make a label only for the player.
- A group, generic or null speaker makes no label.
- A row without `quotes` or `cast` derives nothing.
- Derived labels apply the same way as mention corrections (Q35). A player's mention or non-mention correction on the same span wins.

**Exportable rows:**
- A row is exported only when it holds a mention correction, a non-mention correction or a derived label.
- Any other row is skipped, even when accepted. It stays stored.

**Queue API:**
- Each queue row says whether it changes labels and lists its derived labels.
- A staff route rejects every pending row that changes no labels and returns the count.

Amend Q36 in the Character Mentions spec so it points to this spec's export rule.

## Acceptance criteria

- [x] For a quote correction tagged `"…," she says`, the export puts that "she" in the named entity's cluster. Test: "puts the speech-tag "she" and the quote's own "I" in the named speaker's cluster".
- [x] The export puts a quote's own "I" in the speaker's cluster. Same test, plus "labels only the first person for the %s rule".
- [x] A group-kind speaker gives no derived label. Test: "derives nothing from a group-kind speaker".
- [x] A player's mention correction wins over a derived label on the same span. Test: "lets the player's mention or non-mention fix win on the same span".
- [x] An accepted quote-only row with no derived label is not in the export. Tests: "leaves out an accepted quote-only row without speaker data, and keeps it stored", "derives nothing from …".
- [x] The bulk reject rejects only pending rows that change no labels, and returns their count. Test: "counts and rejects only pending rows that change no label".
- [x] Rows from before 04 export the same as today, when their corrections change a label. The existing export tests pass unchanged. A pre-04 row whose corrections change nothing is now left out, per spec rule 5. Test: "leaves out a row whose mention correction changes no label".

## Landed

All checks ran in `tests/corefContributions.test.js` (106 tests). Each new guard was mutation-tested: 14 mutations, and each one failed its own test.

**Not verified:**
- Nothing unticked.

**For you:**
- Before you bulk-reject in production, read the `noChange` count from `GET /api/coref-contributions/count`. Old quote-only rows that are already accepted stay stored, but the export now leaves them out.
