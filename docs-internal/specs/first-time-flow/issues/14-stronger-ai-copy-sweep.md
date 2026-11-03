# 14: Stronger AI Copy Sweep

Status: ready-for-agent
Blocked by: 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: copy and test changes across known surfaces, with no behavior change.

**What to build:** every in-app offer for Formamorph AI sells a stronger AI with no setup (Q55). No offer pitches how much story a level holds. No offer compares turns against a local model or the Demo AI.

Facts for the copy:

- Formamorph AI is stronger than the Demo AI and than a model that fits 8 GB.
- It needs no setup and no download.
- Every level uses the same AI. Higher levels add turns each week and room for larger worlds.
- A local model has no weekly limit, so "more turns" compares levels only.

Proposed wording, for the user's approval:

| Surface | Now | Proposed |
|---|---|---|
| Story card title | Want the AI to Keep More of This Story in Mind? | Want a Stronger AI for This Story? |
| AI setup card body | Formamorph AI gives you more turns each week. It also keeps large worlds and long stories in mind. | Formamorph AI is stronger than the models that fit your GPU, with nothing to download. |
| Scene title | How Far Should Your Story Go? | Play on a Stronger AI |
| Scene description | Your support includes Formamorph AI. Every level adds more turns and more room for your world and your story. | Your support includes Formamorph AI, with no setup. Higher levels add more turns each week. |
| Spark line | Room for your world and a long story | A stronger AI, ready to play with no setup |
| Flame line | More turns, and room for a large world and a much longer story | More turns each week |
| Beacon line | The most turns, and room for the largest worlds and the longest stories | The most turns each week |
| Flame perk | Formamorph AI, with twice Spark's memory, so a large world still has room for your story | Twice Spark's room for large worlds |
| Beacon perk | Formamorph AI, with four times Spark's memory, for the largest worlds and the longest stories | Four times Spark's room for large worlds |
| Demo AI dialog | A stronger model writes sharper narration, remembers more of your story, and keeps each entity consistent. | A stronger model writes sharper narration and keeps each entity consistent. |

- [ ] Each surface above shows the approved wording, and the tests that pin the old wording use the new one.
- [ ] The line "Every level keeps the latest scenes word for word" is gone from the scene.
- [ ] The locked preset panel from ticket 11 follows Q55.
- [ ] The road's art, its lit counts and the side-by-side sample don't change.
- [ ] A search of `src/` and `docs/` finds no offer that pitches story held, and no "more turns" outside a comparison of levels.
- [ ] `docs/How-to-Play.md` no longer says a level's light shows how much of your story it reaches.
- [ ] The existing In Progress changelog line that says each level's line states what it adds for your world and your story is correct after this change, and a changelog fragment states what changed for the player.

For you: the wording above, and whether `.scratch/tier-art/patreon-tier-text.md` follows, because the Flame and Beacon perks there use the old memory lines.
