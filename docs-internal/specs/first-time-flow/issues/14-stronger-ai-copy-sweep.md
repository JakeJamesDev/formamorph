# 14: Stronger AI Copy Sweep

Status: done
Blocked by: 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: copy and test changes across known surfaces, with no behavior change.

**What to build:** every in-app offer for Formamorph AI leads with narration quality and consistency, with no setup (Q55, Q60, Q61). Longer surfaces then name allowance against lower levels, and context against lower levels last. It also names supporting development as a reason to pledge. No offer compares turns against a local model or the Demo AI.

The user approved this wording. Use it as written:

| Surface | Wording |
|---|---|
| Story card title | Want Better Narration for This Story? |
| Story card body | Formamorph AI writes sharper narration and keeps characters consistent. Your support includes it, and it helps fund new updates. |
| AI setup card title | Better Narration, Nothing to Download |
| AI setup card body | Formamorph AI writes better narration and keeps characters more consistent than the models that fit your GPU. Your support also helps fund new updates. |
| Scene title | Better Narration for Your Stories |
| Scene description | Your support keeps Formamorph's updates coming, and it includes Formamorph AI: sharper narration and more consistent characters, with no setup. Higher levels add more turns each week, then more room for large worlds. |
| New line above Support on Patreon, on the full scene only | Whatever the perks are worth to you, every pledge helps keep the updates coming. |
| Spark line | Sharper narration and consistent characters, with no setup |
| Flame line | More turns each week, and twice Spark's room for large worlds |
| Beacon line | The most turns each week, and four times Spark's room for large worlds |
| Spark perks | Sharper narration and more consistent characters · A weekly allowance of turns · Ready to play with no setup |
| Flame perks | More turns each week · Twice Spark's room for large worlds and long stories |
| Beacon perks | The most turns each week · Four times Spark's room for the largest worlds and longest stories |
| Demo AI dialog | A stronger model writes sharper narration, keeps each entity consistent, and remembers more of your story. |
| Demo AI dialog offer | Formamorph AI is a stronger AI with no setup. Your support on Patreon includes it and helps fund new updates. |

Level names in these lines use the server's name, as the level table does today. The shared perks (Mascots, badge, Supporters wall) stay after these.

- [x] Each surface above shows this wording, and the tests that pin the old wording use the new one. (Table-by-table diff review; `RoadScene.test.tsx`, `DemoAINotice.test.tsx`, `RoadSceneHost.test.tsx`)
- [x] The line "Every level keeps the latest scenes word for word" is gone from the scene. (`RoadScene.test.tsx`: no `word for word` text on any level)
- [x] The locked preset panel from ticket 11 shows the new level lines through the shared table. (`LockedPresetPanel` calls `roadLevel(tier).line(name)`)
- [x] The road's art, its lit counts and the side-by-side sample don't change. (Diff touches no `lit`, fire or `ROAD_SAMPLES` value)
- [x] A search of `src/` and `docs/` finds no offer that leads with story held, and no "more turns" outside a comparison of levels. (Grep, and the spec review)
- [x] `docs/How-to-Play.md` no longer says a level's light shows how much of your story it reaches.
- [ ] The existing In Progress changelog line that says each level's line states what it adds for your world and your story is correct after this change, and a changelog fragment states what changed for the player. (Fragment written; the old line is not corrected, see Landed)

For you: whether `.scratch/tier-art/patreon-tier-text.md` follows, because the Flame and Beacon perks there use the old memory lines. The AI setup card's comparison with local models has no side-by-side behind it yet.

## Landed

**Not verified**
- The old In Progress line in `docs/Changelog.md` ("Each level's line now states what it adds for your world and your story") is now wrong. A ticket branch cannot edit the changelog, so it still says that. Edit it by hand to match the new level lines.
- The footer line's placement above Support on Patreon. Tests check the text only, and no frame was taken.
- Jsdom tests ran only in prepare's gates, not in the review gates.

**For you**
- Whether `.scratch/tier-art/patreon-tier-text.md` follows, because the Flame and Beacon perks there use the old memory lines. The AI setup card's comparison with local models has no side-by-side behind it yet.
- The approved wording says "characters" where the Writing Guide says "entity", and it mixes "support" and "pledge". Look at the story card, the AI setup card and the levels screen (`#dev?modal=aiSetup&vram=6144`).
- "Twice Spark's room" and "four times Spark's room" are level multipliers kept from the approved table.
