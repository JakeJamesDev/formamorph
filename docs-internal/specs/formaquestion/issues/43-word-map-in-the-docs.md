# 43: Word map in the docs

Status: ready-for-agent
Blocked by: 39
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The keyword search knows the words players use for each feature (Q71). Ticket 39 measured a bigger word map at 72% blind recall@5, against 52% for the shipped keyword lines. Its 3,529 phrases on 466 sections live only in the probe today (`testing/baseline/help-word-map.json`).

- Move the phrases into the docs as authored keyword lines (Q47), in the section each phrase belongs to. The player never sees them, in the reader or the Search tab.
- Keep each phrase a player's word for that section's feature or control. Drop a phrase that would pull a question to the wrong page.
- Do not read ticket 26's set or ticket 39's blind set while writing or pruning. Both stay unseen, so the numbers stay honest.
- The coverage test keeps every keyword line valid.
- The probe reads the shipped docs, not the JSON. Retire the JSON.

**Probe.** Run ticket 39's recall probe on both sets with the keyword source only. Report recall@5 before and after, and confirm the blind number matches ticket 39's word-map row within a point or two.

Recommended model rationale: thousands of phrases need care so that none pulls a question to the wrong page.

## Acceptance criteria

- [ ] The word map lives in the docs' keyword lines; the probe JSON is gone
- [ ] Keyword lines never show in the reader or the Search tab; the coverage test passes
- [ ] Blind-set recall@5 with the keyword source is within 2 points of ticket 39's word-map row, or the handover explains the gap
- [ ] Neither question set was read while writing the lines
- [ ] Four gates green
