# 04: Lens Entity Scope

Status: done
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

- [x] In the AI Context instrument, an entity's description with an owned chip shows the value play shows. `aiContext.test.ts` "reads a description's owned chip and Character Name as play does", "reads a blueprint chip through the entity's own copy".
- [x] A relationship label with an owned chip, printed on the persona's block, shows the holder's value. "reads a relationship label in the owner's scope on the persona's block".
- [x] Pronouns with an owned chip show the holder's value. "reads pronouns with an owned chip in the owner's scope".
- [x] The lens pins still win where play's pins would win. "lets the lens location's pin win…" and "lets a starting stat's band pin win…".

## Landed

Every guard above was mutation-tested: each one fails its test when the bug is put back. Q18 (a trait's own pins over the entity's) is covered by "keeps a trait's own pin on its own text over the entity's".

**Not verified**
- The Custom Persona entity's branch in `lensOwnerScopes` reads the lens's pins. Removing that branch changes no output: its traits are already in the lens's played layer. The test asserts the behavior, not the branch.
- Aliases are not in scope here. Play does not route aliases through the entity text resolver either, so the lens already matches play.
- No browser check. The change is in pure data builders, and `aiContext.test.ts` covers them.

**For you**
- Test Bench → AI Context tab on a world where an entity owns a placeholder that its default trait pins. Its description, pronouns and a label on your persona should read the pinned value.

## Comments
