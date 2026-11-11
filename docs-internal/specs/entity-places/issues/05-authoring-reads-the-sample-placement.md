# 05: Authoring Reads the Sample Placement

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every authoring surface that shows "who is here at the start of the story" asks the Entity Places module for the Sample Placement, so they all show one stable cast.

Readers that move: the script hover card for a location, the authored chip scene, the Test Bench AI context, the Openings tab view, and the opening pool when authoring calls it.

Corrections that land here (Q9, Q10):

- **The script hover card (#3).** Its "Present" row lists a Unique entity at every routine place and leaves out an entity that begins at Player's Starting Location. It lists who the Sample Placement puts at that location, which is what a Test Code run of `present` gives.
- **The Openings tab (#6).** It counts a Unique entity as at the start through any row place, and gives an entity that begins at Player's Starting Location the "at no start" badge and no chance. An entity counts as at a start only when that start is one of its Start places.
- **A script run with no live positions (Q10).** The game view's standalone script run and the tool script run can fall back to an opening state with no positions, where a Unique entity stands at every listed place. They use the Sample Placement.

Settle the spec's three open checks before moving the reader each concerns, and write the answer into the landing:

1. Which cast the Test Bench opening pool passes to the opening pool reader.
2. How often a script run uses the opening state with no positions, and from where.
3. When the opening placement cannot place an entity with a kind. Decide nothing here: if that case exists, send the spec session the case and ask what its Sample Placement is.

Add each moved reader to the agreement test. The script guide and the Test Bench wiki page change where they describe the hover card or the placement.

Spec rulings: Q6, Q9 (#3, #6), Q10. ADR-0005.

## Acceptance criteria

- [ ] The script hover card's "Present" row for a location equals the Sample Placement's cast there. A test compares the card with a Test Code run of `present` on one fixture and fails with the old read.
- [ ] An entity that begins at Player's Starting Location appears on the hover card of the sample start.
- [ ] On the Openings tab, a Unique entity whose only tie to a start is a Schedule row does not count as at that start. The test fails with the old read.
- [ ] On the Openings tab, an entity that begins at Player's Starting Location shows as at the start, with its chance, and has no "at no start" badge.
- [ ] A script run with no live positions places each Unique entity at one place. The test fails with the old fallback.
- [ ] The authored chip scene and the Test Bench AI context still show the same cast as before on the bundled worlds. A test compares them.
- [ ] The agreement test holds every reader moved here.
- [ ] The landing answers the three open checks with evidence.
- [ ] The script guide and the Test Bench page match the new behavior.
- [ ] A changelog fragment records the three fixes.
