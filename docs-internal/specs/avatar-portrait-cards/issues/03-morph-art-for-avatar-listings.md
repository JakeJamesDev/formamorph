# 03: Morph Art for Avatar Listings

Status: ready-for-human
Base: dd79eff8
Blocked by: 02
Also blocked by: FormamorphServer 01 (Flag Avatar Stand-Ins)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

**Parent:** [Avatar Portrait Cards](../spec.md)

**What to build:** An Avatar listing with no art draws Morph art on every community surface (Q2, Q5). The Morph-art predicate covers Avatars as well as entities, so a flagged Avatar never fetches or shows the stored stand-in. An Avatar with no file at all falls back to Morph art too, as an entity does. The id seed is the listing id. The client carries no compat code for servers that do not flag Avatars yet.

## Acceptance criteria

- [ ] A flagged Avatar draws Morph art on the card, in the details window and in the profile creation rows.
- [ ] A flagged Avatar never requests its stored thumbnail, and the thumbnail preload skips it.
- [ ] An Avatar with no thumbnail file draws Morph art.
- [ ] An unflagged Avatar with art still shows its art.
- [ ] The card and details-window layout tests gain these cases. Each guard is proven by reverting the predicate.
- [ ] The design-system doc's Morph-art lines name Avatars. The showcase gains a flagged Avatar sample.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Fold into ticket 02's changelog entry when it is still unreleased.
