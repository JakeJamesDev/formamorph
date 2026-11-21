# 06: Export Derives Labels and Skips No-Change Rows

Status: ready-for-agent
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

- [ ] For a quote correction tagged `"…," she says`, the export puts that "she" in the named entity's cluster.
- [ ] The export puts a quote's own "I" in the speaker's cluster.
- [ ] A group-kind speaker gives no derived label.
- [ ] A player's mention correction wins over a derived label on the same span.
- [ ] An accepted quote-only row with no derived label is not in the export.
- [ ] The bulk reject rejects only pending rows that change no labels, and returns their count.
- [ ] Rows from before 04 export the same as today.
