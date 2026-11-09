# Spec: NPC Schedules

Status: ready-for-agent
Spec session: npc-schedules — spec

Each character in a world starts somewhere, keeps a daily routine of staying, wandering or patrolling, can be taken along or told to wait by the player, and is never in two places at once or stuck where the story can't reach them. Locations say which neighbors are near enough to call over.

## Problem Statement

Characters don't behave like real people. A playtest showed the problems:

- The farrier was the focus of the whole scene at the inn, but the game kept her positioned in the village around it. Every item change involving her was skipped, because the game did not count her as present.
- A centaur mare and the breeder were seen through a window, and the game treated them as present in the office from then on.
- Inventory changes for the breeder failed because the narration used her in-story name, which only exists as an alias.

The alias failure moves to the Stranger Fields effort (Q30). The cause of the rest is the entity model. `movement` (Free, Stays Put, Moves Between, Can Follow) mixes three questions in one field: where a character can be, how they move on their own, and whether the player can take them along. `presence` adds a random start that can land on a parent location the pull rules never reach. Nothing moves a character while the player is elsewhere, so a "Moves Between" character only moves when the player is standing next to them.

Authors can't say the simple things: "the farrier is at the smithy by day and the inn at night", "the guard walks the wall, then the gate", "the queen never leaves the palace", "the mercenary goes wherever you go". Nor can they say that two villages on the same map are a day's ride apart, so nobody in one should hear a shout from the other.

## Solution

A character is either a **Group** or an **Individual**.

- A **Group** is today's Everywhere Listed entity: a herd, a swarm, a fixture. It is at all its places at once, never moves, is never pulled and never follows.
- An **Individual** is one body in one place. It has one or more weighted **Starts**. One Start is rolled per playthrough. Each Start is a place plus a **schedule**: rows of a time range and an action.
  - **Stay** at one place.
  - **Wander** among weighted places, idling between moves.
  - **Patrol** a list of stops in order, idling at each, then looping.

  A Start with an empty schedule stays at its place. Duplicate Starts at the same place with different schedules are fine.

An Individual has a **Traversable** list: the places it may go beyond its schedule, or Anywhere. Pulls and follows reach only the places the current schedule row uses plus the Traversable places. A row can be **Strict**: during it the character can't be called over and won't start following.

The player can take a character along. A follower can be told to **wait** somewhere for a while, or to **part ways**. A follower who can't enter the player's next place stays behind and waits. When a wait runs out, or the player parts ways, the character goes back to their schedule.

Every link between two locations has a **distance**: **Nearby** or **Far**. Narration can call a character over only across one Nearby link, and the narrator hears about characters only in Nearby places. Far still allows travel. Implicit links are Nearby; an author makes one Far by clicking its arrow on the canvas, which turns it into a Connection.

Shipped worlds migrate so they play as they do today.

## Rulings

Rulings Q1–Q30 came from the first grill. The rebase grill (Q31–Q64) superseded several; superseded rulings stay listed so ticket references resolve.

- **Q1** *Superseded by Q61.* Narration pulls a named character in only from the same top-level location, and only into a place in their range.
- **Q2** *Superseded by Q50.* Each schedule has a re-pick interval field.
- **Q3** A wait lasts at most until the end of the next daypart: at least one daypart, never two.
- **Q4** A follower's replies include Part ways.
- **Q5** A schedule row's time shows as dayparts by default. A swap button left of the field switches it to hours. Hours are always what is stored; the swap is UI only.
- **Q6** *Amended by Q31.* Group = Everywhere Listed, with no schedule. Individual = one position, driven by Starts and schedules.
- **Q7** *Superseded by Q53.* A script move holds until the next re-pick.
- **Q8** Wait durations: about an hour, until the end of this daypart, until the end of the next daypart. "As long as it takes" maps to the last.
- **Q9** Swapping an hour range that doesn't land on daypart edges snaps it to the dayparts that cover it, and says so.
- **Q10** *Superseded by Q55 and Q58.* Migrated Moves Between characters get Can Follow off.
- **Q11** *Superseded by Q46 and Q51.* Can Follow defaults.
- **Q12** A new entity defaults to Individual.
- **Q13** *Superseded by Q50.* Re-pick presets.
- **Q14** *Amended by Q52.* A timed row beats the All-day row for the hours it covers.
- **Q15** Off-screen schedule moves are silent: no log line, no notice.
- **Q16** In scope: the entity location request rework. Out of scope: the narration arrival line and the narrated-move room fix. (Q30 moved inventory owner aliases out.)
- **Q17** *Superseded by Q55.* Can Follow migration.
- **Q18** An entity with one location and no presence migrates to Individual.
- **Q19** The movement tag shows for Individuals only.
- **Q20** *Restated by Q56.* A runtime character acts as an Individual placed where they were discovered.
- **Q21** *Amended by Q47.* The Entities chip gains a Movement include, on by default. It adds a state suffix: following you, waiting here, or stays here.
- **Q22** *Superseded by Q33 and Q57.* Never re-pick.
- **Q23** A migrated one-place character that was Free loses today's sibling pull. Traversable is the rule; the author adds places to allow it.
- **Q24** *Superseded by Q46.* Group pulls.
- **Q25** *Superseded by Q58.* Moves Between migration.
- **Q26** *Amended by Q51 and Q59.* A pull brings a character only into a place their current row uses or their Traversable list allows. A Waiting or Following character is never pulled.
- **Q27** The location request keeps today's gate: it runs only while location routing is on.
- **Q28** *Amended by Q64.* Scripts: `.follow()` works on any Individual and is ignored on a Group. `.unfollow()` is Part ways. The entity entry exposes a read-only waiting state.
- **Q29** *Superseded by Q46.* Group followers.
- **Q30** Inventory owner aliases move to the Stranger Fields effort. Moved: Stranger Fields Q17 and ticket 04, Inventory Owners by Alias (e173b21c2).
- **Q31** Group stays beside Individual. Group = a place list, present at all of them, never moves. Individual = Starts.
- **Q32** No "moves or not" toggle. A Start with an empty schedule stays at its place.
- **Q33** The weighted Start roll happens once per playthrough.
- **Q34** Traversable belongs to the entity, one list for all its Starts.
- **Q35** A new entity's Traversable defaults to Anywhere.
- **Q36** A Strict row blocks pulls and blocks starting a follow. A follow already running continues.
- **Q37** Distance has two values: Nearby (pull reach and context) and Far (neither).
- **Q38** Distance is one value per pair, not per leg.
- **Q39** The canvas keeps its current behavior: implicit arrows show only for the hovered and selected locations, and clicking one turns it into a two-way Connection.
- **Q40** A pulled character on a Stay row goes back when the player leaves. On Wander and Patrol rows, when the idle runs out.
- **Q41** After a pull or follow ends, a Patrol resumes at the stop after the one it last reached.
- **Q42** A follower who can't enter the player's next place stays at its current place, Waiting with the default wait, then returns to its schedule.
- **Q43** A Wander or Patrol place counts as connected when the Start's place reaches it through any path of travel links. Far links count.
- **Q44** The place pickers in Wander, Patrol and Stay rows list only connected places.
- **Q45** *Dropped.* Blocking a link entirely does not fit the current design.
- **Q46** Groups are never pulled and never follow. A Group in a Nearby place appears in context.
- **Q47** A Strict Individual in a Nearby place appears in context tagged stays here, and can't be pulled.
- **Q48** Implicit links, new Connections and migrated Connections are all Nearby.
- **Q49** Followers cross Far links with the player. Far limits only pulls and context.
- **Q50** Idle is one fixed duration: one per Wander row, one per Patrol stop. Its control matches the wait-style duration field (presets plus a box).
- **Q51** Can Follow is removed. Traversable and Strict govern following.
- **Q52** In hours no row covers, the Individual stays at its Start's place.
- **Q53** A script move outside the schedule holds until the current idle runs out (Stay rows: until the row ends). Then the schedule resumes.
- **Q54** A listed place that a later link edit makes unreachable stays in its row, is flagged there, and is skipped in play.
- **Q55** Migration gives follow-mode entities Traversable = Anywhere and every other Individual an empty Traversable list (schedule places only).
- **Q56** A runtime character is one Start at its discovery place, an empty schedule and Traversable = Anywhere.
- **Q57** A shipped random-presence entity gets one equal-weight Start per listed place.
- **Q58** A shipped Moves Between entity gets an all-day Wander over its places, idle one daypart.
- **Q59** Strict is set per schedule row.
- **Q60** Traversable lists exact places. Picking a city does not allow its houses.
- **Q61** Pull and context reach is one Nearby link from the player's place. Links don't chain.
- **Q62** After its last stop, a Patrol loops back to stop 1.
- **Q63** An off-screen Wander or Patrol move jumps straight to the next place.
- **Q64** A script `.follow()` ignores Strict and Traversable.
- **Q65** Timed rows can't overlap. Pickers and drags block any time another timed row holds. One All-day row may sit under them as the base layer, and it reads "The rest of the day" next to timed rows.
- **Q66** The schedule editor lives in a Routine tab in the entity panel.
- **Q67** The editor is the prototype's D2: the routine as sentences in clock order, with free time inline, under a 24-hour strip with daypart icons (full name in a tooltip).
- **Q68** The free-time line names only the uncovered hours ("Evening – Dawn, stays at X"). With no free hours it reads "Busy all day".
- **Q69** Each timed row's band has drag handles on both ends. Dayparts snap to daypart edges; hours snap to whole hours. A handle's label shows its position in the row's own format, and it stops at the last valid spot.
- **Q70** *Amended by Q80.* Clicking a band or a sentence selects that row. The selected row's handles win a shared edge; rows never drag together. Clicking elsewhere clears the selection.
- **Q71** On the full-screen canvas, the entity card in the right panel holds the same Routine editor. Nothing floats beside it. The card's mode switch is Routine / Known In; Known In keeps today's picker.
- **Q72** In Routine mode the canvas shows the routine of the Start on show. Connection lines, their labels and the starting-location star hide. Places the entity can never reach are faded.
- **Q73** With no row selected the canvas shows an overview: one neutral ring on every routine place, a flag where the Start begins, an arrow for each move at a set time (colored by action, labeled with the time), and an arrow per Patrol move. No badges and no Wander lines.
- **Q74** With a row selected the canvas shows that row only: its lines, its action color on its places, and its badges (Wander chances, Patrol stop numbers). The other routine places keep the neutral ring.
- **Q75** A selected row is edited on the map.
  - Click: Stay moves to the place. Wander adds or removes it. Patrol adds it as the next stop, and a click on the last stop removes it. An empty row takes its first place from one click.
  - Drag: starts only on a place of the selected Wander or Patrol row, and those places show their connect grip without a hover. It ends on any connected place (Q43). Patrol puts the new stop right after the stop the drag left, after its last occurrence when the place repeats. A drag from the last stop to stop 1 does nothing. Wander adds the target. Stay has no drag.
  - A Patrol may visit the same place more than once.
- **Q76** With no row selected, a click adds the place to the Traversable list or removes it. With Traversable = Anywhere a click does nothing.
- **Q77** A status line at the top of the map says what a click or a drag does right now.
- **Q78** Hours use the themed time field (hour and minute columns), not the browser's time input.
- **Q79** Wander and Patrol share one list control: drag to reorder, the place, then the action's own field on the right (Wander: weight and its percent; Patrol: idle), then remove. Patrol rows are numbered. Wander keeps its one idle field under the list. This replaces the weight chips for Wander places (story 6 now applies to Start weights only).
- **Q80** A press on the map keeps the row selection, so the author can pan and edit with a row selected.
- **Q81** The location Presence tab keeps its name and changes as follows.
  - The Entities picker lists Groups only. It adds this place to a Group or removes it.
  - Entities Here becomes a read-only list of who can be at this place, one line per entity with the reason (Group; begins here, with the chance when there are several Starts; stays, wanders or patrols here, with the time; can be led here). Each line opens that entity's Routine tab.
  - Known Here is unchanged.
  - Each Connection row gets the Nearby / Far choice.
- **Q83** When several idles or row edges pass between two engine calls, the engine replays each step in clock order, so the result equals continuous play. The no-move rule at the player's location still holds for the whole span. (Ticket 02.)
- **Q84** A row whose places are all unconnected acts like a gap: the character stays at its Start's place. A Wander or Patrol with some connected places uses only those. (Ticket 02.)
- **Q85** A follower recruited by a script `.follow()` is never blocked by Traversable. Wait and Part ways still apply. The follow state records that it came from a script. (Ticket 02.)
- **Q86** The saved per-Individual state also holds the current row id and the time the engine last ran. (Ticket 02.)
- **Q87** A saved Start that the world no longer has is rolled again for that character alone. (Ticket 02.)
- **Q88** Nearby covers every implicit neighbor (parent, siblings, children) and both ends of a Connection, a one-way Connection included, minus Far pairs. A child joined to its parent by a Far Connection is left out of every section of the Entities chip, the sub-locations section included. (Ticket 01.)
- **Q89** The Connection field is `distance`, holding `far` or absent. The bundled worlds and dev fixtures lose `nearbyUsesConnections` in their files, and the probe that compared that field is deleted. (Ticket 01.)
- **Q90** A script-move hold on a Stay lasts until that stretch of the day ends: the row's end, or the start of the next timed row for free time or an All-day row. With no timed row at all it never ends, so a scripted move of a character with an empty schedule stays until a script moves them again, as it does today. (Ticket 02.)
- **Q91** In free time and with an empty schedule, the Start's place counts as the place the current row uses, so it is always allowed. (Ticket 02.)
- **Q92** A pull or script move on a Wander or Patrol row whose idle already ran out starts a fresh idle from the move. (Ticket 02.)
- **Q93** The engine's per-Individual state is the one record of who follows. The save drops its follower list, and an older save's followers load as Following. Runtime characters carry engine state too. (Ticket 03.)
- **Q94** Until ticket 09 lands, the location request keeps today's four replies and asks only about followers and non-Strict Individuals at the player's place who have somewhere else allowed to go. Come along starts a follow. Stay here is a wait until the end of this daypart. Go to takes allowed places only. The Moves Between one-shot is removed. (Ticket 03.)
- **Q95** The peel-off is removed: a Group's "come along" no longer makes a following copy (Q46). Copies already in a save stay as runtime characters. (Ticket 03.)
- **Q96** Until ticket 08 lands, the narration pull keeps today's sibling and child reach but runs through the engine's rule: allowed place, not Strict, not Following or Waiting. A Group is never pulled and no longer gets a discovered copy. (Ticket 03.)
- **Q97** Ticket 03 already limits the location Entities picker to Groups. Its stand-in edits the first Start's place and says how many Starts the entity has; a canvas click sets that place, and removing a place there does nothing for an Individual. (Ticket 03.)
- **Q98** A script `.move()` on a follower ends the follow, then holds, as it does today. On a Group it does nothing. (Ticket 03.)
- **Q82** Nearby Through Connections is removed, checkbox and field. Nearby reach already counts Connections (Q61), and migrated Connections stay Nearby (Q48).

## User Stories

### Authoring characters

1. As an author, I want to mark a character as a Group or an Individual, so that a swarm of moths can be everywhere while a named person is in one place.
2. As an author, I want a new character to start as an Individual, so that the common case needs no setting.
3. As an author, I want an Individual to have a Start at one place, so that I always know where it begins.
4. As an author, I want a Start with no schedule to keep the character at its place, so that a shopkeeper needs no extra setup.
5. As an author, I want to add several Starts with weights, so that a character can begin in different places across playthroughs.
6. As an author, I want to set weights with the same chips I use for placeholder values, so that I don't learn a second control.
7. As an author, I want two Starts at the same place with different schedules, so that the same character can keep different routines across playthroughs.
8. As an author, I want the Start roll to happen once per playthrough, so that a character keeps one routine for the whole save.
9. As an author, I want to add schedule rows of a time and an action, so that the character keeps a daily routine.
10. As an author, I want All day as a time choice, so that one row can cover a whole routine.
11. As an author, I want rows to use dayparts by default, so that they read like the Conditions I already use.
12. As an author, I want to swap a row to exact hours, so that I can say 08:30 when I need to.
13. As an author, I want swapping odd hours back to dayparts to snap and tell me, so that nothing changes silently.
14. As an author, I want a timed row to win over an All-day row, so that I can write exceptions without rewriting the routine.
15. As an author, I want hours no row covers to keep the character at its Start, so that a gap never strands them.
16. As an author, I want a Stay action at one place, so that the farrier works at the smithy during the day.
17. As an author, I want a Wander action over weighted places, so that a merchant drifts around the market and favors the stall.
18. As an author, I want a Wander idle time, so that a busy market feels busy and a quiet farm feels calm.
19. As an author, I want a Patrol action with ordered stops and an idle per stop, so that a guard walks the wall, waits at the gate, and goes round again.
20. As an author, I want place pickers to list only places the Start can reach, so that I can't give a character a place it could never walk to.
21. As an author, I want a place that later becomes unreachable to stay in the row with a flag, so that undoing a link edit restores it and nothing is lost silently.
22. As an author, I want to mark a row Strict, so that a clerk can't be called away during work hours but can be after.
23. As an author, I want a Traversable list per character, so that a queen follows the player through the palace and stops at the gate.
24. As an author, I want Traversable to default to Anywhere, so that most characters can be companions with no setup.
25. As an author, I want Traversable to list exact places, so that allowing a city doesn't allow every house in it.
26. As an author, I want scripts to recruit any character regardless of Strict or Traversable, so that "convince the queen and she joins you" is possible on my terms.
27. As an author, I want a script move to hold until the current idle runs out, so that my scripted scene isn't undone the same turn.
28. As an author, I want scripts to read whether a follower is waiting, so that a scene can react to a companion left behind.
29. As an author, I want my shipped worlds to play the same after the update, so that I don't have to re-tune every character.

### Authoring locations

30. As an author, I want to mark a link between two places Far, so that two villages on one map don't hear each other.
31. As an author, I want every link to start as Nearby, so that worlds play as before until I change one.
32. As an author, I want to set the distance of an implicit link by clicking its arrow, so that I don't have to create a road location.
33. As an author, I want deleting that Connection to restore the implicit Nearby link, so that the change is reversible.
34. As an author, I want a Far link to still allow travel, so that distance never strands the player.

### Playing

35. As a player, I want a character who is the focus of the scene to count as present, so that items they give, take or wear are tracked.
36. As a player, I want characters to be where their routine puts them, so that I can find the farrier at the smithy by day.
37. As a player, I want characters to move about while I'm elsewhere, so that the world feels alive.
38. As a player, I want a character I'm with to stay put while we talk, so that nobody wanders out of the scene.
39. As a player, I want to call someone over from the next room or across the yard, so that nearby people can join the scene.
40. As a player, I don't want someone in a distant village to appear because their name came up, so that the world stays consistent.
41. As a player, I don't want characters I only see through a window to count as here, so that the scene list matches the story.
42. As a player, I want someone I called over to go back afterward, so that the world keeps its routine.
43. As a player, I want to ask a character to come along and have them follow me, so that companions work.
44. As a player, I want a follower to stay with me past their usual hours, so that a mercenary doesn't leave for their inn corner at night.
45. As a player, I want a follower to follow me across a long road, so that distance doesn't break companionship.
46. As a player, I want a follower who can't enter a place to stay behind and wait, so that the queen stops at the palace gate in the story and in the game.
47. As a player, I want to tell a follower to wait, so that I can leave them somewhere and come back.
48. As a player, I want a follower to wait as long as they said they would, so that "only till ten, it's late" is honored.
49. As a player, I want a follower who waited too long to go back to their routine, so that nobody waits forever.
50. As a player, I want to part ways with a follower, so that I can release them without waiting out a timer.
51. As a player, I want a character on a Strict shift to decline in the story, so that the prose never shows them coming along.
52. As a player, I want the choices never to offer taking along someone who can't come, so that I'm not shown dead-end options.
53. As a player, I want a patrolling guard to pick up the round where they left it, so that their route stays believable.
54. As a player, I want a character the story invented to stay where I met them when I release them, so that they keep a place in the world.
55. As a player, I want off-screen movement to stay silent, so that finding people is part of the world, not a log feed.

### Narrator and passes

56. As the narrator, I want each Individual at the scene tagged following you, waiting here, or stays here, so that I describe movement that matches the game.
57. As the narrator, I want Strict characters in Nearby places tagged stays here, so that I don't walk them over.
58. As the narrator, I want characters in Far places left out of context, so that I don't mention someone out of earshot.
59. As the location request, I want the current time and daypart, so that "it's already late" means something when choosing a wait.
60. As the location request, I want a closed list of replies with wait durations, so that a small model answers reliably.
61. As the location request, I want a JSON reply with a text fallback, so that endpoints without schema support still work.

## Implementation Decisions

### World shape: entities

- An entity gains a Group / Individual kind. It replaces `presence`. The persona, the played entity and an entity with no locations have no kind; they stay outside positions as today.
- `movement` is removed.
- A Group keeps `locations` as its place list and nothing else.
- An Individual gains:
  - **Starts:** an ordered list. Each has an id, a place, a weight (positive integer, default 1) and a schedule.
  - **Schedule rows:** an ordered list per Start. Each row has an id, a time (All day, or start and end in minutes from midnight; a range may wrap past midnight), a Strict flag, and one action:
    - Stay: one place.
    - Wander: weighted places (place plus weight) and one idle duration.
    - Patrol: ordered stops, each a place plus an idle duration.
  - **Traversable:** Anywhere, or a list of exact place ids. An empty list means schedule places only.
- An Individual's `locations` stays the entity's membership list (ADR 0003), so its readers keep working: roster indexes, the location-first roster editor, canvas picking, the persona start and Known In "Nearby". For an Individual it is derived: every Start place and every row place. The editor and the load normalizer rewrite it; nothing else writes it.
- Deleting a location drops it from Starts, rows and Traversable. A Start whose place is deleted is dropped. A row left with no places is dropped.
- Idle and wait durations are stored in minutes. Daypart edges are fractions of a 24-hour day; a daypart pick stores those edges rounded to the minute, and the UI shows a row as dayparts when both stored ends are within one minute of daypart edges.

### World shape: connections

- A Connection gains a distance. Only Far is stored; absent means Nearby (Q48). It applies to the pair, both legs (Q38).
- An implicit pair is Nearby. To make it Far, the author clicks its arrow, which already creates a two-way Connection (Q39), then sets Far. Deleting the Connection restores the implicit Nearby link.
- Distance never changes travel (Q49, ADR 0006).
- A new ADR extends ADR 0002 with distance.

### Reach

- **Connected** (pickers, Q43): a place is connected to a Start when travel can get from the Start's place to it through any path of effective links, Far included. Pickers list only connected places (Q44). Stored places that stop being connected are flagged in the editor and skipped in play (Q54).
- **Nearby** (pulls and context, Q61): a place one link from the player's place, implicit or Connection, in either direction, whose distance is Nearby.
- **Allowed** for an Individual right now: the places its current row uses, plus its Traversable places (all places for Anywhere). Pulls and follows reach only allowed places.

### Migration

`migrateWorld` maps shipped worlds idempotently. Starts come from `presence`; schedules and Traversable come from `movement`.

| Today | Becomes |
|---|---|
| No presence, more than one location | Group, same places |
| No presence, one location | Individual, one Start at that place |
| `presence: random` | Individual, one weight-1 Start per listed place (Q57) |
| Free, Stays Put | Empty schedules |
| Moves Between | Each Start gets an all-day Wander over the listed places, idle one daypart (Q58) |
| Can Follow | Traversable = Anywhere (Q55) |
| Free, Stays Put, Moves Between | Traversable = empty list (Q55) |
| Any Connection | Nearby (no field) |

The bundled worlds and the dev fixtures migrate through the same path.

### Position engine (new module)

One pure module answers where every Individual is now, from the world, the saved per-Individual state, the clock and a random source. It owns:

- **Start roll:** once per playthrough, weighted (Q33). The chosen Start is saved.
- **Row resolution:** the timed row covering now beats an All-day row. Timed rows never overlap (Q65). With no row, the character stays at its Start's place (Q52).
- **Actions:**
  - Stay → its place.
  - Wander → a weighted pick among its connected places, other than the current one when there is a choice. A new pick happens when the idle runs out.
  - Patrol → stops in order, idling at each, looping (Q62). A row entry starts at stop 1. After a pull, script move or follow ends, it resumes at the stop after the last one reached (Q41).
  - Moves jump straight to the target (Q63) and are silent (Q15).
- **With the player:** no move happens to a character at the player's location until the player leaves, so a row change or an expired idle never removes someone mid-scene.
- **Off-row correction:** a character outside its row's places goes to where the action puts it now, unless a hold applies. A pull holds a Stay-row character until the player leaves, and a Wander or Patrol character until its idle runs out (Q40). A script move holds the same way (Q53).
- **Follow states:** Not following → Following → Waiting (place, until-time) → Not following on timeout or Part ways. Following and Waiting pause the schedule. Starting a follow needs a non-Strict row (Q36); a running follow ignores Strict.
- **Blocked follower:** when the player moves to a place not allowed for a follower, the follower stays at its current place and becomes Waiting until the end of this daypart (Q42).
- **Runtime characters:** one Start at their discovery place, empty schedule, Traversable = Anywhere (Q56).
- **Scripts:** `.follow()` makes any Individual follow, ignoring Strict and Traversable (Q64); on a Group it does nothing. `.unfollow()` is Part ways. `.move()` sets a hold and ends a wait. The script entity entry exposes a read-only waiting state.

The game calls it at game start (replacing the presence roll), once more when the opening hour is set (skipping anyone at the player's location, since the opening placed them before the hour was known), on load (replacing the re-roll on a missing location), and at each turn commit after time passes. It is called from the same place follower moves are committed today, not from the pure turn commit.

### Narration pull

The visitor pull selects a named Individual when they stand in a Nearby place, the player's place is allowed for them, their current row is not Strict, they are neither Following nor Waiting, and they are not already here. It no longer looks at siblings and children directly. Groups are never pulled (Q46).

### Context

The Entities chip's nearby section lists Groups and Individuals in Nearby places only. Characters in Far places are left out.

### Entity location request

- Sent for each follower, and for each Individual at the player's location whose current row is not Strict. Never for Groups. The gate is unchanged: no request runs while location routing is off (Q27).
- In auto mode the request runs before narration and sees only the action, so wait durations come from the action there. Suggest mode also reads the narration.
- Replies: Come along / Stay for non-followers. Keep following / Wait here (about an hour · until the end of this daypart · until the end of the next daypart) / Part ways for followers. "Go to a place alone" stays, limited to the character's allowed places.
- Reply as a JSON schema with a text fallback, chosen per endpoint like the Inventory pass. The reply format sits after the user message, outside the author's prompt.
- The request's context carries the current time and daypart.
- Sampler pins add repetition penalty 1.
- One call per character stays the default. A probe decides whether a single batched call replaces it. The bar: an action that names one character, with two others present, moves only the named one.

### Movement tag (Entities chip)

The Entities chip gains a Movement include, on by default in every prompt that uses the chip. It adds a suffix to Individuals: following you, waiting here, or stays here.

- At the player's location: following you, waiting here, or stays here when the current row is Strict.
- In Nearby places: stays here when the current row is Strict (Q47). No other suffix there.
- Groups and Individuals with no state get none. Following wins over stays here.
- In auto mode the request runs before narration, so the tag shows this turn's result.

### Save shape

The save gains, per Individual: the chosen Start, follow state (with whether a script started it, Q85), wait until-time, hold and its end, the current idle's end, the patrol stop index, the current row id and the time the engine last ran (Q86). The waiting place is the saved position.

## Testing Decisions

A good test drives a public seam with realistic input and asserts the outcome a player or author sees: where a character stands, who is in the scene, which ops land. Never assert on helpers or call order. Each guard is proven by reinstating the bug.

- **Position engine** (new seam): fixture worlds and clocks. Covers the weighted Start roll with a seeded source, row precedence, gaps at the Start, Wander picks and idle, Patrol order, loop and resume, no moves at the player's location, off-row correction, pull and script holds, the wait cap, timeout, Part ways, blocked followers, Strict on new and running follows, skipped unreachable places, and runtime characters. Prior art: the follower state tests beside the follower module.
- **Reach** (part of the position engine seam, or the location graph's own tests): connected through Far links, Nearby one hop only, implicit pairs Nearby, a Far Connection out of reach. Prior art: the location graph and neighbor tests.
- **Turn pipeline** (existing seam, ADR 0001): recorded AI replies through plan and run, then the entity-move commit. Covers the pull rule (the playtest's inn case; the window case; a mention across a Far link; a Strict character next door), the reworked location request with both reply forms, and pulls refused into places that aren't allowed. Start and load placement are tested through the load-time position reconciler. Prior art: the turn pipeline parity and turn-read tests, and the multi-hop move tests.
- **Migration** (existing seam): `migrateWorld` maps each row of the migration table and is idempotent. Prior art: the existing migration tests.
- **UI:** the Start and schedule editor, the swap, the weight chips and the distance control get component tests plus `verify-ui` on a dev route.
- **Prompts:** probe numbers on the cloud default, with in-batch controls, for the movement tag (a request to take a Strict character along → they stay; a Strict neighbor is not walked over; ordinary turns → no mention of staying) and for the location request (wait durations from narration, batching bar).

## Out of Scope

- Blocking a link entirely (Q45).
- A third distance tier, per-leg distance, and travel time on links.
- Walking intermediate places on off-screen moves (Q63).
- Private places and "keeps this appointment" flags.
- The narration arrival line ("someone who arrives this turn isn't already there").
- The narrated-move fix for a room inside the current location.
- Player-facing notices of off-screen moves.
- Inventory owner aliases: moved to the Stranger Fields effort (Q30).
- Releasing a follower while location routing is off (Q27).
- Authorable calendars or day lengths.

## Further Notes

- **Export shape:** the world `.json` loses `movement`, `presence` and a location's `nearbyUsesConnections` (Q82), and gains kind, Starts, schedules, Traversable and Connection distance, through a migration. The save `.json` gains the position engine's state. `movement` and `presence` shipped in v3.4.0.
- This is the range feature ADR 0003 anticipated. `locations` stays the membership list and is derived for Individuals.
- Labels in this spec (Group, Individual, Start, Stay, Wander, Patrol, Strict, Traversable, Nearby, Far, Part ways, All day) are working names. Final copy follows the Writing Guide in the tickets.
- **New visual patterns need approval:** the weight chips outside the placeholder editor if they need a new variant. The Far link's look was approved on 2026-11-09 with ticket 01: a dotted line, with "Far ·" ahead of the hint.
- **Other consumers to update:** the Test Bench (time-aware placement), the canvas picker's range warning (it only made sense for Moves Between), the Presence and Movement copy and pick card, the dev fixtures, the bundled worlds, the world format doc, the wiki pages on locations and the glossary, and the help vectors (`build:help-vectors`).
- **Ticket order:** Connection distance (01) and the pure position engine (02) start side by side. `movement` has about 15 readers, so the world shape, migration and reader swap land as one ticket (03) on top of the engine. The editor chain (04 → 05 → 06 → 07), the pull rule (08), the request rework (09), the movement tag (10) and the location Presence tab (11) follow.
- **Request count:** every non-Strict Individual at the player's location now gets a request each turn. The batching probe also measures that count.
- **Prototype:** the question was "what should the schedule editor look like". Verdict: D2 (Q65–Q70). Branch `prototype/npc-schedules` at `4408ec845` holds every variant (A, B, C1–C4, D1–D3), the Nearby/Far toggle, and the canvas routine view with map editing (Q71–Q80). Run it from its worktree with `npm run dev -- --port 5310`, then open an entity's Routine tab, or pick an entity on the full-screen canvas.
- **Prototype findings to keep:** a tooltip that appears on a canvas connect grip at runtime remounts the grip and the canvas loses its measured position, so the drag never starts. The old picker's rule that draws canvas lines at 25% must not apply in Routine mode. Movement lines run straight between places; they do not follow the Connections the entity would walk.
