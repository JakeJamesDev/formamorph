# 07: Expand Sugarscape

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Sugarscape Survival** grows from 5 locations and 9 entities to at least 11 and 16, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Sugarscape keeps the hunger script, the pick counts, and the opening weights.

- Grow the Sugarscape: a licorice forest, the caramel caves, a marshmallow marsh, a toffee ridge, the seam's far side, each with its creatures and hazards.
- A Time of Day gate on the Daylight Seam: a trait or rule that holds only in daylight dayparts, so night changes what the seam allows.
- **Assigned features:** Time of Day gate.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [ ] The world has at least 11 locations and 16 entities, every one with `imageTags`, and the stripped diff is ready for review.
- [ ] The world's coverage row claims `timeGates`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions.
- [ ] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once.
- [ ] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [ ] Fingerprints are regenerated. No changelog fragment: ticket 01's entry covers every world (Q14).

For you: read one transcript per opening and judge whether the new places feel like the same world.
