/**
 * Registry for the in-app help pop-outs (`HelpButton`). One topic per surface that needs explaining —
 * what it does and why it exists — kept out of the components so the copy is editable in one place and
 * the mechanism stays generic. Topic ids are namespaced by surface (`worldEditor.dictionary`) so other
 * screens can register their own without collision.
 *
 * Copy rules: written for an author who has never opened the tab. Lead with what it is, then why it
 * exists, then the controls that aren't self-evident from the UI. Only claim what the code actually
 * does — placement inside the prompt is author-editable, so don't promise an order the chips don't fix.
 */

const WIKI_BASE = 'https://github.com/JakeJamesDev/formamorph/wiki';

/** A wiki page's URL, e.g. `Connect-Your-Own-AI`. */
export function wikiPageUrl(page: string): string {
  return `${WIKI_BASE}/${page}`;
}

export interface HelpTopic {
  /** Dialog title. */
  title: string;
  /** Markdown body. Give a topic either this or `tabs`, not both. */
  body?: string;
  /** Sectioned body: the dialog renders a tab bar with one markdown panel per section. Each tab must
   *  stand alone — users land on the first and may never click the others, so it gets the essentials.
   *  `mobileBody` swaps in on narrow viewports for copy naming platform gestures (show one, not both). */
  tabs?: { label: string; body: string; mobileBody?: string }[];
  /** Wiki page this topic documents, e.g. `WorldEditor` or `Entities`. Stated on every topic rather
   *  than defaulted: a wrong default silently sends a reader to the wrong page, and a missing one is a
   *  type error instead. Omit only while no page covers the topic yet. */
  wikiPage?: string;
  /** Anchor within `wikiPage`, appended after `#`. Omit to link the page itself. */
  wikiAnchor?: string;
}

/** Full "Learn more" target for a topic, or null when no wiki page covers it yet. */
export function helpWikiUrl(topic: HelpTopic): string | null {
  if (!topic.wikiPage) return null;
  return `${wikiPageUrl(topic.wikiPage)}${topic.wikiAnchor ? `#${topic.wikiAnchor}` : ''}`;
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  'game.howToPlay': {
    title: 'How to Play',
    tabs: [
      {
        label: 'Actions',
        body: `Type what your character does, in the first person: *I ask her where the road leads. I draw my knife. I hand him the coin and wait.*

**The suggested choices are only suggestions.** You can always type anything instead — the story responds to whatever you write.

**Speak in your own words.** When you talk to someone, say what your character says — *I tell her the truth about the fire* lands better than *I respond*.

**Success isn't guaranteed.** The narrator decides how your attempt goes, and your stats shape it — a drained character struggles where a strong one breezes through.

**Enter** sends your action; **Shift+Enter** starts a new line.`,
      },
      {
        label: 'Choices',
        body: `The choices under the story are ready-made actions: **click one to put it in the action box**, edit it if you like, then send.

**Ctrl+click** (Cmd+click on Mac) *adds* a choice to the box as an extra sentence instead of replacing what's there — stack two choices together, or add your own twist before sending.

And you never need them at all: type anything, the story answers. Prefer pure freeform play? The checkbox below turns choice generation off entirely.`,
        mobileBody: `The choices under the story are ready-made actions: **tap one to put it in the action box**, edit it if you like, then send.

**Press and hold** a choice to *add* it to the box as an extra sentence instead of replacing what's there — stack two choices together, or add your own twist before sending.

And you never need them at all: type anything, the story answers. Prefer pure freeform play? The checkbox below turns choice generation off entirely.`,
      },
      {
        label: 'Directing',
        body: `Square brackets in your action speak to the AI as the **author**, not your character. Everything outside the brackets is what your character does; everything inside is stage direction for how the turn should go.

*I climb on behind her. [She stops hesitating — she agrees, and they ride off.]*

Use it to steer an outcome, skip ahead, or hold a tone:

- *[Skip ahead — the scene picks up when we reach the harbor at dusk.]*
- *[Keep this scene light — nothing goes wrong tonight.]*

The direction itself never enters the story: your character doesn't say it, the prose won't quote it, and the story's memory records only what actually happened. Brackets direct *this turn* — for a standing fact the AI should always keep in mind, use your Notes instead.`,
      },
      {
        label: 'Memory & Notes',
        body: `The story remembers your most recent turns word-for-word. As it grows, older turns are carried as short memory notes instead — open the **Memory** tab in the side panel to see exactly what's kept, pin a memory to keep it for good, or let one go.

Memory notes need **Memory Summaries** (the checkbox below; on unless you've turned it off). Without it, the oldest turns simply drop off as the story outgrows its context.

**Notes travel with every turn.** Anything you write in the **Notes** tab is sent to the AI alongside each action, so standing facts belong there: who you're pretending to be, what you're carrying, the goal you're working toward.

The rule of thumb: **[brackets] direct this one turn; Notes persist until you change them.** If the story keeps forgetting something that matters, put it in Notes.`,
      },
    ],
  },
  'game.memoryManager': {
    title: 'Memories',
    body: `Everything the story remembers about what's already happened, and the place to change it.

As the story grows, older turns stop riding word-for-word and are carried as short memories instead. The story picks which ones are worth keeping — faded, struck-through lines are the ones it let go.

**What you can do to a memory**

| | |
|---|---|
| **Edit** | Rewrite it in your own words. An edited memory is always kept — you wrote it, so the story doesn't get to drop it. |
| **Rewrite** | Have the story summarize that turn again, in case the first attempt missed the point. |
| **Pin / forget** | Force a memory to stay, or let one go, without changing its words. |
| **Delete** | Remove it entirely. Nothing is really lost — switch the filter to **Deleted** to bring it back. |
| **Add Memory** | Write something the story should remember that never happened in a turn. Yours are always kept. |

**Nothing you do here is permanent.** The story's own version is always kept underneath, so **Revert** restores the original wording and **Reset All My Changes** puts everything back the way the story had it.

Memories under the **Recent** line are still fresh enough that the story has them word-for-word — your changes to them start mattering once they age out.

**Kept isn't the same as sent.** A memory the story keeps still has to earn its place each turn — with **Semantic Memory** on, only the handful most relevant to what you just did actually rides. Rows with a **left accent bar** reached the story last turn; plain rows are remembered but sat this one out; struck-through rows are the ones it let go. A memory sent back as a full scene is marked **Scene**. The filter chips sort by the form the story has a memory in: **Verbatim** (its real text — a recent turn, or one recalled as a scene), **Summary** (the compressed line, sent last turn), **Held** (remembered, but not sent this turn).

**When it happened.** With **Measured Clock** on, each memory carries its place in the story's time — *"Day 3, evening — two days ago"* — the same stamp the story itself reads. Without that setting every turn costs a flat hour whatever happened in it, so nothing is dated rather than dating it wrongly.`,
    wikiPage: 'Memory',
    wikiAnchor: 'when-each-memory-happened',
  },
  // Deliberately separate from `worldEditor.entities`: that copy is for an author choosing fields, this
  // is for a player mid-story wondering who a name in their scene list is.
  'game.entities': {
    title: 'Entities in Play',
    wikiPage: 'Entities',
    body: `Who the story counts as being here with you right now. The list changes as the scene does — people arrive, people leave. Your persona always heads the list, marked **(You)**.

Most of these are characters the world's author wrote. Some the story **invented on the spot**: ask a shopkeeper for directions and it may answer with a name nobody wrote down. Those are remembered from the moment they're named, so the story can keep them consistent and offer you things to do with them.

Someone merely *talked about* isn't added — only characters the story actually shows in the scene. A character who introduces themselves ("I'm Freya") counts as shown.

**When something isn't a person**

Names come out of the story's own prose, so once in a while it capitalizes a café or a street and that ends up here. Use the remove button beside the entry to take it out. The story stops picking that name up for the rest of this playthrough, and the prose itself is left exactly as written.

Only story-invented entries can be removed. The world's own cast belongs to the world — that's the World Editor's job, not yours mid-scene.

**Descriptions**

Settings → Output → Characters → **Describe New Characters** gives each invented character a written description you can open from here. Everything else on this list works whether that's on or off.`,
  },
  'worldEditor.locations': {
    title: 'Locations',
    wikiPage: 'World-Editor-Locations',
    body: `The places your story happens. The player is always in exactly one, and it decides what the AI is told about the scene: the description, who's there, and where the story might go next.

Locations keep the story in one place. Without a fixed place the narrator loses track of where the scene is. The tavern becomes a street, then a forest, and nothing stays put. A location is sent to the AI again every turn, so the scene stays where you put it.

**Nesting is the AI's map, not the player's.** The player can travel anywhere at any time. The in-game location list offers every location in your world, unfiltered.

Nesting decides where *the story* can take them. When the AI reads an action as movement, it only considers places connected to where they are: down into a sub-location, or up and sideways from one. It then offers the move, *Move to the Eelhouse?*, and the player takes it or dismisses it. Nest your places and the story starts proposing journeys through them. Leave them flat and travel only happens when the player asks for it.

**What the AI sees**

- The **AI-Facing Description** field is the full text the AI works from. The player never sees it, so it's where a secret belongs.
- The **AI-Facing Summary** field is a one-line version for slots where the full text is too long. The default prompt uses it for sub-locations and reachable places. Left blank, the full description is used instead.
- The **Player-Facing Description** field is what the player reads in the location panel. It's never sent to the AI, so whatever you write here, the player knows.
- The **Entities** list is who's here. It's the same list an entity's own Locations picker writes to, from the other end.

**Starting Location** marks where a new game can begin, and the checkbox does more than it looks:

- Tick none and the game starts at random, in *any* location in the world
- Tick one and every game starts there
- Tick several and the player chooses between them before starting

The background image, image tags and ambient sound are for the player's screen. The narrator never sees them.

**Simple mode hides** AI-Facing Summary, Ambient Sound and Image Tags. Switch the editor to Advanced to use them.

Write the AI-Facing Description first, since it's the one doing the work. Nest locations when you want the story to move the player on its own.`,
  },
  'worldEditor.entities': {
    title: 'Entities',
    wikiPage: 'World-Editor-Entities',
    body: `The people, creatures and things that populate your world: a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**, and the AI is handed the ones that could turn up wherever the player currently is.

Entities give the AI a cast it can't lose track of. Left to itself the narrator invents a stranger, gives them a name, and forgets both by the next turn. An entity is fixed and reusable, so the story can keep returning to it.

**What the AI sees.** An entity only reaches the AI when the player is somewhere it's assigned to. That assignment is the only condition.

- The **Name** field is always sent
- The **AI-Facing Description** field is the full description, and the main thing the AI knows. **The player never sees this field**, so it's where a secret belongs: who the ferryman really works for, what's behind the door. The default prompt does ask the narrator to hold a name back until the player would have learned it, but that's a request to the AI, not a guarantee.
- The **AI-Facing Summary** field is a one-line version for prompt slots where the full text is too long. The default prompt uses it for entities in reachable locations. Left blank, the full description is used instead.
- The **Player-Facing Description** field is what the player reads when they look at this entity. It's **never sent to the AI**, so it costs no context, and anything you write here, the player knows.
- The **Type** field is sent as a plain field

The **Locations** picker decides where the entity can appear. Assign it to as many as you like. An entity in no location never reaches the AI at all.

**The link lives on the location.** Assigning locations here writes the entity into each of those locations' lists, so **deleting a location quietly drops its entities from it**. They aren't deleted, but one that was only in that location now appears nowhere, and nothing warns you.

**Groups** are organizational. Nesting and order are editor-only and never reach the AI, so grouping never changes the story.

Image, Image Tags and the 3D model are for the player's screen and for image generation. The narrator never sees them.

**Simple mode hides** Aliases, AI-Facing Summary, Type, Image Tags and the 3D model, and adds entities without groups. Switch the editor to Advanced to use them.

Give a location the two or three entities the scene genuinely depends on. Everything at the player's location is sent every turn, so a crowded location costs context on every turn.`,
  },
  'worldEditor.aliases': {
    title: 'Aliases',
    body: `Other names an entity goes by: a nickname, a title, an epithet. "Rosalind" answers to "Roz", and to her title, "Warden". List as many as you like.

Aliases keep the story recognizing an entity even when it doesn't use the full name. Given only the name, the narrator writes "the Warden" and Rosalind is no longer detected in the scene. She drops off the cast, out of the choices, off the Entities tab. An alias closes that gap, and the AI is told the nickname too so it can use it naturally.

**What an alias does**

- **Detection.** When an alias appears in the narration, the entity counts as present that turn, exactly as if its name had appeared. This decides who shows in the Entities tab, who the choices consider, and which entities travel with the scene.
- **Told to the AI.** Aliases are sent alongside the name as *also known as*, so the narrator knows Rosalind and the Warden are one person and can use either

**How matching works**

- **Case-sensitive**, unlike the name. Write an alias with the capitalization it'll appear in. *Cat* matches *Cat*, not *cat*. This is deliberate: short nicknames would otherwise fire inside ordinary words (*Cat* inside *category*, *scatter*).
- **Whole words only**, and **plurals match**. An alias *Wolf* is found in *Wolves*.
- **Skip a leading "the"/"a".** Write *Gray One*, not *the Gray One*. An article inside the alias, matched case-sensitively, would miss *The Gray One* at the start of a sentence.

Aliases apply in every mode, and they travel with the world and with an exported character card.

Give an entity the one or two names the story will actually use. Each alias is also a line the AI reads whenever the entity is in scene, so a long list is extra prompt for no gain.`,
  },
  'worldEditor.traits': {
    title: 'Traits',
    wikiPage: 'World-Editor-Traits',
    body: `The choices that make one playthrough different from the next: *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks their traits before the story starts, and the ones they take are described to the AI on every turn.

A trait is a durable fact about the character. Stats move constantly and the story moves with them. A trait stays fixed, so the narrator is handed the same fact on turn one and turn ninety. A stat says *how much*, a trait says *who you are*.

**Only chosen traits count.** A trait the player didn't take isn't sent to the AI and changes nothing. Everything below applies to the ones they picked.

**What the AI sees**

- The **AI-Facing Description** field is what the AI is told this trait means. Leave it blank and the AI gets only the trait's name, which is often enough for something like *Left-Handed*.
- The **Player-Facing Description** field is what the player reads while choosing. It's never sent to the AI.
- **Stat Changes are invisible to the AI.** It's told you're *Sickly*. It's never told that cost you 20 Vigor. The number does its work through the stat itself.

**Enabled by Default** pre-checks the trait on the selection screen. The player can still untick it.

**Stat Changes** adjust a stat when the trait is taken. The section's own **?** explains each property and how the numbers stack.

**Groups** organize the list, and they also speak to the AI: give a group an AI-Facing Description and it becomes a header above its chosen traits, so you can frame a whole set at once (*"Origin: where this life began"*). A group with nothing chosen inside it is skipped entirely.

**Simple mode hides** Stat Availability and Placeholder Pins, and adds traits without groups. Switch the editor to Advanced to use them.

Write the AI-Facing Description as a fact about the character the narrator can act on, not a stat note. *"Flinches at open water"* beats *"-20 swimming"*.`,
  },
  'worldEditor.statChanges': {
    title: 'Stat Changes',
    body: `Adjusts a stat when this trait is taken. Each row is a stat, a number, and which of the stat's properties to change.

**They're all adjustments, not settings.** \`+20\` on a stat that starts at 50 gives you 70, not 20.

- **Starting Value** shifts where the stat begins
- **Min** raises the stat's floor, pulling the value up with it if it's below. Negative changes can only take back what other traits added. The stat's own Min is the true bottom.
- **Max** moves the ceiling either way. Lowering it below the current value drags the value down too.
- **Regen** adds to what the stat recovers each turn. Negative drains it.

**Stat Changes are invisible to the AI.** It's told you're *Sickly*. It's never told that cost you 20 Vigor. The number does its work through the stat itself.`,
  },
  'worldEditor.statAvailability': {
    title: 'Stat Availability',
    body: `Switches a stat on or off while this trait is active, overriding the stat's own default. Each row names a stat and whether taking the trait enables or disables it.

A stat that is off is gone, not just hidden: the player doesn't see it, the AI isn't told about it, and its regen and stat code pause until something turns it back on. The stat's own **Enabled** checkbox sets the default. A trait's switch overrides it only while the trait is active.

When two active traits switch the same stat, the one lower in the trait list wins. The row says so whenever that applies.`,
  },
  'worldEditor.placeholderPins': {
    title: 'Placeholder Pins',
    body: `Holds a placeholder at a fixed value while this trait is active, like a *Redhead* trait pinning Hair Color to *copper*. The playthrough's own roll is kept underneath and returns if the trait is switched off.

The pinned value doesn't have to come from the placeholder's own list. The box suggests the authored values, but anything you type is used as written, so a trait can force a value nobody else rolls.

A value that is a chip pins that part. Pin a Wildcard to the value holding *isAsian* and every chip of it takes that variant. The box names such a value after the part it holds, exactly as the Values list does, so you pick by the thing rather than by the words it joins to. A chip inside a longer value is prose, so that one reads as what it will resolve to.

When two active traits pin the same placeholder, the one lower in the trait list wins. The row says so whenever that applies. A location's pin outranks a trait's, and a stat band's outranks both. A placeholder value's pin ranks under all three.`,
  },
  'worldEditor.locationPins': {
    title: 'Placeholder Pins',
    body: `Holds a placeholder at a fixed value while the player is here, like the *Fen* pinning Weather to *fog*. The pin releases the moment the player leaves, and the playthrough's own roll shows again. A sub-location doesn't inherit its parent's pins.

The pinned value doesn't have to come from the placeholder's own list. The box suggests the authored values, but anything you type is used as written.

A stat band's pin outranks a location's. A location's outranks a trait's and a placeholder value's. Two locations never compete, since only one is current at a time. The row says who wins whenever another source pins the same placeholder.`,
  },
  'worldEditor.pinsOnPlaceholder': {
    title: 'Placeholder Pins',
    body: `Every pin aimed at this placeholder, from any source: a trait, a location, a stat band, or another placeholder's value. The pins live on those sources, and this list only gathers them, so a change here is a change on that trait, location, stat or placeholder, and shows there too.

Rows are in the order the game settles them: a stat band outranks a location, a location a trait, and a trait a placeholder value. Within one kind the lower in its own list wins, and each row says who else claims the placeholder and which one the rules pick.

The **Add Pin** button picks the kind of source, then the source, and writes an empty pin there for you to fill in. A row's first box re-aims its pin at another source of the same kind. The value box suggests this placeholder's values, but anything you type is used as written.`,
  },
  'worldEditor.placeholders': {
    title: 'Placeholders',
    wikiPage: 'World-Editor-Placeholders',
    body: `Reusable bits of world text you define once and drop into your writing as chips: an eye color, a street name, a deity. Each has a **Name** and a list of **Values**, and everywhere you place its chip, it resolves to one of those values when the story runs.

Placeholders let a world vary without being rewritten. Author *"the {{Eye Color}} stranger"* once, and it reads as a real detail every playthrough. Sometimes it's the same detail on purpose, sometimes a fresh one each time.

**The Kind row says what a placeholder is:**

- **Wildcard** randomizes. One of its values is picked, and every chip of it shows that pick. Good for variety, like a crowd of strangers who aren't all identical.
- **Object** holds. All of its values apply, joined together wherever it's placed. Good for a thing made of parts.
- **Variable** names either kind while it has one value. It always resolves to that value, so changing it here updates every chip.

New placeholders start as Wildcards, and one you have never touched reads as the kind its value count already implies.

**Parts.** A value that is exactly one chip is a **part** of the placeholder holding it, addressable as \`Name › Part\`. That is how an Object is built out of other placeholders.

**World vs. Unique** (Wildcards only). Each chip you place chooses how its roll is shared:

- **World** rolls once for every World chip of this placeholder and shows the *same* value everywhere. One randomly chosen town name, used consistently across the whole world.
- **Unique** rolls on its own for each placement. Ten Unique chips of *Eye Color* give ten independent eyes.

**The roll is frozen for the playthrough.** A Wildcard is rolled once, when a game begins, and stored in that save. The stranger who had gray eyes on turn one still has them on turn ninety, and reloading the save changes nothing. A new game rolls fresh.

**Where chips work.** Anywhere with the chip picker: entity, location and dictionary descriptions, the readme, the world's AI-Facing Description. They resolve both in what the AI reads and in what the player sees. The world's **Player-Facing Description is the exception.** It's read in the library before any game exists, so there are no rolls yet, and it takes no chips.

**Placeholders are Advanced-only.** The editor's mode switch has to be on Advanced for this tab and the chip palette to appear.

Define a placeholder here, then place its chip from any field that offers them. A placeholder with no values resolves to nothing, so give it at least one.`,
  },
  'worldEditor.stats': {
    title: 'Stats',
    wikiPage: 'World-Editor-Stats',
    body: `The numbers that describe your player: health, coin, reputation, whatever your world needs. Each stat has a value between a **Min** and **Max**, and the AI sees them every turn and lets them color how each action turns out.

Stats give the story a memory with consequences. Prose alone forgets. A stat is a fact the AI has to write around: a low one shows up as effort and cost, a high one as ease. The narrator is told to work them into events rather than announce them, so stats shape the story without reading like a spreadsheet.

**What the AI sees.** Each stat's **Name** is always sent. The Stats chip in your prompt picks what is sent with it:

- **Values** sends the current number and its ceiling, like \`62/100\` (or \`62%\` for a percentage stat)
- **Status** sends the matching **Stat Descriptor**, a word for the current level
- **Meaning** sends the stat's **Description**, what it represents

**The fields**

- **Type** is **Number** or **Percentage**. A Number stat spans a range you set. A Percentage stat is pinned from 0 to 100 and shown everywhere as \`N%\`. Everything below works the same for both. A percentage stat fixes the range for you and drops the Max, so you only set its **Initial Value (%)**.
- **Min / Max / Initial Value** set the range and where the stat starts. (A percentage stat locks Min/Max at 0/100 and shows just Initial Value.)
- **Regen** is added every turn, then clamped to the range. A positive number heals over time, a negative one drains.
- **Stat Descriptors** turn a number into a word. A threshold is a **value of this stat** (on a 0–10 stat, \`3\` means 3) and it is the *top* of its band, so the lowest band the value fits in wins, whatever order you list them in. Give the highest one a threshold of your **Max**, or a value above it gets no descriptor at all. The coverage bar draws every band's real extent with the gap above them in red, and each row says what it covers. Switch **Thresholds in** to **% of Max** if you'd rather the bands rescale when you change the range. Your numbers are converted as you switch, so nothing moves.
- **Prevent AI Changes** locks a stat against the AI in one direction. Useful for anything only your world's rules should move.
- **Body Sliders** bind a body morph to the stat, so its value sets the slider from Min to Max
- **Dynamic Value Calculation** runs a small script that can set the value, Min, Max, or Regen, pin a placeholder, or switch a trait. It has a **?** of its own beside it.

**Simple mode hides** Stat Descriptors, Prevent AI Changes and Dynamic Value Calculation. Switch the editor to Advanced to use them.

Start with two or three stats that the story would genuinely depend on. Every stat you add spends context on every turn, whether it matters to the scene or not.`,
  },
  'worldEditor.statCode': {
    title: 'Dynamic Value Calculation',
    wikiPage: 'StatCodeGuide',
    body: `A stat can run a small script. Write JavaScript. A returned number replaces the stat's value. A script with no return can still set \`self\`, pin a placeholder, or switch a trait. Leave a box empty and the manual value stands.

**Two boxes, one turn.** Turn order:

| | |
|---|---|
| 1 | **Before the AI** |
| 2 | AI stat changes |
| 3 | Regen |
| 4 | **After the AI** |

**Before the AI** runs at the start of the turn, before the prompt is built. A value it sets, a placeholder it pins, or a trait it switches is in the prompt for that turn. \`previous\` reads as the stat itself, every \`delta\` reads zero, and the clock reads turn start.

**After the AI** runs after the AI's changes and Regen apply. It reads the values the before box set. Both boxes run every turn. An empty box is skipped. A bound set by one box persists until the other box writes it or both boxes are empty.

The **Test Code** button under each box runs that box alone on that box's clock: the opening turn for Before the AI, a one-hour turn on day one for After the AI. Test Code executes the code. Editor underlines are static analysis only.

**What the script can reach.** A copy of every stat, the world's placeholders, and the world's traits. The sandbox exposes nothing else. \`stats\` is a map keyed by name. \`self\` is the stat that owns the code. Each stat carries \`id\`, \`name\`, \`type\`, \`description\`, \`min\`, \`max\`, \`value\` and \`regen\`.

\`\`\`js
const health = stats.Health.value;
return health / 2;
\`\`\`

A name with a space needs brackets: \`stats["Hit Points"]\`. \`Object.values(stats)\` iterates every stat. A name with a placeholder chip reads in code as that placeholder's name, so a stat named \`{{Beast}} Power\` is \`stats["Beast Power"]\` in every playthrough.

**Writing to \`self\`.** Set \`self.value\`, \`self.min\`, \`self.max\` or \`self.regen\` and the stat takes that number this turn. A bound the code sets persists until the code writes it again or both boxes are empty. A field the code doesn't write keeps the turn's value, so a script can set the cap and leave the value to the AI. Only \`self\` accepts writes. Every other stat is read-only.

\`\`\`js
const level = stats.Level.value;
self.max = level * 10;
\`\`\`

**Reading this turn.** Each stat carries the turn's state before the code ran. \`previous\`: the full stat (\`id\`, \`name\`, \`type\`, \`description\`, \`min\`, \`max\`, \`value\` and \`regen\`) at the start of the turn. \`delta\`: every change the turn made. \`delta.ai\` is the AI's requested change. \`delta.regen\` is the regen change. \`delta.total\` is their sum. \`delta.actual\` is current values minus \`previous\`. Each has \`value\`, \`min\`, \`max\` and \`regen\`. \`previous\` and \`delta\` are read-only. Use them to clamp or scale the AI's change before it applies.

\`\`\`js
self.value = self.previous.value + Math.min(self.delta.ai.value, 10);
\`\`\`

**Placeholders.** \`placeholders\` holds every placeholder by name. Each entry has \`values\`, every authored value as text; \`value\`, the current value; \`text\`, the value the prompt sees; and \`roll()\`, one weighted draw. On a Wildcard or a Variable, \`value\` is one text and \`text\` is the same text. On an Object, \`value\` is the list of current values and \`text\` joins them with \`", "\`. Compare narration wording with \`text\`. \`pin(x)\` pins the placeholder until the code changes it again. \`unpin()\` restores the other pins and the roll. \`pin\` takes the same shape \`value\` reads: one text on a Wildcard, a list on an Object. One text on an Object pins a one-item list. A name with a space needs brackets: \`placeholders["Hair Color"]\`.

**Paths.** Code reaches a placeholder by the path the editor shows. An entity or dictionary that owns placeholders is a path segment. A placeholder that holds parts carries them as members, to any depth. An owner segment has no placeholder members, only the placeholders it owns. Every placeholder has \`values\`, \`value\`, \`text\`, \`roll\`, \`pin\` and \`unpin\`, so a part with one of those names is shadowed by the member. A bare name resolves to the world's own row first, then the last one authored. Write the full path for an exact match.

\`\`\`js
placeholders.Mood.pin(self.value < 20 ? 'furious' : 'calm');
placeholders.Hair.pin(['gray', 'cropped short']);
placeholders.Molly.Hair.Shade.pin('ash');
placeholders["Old Molly"]["Eye Color"].pin('green');
\`\`\`

**Traits.** \`traits\` holds every authored trait by name. Each entry has \`enabled\`, true when the player has the trait and it is on, and \`acquired\`, true when the player has the trait. Set \`enabled\` to switch the trait on or off after the run, with the same effect as the player's checkbox, exclusive siblings included. Enabling a trait the player never took acquires it. Code ignores **Player Can Toggle In-Game**, so it can switch a trait the player can't toggle. A trait name with a placeholder chip reads in code as that placeholder's name, so a trait named \`{{Beast}} Fury\` is \`traits["Beast Fury"]\` in every playthrough.

\`\`\`js
traits.Cursed.enabled = self.value <= 0;
\`\`\`

**Clock.** Six values describe the story time:

| | |
|---|---|
| \`deltaHours\` | Story hours **this** turn consumed |
| \`elapsedHours\` | Total story hours so far, counting this turn |
| \`day\` | Day number at the **end** of the turn |
| \`daypart\` | Time of day at the **end** of the turn |
| \`startDay\` | Day number at the **start** of the turn |
| \`startDaypart\` | Time of day at the **start** of the turn |

Both ends are given because a turn spans time: an eight-hour sleep begins in the afternoon and ends at night. Dayparts are \`night\`, \`dawn\`, \`morning\`, \`midday\`, \`afternoon\`, \`evening\`. With **Measured Clock** off, \`deltaHours\` is \`1\`.

This enables a per-hour drain (\`current + 2 * deltaHours\`) or a stat that only rises after dark.

**The code runs every turn.** Both boxes run on the opening turn and on a turn with no AI stat change. They run when the stat request is off or fails. On those turns \`delta.ai\` reads zero in the after box, as it always does in the before box.

**A script that sets the value overrides the AI.** The AI's write is recomputed away. The AI still reads the value and description. A script that only writes a bound, a placeholder or a trait leaves the value to the AI.

**A failed run changes nothing.** Code that throws or times out leaves the stat, the placeholders and the traits unchanged. A write to an unknown placeholder or trait name is ignored. Test Code and the Test Bench both report it.

**Templates.** The **Templates** menu beside each Test Code button inserts common code shapes. Each box offers the templates that match its timing. Before the AI: a placeholder pin, a trait switch, an opening value. After the AI: a drain, a timer, a blend of two stats, a bound from another stat. Each template asks only for its inputs and inserts plain code you can edit.`,
  },
  'worldEditor.dictionary': {
    title: 'Dictionary',
    wikiPage: 'World-Editor-Dictionary',
    body: `Your world's lorebook. Each **book** holds **entries**, and an entry injects its content into the AI's prompt whenever one of its keywords shows up in the scanned text.

The AI can't hold your whole world in mind at once. Rather than spending context on every detail every turn, the Dictionary keeps lore on standby and pays for it only when it's relevant. Someone mentions the Gloamwater, and the AI knows what it is.

**What gets scanned.** The rule is short: **if the AI is told it, it can fire a trigger.** Each turn the scan covers:

- the **scene as the AI receives it**: your location and the entities present, plus any **nearby or sub-location** detail your prompt sends. Keywords match the exact wording the AI gets, so where a block is sent as a summary, the summary is what's matched;
- your **notes** and the **action** you just took;
- **earlier turns**, both your actions and the AI's replies, as far back as the entry's **Scan Depth** allows. All of them by default, none at 0.

Text that's present every single turn is deliberately left out: your world's AI-Facing Description, stats, traits, and formatting guidance. Its terms would otherwise fire constantly.

**The controls**

- **Trigger Keywords** fire an entry. List as many as you like, comma-separated, and any single match is enough.
- **Always Inject** skips the scan and sends the entry every turn. Use it sparingly, since it costs context every turn.
- **Secondary Keywords** add a condition: *bridge* fires only if *toll* also appears in the scanned text
- **Background** and **Foreground** are two separate lore blocks placed in the system prompt. Drag an entry between a book's two groups to move it. By default, Background comes earlier than Foreground.
- **Recursive** entries can also be fired by the content of entries that already activated, not just by the scene
- **Books** group related entries: their order sets injection order, and disabling one mutes everything in it. Players may override those toggles before starting.

**Simple mode hides** Always Inject, Regex, Recursive, Scan Depth and Secondary Keywords, along with the Background/Foreground split and the enable toggles. Switch the editor to Advanced to use them.

Start with one book and a few entries. Use the extra controls only when an entry fires when it shouldn't.`,
  },
  // Opened from the linked copy's footer menu in the World Editor, once on a profile's first link, and by
  // both update reviews. One topic for all: the dialog a reader opened decides which tab they read first,
  // so every tab stands alone.
  'library.linkedContent': {
    title: 'Linked Content',
    wikiPage: 'LinkedContent',
    tabs: [
      {
        label: 'Linked Copies',
        body: `An entity or a dictionary in a world becomes a **linked copy** when it follows a **library item**. When you save the library item, every linked copy of it receives the change the next time you open its world. A copy that follows nothing is an **independent copy**.

**Who owns the item decides what an edit does.** If the library item is your own, an edit to the copy stays **Linked**. Saving the world writes the edit to the library item, and every other world holding a copy receives it the next time you open that world. If the item is another author's, the first edit makes the copy a **Local replacement**: your change is kept, and their updates still reach you for review.

**How a copy becomes linked.** **Save to Library** links the copy it saved. **Add Entity** and **Add Dictionary** add a copy from your library and offer **Link to Library**, on by default. **Import Entity…** and **Import Dictionary…** offer the same choice for a file. An independent copy's menu holds **Link to Library Item…**. All of these make the same link.

**The three link states.** A linked row carries a 🔗 marker in the list, and the footer button reads **Open in Library**. Point at either one to read the state and the name of what the copy follows.

| | |
|---|---|
| **Linked** | The copy follows its library item. Updates replace its content. If the item is yours, saving the world writes your edits to it. |
| **Local replacement** | You edited a copy of another author's item. No update overwrites it. **Keep Mine** is its default in every review. |
| **Link pending save** | You linked the copy in this editing session. The link is written when you save the world. |

**Open in Library** opens the library item. **Unlink** turns the copy into an independent copy. The content stays exactly as it is, and the copy follows nothing.

**Connect World References.** A library item names the Placeholder or location it needs by an id from its own world. When this world doesn't already answer that reference, a step asks what each one means here. **Save Connections…** in the copy's menu reopens the step, so you can point a reference somewhere else after you remove a Placeholder.`,
      },
      {
        label: 'Updates',
        body: `**Check for Updates** is on a library tile and in a linked copy's menu. It compares the library item against every world that holds a copy. If no world is behind it, nothing opens.

**Update Available** lists one row per world, with the copy's state and an action. A copy you edited is a **local replacement**.

| | |
|---|---|
| **Update** | Replace the copy with the library item. The default for a **Linked** copy. |
| **Use Author's** | Replace a **Local replacement** with the library item. Your edits go. |
| **Keep Mine** | Keep the copy as it is. The default for a local replacement. |
| **Unlink** | Keep the copy as it is and stop following the library item. |

**View Changes** shows each changed field with your value and the author's. Choosing an action changes nothing until **Apply Updates**. **Cancel** applies none of it.

**Keep Mine remembers the revision you answered for.** That revision doesn't come back. The next revision asks again.

**Update This World** opens when you choose **Update an existing copy** for a community world. It lists the linked copies the update would change, with the same four actions. A local replacement starts on **Keep Mine**, so your edits survive the update. **New Required Content** lists sources the author now requires, which download and link when you apply. **No Longer Required** lists copies the author stopped requiring, which stay in your world as independent copies. **Cancel** applies none of it.`,
      },
      {
        label: 'Publishing',
        body: `**Publishing a world.** The publish dialog lists every library item the world's copies follow under **Linked Content**. **Include as required** makes that item download and link with the world. An unchecked item is published inside the world with no source to follow. A source of yours with no listing yet reads **Will publish with this world** and publishes first, as **Unlisted** unless you choose **Public**. If one source is refused, the world stays unpublished and **Retry** finishes the rest.

**Publishing an entity or a dictionary.** **Listing** is **Public** or **Unlisted**. An unlisted listing reaches players only inside a world that requires it. **Compatible Worlds** lists your published worlds that hold a linked copy. Check **Offer as add-on** for a world and the world's author reviews the offer. The review state shows beside each world you offered it for.

**Manage Add-ons** on your own world card opens the offers other authors made for your world. Each offer is **Approved**, **Unreviewed**, or **Declined**.

| | |
|---|---|
| **Approved** | The add-on is listed under **Approved Add-ons** on your world's download. |
| **Unreviewed** | The add-on is listed under **Community Add-ons**. |
| **Declined** | The add-on leaves both tabs. It stays downloadable from its own listing. |

A source that changed after your answer keeps that answer and gains **Updated since review**. **Mark Reviewed** accepts the change. Nothing changes until **Save Changes**.`,
      },
      {
        label: 'Downloading',
        body: `A community world's details window lists what it brings under **Linked Content**.

| | |
|---|---|
| **Required** | Comes with the world. You don't choose it. |
| **Approved Add-ons** | Optional. The world's author approved it. |
| **Community Add-ons** | Optional. Offered by its author and not reviewed by the world's author. |

The download button counts what it installs, so it reads **Download World + 3 Items**. Downloading places each item in your library and links the world's copies to it. Each copy opens in the World Editor as **Linked** with its source named.

A required item that doesn't download leaves the world out of your library, and **Retry** finishes it. An add-on that doesn't download leaves the world ready and gets its own **Retry**.

**Compatible Worlds** on an entity's or a dictionary's listing shows the worlds it is offered for. Downloading the entity or dictionary installs it alone.

**Importing a world file.** The file carries what each copy follows. On the machine that wrote it, every link is restored. Elsewhere, **Link bundled content to my library** saves each bundled item as a library item of yours, and the world's copies follow it. Unchecked, the copies follow nothing. If you already have a copy's source, the copy follows your item as a **local replacement**, which no update overwrites, because the file's content always wins.`,
      },
      {
        label: 'Repairs',
        body: `**Check Sources** in the Test Bench's **Issues** list asks the server about every library item this world's copies follow. It asks only when you press it, so an installed world stays playable with no connection.

A source the server reports as deleted reads as a source its author removed. Any other failure reads as a source that couldn't be checked, with **Retry Check**.

Each copy with a missing source gets one repair and its own **Apply**.

| | |
|---|---|
| **Replace from Library** | Follow a different library item. |
| **Unlink and Keep Content** | Keep the copy as an independent copy. |
| **Remove from World** | Delete the copy from this world. |

**A republished source is a new listing.** It never reconnects on its own. Replace from Library is how to reconnect to it.

While a required source reads as removed, **Enter World**, **Quick Start**, and **Publish World** are off for that world. The reason names the source and carries **Repair Sources** to the editor. **Edit World** and **Load Game** stay open.

**Removing a library item** leaves every copy that followed it as an independent copy with its content untouched. No world breaks.`,
      },
    ],
  },
};

/** The help topic id for a World Editor tab, or undefined when that tab has no copy yet. */
export function worldEditorTopicId(tab: string): string | undefined {
  const id = `worldEditor.${tab}`;
  return HELP_TOPICS[id] ? id : undefined;
}
