# 01: Presence Module

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Build the one module that says, for every entity, **where** it is (here, connected or elsewhere), whether the player has **met** it, whether it is **in scene**, and the **label** a player sees. It exposes the three named sets the spec defines: **Look Around**, **In Scene** and **Met**. Surfaces do not change in this ticket. They move onto the sets in tickets 02 to 08.

This ticket also owns the shared pieces the later tickets import:
- The optional `strangerName` and `strangerDescription` entity fields: the type and world load only, since the editor is ticket 06. Both resolve through placeholders and rolls.
- The save's remembered last alias per entity, filled from the planner's cast alias.
- A move clears the live scene list, followers kept.
- Met-in-play detection on naming, dialogue included, which replaces today's single effect over the live scene list. The start-met rule is derived at read time and never stored.

## Acceptance criteria

- [ ] Mara quiet for 2 turns is In Scene. After 3 quiet turns she is not.
- [ ] A move clears In Scene except for followers. An entity the story moves away leaves In Scene at once.
- [ ] A name only inside another character's dialogue does not put that entity In Scene, but it does make a stranger met.
- [ ] Connected covers parent, sibling and child places and map connections. An unpositioned entity is here at every place it lists.
- [ ] Start-met: no Stranger Name means met. A relationship on either side with the played persona means met. An explicit Known In pick whose subtree covers a place the persona's entity lists means met. The Nearby default and Nowhere do not. A runtime character starts met. A persona with no places meets strangers fresh.
- [ ] Labels: a met entity shows its resolved name. A stranger shows its latest remembered alias, else its resolved Stranger Name. With neither it has no label and is absent from Look Around and In Scene.
- [ ] An older save with an empty met list reads every entity without a Stranger Name as met.
- [ ] Each rule's test fails when its old behavior is put back.
- [ ] The changelog fragment and the glossary entries for Look Around, In Scene, Met and Stranger are written. The landing message lists both export-shape changes.
