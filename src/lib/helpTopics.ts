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
  return `${WIKI_BASE}/${topic.wikiPage}${topic.wikiAnchor ? `#${topic.wikiAnchor}` : ''}`;
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
    body: `Who the story counts as being here with you right now. The list changes as the scene does — people arrive, people leave.

Most of these are characters the world's author wrote. Some the story **invented on the spot**: ask a shopkeeper for directions and it may answer with a name nobody wrote down. Those are remembered from the moment they're named, so the story can keep them consistent and offer you things to do with them.

Someone merely *talked about* isn't added — only characters the story actually shows in the scene.

**When something isn't a person**

Names come out of the story's own prose, so once in a while it capitalizes a café or a street and that ends up here. Use the remove button beside the entry to take it out. The story stops picking that name up for the rest of this playthrough, and the prose itself is left exactly as written.

Only story-invented entries can be removed. The world's own cast belongs to the world — that's the World Editor's job, not yours mid-scene.

**Descriptions**

Settings → Generation → **Describe New Characters** gives each invented character a written description you can open from here. Everything else on this list works whether that's on or off.`,
  },
  'worldEditor.locations': {
    title: 'Locations',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'locations',
    body: `The places your story happens. The player is always in exactly one, and it decides what the AI is told about the scene — the description, who's there, and where the story might go next.

Locations exist to keep the story somewhere. Without a fixed place the narrator drifts: the tavern becomes a street becomes a forest, and nothing stays put. A location is an anchor the AI is handed again every turn.

**Nesting is the AI's map, not the player's.** The player can travel anywhere at any time — the in-game location list offers every location in your world, unfiltered.

What nesting decides is where *the story* can take them. When the AI reads an action as movement, it only considers places connected to where they are: down into a sub-location, or up and sideways from one. It then offers the move — *Move to the Eelhouse?* — and the player takes it or dismisses it. Nest your places and the story starts proposing journeys through them. Leave them flat and travel stays something the player reaches for.

**What the AI sees**

- **AI-Facing Description** — the full text the AI works from. The player never sees it, so it's where a secret belongs.
- **AI-Facing Summary** — a one-line version for slots where the full text is too long; the default prompt uses it for sub-locations and reachable places. Left blank, the full description is used instead.
- **Player-Facing Description** — what the player reads in the location panel. Never sent to the AI, so whatever you write here, the player simply knows.
- **Entities** — who's here. The same list an entity's own Locations picker writes to, from the other end.

**Starting location** marks where a new game can begin, and the box does more than it looks:

- **Tick none** and the game starts somewhere random — *any* location in the world.
- **Tick one** and every game starts there.
- **Tick several** and the player chooses between them before starting.

The background image, image tags and ambient sound are for the player's screen — the narrator never sees them.

Write the AI-Facing Description first; it's the one doing the work. Reach for nesting when you want the story to move the player on its own.`,
  },
  'worldEditor.entities': {
    title: 'Entities',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'entities',
    body: `The people, creatures and things that populate your world — a ferryman, an eel-smoker, a barred door. An entity belongs to one or more **Locations**, and the AI is handed the ones that could turn up wherever the player currently is.

They exist to give the AI a cast it can't lose track of. Left to itself the narrator invents a stranger, gives them a name, and forgets both by the next turn. An entity is a fixed, reusable character the story can keep returning to.

**What the AI sees.** An entity only reaches the AI when the player is somewhere it's assigned to — that assignment is the whole gate.

- **Name** — always sent.
- **AI-Facing Description** — the full description, and the main thing the AI knows. **The player never sees this field**, so it's where a secret belongs: who the ferryman really works for, what's behind the door. The default prompt does ask the narrator to hold a name back until the player would have learned it — but that's a request to the AI, not a guarantee.
- **AI-Facing Summary** — a one-line version for prompt slots where the full text is too long; the default prompt uses it for entities in reachable locations. Left blank, the full description is used instead.
- **Player-Facing Description** — what the player reads when they look at this entity. **Never sent to the AI**, so it costs no context — and anything you write here, the player simply knows.
- **Type** — sent as a plain field.

**Locations** decides where the entity can appear. Assign it to as many as you like; an entity in no location never reaches the AI at all.

**The link lives on the location.** Assigning locations here just writes the entity into each of those locations' lists — so **deleting a location quietly drops its entities from it**. They aren't deleted, but one that was only in that location now appears nowhere, and nothing warns you.

**Groups** are organizational. Nesting and order are editor-only and never reach the AI, so grouping never changes the story.

Image, Image Tags and the 3D model are for the player's screen and for image generation — the narrator never sees them.

Give a location the two or three entities the scene genuinely turns on. Everything at the player's location is sent every turn, so a crowded location is a permanent context bill.`,
  },
  'worldEditor.aliases': {
    title: 'Aliases',
    body: `Other names an entity goes by — a nickname, a title, an epithet. "Rosalind" answers to "Roz", and to her title, "Warden". List as many as you like.

They exist so the story keeps recognizing a character even when it doesn't use their full name. Given only the name, the narrator writes "the Warden" and Formamorph no longer sees Rosalind in the scene — she drops off the cast, out of the choices, off the Entities tab. An alias closes that gap, and the AI is told the nickname too so it can reach for it naturally.

**What an alias does**

- **Detection.** When an alias appears in the narration, the entity counts as present that turn — exactly as if its name had appeared. This drives who shows in the Entities tab, who the choices consider, and which characters travel with the scene.
- **Told to the AI.** Aliases are sent alongside the name as *also known as*, so the narrator knows Rosalind and the Warden are one person and can use either.

**How matching works**

- **Case-sensitive**, unlike the name. Write an alias with the capitalization it'll appear in — *Cat* matches *Cat*, not *cat*. This is deliberate: short nicknames would otherwise fire inside ordinary words (*Cat* inside *category*, *scatter*).
- **Whole words only**, and **plurals match** — an alias *Wolf* is found in *Wolves*.
- **Skip a leading "the"/"a".** Write *Gray One*, not *the Gray One*. An article baked into the alias, matched case-sensitively, would miss *The Gray One* at the start of a sentence.

Aliases apply in every mode, and they travel with the world and with an exported character card.

Give a character the one or two names the story will actually use. Each alias is also a line the AI reads whenever the entity is in scene, so a long list is just extra prompt for no gain.`,
  },
  'worldEditor.traits': {
    title: 'Traits',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'traits',
    body: `The choices that make one playthrough different from the next — *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks their traits before the story starts, and the ones they take are described to the AI on every turn.

A trait is a durable fact about the character. Stats move constantly and the story moves with them; a trait stays put, so the narrator is handed the same truth on turn one and turn ninety. A stat says *how much*, a trait says *who you are*.

**Only chosen traits count.** A trait the player didn't take isn't sent to the AI and changes nothing. Everything below applies to the ones they picked.

**What the AI sees**

- **AI-Facing Description** — what the AI is told this trait means. Leave it blank and the AI just gets the trait's name, which is often enough for something like *Left-Handed*.
- **Player-Facing Description** — what the player reads while choosing. Never sent to the AI.
- **Stat Changes are invisible to the AI.** It's told you're *Sickly*; it's never told that cost you 20 Vigor. The number does its work through the stat itself.

**Enabled by Default** pre-checks the trait on the selection screen. The player can still untick it.

**Stat Changes** adjust a stat when the trait is taken. Each row is a stat, a number, and what to change. **They're all adjustments, not settings** — \`+20\` on a stat that starts at 50 gives you 70, not 20.

- **Starting Value** shifts where the stat begins.
- **Min** raises the stat's floor, pulling the value up with it if it's below. It can also be lowered, but only far enough to undo another trait's raise — never below the floor you gave the stat.
- **Max** moves the ceiling either way. Lowering it below the current value drags the value down too.
- **Regen** adds to what the stat recovers each turn. Negative bleeds.

**Groups** organize the list, and they also speak to the AI: give a group an AI-Facing Description and it becomes a header above its chosen traits, letting you frame a whole set at once (*"Origin: where this life began"*). A group with nothing chosen inside it is skipped entirely.

Write the AI-Facing Description as a fact about the character the narrator can act on, not a stat note. *"Flinches at open water"* beats *"-20 swimming"*.`,
  },
  'worldEditor.placeholders': {
    title: 'Placeholders',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'placeholders',
    body: `Reusable bits of world text you define once and drop into your writing as chips — an eye color, a street name, a deity. Each has a **Name** and a list of **Values**, and everywhere you place its chip, it resolves to one of those values when the story runs.

They exist so a world can vary without being rewritten. Author *"the {{Eye Color}} stranger"* once, and it reads as a real detail every playthrough — sometimes the same detail on purpose, sometimes a fresh one each time.

**The kind is set by how many values you give it:**

- **One value → a Variable.** It always resolves to that value. Change it here once and every chip updates. Good for a name or a fact you want consistent and easy to edit.
- **Two or more → a Wildcard.** It resolves to a *random* one of the values. Good for variety — a crowd of strangers who aren't all identical.

**World vs. Unique** (Wildcards only). Each chip you place chooses how its roll is shared:

- **World** — every World chip of this placeholder rolls once and shows the *same* value everywhere. One randomly-chosen town name, used consistently across the whole world.
- **Unique** — each placement rolls on its own. Ten Unique chips of *Eye Color* give ten independent eyes.

**The roll is frozen for the playthrough.** A Wildcard is rolled once, when a game begins, and stored in that save. The stranger who had gray eyes on turn one still has them on turn ninety — reload the save and nothing shifts. A new game rolls fresh.

**Where chips work.** Anywhere with the chip picker: entity, location and dictionary descriptions, the readme, the system prompt addition. They resolve both in what the AI reads and in what the player sees. The **World Description is the exception** — it's read in the library before any game exists, so there are no rolls yet, and it takes no chips.

Define a placeholder here, then place its chip from any field that offers them. A placeholder with no values resolves to nothing, so give it at least one.`,
  },
  'worldEditor.stats': {
    title: 'Stats',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'stats',
    body: `The numbers that describe your player — health, coin, reputation, whatever your world needs. Each stat has a value between a **Min** and **Max**, and the AI sees them every turn and lets them color how each action turns out.

They exist to give the story a memory with consequences. Prose alone drifts; a stat is a fact the AI has to write around — a low one shows up as effort and cost, a high one as ease. The narrator is told to work them into events rather than announce them, so stats shape the story without reading like a spreadsheet.

**What the AI sees.** Each stat's **Name** is always sent. The Stats chip in your prompt picks what rides along with it:

- **Values** — the current number and its ceiling, like \`62/100\` (or \`62%\` for a percentage stat).
- **Status** — the matching **Stat Descriptor**, a word for the current level.
- **Meaning** — the stat's **Description**, i.e. what it represents.

**The fields**

- **Type** — a **Number** stat spans a range you set; a **Percentage** stat is pinned from 0 to 100 and shown everywhere as \`N%\`. Everything below works the same for both — a percentage stat just fixes the range for you and drops the Max, so you only set its **Initial Value (%)**.
- **Min / Max / Initial Value** set the range and where the stat starts. (A percentage stat locks Min/Max at 0/100 and shows just Initial Value.)
- **Regen** is added every turn, then clamped to the range — a positive number heals over time, a negative one bleeds.
- **Stat Descriptors** turn a number into a word. **Threshold % is a percentage of the way from Min to Max, not a raw value**, and the *first* descriptor whose threshold the stat is at or below wins — so list them low to high, or the wrong one matches.
- **Prevent AI Changes** locks a stat against the AI in one direction. Useful for anything only your world's rules should move.
- **Body Sliders** bind a body morph to the stat, so its value drives the slider from Min to Max.
- **Dynamic Value Calculation** replaces the value with the result of a small script — see below.

**Calculated stats.** A stat can compute itself from the others: write JavaScript that returns a number, and it recalculates each turn instead of using Initial Value. **Test Code** runs it right there, as a one-hour turn on day one. Your script sees a read-only copy of every stat (name, description, min, max, value, regen) and nothing else — it can't reach the page or the network. A calculated stat ignores the AI entirely: whatever it writes gets recomputed away, though it still *reads* the value.

**Scripts can read the clock.** Alongside the stats, your script gets six values describing where the story stands in time:

| | |
|---|---|
| \`deltaHours\` | Story hours **this** turn consumed |
| \`elapsedHours\` | Total story hours so far, counting this turn |
| \`day\` | Day number at the **end** of the turn |
| \`daypart\` | Time of day at the **end** of the turn |
| \`startDay\` | Day number at the **start** of the turn |
| \`startDaypart\` | Time of day at the **start** of the turn |

Both ends are given because a turn spans time: an eight-hour sleep begins in the afternoon and ends at night. Dayparts are \`night\`, \`dawn\`, \`morning\`, \`midday\`, \`afternoon\`, \`evening\`.

That's what makes a per-hour drain (\`current + 2 * deltaHours\`) or a stat that only climbs after dark possible. With **Measured Clock** off, \`deltaHours\` is simply \`1\`. One catch: a script mentioning any of these re-runs **every** turn, since time passes every turn — a script that mentions none of them still runs only when a stat changes.

Start with two or three stats that the story would genuinely turn on. Every stat you add spends context on every turn, whether it matters to the scene or not.`,
  },
  'worldEditor.dictionary': {
    title: 'Dictionary',
    wikiPage: 'WorldEditor',
    wikiAnchor: 'dictionary',
    body: `Your world's lorebook. Each **book** holds **entries**, and an entry slips its content into the AI's prompt whenever one of its keywords shows up in the scanned text.

It exists because the AI can't hold your whole world in mind at once. Rather than spending context on every detail every turn, the Dictionary keeps lore on standby and pays for it only when it's relevant — someone mentions the Gloamwater, and the AI knows what it is.

**What gets scanned.** The rule is simple: **if the AI is told it, it can fire a trigger.** Each turn Formamorph scans:

- the **scene as the AI receives it** — your location and the characters present, plus any **nearby or sub-location** detail your prompt sends. Keywords match the exact wording the AI gets, so where a block is sent as a summary, the summary is what's matched;
- your **notes** and the **action** you just took;
- **earlier turns**, both your actions and the AI's replies, as far back as the entry's **Scan depth** allows — all of them by default, none at 0.

Text that's present every single turn is deliberately left out — your world description, stats, traits, and formatting guidance — since its terms would otherwise fire constantly.

**The controls**

- **Keywords** fire an entry — list as many as you like, comma-separated, and any single match is enough.
- **Always inject** skips the scan and sends the entry every turn — use sparingly, it costs context every turn.
- **Secondary Keywords** add a condition: *bridge* fires only if *toll* also appears in the scanned text.
- **Background** and **Foreground** are two separate lore blocks placed in the system prompt; drag an entry between a book's two groups to move it. By default, Background comes earlier than Foreground.
- **Recursive** entries can also be fired by the content of entries that already activated, not just by the scene.
- **Books** group related entries: their order sets injection order, and disabling one mutes everything in it. Players may override those toggles before starting.

Start with one book and a few entries. Reach for the extra controls only when an entry fires when it shouldn't.`,
  },
};

/** The help topic id for a World Editor tab, or undefined when that tab has no copy yet. */
export function worldEditorTopicId(tab: string): string | undefined {
  const id = `worldEditor.${tab}`;
  return HELP_TOPICS[id] ? id : undefined;
}
