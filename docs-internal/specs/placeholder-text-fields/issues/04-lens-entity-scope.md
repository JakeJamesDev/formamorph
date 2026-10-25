# 04: Lens Entity Scope

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Found by the close review. The fix crosses the Test Bench lens and the authored Chip Scene, so Opus.

## Parent

`docs-internal/specs/placeholder-text-fields/spec.md`

## What to build

The AI Context instrument (the Test Bench lens) resolves entity texts in each entity's own scope, as play does (spec Q6, Q6b, Q13).

Today the lens passes only a text resolver to the authored Chip Scene. With that resolver set, the scene skips the entity text resolver. Every entity text then resolves against the lens pins in global scope: descriptions, aliases, pronouns and relationship labels. An owned chip, or an entity's own trait pin, reads wrong in the instrument but right in play.

- The lens gives the scene an entity resolver that layers the lens pins with each entity's own placeholders and trait pins.
- Relationship labels resolve on the holding entity before the cast moves them onto the persona's block.

- [ ] In the AI Context instrument, an entity's description with an owned chip shows the value play shows.
- [ ] A relationship label with an owned chip, printed on the persona's block, shows the holder's value.
- [ ] Pronouns with an owned chip show the holder's value.
- [ ] The lens pins still win where play's pins would win.

## Comments
