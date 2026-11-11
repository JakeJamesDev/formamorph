# Spec: NPC Schedules

Status: done
Status note: Closed 2026-11-11, tickets 01–35, last landing 242476aa6. First closed 2026-11-10 with tickets 01–24; reopened for the scripts and help-content sweeps (Q208). Review: spec text corrected; two small gaps fixed in f58e9c64e; three gaps and four thin tests fixed by ticket 35 (Q233, Q234). Gates green on 2026-11-11: two CUDA notice tests failed under load in the full run and passed alone, as before (ticket 25); their fix 5ff664c16 on `worktree-fix-cuda-notice-popover-hold` is not on main. The Presence tab was changed by the Presence Rows effort (Q207).
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

Both kinds have one or more **Starts**. Each Start is a place plus a **schedule**: rows of a time range and an action. The kind decides how the Starts play (Q130–Q141).

- A **Group** is a kind of creature or a crowd: a herd, a swarm, an enemy met in several places. Every Start runs at the same time, so the Group has one presence per Start, each on its own schedule. It is still one entity. It is never pulled and never follows.
- An **Individual** is one body in one place. Its Starts are weighted, and one Start is rolled per playthrough.

The actions:
  - **Stay** at one place.
  - **Wander** among weighted places, idling between moves.
  - **Patrol** a list of stops in order, idling at each, then looping.

  A Start with an empty schedule stays at its place. Duplicate Starts at the same place with different schedules are fine. A Start's place can be **Player's Starting Location**, and such a Start of an Individual can begin Following (Q147, Q148).

An Individual has a **Traversable** list: the places it may go beyond its schedule, or Anywhere. Pulls and follows reach only the places the current schedule row uses plus the Traversable places. A row can be **Strict**: during it the character can't be called over and won't start following.

The player can take a character along. A follower can be told to **wait** somewhere for a while, or to **part ways**. A follower who can't enter the player's next place stays behind and waits. When a wait runs out, or the player parts ways, the character goes back to their schedule.

Every link between two locations has a **distance**: **Nearby** or **Far**. Narration can call a character over only across one Nearby link, and the narrator hears about characters only in Nearby places. Far still allows travel. Implicit links are Nearby; an author makes one Far by clicking its arrow on the canvas, which turns it into a Connection.

Shipped worlds migrate to the nearest form. One thing changes in play: an old character with several locations and no presence setting was present at all of them, and a person among those now wanders between them (Q143, Q152).

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
- **Q31** *Amended by Q130–Q141.* Group stays beside Individual. Group = a place list, present at all of them, never moves. Individual = Starts.
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
  - A Patrol may visit the same place more than once, but no stop follows itself, and the loop from the last stop to stop 1 counts as a step. A click or a drag that would break this does nothing. (Ticket 07.)
  - A Group gets the status line too. With no row selected a click toggles any place, connected to the Start or not. Removing a row's last place is allowed. (Ticket 07.)
- **Q76** With no row selected, a click adds the place to the Traversable list or removes it. With Traversable = Anywhere a click does nothing.
- **Q77** A status line at the top of the map says what a click or a drag does right now.
- **Q78** Hours use the themed time field (hour and minute columns), not the browser's time input.
- **Q79** Wander and Patrol share one list control: drag to reorder, the place, then the action's own field on the right (Wander: weight and its percent; Patrol: idle), then remove. Patrol rows are numbered. Wander keeps its one idle field under the list. This replaces the weight chips for Wander places (story 6 now applies to Start weights only).
- **Q80** A press on the map keeps the row selection, so the author can pan and edit with a row selected.
- **Q81** The location Presence tab keeps its name and changes as follows. (The first two points are replaced by Q207; the last moved to the Connections tab, Q175.)
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
- **Q99** As an idle length, "one daypart" is 240 minutes, a sixth of the day, because real dayparts are uneven. Migrated Moves Between Wanders get 240 (Q58), and the editor's "1 daypart" idle choice stores the same. (Ticket 03.)
- **Q100** A character the narration calls over owns items in that same turn: the Inventory pass counts them as present. (Ticket 08, story 35.)
- **Q101** The pull cannot tell "seen" from "called over". A character named in full is refused only by the rule itself: a Far link, a Strict row, a place that is not allowed, or a follow or wait. The playtest's window case holds because the office was not an allowed place for those characters (Q23). A character with Traversable = Anywhere on a non-Strict row next door is pulled when named. (Ticket 08.)
- **Q102** A character in the parent place is one Nearby link away and can be pulled (Q88). (Ticket 08.)
- **Q103** Ticket 09 lands one call per character and records the batching verdict. A switch to one batched call is a follow-up ticket. (Ticket 09.)
- **Q104** A follower's replies are exactly Keep following, Wait here and Part ways. Go to a place alone is offered to non-followers only, as today. (Ticket 09.)
- **Q105** Go to offers the places one travel link from where the character stands that are also allowed for them. It does not list every allowed place in the world. (Ticket 09.)
- **Q106** Part ways resumes the routine at once. A character at the player's place still leaves only when the player does. (Ticket 09.)
- **Q107** The request states the current clock time and daypart, and names each wait's end as a clock time and daypart. (Ticket 09.)
- **Q108** The closed reply list and the reply instruction live in the appended format. The move-state chip stays an author chip. The move-options chip leaves the default template and renders empty in a saved template that still holds it. (Ticket 09.)
- **Q109** The idle control is a number box with a unit: minutes, hours or dayparts. This is the prototype's control and it replaces Q50's "presets plus a box". (Ticket 04.)
- **Q110** In hours mode the hour column disables hours that would make the range touch another timed row. A write that still overlaps is refused with a one-line note. (Ticket 04.)
- **Q111** The kind switch, a Group's places and the Starts all live in the Routine tab; nothing of them stays in the Profile tab. The last Start can't be deleted. Changing a Start's place keeps its rows, and places it can no longer reach get the flag (Q54). Each Start tab shows its chance as a chance chip, and the weight edits from the "begins at" sentence. (Ticket 04.)
- **Q112** The movement tag is a field line in an Individual's block, like the stranger-name field. Name-only content appends it in parentheses. Its wording addresses the model, so it reads "following the player", "waiting here", "stays here" at the player's place and "stays there" in a Nearby place. The tag follows where the character stands, the same in every scope of the chip. (Ticket 10; amends Q21 and Q47's wording.)
- **Q113** Stay, Wander and Patrol each have a theme color token, used by the strip's bands, a small swatch before each sentence, and the map's lines and marks. A click on a free-time gap adds a Stay row at the Start's place and selects it. Switching the Start tab clears the row selection. One shared selection record per entity holds the Start on show and the selected row, for the canvas to read. (Ticket 05.)
- **Q114** On the cloud default the movement tag alone does not change what the narrator writes (12 runs per arm, no gain over no tag). Ticket 10 may add one sentence to the default narration and choices templates that gives the movement line its meaning, and lands it only if it beats the no-tag control without more mentions of staying on ordinary turns. Two wordings at most; if neither wins, the tag ships as built and the "they stay" bar is recorded as not met. (Ticket 10.)
- **Q115** Ticket 09's probe: one batched call met the one-named bar in 24 of 24 runs, and one call per character in 16 of 24. Ticket 12 switches the request to one batched call. (Ticket 09.)
- **Q116** A row's two handles never cross. A drag cannot turn a row into one that wraps midnight; the time editor sets a wrapping range, and a row that already wraps drags both its ends. The prototype let an end pass its own start, which was not intended. (Ticket 05.)
- **Q117** In the batched request, each character has a block in the appended format with its state sentence and its own reply list. The character-name and move-state chips leave the default template; in a saved template the first reads "each character listed" and the second renders empty. Two subjects with one name are numbered in the request. (Ticket 12; amends Q108.)
- **Q118** The one-named bar decides between the two request forms; it is not a 100% gate. Ticket 12's batched text met it in 67 of 72 runs over three batches against 48 of 72 for one call per character, with fewer false moves and more right answers in every batch, so the batched form ships. The cost is about half a second more per turn. "As long as it takes" and "until night falls" still pick the end of this daypart (Q8 not met; two fixes tried and dropped). (Ticket 12.)
- **Q119** Free time can be made Strict from its own line: each free-time line has a lock, and a click writes one locked All-day Stay at the Start's place. That row plays only in the hours no timed row covers, so each timed row keeps its own lock. Keeping a character inside a set of places is Traversable's job and needs no rows. (After the tickets.)
- **Q120** The strip and the sentences start at Dawn, not midnight, so Night is one stretch at the right end and no daypart wraps. With midnight on the left, Q116 kept a row from being dragged into Night. Q116 still holds: handles never cross, and only an hours row that runs across Dawn wraps. (After the tickets.)
- **Q121** A row dragged over the whole strip becomes All Day, since a timed range cannot say "every hour". An All-day row with no timed rows has handles, and a drag inward makes it timed again. Over an All-day base row, a timed row stops one snap short, because one All-day row is the limit (Q65). (After the tickets.)
- **Q122** A row's color swatch is as wide as the free-time line's icon and centered on it, so the two locks line up. A row's delete button sits at the right edge of the row. (After the tickets.)
- **Q123** Dayparts start on whole hours of a 24-hour day: Dawn 06:00, Morning 08:00, Midday 11:00, Afternoon 13:00, Evening 17:00, Night 20:00. The game clock itself changed, so Conditions, scripts and the narrator's time read the same edges. Before, the fractions gave 07:55, 11:02, 12:58, 17:02 and 19:55, and a row set to 11:00 began before Midday. (After the tickets.)
- **Q124** A timed band drags whole. An hours row keeps its length and moves by whole hours; a row on daypart edges keeps its count of dayparts. The row lands in the nearest place clear of other timed rows, so it can pass a neighbor, and it can run past the strip's end onto its start. Left and Right on a focused band do the same, one place at a time. An All-day row does not move. (After the tickets.)
- **Q125** An end handle on the strip's right edge goes round to the strip's start when the pointer is there, and a start handle on the left edge goes round to the end, so a row can run across Dawn and fill the day without the row's time editor. It still stops at the next timed row. A handle that is not on the strip's edge stops at its row's other end, as Q116 says. Arrow keys follow the same rule. (After the tickets.)
- **Q126** Replaces the arrows of Q73 and Q74. The canvas draws no line from one row to the next: the engine walks no path between rows, and those arrows took a Patrol's first stop as its exit. Only a Patrol draws arrows, and a selected Wander row draws its dashed links. (After the tickets.)
- **Q127** With no row selected, a place takes its action's color when every row there shares one action, and the neutral ring otherwise. Each routine place carries a thin Dawn-to-Night bar, colored where the entity can be there, with the times in its tooltip. Free time shows muted on the Start's location. With a row selected, the bar shows that row only. (After the tickets.)
- **Q128** The full-screen canvas has a key at the bottom center for the Routine and Known In views. It lists only what the view draws now, folds to its title, and remembers that on the device. The status line (Q77) still says what a click does. (After the tickets.)
- **Q129** A press in the canvas's right panel clears the selected row, as on the Routine tab. A press on the map still keeps it (Q80). (After the tickets.)
- **Q130** Groups and Individuals share one model. A Group has Starts, and every Start runs at once: one presence per Start, each on its own schedule. A Group is still one entity with one set of stats, inventory and memory. (Group grill; amends Q6 and Q31.)
- **Q131** Two presences of one Group in the same location show the Group once, in context, panels and the canvas.
- **Q132** Q46 stays. A Group moves only by its schedules: no pull, no follow, no location request. Script `.follow()` and `.move()` still do nothing on a Group.
- **Q133** A Group made from a released entity's location list gets one Start per location with no rows, so each presence stays in place (see Q146).
- **Q134** The Routine tab hides a Start's chance chip and weight for a Group. The weight stays in the data. (Amends Q111.)
- **Q135** A kind switch keeps every Start and row. It only changes "roll one" to "run all".
- **Q136** Traversable is hidden for a Group and stays in the data. The canvas shows no Traversable marks for a Group.
- **Q137** Strict is hidden on a Group's rows and stays in the data.
- **Q138** For a Group, the canvas shows the routine of the Start on show. The other Starts' places take the "Is Here" mark.
- **Q139** The location editor's Entities picker adds a Start with no rows at this place to a Group. Its remove deletes every Start of that Group that begins here, with its rows. The last Start can't be removed (Q111). (Amends Q97.)
- **Q140** No limit on the number of Starts.
- **Q141** A Group can have two Starts at the same place, as an Individual can.
- **Q142** These rulings land in this spec, with new tickets after it.
- **Q143** A released entity with several locations, no presence setting, and the look of one person (Q146, Q151) becomes an Individual: one Start at the first listed location, an All-day Wander over the list with an idle of one daypart, and Traversable set to the same list. Before the Group split, authors listed several locations to say "can be met here", never "is in all of them".
- **Q144** A released entity listed at every location of the world becomes an Individual with one Start at Player's Starting Location, Traversable = Anywhere, and Begins Following on. These are companions that travel with the player. This check runs before Q146.
- **Q145** The migration is silent. The changelog and the docs explain the rule, and they say plainly that a migrated person is now present by chance (Q152).
- **Q146** A released entity with several locations and neither pronouns nor the persona flag becomes a Group with one Start per location (Q133), in a world that uses those fields (Q151). These are random-encounter enemies, such as a Mimic listed in two dungeons. With either field, Q143 applies.
- **Q147** Player's Starting Location is a choice for any Start's place. It resolves at New Game to the location where the player begins.
- **Q148** Begins Following is a setting on a Start. It shows only when the Start's place is Player's Starting Location, and only for an Individual. With it on, the follow state starts as Following in a new game, ignoring Strict, as a script `.follow()` does (Q64).
- **Q149** A Start at Player's Starting Location can have rows. Its pickers offer every location, because the connected filter (Q44) has no fixed place to start from. Play skips a place the entity can't reach from the real start (Q54). The canvas draws no "Starts Here" flag for it.
- **Q150** A Group's Start can use Player's Starting Location too. It never follows.
- **Q151** The Q146 split applies only in a world where at least one entity has pronouns or the persona flag. In a world with none, every multi-location entity follows Q143, because the world is older than both fields.
- **Q152** Q61 stays for a Wander row: narration pulls an Individual only from a Nearby place, not from any place its row uses. A migrated person is present by chance until the author writes a routine.
- **Q153** A Group's saved record per Start also holds the time the engine last ran for it, so idles and row edges replay per presence (Q83). (Ticket 13.)
- **Q154** The rule that nobody moves at the player's location until the player leaves applies to each presence of a Group. The opening reseat leaves a presence at the player's place where it is. (Ticket 13.)
- **Q155** Ticket 13 makes the kind switch keep Starts, rows, weights, Strict and Traversable in both directions (Q135), because a Group with no Starts is present nowhere. A kindless entity switched to Group gets one Start per listed location, no rows. Ticket 14 keeps the round-trip test and the UI. (Ticket 13.)
- **Q156** Ticket 13 changes the output of today's "several locations, no presence → Group" migration row to one Start per location with no rows. Ticket 18 owns which entities become Groups. (Ticket 13.)
- **Q157** Every writer of a Group's places goes through ticket 13's helper: the canvas Locations pick mode, the canvas Routine view's Group click (Q75), the authoring tour's place step and the location Entities picker. Until ticket 15, the canvas Routine view for a Group lights every presence's Start and row places. (Ticket 13.)
- **Q158** A Group added to a world from the library keeps the Starts whose place maps into the world, with Start and row places remapped; a row left with no places is dropped, and a Group left with no Starts gets one per mapped location. An Individual's Start places are not remapped on that path today; that gap is a follow-up, not ticket 13. (Ticket 13.)
- **Q159** On the canvas, a Group's places connected to the Start on show draw plain and the rest faded. "Is Here" is its own mark with the neutral ring, on the begin places of the other Starts where the Start on show draws nothing. The "Starts Here" flag stays on the Start on show. (Ticket 15.)
- **Q160** With no row selected, a canvas click on a place adds a Start there for a Group, or removes every Start that begins there, the one on show included, as one undo step. The view then falls back to the first Start, and the last Start stays. The status line keeps "Click a location to add or remove it". (Ticket 15; amends Q75.)
- **Q161** The location's read-only list shows one merged set of lines per Group: "begins here" once, and each row reason from every Start, with equal lines shown once. When the picker refuses to remove a Group's last Start, a hint under the picker says so and the Group stays ticked. UI copy never says "Start"; the Routine tab's word is "begins at". (Ticket 16.)
- **Q162** The two kinds are named **Unique** (was Individual) and **Generic** (was Group). Game modders already say "unique NPC" and "generic NPC", and Generic fits one Mimic in each dungeon, which is not a group. This spec keeps the old words above this line. (Amends the working names.)
- **Q163** The rename covers everything: the switch, hints, docs, wiki, glossary, unreleased changelog entries, and the code, including the stored kind value and the save's per-kind state names. Tickets 14 to 18 write user-facing text with the new names and leave the code names; ticket 19 renames the code after they land. The stored value is unreleased, so no compat is written.
- **Q164** Starting hints for the switch. Unique: "One character. Begins at one of the locations below". Generic: "A type of character. One begins at every location below, at the same time". Ticket 14 checks them against the Writing Guide.
- **Q165** Player's Starting Location resolves to the place New Game seats the player in, after the start pick. A move in the opening turn does not change it. The save keeps one resolved value per playthrough. With no starting location in the world, such a Start places nobody. (Ticket 17.)
- **Q166** Begins Following skips only the Strict check at the start. It is not a script follow: Traversable still applies, and a companion who can't enter a place stays behind and waits (Q42). (Ticket 17; narrows Q148.)
- **Q167** A save from before the engine state loads a Player's Starting Location as its page-one location, else the player's current location. An Individual whose rolled Start has Begins Following is then placed with the player and starts Following, as the old play had that companion always present. (Ticket 17.)
- **Q168** A new row on a Start at Player's Starting Location defaults to the first location of the world. On the canvas, a Group's click never adds or removes such a Start, and it never marks "Is Here". (Ticket 17.)
- **Q169** Migration details. "Uses them" (Q151) reads every entity of the world: a non-blank pronouns string, the persona flag or a custom persona. On the entity itself (Q146) only pronouns and the persona flag count. "Every location" (Q144) needs a world with at least two locations and compares against the world's location ids, ignoring stale ids. (Ticket 18.)
- **Q170** The four multi-location rows ignore `movement`, with one exception: a wandering Individual (Q143) that had Can Follow gets Traversable = Anywhere (Q55), not the list. Moves Between adds no second Wander. (Ticket 18.)
- **Q171** Pronouns that start with "it" do not count as the person signal on an entity (Q146): authors give creatures "it/its". "They/them" still counts as a person. For the world-level check (Q151), any non-blank pronouns count. Found when ticket 18 ran the rule on the bundled worlds. (Ticket 18.)
- **Q172** The bundled worlds already store kinds, so the migration skips them, and their named people with several locations are stored as Generic. Ticket 20 applies the rule to them and the user reviews each result by name. (Ticket 20.)
- **Q173** The Connections tab, the Connection row and the Known In canvas view belong to this spec, as tickets from 21.
- **Q174** Known In set to Nearby means near where the entity is now: the player is one Nearby link from the place the entity stands this turn (Q61, Q88). The rule does not change. Only the hint text under Known In changes; it must say "nearby", not "one location away".
- **Q175** A location's panel gets a Connections tab, right after Presence. It holds the Connections and nothing else. Presence keeps Entities, the entities that are here, and Known Here. (The first two are replaced by Q207.)
- **Q176** The Connections tab also lists the free links (parent, children, siblings) that no Connection replaces, in one folded group under the Connections and the "Connect to" picker, closed by default.
- **Q177** A collapsed Connection row shows, in order: the fold chevron, the direction icon, the other location's name, the distance mark, and Delete. It shows no "one way" text and no hint marker. The distance mark is read-only.
- **Q178** Amended by Q184.
- **Q179** An open Connection row holds three fields, top to bottom:
  - **Travel:** a three-choice segmented control, each choice an icon and a word (both ways, to there, to here). No line of text under it.
  - **Distance:** a label with an ⓘ, then a two-choice segmented control. It is two thirds of the row wide, so its choices line up under the first two Travel choices and the third slot is empty. Each choice shows the distance mark. No line of text under it.
  - **Travel Hints:** the two hint boxes labeled "To X" and "From X", with the link button. No group label above them.
- **Q180** On the full-screen canvas, Known In set to Nearby marks every place the routine uses, and marks every place one Nearby link from those more lightly. The key says the lighter marks apply only while the entity is there.
- **Q181** That view draws a Far link in the Far style and leaves its other end unmarked, so the author sees why the entity is not known there.
- **Q182** Each free-link row has one button that makes it a Connection: two-way and Nearby. The new Connection joins the list above and the free row goes.
- **Q183** The Connections tab and the Connection panel on the full-screen canvas use one widget for the open row (Q179). The canvas panel shows one Connection and has no fold.
- **Q184** Every Connection row starts collapsed, whatever the count. A new Connection opens when it is added. The tab has the Collapse All button of the Openings list. (Amends Q178, which matched Openings: open below three rows.)
- **Q185** The distance mark is a line, then the word, in one fixed width, so the shorter word gets the longer line. Nearby is a short straight line. Far is a dotted sine wave with few humps (one per 8 px in the prototype). Both values show the mark; Nearby is never blank. This is a new visual pattern, approved on 2026-11-10 in the prototype.
- **Q186** Distance needs an in-depth explanation in its ⓘ: what the AI is told about the other end, who the narration can call over, and that travel works either way. The one-line hint under the control is removed. The copy is written in the ticket from a facts list (Writing Guide).
- **Q187** The link button of the hint pair spans from the top of the first hint box to the bottom of the second. It does not cover the first label.
- **Q188** The two hints keep the link button. The rule "an empty return hint uses the words of the way out" was tried and dropped.
- **Q189** Rejected in the prototype: the direction as a click-to-cycle icon; distance as dropdowns, as a clickable header mark, as a menu on the mark, as a slider line, and as the list a row is in; sentences with inline picks; arrows the hint is typed on; a list with one editor; a checkbox grid; ways out and ways in; a small radial map; chips; groups by place with free links as ghost rows. Reason for the last two families: a row that moves or changes list while it is edited is bad to use.
- **Q190** The Known In canvas view (Q180) uses the whole day of every Start, never the Routine tab's selection, and for a Generic entity all its Starts. It marks only places the engine can use: a row place that is not connected to its Start (Q54) gets no mark. (Ticket 24.)
- **Q191** In that view, Player's Starting Location stands for every location when no location is flagged as starting, as in the engine. (Ticket 24.)
- **Q192** That view fades unmarked places the way the Picked Locations view fades non-picks. (Ticket 24.)
- **Q193** In that view the routine-place mark replaces the member mark. Nowhere and Picked Locations keep the member mark. (Ticket 24.)
- **Q194** The Known In hint and the two key labels use the word Nearby, the word the Distance control uses, and no "next door". Working text: "Sends its summary to the AI at locations Nearby to where it is", "Can Be Here", "Known Here While It Is Nearby". The user approves the final copy. (Ticket 24.)
- **Q195** The Connection widget takes its Travel choice labels from the surface: icon and word on the location panel, icon and a tooltip that names both ends on the canvas. The canvas has no "here", and two choices that both read "one way" would mislead. (Ticket 21; narrows Q183.)
- **Q196** The widget takes its hint labels from the surface too: "To X" and "From X" on the location panel, an arrow and the destination on the canvas. (Ticket 21.)
- **Q197** The one-line distance hints are deleted. The Distance ⓘ is the only place that explains Nearby and Far (Q186). (Ticket 21.)
- **Q198** Tickets 21 and 24 share no primitive. Ticket 21 owns the distance mark; ticket 24 draws Far links in the canvas's existing Far style. (Tickets 21, 24.)
- **Q199** Collapse All on the Connections tab shows only with more than one row, as on the Openings list. (Ticket 22.)
- **Q200** The Connections tab has no "Connections" label; the tab names it. Its hint line stays, with Collapse All right-aligned on it. Ticket 23 cuts the hint to its first sentence when the free-links group says the rest. (Tickets 22, 23.)
- **Q201** A row opens only when the author adds the Connection on the tab: the "Connect to" picker and the Authoring Tour's example. A Connection that returns through undo, or arrives any other way, stays closed. (Ticket 22; narrows Q184.)
- **Q202** A reveal that lands on a field of a closed row opens the row first: world search, undo and Reveal Origin, on a Travel Hint, Travel or Distance. (Ticket 22.)
- **Q203** On a closed row the distance mark draws Far in the foreground color and Nearby muted, as in the prototype. (Ticket 22.)
- **Q204** The Authoring Tour's example opens the row it writes to, also when the Connection already exists and only its hints change. The step exists to show the example text. (Ticket 22; adds to Q201.)
- **Q205** The four CUDA notice tests that were red at the close pass alone. Their fix is `5ff664c16` on the branch `worktree-fix-cuda-notice-popover-hold`, not on main. Ticket 25 names it and edits nothing there; main stays red on those tests until the user merges that branch. (Ticket 25.)
- **Q206** The `instancePid` test fails only inside the full run, where a real PowerShell spawn slows about 35 times. The code's 15 s timeout stays. The fix is in the test: the runner's own way to keep a test out of the parallel pool if it has one, else a longer timeout for that one call. (Ticket 25.)
- **Q207** The Presence Rows effort (`docs-internal/specs/presence-rows/spec.md`, closed 2026-11-11, last landing 2f1fa5266) replaced the Presence tab of Q81 and Q175. That spec holds the rulings; this is what changed here.
  - Entities Here is a list the author selects from, one row per Unique or Generic entity with a reason at this location. One entity is selected at a time, and none when the tab opens.
  - The selected entity's editor shows under the list: the canvas entity card's body, with the Routine editor and Known In. The Routine editor marks each Start, each row and each Can Also Go entry that names this location.
  - One add control under the list replaces the Generic-only picker. It adds any Unique or Generic entity with no row here: a Unique entity gets one more Start here, a Generic entity a Start here.
  - Only a Generic entity that begins here has a remove button. It is disabled, with the reason, when the entity begins nowhere else. A Unique entity leaves through edits in its routine.
  - Each row keeps the button that opens the entity's own Routine tab.
  - The canvas beside the panel draws the selected entity's routine or Known In marks, with the canvas key and a status line. It is view-only there. Picked Locations is still picked in full screen only. The pick carries to and from full screen and clears on a change of tab.
  - Known Here is unchanged but for its remove button, now an icon.
  - An undo of an edit made in that editor returns to the location's Presence tab with the entity selected.
  - The presence-line model, the position engine, the world shape and the save shape are unchanged.
- **Q208** Two sweeps ran on 2026-11-11 after the close: of scripts, and of the help content Morphie reads. Their findings are tickets 26 to 32 of this spec, as Q173 did for the Connections work. Tickets 33 and 34 came from what ticket 32 found (Q229, Q230). The Test Bench rules that read an entity's derived locations read the routine instead (ticket 26).
- **Q209** Script help states the current rules: a Unique entity follows past a locked row and Can Also Go, a Generic entity never follows, and `move`, `follow` and `unfollow` do nothing on a Generic entity. (Ticket 27.)
- **Q210** An authoring run (Test Code, the Test Bench script check, the sample Tool snapshot, the Tool lists) reads a sample placement: the cast as the opening places it at the opening hour, from the placement the Test Bench AI context already uses. The first Start stands in where play rolls one. (Ticket 28.)
- **Q211** Scripts gain four read-only reads: the entity's kind; distance and direction on each `exits` entry; the entity's current routine action and whether a script move holds it; and Known In. The user approved this widening of the script sandbox on 2026-11-11; it covers these four only. `exits` still lists direct ways only. (Ticket 30. "Whether a script move holds it" is replaced by Q222.)
- **Q212** A script that runs After the AI reads the entity places, followers and waiting entities the turn settled, the same state that turn's narration prompts read. The fault is plausible and not yet reproduced; ticket 29 reproduces it first. The engine's end-of-turn placement is not visible to After scripts. (The last sentence is replaced by Q226; the pulls are added by Q218.)
- **Q213** Morphie's index of an author's world includes each entity's kind, Starts, rows and Can Also Go, each Connection's Travel, Distance and hints, and who can be at each location. The in-game view shows a player no routine. (Ticket 31.)
- **Q214** The wiki and copy corrections land as one last ticket, 32, which also rebuilds the help vectors once. Tickets 26 to 31 edit the docs their change makes stale and do not rebuild. Reason: the vectors are one generated file, and parallel rebuilds would collide.
- **Q215** The sample placement of Q210 is for authoring runs only. Play never reads it. The in-game Tool call that falls back to the opening state before the first turn stays unplaced in ticket 28; the landing says whether play's own placement exists at that point, and ticket 29 owns what Tool calls read in play. (Ticket 28.)
- **Q216** The sample placement is taken at story minute 0, as the Test Bench AI context does, whatever clock the script's timing reads. A row that starts later in the day does not show in an authoring run. The Scripts Reference says so. (Ticket 28.)
- **Q217** In the Scripts Reference, ticket 27 owns the `location` and `present` rows and ticket 28 owns the authoring-run paragraph. Ticket 28 does not wait for 27; it uses the position engine tests' fixtures. (Tickets 27, 28.)
- **Q218** An After the AI script reads a character the prose called over as at the player's location, as the Inventory pass does (Q100): the turn's moves plus its pulls. This sharpens Q212, whose "same state as the narration prompts" left the pulls out. (Ticket 29.)
- **Q219** A re-roll's After the AI run reads the live places, which already hold the engine's end-of-turn placement. No settled places are stored on the turn, so the save shape does not change. The Scripts Reference states the difference from the first run. (Ticket 29.)
- **Q220** A Tool call during the turn (a World Tool's On Call script, a User Tool's snapshot) reads the followers joined once the move settled, with no pulls, because the prose does not exist yet. Before the AI and At Game Start scripts read the turn-start places. (Ticket 29.)
- **Q221** The script reads of Q211 are named `kind` ('unique', 'generic' or empty), `distance` ('nearby' or 'far') and `oneWay` on each `exits` entry, `action` ('stay', 'wander', 'patrol' or empty), `held`, and `knownIn` ('nowhere', 'nearby' or 'picked') with `knownInPlaces`, a list that is empty unless the value is 'picked'. Known In is one read in two fields, so that `knownIn` has one type. (Ticket 30.)
- **Q222** `held` reads true for any hold, from a script move or from a narration pull. The saved hold does not record its source, and the save shape does not change. This replaces "whether a script move holds it" in Q211. (Ticket 30.)
- **Q223** (The `held` half is corrected by Q228.) `action` reads empty and `held` false for a follower, a waiting entity, a Generic entity, the played entity and the persona, for a gap, and for a row whose places are all unconnected, which acts like a gap (Q84). A Wander or Patrol row with some connected places reads its own action. (Ticket 30.)
- **Q224** A runtime character reads `kind` 'unique', because the engine runs it as Unique (Q56) and `move` and `follow` work on it. Its `action` reads empty. The played entity and the persona read every one of these fields empty. (Ticket 30.)
- **Q225** The new reads follow the same placement as `location` at each timing (Q218 to Q220). Ticket 30 owns the new script-state field and tells ticket 29 its name. (Tickets 29, 30.)
- **Q226** Ticket 29 reproduced the fault of Q212: an After the AI script read a waiting entity as following and a called-over entity at its old place. After scripts now read the Inventory pass's placement exactly (Q218). That placement holds the engine's end-of-turn placement in two cases: the opening turn, and a suggested move the player has not taken. The Scripts Reference names both. This replaces the last sentence of Q212. (Ticket 29.)
- **Q227** An item event script that runs when the turn commits reads the same placement as that turn's After the AI scripts, not the end-of-turn placement: the event belongs to the turn whose prose caused it. If the turn's placement is no longer available at that point without new stored state, the script reads the live placement and the Scripts Reference says so. (Ticket 29.)
- **Q228** Correction to Q223, on evidence from ticket 30's landing: `held` does not depend on `action`. An entity that a script moved while it is in a gap, on a row with no connected place, or with no schedule at all (a runtime character) is held, and `held` must read true. Q223 made it read false there. `action` still reads empty in those cases. `held` reads false for a follower, a waiting entity, a Generic entity, the played entity and the persona. (Ticket 32 fixes it.)
- **Q229** A player who plays as a Playable or Persona-Only entity can start at the place of each of that entity's Starts, not at every place its routine uses. The Routine tab hint already says so; the New Game list read the derived locations and offered row places too. User ruling of 2026-11-11, on evidence from ticket 32. Ticket 32 writes the docs for Starts only; ticket 33 fixes the list. The list keeps world order, as today; Start order sets only the preselected place.
- **Q230** The met-by-start rule follows Q229: the player has met an entity whose Known In picks cover a place where the played persona can start, which is the place of each of its Starts, not every place its routine uses. A Start at Player's Starting Location stands for the world's starting locations, by the engine's rule (Q191: with none flagged, every location). The New Game start list is not changed by this; what it offers in a world with no flagged start is a finding of ticket 34 for the user. Ticket 33 left this reader; ticket 34 fixes it.
- **Q231** `action` and `held` read the minute their placement belongs to. In an After the AI script that is the minute the turn began, because `location` there is the place before the end-of-turn placement. It is the end-of-turn minute only in the two cases of Q226, where the placement is the end-of-turn one. Close review of 2026-11-11; this is what Q225 meant. (Ticket 35.)
- **Q232** An After the AI script reads the entity writes of Before the AI scripts and Tool calls of the same turn as applied, because it reads the Inventory pass's placement (Q226). The code stands; the Scripts Reference said the opposite and follows. Traced by the close review, reproduced by ticket 35.
- **Q233** The close review of 2026-11-11 found three gaps and four thin tests in tickets 26 to 34. The user chose one ticket, 35, before the close. Two small gaps were fixed at once: the "location has no entities" rule uses the engine's starting-location rule (Q191), and two stale test strings.
- **Q234** Correction to Q226 and Q231, on a mounted-game probe by ticket 35. The Inventory pass's placement is the end-of-turn placement in every turn where the player has a location, moved or not, not only in the two cases Q226 named. So an After the AI script reads every entity placed for the end of the turn, with the pulls and with the entity writes of Before the AI scripts and Tool calls applied (Q218, Q232 stand). `action` and `held` already read that same minute. The one split is a turn with no current location: the placement is then the turn-start one, and `action` and `held` read the turn-start minute there. An After script's own entity writes, and a `clock.advance` it calls, apply when the turn ends; a re-roll reads that. The Scripts Reference drops the two-case exception and states this.
- **Q235** The sample world (the cast a Tool is tried against with no world open) gets a kind and Starts, authored in place, each entity at the place it has today. It was the one production world still in the pre-effort shape, so the sample Tool snapshot of Q210 placed nobody. (Ticket 35.)
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

### Groups and old worlds

62. As an author, I want a Group to have a Start in each place it begins, so that an enemy type can be met in several places at once.
63. As an author, I want each Start of a Group to have its own routine, so that the wolves leave the forest for the road at night while the ones in the hills stay.
64. As an author, I want to switch a character between Group and Individual without losing its Starts and rows, so that a wrong kind costs one click.
65. As an author, I want the Routine tab to hide chance, Strict and Traversable for a Group, so that I only see settings that do something.
66. As an author, I want the canvas to mark where a Group's other Starts are, so that I see the whole Group while I edit one routine.
67. As an author, I want to add a Group to a location from the location editor, so that placing an enemy type stays quick.
68. As an author, I want to pick Player's Starting Location as a Start's place, so that a companion begins beside the player in a world with several starting locations.
69. As an author, I want a companion to begin Following, so that a party member travels with the player from the first turn.
70. As an author of an old world, I want a named person with a home and a workplace to become one Individual, so that nobody is labeled a group of people.
71. As an author of an old world, I want an enemy listed in several places to stay in all of them, so that random encounters play as before.
72. As an author of an old world, I want a companion I listed at every location to keep traveling with the player, so that my party still works.
73. As a player, I want a Group that is here twice to show once, so that the scene list stays readable.
74. As a player of an old world, I want to read what changed for characters with several locations, so that I understand why someone is not always where I look.

### Connections tab and Known In

75. As an author, I want a location's Connections on their own tab, so that the Presence tab is only about who is there.
76. As an author, I want every Connection row closed when I open the tab, so that I can read a long list.
77. As an author, I want a closed row to show the direction, the other location and the distance, so that I can scan the list without opening anything.
78. As an author, I want both Nearby and Far drawn as a line and a word, so that I can tell them apart at a glance.
79. As an author, I want one click to open a row, so that I can edit it in place.
80. As an author, I want a new Connection to open when I add it, so that I can set it up at once.
81. As an author, I want to close or open all rows with one button, so that I can reset a long list.
82. As an author, I want labels on Travel and Distance, so that I know what each switch sets.
83. As an author, I want a full explanation of Nearby and Far behind an info button, so that I can decide without guessing.
84. As an author, I want the Distance switch to be smaller than the Travel switch, so that the row is not two equal bars.
85. As an author, I want the link button to sit beside the two hint boxes only, so that it reads as joining them.
86. As an author, I want to see the free links of a location, so that I know every way out of it.
87. As an author, I want to turn a free link into a Connection with one click, so that I can make it one-way or Far.
88. As an author, I want the free links folded by default, so that a location with many siblings stays short.
89. As an author, I want the same Connection controls on the full-screen canvas, so that I learn them once.
90. As an author, I want the search to take me to a Travel Hint on the Connections tab, so that Find still works.
91. As an author, I want the Known In hint to say "nearby", so that it matches what the game does.
92. As an author, I want the canvas to show where a Nearby entity can be known, so that Nearby is not an empty view.
93. As an author, I want a Far link to draw as cut off in that view, so that I see why the entity is not known across it.
94. As a new author, I want the tour's Connection step to open the Connections tab, so that the tour still points at the right place.

## Implementation Decisions

### World shape: entities

- An entity gains a Group / Individual kind. It replaces `presence`. The persona, the played entity and an entity with no locations have no kind; they stay outside positions as today.
- `movement` is removed.
- Both kinds hold Starts, rows and Traversable in one shape (Q130). A Group ignores weight, Strict and Traversable, and the editor hides them (Q134, Q136, Q137); the data keeps them for a kind switch (Q135).
- An entity with a kind gains:
  - **Starts:** an ordered list. Each has an id, a place, a weight (positive integer, default 1) and a schedule. The place is a location id or the Player's Starting Location value (Q147). A Start at Player's Starting Location can carry Begins Following (Q148).
  - **Schedule rows:** an ordered list per Start. Each row has an id, a time (All day, or start and end in minutes from midnight; a range may wrap past midnight), a Strict flag, and one action:
    - Stay: one place.
    - Wander: weighted places (place plus weight) and one idle duration.
    - Patrol: ordered stops, each a place plus an idle duration.
  - **Traversable:** Anywhere, or a list of exact place ids. An empty list means schedule places only.
- An entity's `locations` stays its membership list (ADR 0003), so its readers keep working: roster indexes, the location-first roster editor, canvas picking and Known In "Nearby". The persona start and the met-by-start rule read the Starts instead (Q229, Q230). For both kinds it is derived: every Start place and every row place. Player's Starting Location adds no place to it. The editor and the load normalizer rewrite it; nothing else writes it.
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
| No presence, listed at every location | Individual, one Start at Player's Starting Location, Traversable = Anywhere, Begins Following (Q144) |
| No presence, several locations, in a world where no entity has pronouns or the persona flag | Individual, one Start at the first listed location, an all-day Wander over the list, idle one daypart, Traversable = the list (Q143, Q151) |
| No presence, several locations, with pronouns or the persona flag | The same wandering Individual (Q143) |
| No presence, several locations, with neither, in a world that uses them | Group, one Start per location, no rows (Q146, Q133) |
| No presence, one location | Individual, one Start at that place |
| `presence: random` | Individual, one weight-1 Start per listed place (Q57) |
| Free, Stays Put | Empty schedules |
| Moves Between | Each Start gets an all-day Wander over the listed places, idle one daypart (Q58) |
| Can Follow | Traversable = Anywhere (Q55) |
| Free, Stays Put, Moves Between | Traversable = empty list (Q55) |
| Any Connection | Nearby (no field) |

The rows are checked top to bottom, and the Traversable rows from `movement` do not apply to the first four. The rule was checked against four released community worlds: Realms of Arcadia (19 companions wander, the Mimic is a Group, 2 party members follow), Beyond the Mists (15 people wander, 5 enemy types are Groups, 1 companion follows), Praetoria Academy and Monster Girl Brothel Remake (no pronouns in the world, so all wander). A world file that already carries the unreleased Group form does not migrate again.

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
- **Groups:** every Start of a Group runs as its own presence, with its own row resolution, Wander picks and Patrol stop. No follow state, hold or pull applies. A Group is at a place when any presence is there (Q131).
- **Player's Starting Location:** resolved once at game start to the place where the player begins, for both kinds. A Start with Begins Following starts in the Following state (Q148).
- **Runtime characters:** one Start at their discovery place, empty schedule, Traversable = Anywhere (Q56).
- **Scripts:** `.follow()` makes any Individual follow, ignoring Strict and Traversable (Q64); on a Group it does nothing. `.unfollow()` is Part ways. `.move()` sets a hold and ends a wait. The script entity entry exposes a read-only waiting state, and the four reads of Q211 and Q221.

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

A Group saves one record per Start id: the position, the current idle's end, the patrol stop index and the current row id. A Start added to the world after the save begins at its place. A record whose Start is gone is dropped.

### Connections tab (Q173–Q189)

- The location panel's tab list gains Connections after Presence. The dev-router ledger, the tab-for-field lookup (a Travel Hint field now maps to Connections) and the Authoring Tour's Connection step follow the list.
- The Presence tab loses the Connections block. Nothing else on it moved in this effort; Presence Rows changed the rest later (Q207).
- One Connection widget serves both surfaces (Q183). Its body is Travel, Distance and the hint pair (Q179). The tab wraps it in a fold with the header of Q177; the canvas panel shows the body under its own title bar.
- The widget keeps taking a Connection and handing back a rewritten Connection. The tab writes through the editor's Connection update; the canvas keeps its intents. No new write path.
- Fold state is view state, held while the tab is mounted. It starts empty (all closed); adding a Connection opens that row (Q184). It does not use the open-below-three rule of the shared card-collapse hook.
- The free links come from the location graph: the implicit neighbors of the location, minus the pairs a Connection already covers. "Make Connection" creates the default Connection for the pair (two-way, Nearby) and opens it.
- The "Connect to" picker stays under the list. It keeps offering the locations that have no Connection with this one.
- The distance mark is one small component used by the row header and by both choices of the Distance control (Q185). It draws from the current text color, so it follows the theme.
- The hint pair's link button gets a top offset equal to the first label and its gap (Q187). The change is in the shared hint pair, so the canvas panel gets it too.
- No world or save shape change.

### Known In on the canvas (Q174, Q180, Q181)

- No engine or prompt change: the nearby roster already reads the entity's current place and the Nearby links.
- The Known In view of the canvas, with Known In set to Nearby, computes: the places the entity's routine uses (every Start place and every row place; Player's Starting Location resolves to the starting locations), and for each the places one Nearby link away. Routine places draw the full mark, their Nearby neighbors the lighter mark. A Far link out of a routine place draws in the Far style.
- The canvas key lists the two marks while that view shows them (Q128).
- Nowhere and Picked Locations draw as today.

## Testing Decisions

A good test drives a public seam with realistic input and asserts the outcome a player or author sees: where a character stands, who is in the scene, which ops land. Never assert on helpers or call order. Each guard is proven by reinstating the bug.

- **Position engine** (new seam): fixture worlds and clocks. Covers the weighted Start roll with a seeded source, row precedence, gaps at the Start, Wander picks and idle, Patrol order, loop and resume, no moves at the player's location, off-row correction, pull and script holds, the wait cap, timeout, Part ways, blocked followers, Strict on new and running follows, skipped unreachable places, and runtime characters. Prior art: the follower state tests beside the follower module.
- **Reach** (part of the position engine seam, or the location graph's own tests): connected through Far links, Nearby one hop only, implicit pairs Nearby, a Far Connection out of reach. Prior art: the location graph and neighbor tests.
- **Turn pipeline** (existing seam, ADR 0001): recorded AI replies through plan and run, then the entity-move commit. Covers the pull rule (the playtest's inn case; the window case; a mention across a Far link; a Strict character next door), the reworked location request with both reply forms, and pulls refused into places that aren't allowed. Start and load placement are tested through the load-time position reconciler. Prior art: the turn pipeline parity and turn-read tests, and the multi-hop move tests.
- **Migration** (existing seam): `migrateWorld` maps each row of the migration table and is idempotent. Fixtures copy the shapes of the four checked worlds with neutral names: a person with a home and a workplace, an enemy in two places, a companion at every location, and a world with no pronouns. One more case covers a small world where a person is listed at all of its few locations. Prior art: the existing migration tests.
- **Groups** (position engine seam): two Starts move on their own rows, two presences in one place count once, a Group is never pulled and never follows, a kind switch keeps the Starts, a Start at Player's Starting Location resolves at game start, and Begins Following starts the follow.
- **UI:** the Start and schedule editor, the swap, the weight chips and the distance control get component tests plus `verify-ui` on a dev route.
- **Connections tab** (component tests on the location panel, the existing seam of the Connections tests): every row starts closed with one and with five Connections; a closed row names the direction, the place and the distance; opening shows Travel, Distance and the hints; each control rewrites the record; a new Connection opens; Collapse All works; a free link lists only while no Connection covers its pair, and its button creates a two-way Nearby Connection; a Travel Hint search lands on the Connections tab. The canvas panel test checks that it shows the same three fields. `verify-ui` covers both themes for the distance mark. Prior art: the location Connections tests and the hint pair's design-system reference.
- **Known In canvas view** (the canvas mark model's tests): Nearby marks routine places and their Nearby neighbors, leaves a Far neighbor unmarked, and the key lists what is drawn. Prior art: the canvas key and entity picking tests.
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
- A wider Known In reach ("near any place of the routine", Q174).
- A filter box, drag to reorder, or grouping for the Connections list.
- Placeholder chips and the link rule of the Travel Hints: unchanged.

## Further Notes

- **Export shape:** the world `.json` loses `movement`, `presence` and a location's `nearbyUsesConnections` (Q82), and gains kind, Starts, schedules, Traversable and Connection distance, through a migration. The save `.json` gains the position engine's state. `movement` and `presence` shipped in v3.4.0. The Group rulings add, still unreleased: Starts on a Group (its stored place list becomes derived), the Player's Starting Location value for a Start's place, Begins Following on a Start, and one saved position record per Start of a Group.
- This is the range feature ADR 0003 anticipated. `locations` stays the membership list and is derived for Individuals.
- Labels in this spec (Group, Individual, Start, Stay, Wander, Patrol, Strict, Traversable, Nearby, Far, Part ways, All day) are working names. Final copy follows the Writing Guide in the tickets.
- **New visual patterns need approval:** the weight chips outside the placeholder editor if they need a new variant. The Far link's look was approved on 2026-11-09 with ticket 01: a dotted line, with "Far ·" ahead of the hint.
- **Other consumers to update:** the Test Bench (time-aware placement), the canvas picker's range warning (it only made sense for Moves Between), the Presence and Movement copy and pick card, the dev fixtures, the bundled worlds, the world format doc, the wiki pages on locations and the glossary, and the help vectors (`build:help-vectors`).
- **Ticket order:** Connection distance (01) and the pure position engine (02) start side by side. `movement` has about 15 readers, so the world shape, migration and reader swap land as one ticket (03) on top of the engine. The editor chain (04 → 05 → 06 → 07), the pull rule (08), the request rework (09), the movement tag (10) and the location Presence tab (11) follow.
- **Request count:** every non-Strict Individual at the player's location now gets a request each turn. The batching probe also measures that count.
- **Prototype:** the question was "what should the schedule editor look like". Verdict: D2 (Q65–Q70). Branch `prototype/npc-schedules` at `4408ec845` holds every variant (A, B, C1–C4, D1–D3), the Nearby/Far toggle, and the canvas routine view with map editing (Q71–Q80). Run it from its worktree with `npm run dev -- --port 5310`, then open an entity's Routine tab, or pick an entity on the full-screen canvas.
- **Connection row prototype:** the question was "what does a Connection row look like, closed and open". Verdict: the box row with a read-only distance mark and a two-thirds Distance control (Q177, Q179, Q184–Q188); the switcher calls it B4. Branch `prototype/connection-rows` at `7743793dd` holds it with the rejected designs of Q189 (S2, S, X, M, C in the switcher; A to H and B1 to B3 in the history). Run it from its worktree with the `proto-connection-rows` launch entry (port 5312), open a world, select a location and open its Connections tab. Edits there stay in local state and the list is padded with sample Connections. The full-screen canvas panel is not built in the prototype.
- **Connection row findings to keep:** the World Editor is a modal dialog and sets `pointer-events: none` on the body, so anything portaled to the body is dead unless it turns pointer events back on. That killed a popover menu on the distance mark. The Distance ⓘ text in the prototype is a placeholder (Q186).
- **Prototype findings to keep:** a tooltip that appears on a canvas connect grip at runtime remounts the grip and the canvas loses its measured position, so the drag never starts. The old picker's rule that draws canvas lines at 25% must not apply in Routine mode. Movement lines run straight between places; they do not follow the Connections the entity would walk.
