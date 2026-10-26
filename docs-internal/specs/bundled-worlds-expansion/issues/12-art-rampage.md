# 12: Art for Rampage

Status: ready-for-agent
Blocked by: 02, 05, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q6, Q10, Q11, Q12, Q13, Q16, Q17, Q18, Q19, Q21; Implementation Decisions › Image kinds, Visibility rules, Map Background, Encoding)

## What to build

Every location and entity in **City Rampage** has art in one style, and the world shows Image Visibility rules and a Map Background.

- Run the Art Harness (02) with this world's art-direction line from ticket 05, in a GPU window the user names. One landscape backdrop per location and one portrait per entity, for every item without art. Existing art stays (Q10).
- Review the contact sheet, redo by name what misses its subject, and record each redo's seed.
- **Visibility rules (Q18):** at least one location backdrop and one entity image that change with a stat, trait, persona or daypart. Make the variant through the harness with the state's tags added, then set the rule by script. A location rule with no owner reads the played persona.
- **Map Background (Q12):** one generated map image behind the Locations canvas. Set its frame in the editor so the drawn map lines up with the placed locations, and set the opacity. The world's coverage row claims `mapBackground`.
- Refine `imageTags` where the stored art drifted from them, so the tags describe the art.
- The Test Bench image rules hold: WebP, labeled, every rule target present, no all-hideable entity, no zero-span percent rule.

## Acceptance criteria

- [ ] Every location and entity has at least one image, and the shared suite is green with `visibilityRules` and `mapBackground` claimed in this world's row.
- [ ] Per-world tests cover each Visibility rule at a value on both sides of its threshold or daypart, and are shown to bite.
- [ ] The contact sheet is at `.scratch/frames/rampage-sheet.png` with every image labeled by item and slot, and each redo's seed is in this ticket's comments.
- [ ] The world file's size before and after is in this ticket's comments (Q13).
- [ ] The Map Background shows behind the Locations canvas and the in-game Map at `.scratch/frames/rampage-map.png`, 1280 wide, light theme.
- [ ] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

For you: open the contact sheet and reject or redo by name. In play, reach the state that flips each Visibility rule and confirm the image changes.
