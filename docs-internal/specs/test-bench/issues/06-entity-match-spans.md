# 06 — Entity-match span reporting (prefactor)

**What to build:** Entity presence matching reports its evidence. The matching module, which today
returns only names, learns to report for each detection the matched alias (or name) and the text
span it hit — without changing which entities match. This is the agreed extension from the spec: one
matching path, extended, never a parallel reimplementation; the game's own presence surfaces keep
their behavior byte-for-byte. Pure prefactor — no UI.

**Blocked by:** None — can start immediately.

Status: done
Status note: (commit 0a77d2a)

- [x] Span/alias reporting available for every match, including plural-tolerant and multi-word alias hits
- [x] Existing match results unchanged across the current test corpus (same entities, same order)
- [x] Collision evidence expressible: two entities matching overlapping spans are both reported with their spans
- [x] No behavior change in the running game's presence detection

**The seam:** `findNameMatches(text, names, opts) → NameMatch[]` and
`findEntityMatches(text, entities, opts) → EntityMatch[]` in `src/lib/entityMatch.ts`. Each detection
carries `matched` (the form actually searched), `via` (`name` | `partial` | `alias`), and `spans`
(`{start, end, text}`, every occurrence, offsets into the searched string). `matchNames` and
`findEntityNames` are now derivations of them — there is one matcher, so Triggers cannot disagree with play.

**Evidence preference, decided here:** where two passes would both match, the report names the stronger
one — the whole phrase over a lone distinctive word, the widest alias over one nested inside it. This
changes reported evidence only, never which entities match.

**For ticket 07:**

- Spans index the string *passed in*. `stripQuotedSpeech` collapses each quoted run to a single space, so
  offsets taken after it do not map back to the author's pasted text. Either highlight the stripped text or
  make the strip offset-preserving (pad with spaces — matching is unaffected, but three tests assert its
  exact output).
- `dictionaryUtils` exports its own `MatchSpan` (`{start, end, text, keyword}`) and its own exec loop.
  Triggers renders entity spans and dictionary spans side by side; that is the moment to share one type.
  Entity spans are `TextSpan` to keep the two from colliding at the import site meanwhile.
