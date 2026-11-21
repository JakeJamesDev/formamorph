# Spec: Weather

Status: ready-for-agent
Spec session: weather — spec

## Problem Statement

A world's weather exists only in the narration. When the story says a storm rolls in, nothing on screen changes, and two turns later the narrator may forget the rain. Authors cannot say what weather a world has, what weather a story starts in, or which places are indoors. A story also cannot start at a chosen time of day: the game guesses the hour from page one, and an Opening Action that the AI writes from gets whatever time the model picks.

## Solution

A world can turn on **Weather**. It then has one **World Weather** at a time: Clear, Rain, Snow, Storm or Bright Sun. The author picks which kinds the world allows. A new **Weather Pass** reads each turn's narration and changes the World Weather when the story does, limited to the allowed kinds. Scripts can read and set it, and a new **Weather Condition** lets traits and image Visibility rules react to it. The narrator is told the weather every turn.

The player sees weather in two ways, each with its own switch:

- **Weather Background** draws the current weather all the time, over the location art and under the panels. A **Sheltered** location hides it.
- **Weather Foreground** plays a short full-screen effect when the weather the player experiences changes, such as a sunbeam sweep or rain droplets hitting the glass, then stops.

Openings gain an optional **Weather** and **Time** (a daypart). The world gains an optional **Default Weather** and **Default Time**, which the shipped default opening uses. An authored value wins over the page-one read, for weather and time alike.

## Rulings

Settled in the grill, 2026-11-21. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | The narration drives weather changes, limited to the author's allowed kinds. |
| Q2 | Weather is a world opt-in. Off for worlds that never turn it on. |
| Q3 | First version kinds: Rain, Snow, Storm, Bright Sun, plus Clear. |
| Q4 | Foreground fires on any change the player experiences, moving into different weather included. It never fires on load. |
| Q5 | One World Weather for the whole world. |
| Q6 | Locations get a Sheltered flag. It hides the background while the World Weather keeps running. Stepping out of shelter into weather fires the foreground. |
| Q7 | The first detector is an AI turn pass. A trained classifier is a later follow-up once a gold set exists. |
| Q8 | Both switches default on. OS reduced motion turns foreground off and background into a slow, calm version. |
| Q9 | Background is an engine overlay over the location art and under the panels, not a Layered Images layer. |
| Q10 | The narrator gets the current weather in the scene context. |
| Q11 | The Weather Pass runs whenever the world opts in, whatever the player's switches. |
| Q12 | Scripts read and set the World Weather. A script set is a change and can fire foreground. |
| Q13 | The allowed list is one world-level pick from the four kinds. Clear is always allowed. |
| Q14 | (Amended by Q25.) The author can pick the starting weather. |
| Q15 | Bright Sun shows only in daylight. The pass never picks it at night, and it turns into Clear at nightfall with no foreground. |
| Q16 | A new foreground effect replaces one that is still playing. |
| Q17 | No weather sound in v1. |
| Q18 | One intensity per kind. |
| Q19 | Closed: the story clock runs with AI Clock off, so Q15 always applies. |
| Q20 | Background still shows with Location Background off, over the plain theme color. |
| Q21 | Default Weather and Default Time are world fields. The shipped default opening stays a code constant and reads them. |
| Q22 | An authored time is a daypart, stored as that daypart's start hour. |
| Q23 | An authored time skips the opening-time pass. |
| Q24 | Weather follows the clock rule: an authored weather skips the page-one read; an unset one lets the Weather Pass read page one. |
| Q25 | Default Weather and Default Time are both optional. Unset means "read page one", falling back to Clear and the shipped default start hour. |
| Q26 | One spec. Time on Openings is the first ticket and ships without any weather code. |
| Q27 | A Weather Condition ships in this spec, beside the Time Condition. |
| Q28 | Each stored turn records its World Weather. A past page shows its own weather and its own location's Sheltered flag. |
| Q29 | The Background Fade dims the weather along with the location art. |
| Q30 | Script weather words are camelCase: `"clear"`, `"rain"`, `"snow"`, `"storm"`, `"brightSun"`. camelCase is the standard for every script-facing value. |
| Q31 | A Condition checked at the start of a story reads the resolved start weather and time (Opening, then the world defaults). The library entity editor and Enter World read the world defaults, as the World Editor does. Ticket 08. |

## User Stories

**Authoring**

1. As a world author, I want to turn Weather on for my world, so that worlds without weather (a space station, an Open Chat) never show it.
2. As a world author, I want to pick which weather kinds my world allows, so that a desert world never snows.
3. As a world author, I want Clear always allowed, so that the weather can always settle back to nothing.
4. As a world author, I want to mark a location Sheltered, so that rain never falls inside a tavern.
5. As a world author, I want the World Weather to keep running while the player is Sheltered, so that stepping outside shows the storm that was going on.
6. As a world author, I want to set a Default Weather for my world, so that every start without its own weather opens in it.
7. As a world author, I want to leave Default Weather unset, so that the game reads the starting weather from page one.
8. As a world author, I want to set a Default Time for my world, so that the shipped default opening starts at the daypart I choose.
9. As a world author, I want to leave Default Time unset, so that the game reads the hour from page one as it does today.
10. As a world author, I want to give an Opening its own Weather, so that a storm opening starts in a storm.
11. As a world author, I want to give an Opening its own Time, so that a midnight ritual opening starts at night.
12. As a world author, I want an Opening with no Weather or Time to use the world defaults, so that I set them once.
13. As a world author, I want to pick time as a daypart, so that it matches the dayparts my image Visibility rules already use.
14. As a world author, I want the editor to stop me from giving an Opening a weather kind my world does not allow, so that a start can never break my own list.
15. As a world author, I want the Test Bench to flag a Default Weather or Opening Weather outside the allowed list, so that a later change to the list does not leave a broken start.
16. As a world author, I want entity Openings (Others and Self) to carry Weather and Time too, so that a persona's own start can set the scene.
17. As a world author, I want a Weather Condition in Requirement Rows, so that a location image can show rain art while it rains.
18. As a world author, I want a Weather Condition on traits, so that a trait can switch on during a storm.
19. As a world author, I want scripts to read the World Weather, so that a quest can react to snow.
20. As a world author, I want scripts to set the World Weather, so that a ritual can call a storm.
21. As a world author, I want a script that names a kind my world does not allow to stop with an error that names it, so that I find the typo.
22. As a world author, I want the Weather Pass to never pick a kind outside my list, so that a metaphor in the narration cannot bring snow to my desert.

**Playing**

23. As a player, I want to see rain falling behind the panels while it rains, so that the place feels alive.
24. As a player, I want a short full-screen effect when the weather changes, so that the change feels like a moment.
25. As a player, I want the foreground effect to stop on its own, so that it never covers the text for long.
26. As a player, I want the foreground effect never to block my clicks or typing, so that it never gets in my way.
27. As a player, I want stepping out of a Sheltered location into rain to play the rain effect, so that walking outside feels like walking outside.
28. As a player, I want stepping into a Sheltered location to stop the background quietly, so that going indoors feels calm.
29. As a player, I want loading a save to show only the background, so that I am not hit by an effect every time I load.
30. As a player, I want a new game to start with no foreground effect, so that the start feels calm.
31. As a player, I want a new effect to replace one still playing, so that the screen always matches the current weather.
32. As a player, I want Bright Sun to turn into Clear at nightfall with no effect, so that I never see sunbeams at midnight.
33. As a player, I want a switch for Weather Background, so that I can turn the ambient effect off.
34. As a player, I want a separate switch for Weather Foreground, so that I can keep one and drop the other.
35. As a player with reduced motion set in my OS, I want no full-screen effects and only a slow, calm background, so that the game is comfortable for me.
36. As a player sensitive to flashes, I want Storm lightning to stay under three flashes per second, so that it is safe to watch.
37. As a player, I want the background to keep showing with Location Background off, so that the weather switch alone decides it.
38. As a player, I want the background to show when I use Hide UI on desktop, so that I can watch the scene with its weather.
39. As a player, I want the narration to stay consistent with the weather on screen, so that the story does not forget the rain.
40. As a player, I want an Opening Action with an authored time to produce a page one at that time of day, so that the start reads the way the author meant.
41. As a player, I want a page-one redraw to take the new opening's weather and time, so that the redraw is a real new start.
42. As a mobile player, I want weather to run smoothly and not drain my battery, so that I can keep it on.
43. As a player, I want my save to keep the current weather, so that a storm is still there when I load.

## Implementation Decisions

**Data model**

- The world gains a Weather block: an on switch, the allowed kinds (a subset of Rain, Snow, Storm, Bright Sun), an optional Default Weather (any allowed kind or Clear) and an optional Default Time (a daypart). Absent block = Weather off, Default Time unset.
- Default Time lives outside the Weather block's on switch. Time on Openings works in a world with Weather off (Q26).
- A location gains an optional Sheltered flag. Absent = not Sheltered.
- An Opening gains an optional Weather and an optional Time (a daypart). Absent = use the world default. Entity Openings, Self and Others, share the shape.
- The save gains the current World Weather. Absent on a save reads as Clear. No compat code for unreleased forms.
- A daypart maps to its start hour through the story clock's existing daypart table. The game stores that hour as the save's start hour, so the clock and every Time Condition read it unchanged.

**Start resolution (Time on Openings, first ticket)**

- New Game resolves the start time as: the drawn Opening's Time → the world's Default Time → the opening-time pass reading page one → the shipped default start hour.
- When an Opening or the world sets a time, the opening-time pass is left out of the opening turn's plan (Q23), and the start hour is set before page one is written, so the narrator's clock line carries it.
- The shipped default opening reads Default Time and Default Weather (Q21).
- A page-one redraw resolves time and weather again from the newly drawn Opening. With nothing authored on it, the redraw reruns the opening-time pass as a first draw would, even when the first draw had an authored time.
- An authored time sets the start hour even with AI Clock off. Only the page-one pass fallback depends on AI Clock.
- Default Time lives on the world overview, beside the Openings. The Weather block stays separate.
- For an Opening Action, the start hour is set in the same New Game step that places the drawn Opening, so the first clock line carries it.

**Start resolution (weather)**

- The same order: Opening Weather → Default Weather → the Weather Pass reading page one → Clear (Q24, Q25).
- An authored weather skips the page-one Weather Pass. An unset one runs it on the opening turn.
- Nothing at the start fires a foreground effect: New Game, the page-one read and a redraw (Q4).
- One pure start resolver serves New Game and the redraw and returns the start hour and the start weather. An unset weather comes back as unset, not Clear, so the Weather Pass can plan the page-one read. Until that read exists, unset saves as Clear.
- With the Weather block off, the start weather is Clear, whatever an Opening or Default Weather still stores.

**Placement and the helper**

- The Weather block lives on the world overview, beside Default Time.
- Sheltered does not inherit down the location tree. Each location carries its own flag.
- The background reads the shown page: its turn's weather, its location's Sheltered flag and its game time for daylight (Q28). Each turn's history snapshot is a full game state that already carries the World Weather (absent = Clear), so no new field or save shape is needed. Paging never fires foreground.
- The weather canvas sits under the Background Fade (Q29).
- Daylight is every daypart except night. One `isDaylight` helper, built by ticket 04, answers it for the weather view and the Weather Pass.
- The weather view draws nothing for Bright Sun outside daylight, whatever the World Weather holds.
- Calm mode draws fewer, slower particles. Storm in calm mode drops the flashes and shows calm rain only.
- The player switches sit in a Weather group in the Display settings section, beside Location Background.
- Background colors follow the theme: light streaks over location art, the theme foreground color over a plain background.
- One experienced-weather helper takes the World Weather and the current location and returns a kind, or none in a Sheltered location. The save stores Clear as an absent field.

**Weather Pass**

- A new turn pass in the Turn Pipeline, beside the clock pass. It runs every turn while the world's Weather is on (Q11).
- Input: the turn's narration, the current World Weather, the allowed kinds, and whether it is daylight. Bright Sun is not offered at night (Q15).
- Output: structured, like the clock reading: either "no change" or one kind from the offered set. A text fallback parses the same answer. An answer outside the offered set reads as no change.
- It pins its own temperature and penalties in the per-prompt samplers and sends Native Reasoning per its prompt setting.
- The prompt follows the prompt-writing guide: a positive contract, no example values. It names the traps: metaphor, past or reported weather, and weather a character only talks about.
- Prompt changes ship with probe numbers (Q10 and this pass).

**Turn Commit and Turn Landing**

- The Turn Commit carries the turn's resulting World Weather. Order inside the commit: the Weather Pass answer, then the nightfall rule (Bright Sun → Clear when the turn's time ends at night), then script sets, then the Weather Condition reads.
- The Turn Landing applies the weather through its effects port and reports a **Weather Change** when the weather the player experiences changes. The experienced weather is the World Weather, or none in a Sheltered location.
- A Weather Change fires foreground when the new experienced weather is a non-Clear kind, the turn is not the opening turn, and the change is not the nightfall rule. Moving into Shelter, and Clear as the new weather, fire nothing.
- The stat re-roll mode does not fire a Weather Change. It is a named skip in the landing, per ADR 0019.
- The Turn Landing module does not exist yet. One pure Weather Change helper (before, after, opening turn, nightfall → change or none) serves the view's inline landing today and moves into the landing's port when that module lands.
- Q4 covers every location change, not only one inside a turn landing. A Go after the landing and Map travel also call the Weather Change helper.
- The Weather Pass knows only the turn's start time, so it reads daylight at the turn's start. On the opening turn with the hour unread, Bright Sun is offered, and the nightfall rule corrects it at the turn's end.
- The nightfall rule applies whenever the final weather is Bright Sun and the turn ends outside daylight, whatever made it Bright Sun.
- Whether the opening turn runs the Weather Pass comes from a flag set by the start resolver. It is not saved.

**Prompt surface**

- The Weather Pass is a full preset prompt like the clock pass: system and user prompts in the preset, a Weather entry in the Prompts settings, its own request type, per-prompt Native Reasoning and pinned samplers.
- The narrator line is a weather chip in the default narration system prompt, right after the Current Location block. The Now line rides only the recap reply while a digest band exists, so it cannot carry the weather every turn. The chip is empty while Weather is off, and empty on an opening turn whose weather is unset. A player's own edited system prompt does not gain it.

**Narrator context**

- The scene context gets one weather line while Weather is on: the World Weather, and whether the player is Sheltered.
- Page one gets the resolved time and weather, so an Opening Action's page one matches them.

**Weather Condition**

- A new Condition kind beside the Time Condition: it holds while the World Weather is one of a chosen set of kinds (Clear included).
- It mirrors the Time Condition's shape: no owner, no Not. It reads the World Weather, not the experienced weather, so a window image can show rain while the player is Sheltered.
- The game reads it once per turn commit, after the Weather Pass and the nightfall rule. Outside play it reads Default Weather, or Clear when that is unset.
- Traits and image Visibility rules share it, as they share the Time Condition. Its text and picker follow the Time Condition's.

**Scripts**

- The script surface gains a world-level weather member: read the World Weather; set it to Clear or an allowed kind.
- A set lands at commit through the existing write path, saves with the turn and undoes with it. A kind outside the allowed list, or Weather off, stops the script with an error that names it.
- This widens the script sandbox's exposure on purpose (Q12).

**Rendering**

- One pure **weather view** function decides what shows. Input: World Weather, the current location's Sheltered flag, daylight, both player switches, OS reduced motion, and the previous experienced weather. Output: the background kind and mode (full, calm or none), and an optional foreground effect.
- **Background** is one overlay element between the location backdrop and the panels, on its own compositor layer, ignoring pointer input. It draws with a 2D canvas, not three.js. It stops drawing when it shows nothing or the page is hidden.
- **Foreground** is one full-screen layer above the game view, ignoring pointer input, never over open dialogs. Each kind has one effect that plays for a few seconds. A new one replaces a playing one (Q16).
- Storm's flash holds under three flashes per second in every mode.
- Performance: measure on a mobile-width realistic device profile. The particle count scales down on small screens.

**Settings**

- Two player switches, Weather Background and Weather Foreground, both on by default (Q8). Defaults live with the other settings defaults.
- OS reduced motion is read through the existing reduced-motion hook. There is no in-app reduced-motion switch.

**Editor**

- World Editor: a Weather section with the on switch, the allowed kinds, Default Weather and Default Time. Default Time stays available with Weather off.
- Location editor: the Sheltered flag, shown while Weather is on.
- Openings editor: optional Weather and Time per row. Weather lists only the allowed kinds and is hidden while Weather is off.
- Test Bench findings: an Opening Weather or Default Weather outside the allowed list; a Weather Condition naming a kind outside it.
- Every new screen and modal gets a dev-route entry, and a dev hook can set the World Weather and fire a foreground effect.

## Testing Decisions

- Good tests check behavior at a module's public face. They call it with a small world and read the result. They never assert internal structure or mirror the code.
- **Seam 1, the Turn Pipeline:** the request adapter. A fake Weather Pass answer must come out of the Turn Commit as the new World Weather, and the landing must report the Weather Change. Cases: no change, each kind, an answer outside the allowed list, Bright Sun at night, nightfall from Bright Sun, a script set, a move into and out of Shelter, the opening turn, and the stat re-roll skip. Prior art: the turn pass, Turn Commit and Turn Landing tests, and the clock reading tests.
- **Seam 2, New Game start resolution:** Opening → world default → page-one read → fallback, for time and weather. The opening-time pass and the page-one Weather Pass must be absent from the plan when a value is authored, and present when not. A redraw resolves again. Prior art: the New Game opening tests and the plan tests.
- **Seam 3, the weather view:** the pure function, one case per row of its decision: Sheltered, each switch, reduced motion, load versus change, and Clear. The renderer is checked with the verify-ui skill on dev routes. Motion and flash-rate claims use Playwright per-frame sampling.
- **Seam 4, scripts:** the existing script-runner tests. They cover weather reads, allowed sets, the error for a kind outside the list or Weather off, and undo. Prior art: the story clock member tests.
- The Weather Condition rides the existing Condition and image Visibility rule tests, beside the Time Condition cases.
- Each guard is proved to bite by reinstating its bug.

## Out of Scope

- Weather sound and ambience mixing (Q17).
- Intensity levels such as light rain and downpour (Q18).
- Per-location or per-region weather (Q5), and per-location allowed lists (Q13).
- The trained weather classifier (Q7). The Weather Pass outputs feed its future gold set.
- Fog, wind, seasons, forecasts and weather on the Map.
- An editable default opening row (Q21).
- An exact hour on Openings (Q22).
- An in-app reduced-motion switch.

## Further Notes

- ⚠️ **Export shape:** the world file (Weather block, Default Time, Sheltered on locations, Weather and Time on Openings), library entities and character cards that carry Openings, and the save file (current World Weather, which each turn's history snapshot carries too) all change.
- Ticket 1 is Time on Openings with Default Time. It needs no weather code (Q26).
- Glossary candidates for `CONTEXT.md`: World Weather, Weather Kind, Sheltered, Weather Pass, Weather Change, Weather Background, Weather Foreground, Weather Condition, Default Weather, Default Time.
- Spec-session calls, not grill rulings, each reopened by the user's word: the Weather Condition copies the Time Condition's no-owner, no-Not shape and reads the World Weather, not the experienced weather; Clear has no foreground effect; the stat re-roll fires no Weather Change; Sheltered shows only while Weather is on.
- Copy for the editor, Settings and the Test Bench follows the Writing Guide, written from a facts list in the user's words.
