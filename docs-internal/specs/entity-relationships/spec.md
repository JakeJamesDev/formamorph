# Entity Relationships

Status: done
Status note: Closed 2026-10-20: tickets 01–03, last landing a6ba2abee. Gates green except lint, which fails only on the gitignored worlds-wip/cb-3.3.2-live.ts.
Spec session: entity-relationships — spec

## Problem Statement

An author can't tell the AI how two entities relate. Tera's mother, a butler's employer or a knight's rival lives only in description prose, if the author writes it at all.

Prose also fails when the other entity isn't in the scene. "Kate is Tera's mother" means nothing to the narrator if Kate is not in any roster. The AI has no name to anchor and no description. So it invents a Kate, or it ignores her.

## Solution

Each entity gets a **Relationships** list. Each row picks a target entity from a dropdown and takes a free-text role noun: mother, friend, butler, rival.

In play, the AI reads each relationship as one sentence: "Kate is Tera's mother". When Tera is in the scene and Kate is not, Kate joins the **Entities Known Here** roster with her summary. The narrator then knows who Kate is without Kate being present.

- The author enters a relationship once. It counts for both ends.
- The dropdown offers **You**, which resolves to whoever the player plays.
- Relationships are authored. They don't change during play.

## User Stories

1. As an author, I want to give an entity a list of relationships, so that the AI knows who its family, friends and staff are.
2. As an author, I want to pick the related entity from a dropdown, so that I can't misspell a name.
3. As an author, I want to type the relationship as free text, so that I can name any role (mother, butler, sworn rival).
4. As an author, I want the help line to ask for a role noun, so that the AI reads the direction correctly.
5. As an author, I want to enter a relationship once, so that I don't keep two entries in sync by hand.
6. As an author, I want one relationship per target, so that the list stays short and one label holds compound roles ("mother and employer").
7. As an author, I want the dropdown to offer You, so that "Kate is the player's mother" works under any persona.
8. As an author, I want a relationship to a world persona to apply only when that persona is played, so that an unplayed persona's family doesn't leak into the story.
9. As an author, I want relationships to an entity I delete to go away, so that no relationship points at nothing.
10. As an author, I want a relationship to make its target known even when its Known In is Nowhere, so that a hidden relative is still known through the link I drew.
11. As an author, I want the target's summary sent, not its full description, so that a large family stays cheap.
12. As an author, I want a related entity listed only once, so that a mother who is also reachable isn't sent twice.
13. As an author, I want a group or a kind to be a valid target, so that "the barrow dead are Tera's ancestors" works.
14. As an author, I want existing worlds to send exactly the same requests as today, so that adding the feature changes nothing until I use it.
15. As a player, I want the narrator to know who a character's relatives are, so that a mention of "your mother" lands on the right person.
16. As a player, I want the narrator to know my persona's relatives in every scene, so that my own family is never forgotten.
17. As a player, I want an absent relative to stay absent, so that talk of Kate doesn't put Kate in the room.
18. As a player playing a different persona, I want only my persona's relationships sent, so that another persona's family doesn't appear.
19. As a prompt tuner, I want the relationship line to appear once per prompt, so that the same sentence doesn't print twice when both ends are present.
20. As a prompt tuner, I want the relationship lines to show in Request Anatomy, so that I can see exactly what is sent.

## Implementation Decisions

**Authored shape (world JSON).** One optional entity field: an ordered list of `{ targetId, label }`. `targetId` is an entity id or the **You** target. Absent or empty means no relationships, so existing worlds need no migration. At most one row per target per entity. This is an export-shape change (additive).

**Direction.** The label names the target's role toward the owner. Tera owning `{ Kate, "mother" }` reads "Kate is Tera's mother". The game never infers an inverse (mother → daughter).

**You.** A **You** target resolves to the played persona at render time. The played persona's name fills the sentence: "Kate is Rowan's mother". There is no second person form. A relationship held by a world persona, or by the Custom Persona entity, works like any other.

- You follows the owner You model. Under a library persona, the Custom Persona entity's relationships are the player's and render with the library persona's name. Under a world persona, the Custom Persona entity is unplayed and its relationships drop. Under None, it uses the entered name.
- With no persona to resolve to, every You row drops, both its line and its pull-in.
- A You row that resolves to its own owner drops while that persona plays. It renders under any other persona.
- When an owner's You row and its row to a specific persona resolve to the same played entity, the specific row wins and the You row drops.
- The You target is stored as the literal target id `you`.

**Who counts.** A relationship renders only when both ends are in play. An end that is a persona-only entity the player doesn't play drops the relationship from the prompt. The editor keeps it. Runtime characters can't be targets.

**Rendering (one seam: chip values).**

- A relationship renders as a field line inside the entity blocks. No new chip. Each relationship gets its own `relationship` field, after the description and type fields and before traits and stats, in every format.
- Each relationship prints once per scene, decided by roster precedence (here > sublocations > reachable > known): on the owner's block when the chain lists the owner, else on the target's block when the chain lists the target, else nowhere. In Scene is its own roster and applies the same rule over its own ids. Chip values stay per token. There is no template-aware pass, so a custom template with only some scopes can lose a line. So can an owner's scope token that is name-only or filters the owner out with Only With. That gap is accepted.
- The Persona block counts as a block for this rule. It heads both the chain and the In Scene list, so a line that touches the played persona prints only on the Persona block.
- The line appears in every roster scope that renders full or summary blocks. A name-only scope shows no relationship lines.

**Known roster pull-in.**

- Each entity in the here roster or the in-scene roster pulls the other end of each of its relationships into the `<ENTITIES|known>` roster. The played persona counts as present.
- The pull-in is one hop. An entity in the known, reachable or sublocation roster pulls in no one.
- A pull source is never pulled. A relationship never adds a Here or In Scene entity to the known roster. Known In behavior is unchanged.
- The pull-in ignores Known In, Nowhere included.
- The existing precedence holds: here > sublocation > reachable > known. A pulled entity that a higher scope lists stays in that scope.
- A pulled entity renders like any known entity: summary only, no traits, no stats.
- The known roster's header text doesn't change. A separate effort owns that text.

**Deleting an entity** drops every relationship that targets it, in the same pass that removes the entity.

**Editor.** The World Editor entity panel's Profile tab gets a Relationships list below the Locations block. It reuses the Known Here row pattern: a bordered row with the target name, a label input and Remove. A select under the rows adds a target. A row's target is fixed once added; the author removes it and adds it again to change it. The select lists You, then the world's entities, without the owner itself and without targets the owner already uses. The library entity editor gets no Relationships list, since a library character has no world to target.

## Testing Decisions

A good test drives the public seam and asserts what the AI or the author would see. It never asserts internal helpers.

- **Chip values.** Build a scene and read the rendered chip text. Cover: the sentence form; print-once (owner rendered, only target rendered, both rendered); pull-in from here and in scene; no pull-in from lower scopes; Nowhere still pulled in; precedence when the target is reachable; You resolving to the played name; an unplayed persona-only end dropping the line; no lines in a name-only scope; a world without relationships rendering byte-equal to today. Prior art: the known-roster tests in the chip values test file.
- **Editor.** An RTL test of the Relationships list: add a row, pick a target, type a label, remove a row; the dropdown hides the owner and used targets. Prior art: the Location Known Here component test.
- **Entity deletion.** A pure helper drops relationships that target a removed entity. Prior art: the helper that drops a deleted location from every membership and Known In list.
- **Prompt probe.** No default prompt text changes. The probe still runs an in-batch A/B, relationship off vs on: does the narration use the absent relative correctly, without placing them in the scene?

## Out of Scope

- Changing relationships during play: scripts, World Tools, the save envelope.
- Secret or hidden relationships.
- Relationships in character customization for a player-made persona.
- Inferred inverses (mother → daughter).
- Pull-in beyond one hop.
- Rewording the known roster's header.
- Runtime characters as targets.

## Further Notes

- Rulings Q1–Q13 come from the grill on 2026-10-20.
- Q1: the label is a role noun, rendered as a sentence.
- Q2: authoring-only in v1.
- Q3: only the here and in-scene rosters pull in, one hop.
- Q4: a relationship pulls its target in even when Known In is Nowhere.
- Q5: one stored edge counts for both ends.
- Q6: no secret flag.
- Q7: the persona renders by its played name.
- Q8: one relationship per target.
- Q9: a field line in the entity blocks, printed once per prompt.
- Q10: no relationships in character customization.
- Q11: the dropdown offers You.
- Q12: an unplayed persona-only end drops the relationship from the prompt.
- Q13: no change to the known roster's header text.
- "The played persona counts as present" (Q3) is derived: the persona is always in the scene. The player's own relatives are therefore known in every scene.
- This builds on the Entity Presence effort's known roster and roster precedence.
- Ticket 02's probe (`relationship-probe.cli.ts`, cloud): the pull-in works on questions about the relative, and the relative stays absent. When the player seeks or addresses the relative, the relative is in the scene on ~8/10 runs, vs ~3/10 for an invented stand-in without the relationship. That is expected: the narrator follows an explicit player request. The bar is that a known entity never enters the scene unprompted, and the neutral case holds it (0/10 both arms).
