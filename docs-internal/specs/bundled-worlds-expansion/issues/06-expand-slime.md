# 06: Expand Slime

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q4, Q5, Q7, Q8, Q9, Q16, Q20; Size table; Feature assignment)

## What to build

**Slime Outbreak** grows from 7 locations and 8 entities to at least 12 and 16, shows its assigned features, and plays at least as well on the cloud model. The premise holds: title, hook, and the named core cast stay (Q20). Slime keeps the spread script, the hidden Strain trait, and the rolled strain placeholder.

- Grow Ashburn: the hospital, the bridge out, a church shelter, the sewers, the radio station, each with survivors and slime forms.
- A Tool with a live write: the AI marks a block as overrun, which enables that block's lore entry. The world still plays without it.
- Relationship labels among the survivors and the Quarantine Watch. A chip where a label carries a rolled name.
- A Time of Day gate: the Night Pharmacy opens, or a trait turns on, only in the night dayparts.
- **Assigned features:** World Tool with a live write. Relationship labels. Time of Day gate. Script control of lore.
- **Common to every world:** every new location joins the graph by parent or by a Connection with Travel Hints both ways. Every new entity lists its locations and sets `knownIn` where the AI should know of it elsewhere. Lore grows with the map: each new region gets at least one dictionary entry. At least one chip in a Pronouns, Travel Hint or Relationship label field where a roll reads naturally (Q8).
- **Art direction (Q16):** write the world's art-direction line, booru-style, naming medium, palette and mood and never a subject. Put it in this ticket's comments and the spec's Comments. Write `imageTags` for every new location and entity in the same vocabulary.
- **Readme:** "How this world is built" names the features this world now shows.
- Rewrites are allowed where they improve the world (Q4). Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and existing images, validate every reference. Every new script, Tool handler included, follows the house style.

## Acceptance criteria

- [ ] The world has at least 12 locations and 16 entities, every one with `imageTags`, and the stripped diff is ready for review.
- [ ] The world's coverage row claims `tools`, `relationships`, `timeGates`, `scriptLore`, `newFieldChips`, and the shared suite is green, including the old-save check at both revisions.
- [ ] Per-world tests cover each new script's effect, each Tool handler's write, and each gate that must hold, and each is shown to bite by breaking the world file once.
- [ ] The probe shows no structural regression and a rubric win or tie over the pre-expansion revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [ ] The art-direction line is in this ticket's comments and the spec's Comments.
- [ ] Fingerprints are regenerated. The changelog fragment folds this world into the effort's entry.

For you: read one transcript per opening and judge whether the new places feel like the same world.
