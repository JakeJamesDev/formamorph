# Spec: Judge an AI summary by the savings it buys, not the description's length

Status: ready-for-human

## Problem Statement

The `ai-summary-hides-description` rule decides whether a summary was worth writing by looking only
at how long the hidden description is. That proxy misses in both directions:

- A 200-token description with a 170-token summary is a terrible trade — everything hidden to save
  30 tokens per turn — and the rule says nothing, because the description is over the bound.
- A summary *longer* than its description is invisible for the same reason whenever the description
  is long.
- A 60-token description with a 10-token summary is real compression, yet the rule flags it; an
  author who writes tight summaries everywhere gets nagged for consistency.
- The message claims "for little savings" while the check never measures savings at all.

## Solution

The rule compares the summary to the description it hides and fires only when the summary fails to
actually compress: when it is more than about half the length of its description. The message
reports both numbers and the per-turn savings, so the author sees the trade itself rather than a
verdict about length. Very small descriptions are left alone entirely — at that size the savings
are meaningless either way, and flagging them is the old problem back at smaller scale.

## User Stories

1. As an author whose summary barely shortens a long description, I want the finding to fire, so that hiding everything for a few tokens' savings doesn't pass silently.
2. As an author whose summary is longer than the description it hides, I want the finding to fire, so that a strictly worse trade is never invisible.
3. As an author who compressed a short description well, I want no finding, so that writing tight summaries everywhere isn't punished.
4. As an author who compressed a long description well, I want no finding, so that following `entity-long-description-no-summary`'s advice still can't raise a new row.
5. As an author of a tiny described item, I want no finding regardless of my summary's length, so that meaningless token counts don't generate noise.
6. As an author reading the finding, I want the message to carry the summary size, the description size, and the per-turn savings, so that I can judge the trade myself instead of trusting a verdict.
7. As an author scanning the collapsed row, I want the headline to state the failed compression plainly, so that a multi-item row still says what kind of problem it groups.
8. As a location author, I want the same judgment applied to locations, so that the rule keeps covering both owners of the summary field.
9. As an author using placeholder chips in either field, I want both sides measured on resolved text, so that chip syntax can't fake or hide compression.
10. As an author in any authoring state, I want at most one of the two summary rules to fire per item, so that the pincer stays structurally dead.
11. As an author with stored seen/dismissed marks on this rule, I want its identity unchanged, so that my prior dismissals still hold.
12. As a Simple-mode author, I want the rule to stay Advanced-scoped, so that the fold's behavior is untouched.

## Implementation Decisions

- **The check becomes a ratio with a floor.** Fires when a summary and description are both
  present, the description is at or above a small floor, and the resolved summary is more than half
  the resolved description's tokens. Both measurements go through the existing resolved-text
  estimator the two summary rules already share.
- **Threshold shape: summary-side, not savings-side.** "Summary is more than half its description"
  is the same math as "saves less than 50%", but reads as advice about the field the author would
  edit. Two named constants: the ratio (½) and the floor. The floor is ~40 tokens — below that,
  silence, because absolute savings that small are meaningless whatever the ratio says. The
  `SHORT_AI_DESCRIPTION_TOKENS` constant this replaces is deleted; `LONG_AI_DESCRIPTION_TOKENS`
  remains the sibling rule's bound and is no longer referenced by this rule.
- **Message carries the trade:** summary tokens, description tokens, and the per-turn savings —
  e.g. "~120-token summary over a ~150-token description — hides it from most prompts to save ~30
  tokens." The count-carrying headline generalizes the same idea ("N items' AI summaries barely
  shorten the descriptions they hide"). Exact wording is the implementer's, matching the catalog's
  voice; the three numbers are required.
- **Nothing else about the rule moves.** Id, severity (info), section, `advanced` marker, entity and
  location coverage via the shared owner seam — all unchanged. Stored seen marks re-raise
  naturally where wording changes, which is the seen-state design working as intended; dismissals
  are identity-keyed and survive.
- **The pincer invariant holds by structure, not by threshold arithmetic.** The sibling rule
  requires no summary; this rule requires one. The existing both-rules-never-fire test must keep
  passing with cases spanning the new threshold shape.
- **No export-shape impact.** Pure rule-body change; nothing stored changes shape.

## Testing Decisions

- Same seam as the whole catalog: `runRules` in, findings out — the rules suite's per-rule
  describe-block pattern (fire/not-fire matrices, message substrings). No new seams.
- New cases: long-description-poor-summary fires (the case the old bound missed);
  summary-longer-than-description fires; short-description-good-summary is silent (the case the
  old bound wrongly flagged); good compression on a long description stays silent; below-floor
  silence regardless of ratio; both-sides chip resolution (a chip inflating the *summary* is the
  new direction worth a case); the cross-product proving the two summary rules never co-fire.
- The message assertion checks all three numbers appear.
- Mutation checks on the two constants: reverting the ratio to the old absolute bound and deleting
  the floor must each fail at least one test.

## Out of Scope

- The delivery asymmetry (no full→summary fallback in full-preferring prompt blocks) — unchanged
  from the prior ticket.
- Any prompt text, AI Context delivery labels, or the Simple-mode fold.
- Judging summary *quality* (semantic fidelity to the description). This rule measures size only.
- Tuning `entity-long-description-no-summary`'s bound.

## Further Notes

- Direct successor to the narrowing shipped in the bench-summary-simple-mode ticket; it replaces
  that ticket's half-the-long-bound rule, which shipped but was judged unhelpful in practice: it
  still fired on paragraph-length descriptions where a summary is plainly useful, because it never
  measured the summary at all.
- The floor value (~40 tokens) is a judgment call recorded here so the implementer doesn't
  re-litigate it; if practice shows noise just under the floor, tuning it is a one-constant change.
