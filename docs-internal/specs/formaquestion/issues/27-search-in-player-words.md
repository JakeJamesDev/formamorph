# 27: Search in player words

Status: ready-for-agent
Blocked by: 15, 20
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player who asks in their own words gets the right docs section (Q47). Ticket 20's probe found that keyword search found the right section for 8 of 8 questions in the guide's words, but 2 of 8 in a player's words ("back up everything before I reinstall", "redo the last turn", "make a folder"). With the right section, the answers were correct. The search is the weak part.

This fixes the search for every path that uses it: the no-AI docs search (Q7), retrieval mode on models with no tool support (Q10), and the nearest sections under a flagged answer (Q15).

**Authored keywords.** Each "How to…" section gets one hidden line of player phrasings: the words a player uses for that task that the section's text does not. Use an HTML comment, so the wiki and the in-app reader do not show it. The Docs Index reads the line and ranks a keyword match like a heading match. Write the keywords from player language: synonyms, the old names of renamed controls, and common verbs ("undo", "redo", "folder", "reinstall"). Do not repeat words already in the heading.

**Stemming.** The index matches word forms ("folders", "folder"; "backing", "back up"). Use a small rule set or a vetted library; confirm the package from its registry before you install it.

**A check.** The ticket 01 docs checks gain one rule: every "How to…" section has a keyword line. Prove it bites.

**Numbers.** Extend ticket 20's help probe with a player-wording question set: at least one player-worded question for each docs page, written without looking at the section text. Report the right-section hit rate for guide wording and for player wording, before and after, in the same batch. The search runs without a model, so these numbers are exact and need no in-batch control. Also report the answer-level effect on the default cloud model with ticket 20's harness.

Recommended model rationale: a pass over every docs page plus a ranking change whose effect must be measured, not judged.

## Acceptance criteria

- [ ] Every "How to…" section has a hidden keyword line; the wiki and the reader do not show it
- [ ] The Docs Index ranks a keyword-line match like a heading match; a test proves it
- [ ] Stemming matches singular and plural and common verb forms; a test proves it
- [ ] The docs checks fail on a how-to section with no keyword line, proven to bite
- [ ] The player-wording question set covers every docs page
- [ ] Right-section hit rates for guide and player wording, before and after, are in the handover
- [ ] Answer-level numbers on the default cloud model are in the handover
- [ ] The guide-wording hit rate does not drop
- [ ] Four gates green
