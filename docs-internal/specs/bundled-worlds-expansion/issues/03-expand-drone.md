# 03: Expand Drone

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Reincarnated Drone** grows from 4 locations and 6 entities to at least 10 and 14, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Drone keeps its `lock_target` Tool and its chassis gates and pick counts.

- Grow Magiterra Nova from four regions into a map a drone can patrol: towns, ruins, a frontier line, and places under each region.
- Give each new place at least one entity: machines, dragons, scavengers, soldiers, and the people the drone meets.
- Extend `lock_target` where the new cast needs it, and keep it the one Tool this world shows.
- **Assigned features:** none from the table.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [ ] The world has at least 10 locations and 14 entities, every one with `imageTags`, and the stripped diff is ready for review.
- [ ] The world's coverage row claims `newFieldChips`, and the shared suite is green, including the old-save check at both revisions.
- [ ] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once.
- [ ] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [ ] Fingerprints are regenerated. The changelog fragment folds this world into the effort's entry.

For you: read one transcript per opening and judge whether the new places feel like the same world.
