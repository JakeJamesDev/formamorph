# 15: Art for Valentines

Status: ready-for-agent
Blocked by: 02, 08, 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **Valentines Survival** has art in one style, and the world shows Image Visibility rules.

- Run the Art Harness (02) with this world's art-direction line from ticket 08, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed. A portrait whose face sits far from the camera and reads garbled is redone with Face Fix, the harness's `--face-fix` option (Q28); check every face before you store.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set complementary rules on slot 0 and slot 1 by script, since play shows the first visible image and an unruled slot 0 always wins. A location rule with no owner reads the played persona.
- **Map Background:** none. This world is not a map world (Q12).
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- **Hana Sakuragi's stored portrait shows a boy with short hair**, against her text and tags (ticket 08 finding). Existing art stays under Q10 only when it matches the entity; replace this one through the harness with the world's art-direction line and record the old image's replacement in the comments.

- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [ ] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` claimed in this world's row.
- [ ] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite.
- [ ] The contact sheet is at `.scratch/frames/valentines-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [ ] The world file's size before and after is in this ticket's comments (Q13).
- [ ] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
