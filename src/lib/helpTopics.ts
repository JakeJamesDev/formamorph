/**
 * Registry for the in-app help pop-outs (`HelpButton`). One topic per surface that needs explaining —
 * what it does and why it exists — kept out of the components so the copy is editable in one place and
 * the mechanism stays generic. Topic ids are namespaced by surface (`worldEditor.scriptBox`) so other
 * screens can register their own without collision.
 *
 * Copy rules: written for an author who has never opened the section. Lead with what it is, then why it
 * exists, then the controls that aren't self-evident from the UI. Only claim what the code actually
 * does — placement inside the prompt is author-editable, so don't promise an order the chips don't fix.
 */
import { docTargetId } from '@/lib/docs/docsLinks';

const WIKI_BASE = 'https://github.com/JakeJamesDev/formamorph/wiki';

/** The wiki URL of a page or a heading id, e.g. `Connect-Your-Own-AI` or `Settings#display`. */
export function wikiPageUrl(id: string): string {
  return `${WIKI_BASE}/${id}`;
}

/** The wiki's home page. */
export const WIKI_HOME_URL = WIKI_BASE;

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
  return wikiPageUrl(docTargetId({ page: topic.wikiPage, anchor: topic.wikiAnchor }));
}

const SCRIPTS_TOPIC: HelpTopic = {
  title: 'Scripts',
  wikiPage: 'ScriptsGuide',
  wikiAnchor: '-scripts-guide',
  tabs: [
    {
      label: 'Overview',
      body: `A script is one box of JavaScript with a timing. A stat, a trait, an item or the world holds any number of them.

\`return <number>\` sets the stat's value, clamped to its range. A script with no return can still set \`self\`, write another stat, pin a placeholder or switch a trait. An empty script changes nothing.

**The home of a script.** A stat's script runs with the stat as \`self\`. A trait's script runs only while the trait is active, with the trait as \`self\`, read-only. An item's script runs on the events of its Item Copies, with the item as \`self\`, read-only. A world script has an empty \`self\`.

The world's **Scripts** tab lists every script by timing, in run order. Drag a row to set its order within its timing.

**Test Code** under each box runs that box alone. The editor's underlines check the code without running it. **Templates** inserts common code for the box's timing.

A script that throws or times out changes nothing.`,
    },
    {
      label: 'Timings',
      body: `Each script has one timing, and it runs only at that timing:

| Timing | When it runs |
|---|---|
| **Before the AI** | At the start of a turn, before the prompt is built. The prompt holds its writes. |
| **After the AI** | After the AI's changes and Regen apply. It reads what the AI asked for. |
| **During AI Output** | Once for each narration sentence, when it completes. It can rewrite the sentence. |
| **At Game Start** | Once, on the opening turn of a new game, before the Before the AI scripts. |
| **When a Trait Switches** | Each time a trait turns on or off during a game. |

Turn order: At Game Start, Before the AI, the AI's stat changes, Regen, After the AI. **During AI Output** runs while the narration streams.

An item's scripts use five timings of their own: **When Gained**, **When Lost**, **When Equipped**, **When Unequipped** and **When Used**.`,
    },
    {
      label: 'Variables',
      body: `A script reads every stat and the story clock. It also reads the world's placeholders and traits, and the entities, locations, dictionaries, items, memories and notes in the game. Some timings add a name:

- \`narration\` in **During AI Output**. Assign \`narration.sentence\`, or return a string, to rewrite the sentence.
- \`trait\` in **When a Trait Switches**. It's the trait that switched, and \`trait.enabled\` is its new state.
- \`player\` in **Before the AI**, **After the AI**, **At Game Start** and **When a Trait Switches**. \`player.tell\`, \`player.toast\`, \`player.confirm\`, \`player.ask\` and \`player.input\` show the player a message or a question. The script waits for the answer, with no \`await\`, and closing a question fails the script.

\`\`\`js
const health = stats.Health.value;
return health / 2;
\`\`\`

A name with a space needs brackets: \`stats["Hit Points"]\`. \`stats\` is the global stats in every script. An entity's own stats are \`owner.stats\`.`,
    },
    {
      label: 'Stat Writes',
      body: `Set \`self.value\`, \`self.min\`, \`self.max\`, \`self.regen\` or \`self.hidden\` to write this stat. Set \`value\`, \`min\`, \`max\` or \`regen\` on any other stat to write that stat. Writes apply after the run.

A later write to a field overwrites an earlier one, so the run order decides which write wins.`,
    },
  ],
};

export const HELP_TOPICS: Record<string, HelpTopic> = {
  'game.allowance': {
    title: 'Formamorph AI Allowance',
    wikiPage: 'How-to-Play',
    wikiAnchor: 'how-to-check-your-formamorph-ai-allowance',
    body: `Your allowance counts turns on every device and resets every week.

The list shows where this week's use went.

When you've used this week's allowance, Formamorph AI stops until the reset. Background requests, such as diaries, pause too.`,
  },
  'game.howToPlay': {
    title: 'How to Play',
    wikiPage: 'How-to-Play',
    wikiAnchor: 'how-to-take-an-action',
    tabs: [
      {
        label: 'Actions',
        body: `Write what you do, in the first person: *I ask her where the road leads. I draw my knife. I hand him the coin and wait.*

**The choices are suggestions.** You can type any action instead, and the story answers it.

**Say it in your own words.** When you talk to someone, write what you say. *I tell her the truth about the fire* works better than *I respond*.

**Success isn't guaranteed.** The narrator decides how your attempt goes, and your stats shape it.

Press **Enter** to send your action. **Shift+Enter** starts a new line.

On Formamorph AI, a ring beside **Send** shows how much of this week's allowance you've used. Select it to see what's left and where your use went.`,
      },
      {
        label: 'Choices',
        body: `The choices under the story are ready-made actions. Select a choice, and its text replaces what's in the action box. Edit the text if you like, then send it.

To add a choice to what you already typed, **Ctrl+click** it (**Cmd+click** on Mac). The choice joins the box as a new sentence, so you can stack two choices.

You never need the choices: type any action, and the story answers it. Clear the **Choices** checkbox below to turn them off. With choices off, you write every action yourself.`,
        mobileBody: `The choices under the story are ready-made actions. Tap a choice, and its text replaces what's in the action box. Edit the text if you like, then send it.

To add a choice to what you already typed, press and hold it. The choice joins the box as a new sentence, so you can stack two choices.

You never need the choices: type any action, and the story answers it. Clear the **Choices** checkbox below to turn them off. With choices off, you write every action yourself.`,
      },
      {
        label: 'Directing',
        body: `The AI reads text in square brackets as direction from the author, not as something you do. Everything outside the brackets is your action.

*I climb on behind her. [She agrees, and they ride off.]*

Use it to decide an outcome, skip ahead, or keep a tone:

- *[Skip ahead to the harbor at dusk.]*
- *[Keep this scene light. Nothing goes wrong tonight.]*

The narration doesn't quote the bracketed text, and the story's memory leaves it out. Brackets direct one turn. For a fact the AI should read every turn, use the **Notes** tab.`,
      },
      {
        label: 'Memory & Notes',
        body: `The story sends your recent turns to the AI word for word. It carries older turns as short memories.

Open the **Memory** tab in the side panel to see what the story keeps. Pin a memory to keep it, or forget one to let it go.

Memories need **Memory Summaries**, the checkbox below. With it off, the oldest turns are dropped once the story is longer than the context. Memories you wrote still go to the AI.

**Notes go with every action.** The text in the **Notes** tab goes to the AI with every action. Standing facts belong there: who you pretend to be, what you carry, the goal you work toward.

**Brackets direct one turn. Notes stay until you change them.** If the story keeps forgetting something that should always hold, put it in **Notes**.`,
      },
    ],
  },
  'game.memoryManager': {
    title: 'Memories',
    body: `What the story remembers about earlier turns, and the place to change it.

The story keeps your recent turns word for word and carries older turns as short memories. It prunes memories on purpose. Faded, struck-through lines are the ones it let go.

**What you can do to a memory**

| | |
|---|---|
| **Edit This Memory** | Rewrite a memory in your own words. The story always keeps your version. |
| **Have the Story Write This Memory Again** | The story summarizes that turn again. The new text carries a **Rewritten** badge. |
| **Pin This Memory** / **Forget This Memory** | Keep a memory the story let go, or let go of one it kept. **Clear the Pin and Let the Story Decide** gives the decision back to the story. |
| **Delete This Memory** | Removes a memory. Select the **Deleted** chip, then **Restore This Memory**, to bring it back. |
| **Add Memory** | Writes a memory for something that never happened in a turn. The story never judges yours. |

**Edits and deletions can be undone.** The story's own summary is always kept under what you write. **Revert to the Original** restores one memory's wording.

**Reset All My Changes** puts every memory back the way the story had it. The memories you wrote stay. You can't undo a reset.

Memories under the **Recent** line still go to the AI word for word. A pin on one of them matters only after it ages out.

**Kept isn't the same as sent.** A kept memory is one the story judged worth carrying, or one you pinned. With **Semantic Memory** on, only the kept memories most relevant to your action go to the AI.

| Row | Means |
|---|---|
| **Left accent bar** | Sent to the AI last turn |
| Plain | Kept, but not sent this turn |
| Struck through | The story let this one go |
| **Scene** badge | **Scene Recall** sent the memory as its full original prose |

The **Verbatim**, **Summary** and **Held** chips name the form the story has a memory in:

- **Verbatim**: the real text, a recent turn or one that **Scene Recall** sent back whole
- **Summary**: the compressed line, and nothing more
- **Held**: nothing this turn, but it's still kept until it's relevant again

**When it happened.** With **Measured Clock** on, each memory carries its place in the story's time, such as *Day 3, evening — two days ago*. The AI reads the same stamp when **Time in Memory** is on.

With **Measured Clock** off, every turn costs the same **Time Per Turn**, so the list dates nothing. Both settings are in **Settings** → **Output** → **Time**, in **Advanced** mode.`,
    wikiPage: 'Memory',
    wikiAnchor: 'the-memory-manager',
  },
  'game.entities.alsoHere': {
    title: 'Also Here',
    wikiPage: 'Entities',
    wikiAnchor: '-entities-in-game',
    body: `The entities at your location that haven't taken part in the story in the last 3 turns.

When the story shows one, it moves to **In Scene**. An entity moves back here after 3 turns without taking part.`,
  },
  // For a player mid-story wondering who a name in their scene list is.
  'game.entities.inScene': {
    title: 'In Scene',
    wikiPage: 'Entities',
    wikiAnchor: '-entities-in-game',
    body: `The entities at your location that took part in the story in the last 3 turns. Your persona sits above this list, marked **You**.

The entities come from three places: the world's author, your library, and the story itself. You add entities from your library under **Library Additions** at **Enter World**.

**Entities the story invents**

Ask a shopkeeper for directions, and the story might answer with a name no author wrote. That entity joins the scene as soon as the story names it. It then counts as present, and the story considers it when it offers you choices.

The game adds a name only when it acts like a person in the narration: it speaks, gestures, or is introduced. An entity that's only talked about isn't added. An entity that introduces itself (*"I'm Freya"*) counts as shown.

**When an entry isn't a person**

Sometimes the story capitalizes something that isn't a person, such as a café, and the game adds it. Select the **Remove** button (trash icon) beside the entry, then **Confirm**. The game doesn't add that name again in this playthrough, and the story's text stays as it is.

Only story-invented entities and Library Additions have **Remove**. The world's authored entities belong to the world, so you change them in the World Editor.

**Descriptions**

**Settings** → **Output** → **Characters** → **Describe New Characters** gives each invented entity a written description you can open from here. The **Characters** section shows in **Advanced** mode only. Everything else on this list works with the setting on or off.`,
  },
  'worldEditor.aliases': {
    title: 'Aliases',
    wikiPage: 'World-Editor-Entities',
    wikiAnchor: 'names-and-aliases',
    body: `Other names an entity uses: a title, a nickname, an epithet. Press **Enter** after each alias.

Aliases let the game detect an entity when the narration doesn't use its name. With only the name *Rosalind*, narration about "the Warden" doesn't count her as present. The alias *Warden* does.

**What an alias does**

- The game counts the entity as present when the narration uses an alias. Presence decides who shows in the **Entities** tab and who the choices consider.
- The AI reads aliases with the name, as *"also known as"*.

**How matching works**

- **Case-sensitive.** *Matron* matches "the Matron" and doesn't match "the matron". Add each form the narration can write.
- **Plurals match.** *wolf* also matches "wolves".
- **Whole words only.** *Em* doesn't match inside "System".
- **Never start an alias with "the".** Narration often puts a title at the start of a sentence, and "The alpha…" doesn't match *the alpha*. Write *alpha*, which matches in both positions.

**What to avoid**

- **General job titles.** *knight* or *alchemist* match every person of that trade, and the wrong entity joins the scene.
- **A role the story gives to someone absent.** Quoted dialogue is ignored, but plain narration isn't. In *"she was sent by the Warchief"*, the alias *Warchief* marks the Warchief as present.

The **Aliases** field shows in **Advanced** mode only, but aliases work in both modes. They go with the world and with an exported entity card.

Give an entity the one or two names the narration uses. The AI reads every alias of an entity in the scene, so a long list adds prompt text for no gain.`,
  },
  'worldEditor.relationships': {
    title: 'Relationships',
    wikiPage: 'World-Editor-Entities',
    wikiAnchor: 'relationships',
    body: `Each row says what another entity is to the one you're editing. Pick the other entity in **Add a relationship**, then type its role in the box beside its name.

**Example**

You're editing *Mara*, and *Tom* is her son.

1. On Mara's **Profile** tab, pick **Tom** in **Add a relationship**.
2. In the box beside **Tom**, type *son*.

**How the AI reads a row**

| Name in the row | | Entity you're editing | Role you type |
|---|---|---|---|
| Tom | is | Mara's | son |

**Persona**

The **Persona** row says what the player's character is to this entity. With *friend* beside **Persona** on Mara, the AI reads that the player's character is Mara's friend.

**One row per pair**

You don't need a second row on Tom for Mara. If both rows exist, the AI reads only one of them, so make sure they agree.`,
  },
  'worldEditor.strangerName': {
    title: 'Stranger Name',
    wikiPage: 'World-Editor-Entities',
    wikiAnchor: 'stranger-name',
    body: `Hides who an entity is until the player meets it. Until then, the player sees the **Stranger Name**, such as "a hooded figure", in place of the **Name**. The AI narrator uses the Stranger Name too.

- Leave it blank to show the Name.
- The **Stranger Description** is on the **Descriptions** tab, under the **Player-Facing Description**. It works with or without a Stranger Name.
- Clearing this field keeps the Stranger Description.

**How the player meets the entity**

- The narration uses the entity's Name, or a distinctive part of it such as a first name, while the entity is at the player's location. Dialogue counts. Entries in **Aliases** don't.
- A script calls \`meet()\` on the entity.

Once met, the player sees the Name for the rest of the game.

**Before the player meets the entity**

- If the AI tracks the entity under another name, such as "the tall woman", the player sees that name instead.
- The Map doesn't show an entity with a Stranger Name. The Help window shows it only under that other name, with no description.

**Entities the player has already met**

The player has met an entity from the start when it has no Stranger Name and no Stranger Description, or when either of these is true:

- It has a relationship with the persona, in either direction.
- One of its **Known In** picks is one of the persona's **Locations**, or contains one. The **Nearby** default doesn't count.

The field takes placeholders and rolls. It shows in Advanced mode, in the World Editor only.`,
  },
  'worldEditor.strangerDescription': {
    title: 'Stranger Description',
    wikiPage: 'World-Editor-Entities',
    wikiAnchor: 'stranger-description',
    body: `Shows the player a different description until they meet the entity. Until then, the player sees the **Stranger Description** in place of the **Player-Facing Description**.

- Leave it blank to show no description until the player meets the entity. An entity with neither stranger field starts met.
- The field works alone. With no **Stranger Name**, the player knows the Name but sees this description until they meet the entity.
- The entity's popup in the **Entities** tab shows it. The Help window shows it too when the entity has no Stranger Name.
- The AI narrator sees nothing new. It keeps using the Name, or the Stranger Name when there is one.
- A script reads \`met\` as false for the entity until the player meets it. A relationship or a **Known In** pick can meet it at the start. \`meet()\` makes the player meet the entity, as for any stranger.
- The player meets the entity the same way as any stranger: the narration uses its Name while it is at the player's location, or a script calls \`meet()\`. See **Stranger Name** for the rules.

The field takes placeholders and rolls. It shows in Advanced mode, in the World Editor only.`,
  },
  'worldEditor.unidentifiedName': {
    title: 'Unidentified Name',
    wikiPage: 'World-Editor-Items',
    wikiAnchor: 'unidentified-name',
    body: `Hides what an item is until the story reveals it. Until then, the player sees the **Unidentified Name**, such as "Cloudy Vial", in place of the **Name**.

- Leave it blank to show the Name.
- Fill this field or the **Unidentified Description**, and every copy of the item starts unidentified.
- The player sees the Unidentified Name in the **Inventory** tab, in the log and in the Help window.
- The AI narrator sees both names. It can reveal the real one when the story does, or a script can call \`copy.reveal()\`.
- A copy that is out of sight first comes into view and stays unidentified. A second reveal identifies it.

The field takes placeholders and rolls.`,
  },
  'worldEditor.unidentifiedDescription': {
    title: 'Unidentified Description',
    wikiPage: 'World-Editor-Items',
    wikiAnchor: 'unidentified-description',
    body: `Shows the player a different description until the story reveals the item. Until then, the player sees the **Unidentified Description** in place of the **Player-Facing Description**.

- Leave it blank to show the Player-Facing Description.
- Fill this field or the **Unidentified Name**, and every copy of the item starts unidentified.
- The two fields work apart. You can write a description with no Unidentified Name, or the other way around.
- The item's effects apply while it is unidentified.

The field takes placeholders and rolls.`,
  },
  'worldEditor.statChanges': {
    title: 'Stat Changes',
    wikiPage: 'World-Editor-Traits',
    wikiAnchor: 'stat-changes',
    body: `Changes a stat while this trait is active. Each row has a stat, a number, and the field to change.

**Each type adds to the stat. It doesn't set it.** \`+20\` on a stat that starts at 50 gives 70, not 20.

- **Starting Value** changes where the stat starts.
- **Min** raises the Min. A value below the new Min rises with it. A negative number only cancels another trait's raise, and it never goes below the Min you wrote on the stat.
- **Max** raises or lowers the Max. A value above the new Max drops with it.
- **Regen** adds to the stat's Regen. A negative number drains.

On an entity's trait, the rows change that entity's own stats.

**The AI never reads Stat Changes.** It reads that you're *Sickly*, not that the trait costs you 20 Vigor. The change shows only in the stat's value.`,
  },
  'worldEditor.statAvailability': {
    title: 'Stat Availability',
    wikiPage: 'World-Editor-Traits',
    wikiAnchor: 'stat-availability',
    body: `Turns a stat on or off while this trait is active. Each row names a stat and picks **Enable** or **Disable**. The row overrides the stat's own **Enabled** checkbox.

A disabled stat isn't shown to the player or sent to the AI. Its Regen and scripts don't run.

When two active traits change the same stat, the trait lower in the trait list wins. The row says when this applies, and it links to the other trait.`,
  },
  'worldEditor.traitBody': {
    title: 'Body',
    wikiPage: 'World-Editor-Traits',
    wikiAnchor: 'body',
    body: `Changes which equipment slots the trait's owner has while the trait is active. For example, a *Wolf Form* trait sets the Body to *Wolf*, which has no hand slots.

- A world trait changes the player. An entity's own trait changes that entity.
- **None** leaves no slots at all.
- Items in a slot the new Body lacks come off and stay in the inventory. Where a slot holds fewer items, the item equipped last comes off first.

When two active traits set a Body, the one switched on last wins. When it switches off, the one before it takes over. With none left, the Body goes back to the one the owner started with.`,
  },
  'worldEditor.traitSliders': {
    title: 'Sliders',
    wikiPage: 'World-Editor-Traits',
    wikiAnchor: 'sliders',
    body: `Sets the Avatar's sliders while the trait is active. Find it on the trait's **Appearance** tab. For example, an *Elf* trait sets Ear Shape to 1.

- Each picked slider gets a **Set To** number, 1 by default. Any number works.
- The slider takes this value in place of the player's own setting. A stat bound to the slider still adds on top.
- When the trait switches off, the player's own setting comes back.
- A world trait changes the player's Avatar. An entity's own trait changes that entity's model.
- Select **Preview** at the bottom left of the panel to set sliders and colors on the Avatar itself. **Save** writes them to the trait.

When two active traits set the same slider, the one switched on last wins.`,
  },
  'worldEditor.placeholderPins': {
    title: 'Placeholder Pins',
    wikiPage: 'World-Editor-Traits',
    wikiAnchor: 'placeholder-pins',
    body: `Keeps a placeholder at one value while this trait is active. For example, a *Redhead* trait pins Hair Color to *copper*. The playthrough keeps its own roll, and the roll comes back when the trait switches off.

You can type a value that isn't in the placeholder's list. The box suggests the authored values, and the game uses any text as written.

A value that is one chip pins the part that chip holds. Pin a Wildcard to the value that holds *isAsian*, and every chip of that Wildcard reads that variant.

The box names such a value after the part it holds, as the **Values** list does. A chip inside a longer value is text, so the box shows what it resolves to.

**Pin a blueprint** to pin each owner's own copy of it. Albus's *Paladin* pins his copy of *Class Garb*, and no other copy. A link can replace this list for one owner.

When two active traits pin the same placeholder, the trait lower in the trait list wins. The row says when this applies.

A stat descriptor's pin outranks a location's, and a location's outranks a trait's. A placeholder value's pin ranks below all three. A script pin outranks all four.`,
  },
  'worldEditor.locationPins': {
    title: 'Placeholder Pins',
    wikiPage: 'World-Editor-Locations',
    wikiAnchor: 'placeholder-pins',
    body: `Keeps a placeholder at one value while the player is here. For example, the *Fen* pins Weather to *fog*. When the player leaves, the playthrough's own roll shows again.

A sub-location doesn't get its parent's pins. You can type a value that isn't in the placeholder's list, and the game uses it as written.

A stat descriptor's pin outranks a location's. A location's outranks a trait's and a placeholder value's. A script pin outranks all four.

Only one location is current at a time, so two locations never pin together. The row says which source wins when another one pins the same placeholder.`,
  },
  'worldEditor.pinsOnPlaceholder': {
    title: 'Placeholder Pins',
    wikiPage: 'World-Editor-Placeholders',
    wikiAnchor: 'pins',
    body: `Every pin aimed at this placeholder, from a stat descriptor, a location, a trait or another placeholder's value. Each pin is stored on its source. A change here is a change on the source, and it shows there too.

Rows are in rank order: a stat descriptor outranks a location, a location a trait, and a trait a placeholder value. A script pin outranks all four.

Within one kind, the source lower in its own list wins. Each row names the other sources that pin this placeholder, and which one wins.

**Add Pin** picks the kind of source, then the source, and adds an empty pin there for you to fill in. A row's first box moves its pin to another source of the same kind. The value box suggests this placeholder's values, and the game uses any text as written.`,
  },
  // One topic for the stat, trait and world Scripts tabs. A saved help link to `worldEditor.statCode` still opens it.
  'worldEditor.scriptBox': SCRIPTS_TOPIC,
  'worldEditor.statCode': SCRIPTS_TOPIC,
  // Opened from the linked copy's footer menu in the World Editor, once on a profile's first link, and by
  // both update reviews. One topic for all: the dialog a reader opened decides which tab they read first,
  // so every tab stands alone.
  'library.linkedContent': {
    title: 'Linked Content',
    wikiPage: 'LinkedContent',
    wikiAnchor: '-linked-content',
    tabs: [
      {
        label: 'Linked Copies',
        body: `A **linked copy** is an entity or a dictionary in a world that follows a **library item**. When you save the library item, every linked copy of it receives the change the next time you open its world. A copy that follows nothing is an **independent copy**.

**Who owns the library item decides what an edit does.**

- If the item is yours, the copy stays **Linked**, and saving the world writes your edit to the item.
- If the item is another author's, your first edit makes the copy a **Local replacement**. Their updates still reach you for review.

**How a copy becomes linked**

- **Save to Library** saves the copy as a library item and links the copy to it.
- **Add From Library…** adds a copy with **Link to Library** on by default. It's in the menu of the **Add to Entities** or **Add to Dictionary** icon button (+).
- **Import Entity…** and **Import Dictionary…**, in the same menus, add a copy from a file with the same choice.
- **Link to Library Item…**, in an independent copy's menu, links the copy to a library item you pick.

**The three link states.** A linked row carries a 🔗 marker in the list, and its footer button reads **Open in Library**. Hover either one to read the state and the name of what the copy follows.

| | |
|---|---|
| **Linked** | The copy follows its library item. Updates replace its content. If the item is yours, saving the world writes your edits to it. |
| **Local replacement** | You edited a copy of another author's item. No update overwrites it. **Keep Mine** is its default in every review. |
| **Link pending save** | You linked the copy in this editing session. The link is written when you save the world. |

**Open in Library** opens the library item. **Unlink** turns the copy into an independent copy, and its content stays as it is.

**Connect World References.** A library item names the Placeholder or location it needs by an id from its own world. When this world doesn't answer that reference yet, a step asks what each one means here. **Save Connections…** in the copy's menu reopens the step, so you can connect the reference to another one.`,
      },
      {
        label: 'Updates',
        body: `**Check for Updates** is on a library tile and in a linked copy's menu. It compares the library item against every world that holds a copy. If no world is behind it, nothing opens.

**Update Available** lists one row per world, with the copy's state and an action.

| | |
|---|---|
| **Update** | Replaces the copy with the library item. The default for a **Linked** copy. |
| **Use Author's** | Replaces a **Local replacement** with the library item. Your edits go. |
| **Keep Mine** | Keeps the copy as it is. The default for a local replacement. |
| **Unlink** | Keeps the copy as it is and stops following the library item. |

**View Changes** shows each changed field twice, under **This world** and **Library**. For an imported file, the file's name replaces **Library**.

Choosing an action changes nothing until **Apply Updates**. **Cancel** applies none of it. If one world fails, it keeps the content it had and offers **Retry**.

**Keep Mine remembers the revision you answered for.** That revision doesn't come back. The next revision asks again.

**Update This World** opens when you choose **Update an existing copy** for a community world. It lists the linked copies the update would change, with the same four actions. A local replacement starts on **Keep Mine**, so the update keeps your edits.

- **New Required Content** lists sources the author now requires. Each one downloads and links when you apply.
- **No Longer Required** lists copies the author stopped requiring. Each one stays in your world as an independent copy.`,
      },
      {
        label: 'Publishing',
        body: `**Publishing a world.** The publish dialog lists every library item the world's copies follow under **Linked Content**. **Include as required** makes that item download and link with the world. An unchecked item is published inside the world with no source to follow.

A source of yours with no listing yet reads **Will publish with this world**. It publishes first, as **Unlisted** unless you choose **Public**. If one source is refused, the world stays unpublished, and **Retry** continues from where it stopped.

**Publishing an entity or a dictionary.** **Listing** is **Public** or **Unlisted**. An unlisted listing reaches players only inside a world that requires it.

**Compatible Worlds** lists your published worlds that hold a linked copy. Check **Offer as add-on** for a world, and the world's author reviews the offer. The review state shows beside each world you offered it for.

**Manage Add-ons** on your own world card opens the offers other authors made for your world. Each offer is **Approved**, **Unreviewed** or **Declined**.

| | |
|---|---|
| **Approved** | The add-on is listed under **Approved Add-ons** on your world's download. |
| **Unreviewed** | The add-on is listed under **Community Add-ons**. |
| **Declined** | The add-on is in neither tab. It stays downloadable from its own listing. |

A source that changed after your answer keeps that answer and gains **Updated since review**. **Mark Reviewed** accepts the change. Nothing changes until **Save Changes**.`,
      },
      {
        label: 'Downloading',
        body: `A community world's details window lists what it brings under **Linked Content**.

| | |
|---|---|
| **Required** | Comes with the world. You don't choose it. |
| **Approved Add-ons** | Optional. The world's author approved it. |
| **Community Add-ons** | Optional. Its own author offered it, and the world's author hasn't reviewed it. |

The download button counts what it downloads, so it reads **Download World + 3 Items**. Downloading places each item in your library and links the world's copies to it. Each copy opens in the World Editor as **Linked** with its source named.

A required item that doesn't download leaves the world out of your library, and **Retry** finishes it. An add-on that doesn't download leaves the world ready and gets its own **Retry**.

**Compatible Worlds** on an entity's or a dictionary's listing shows the worlds it's offered for. Downloading the entity or dictionary gets only that item.

**Importing a world file.** The file records what each copy follows. On the machine that wrote it, every link is restored.

Elsewhere, **Link bundled content to my library** saves each bundled item as a library item of yours, and the world's copies follow it. Unchecked, the copies follow nothing.

If you already have a copy's source, the copy follows your item. When the file's copy differs from your item, it arrives as a **local replacement**, which no update overwrites.`,
      },
      {
        label: 'Repairs',
        body: `**Check Sources** in the Test Bench's **Issues** list asks the server about every published source this world's copies follow. It asks only when you press it, so a downloaded world stays playable with no connection.

A source the server reports as deleted reads as a source its author removed. Any other failure reads as a source that couldn't be checked, with **Retry Check**.

Each copy with a missing source gets its own repair and its own **Apply**.

| | |
|---|---|
| **Replace from Library** | The copy follows a different library item. |
| **Unlink and Keep Content** | The copy becomes an independent copy. |
| **Remove from World** | The copy is deleted from this world. |

**A republished source is a new listing.** It never reconnects on its own. Use **Replace from Library** to follow it.

While a required source reads as removed, **Enter World**, **Quick Start** and **Publish World** are off for that world. The reason names the source and has **Repair Sources**, which opens the editor. **Edit World** and **Load Game** stay open.

**Removing a library item** leaves every copy that followed it as an independent copy, with its content untouched. No world breaks.`,
      },
    ],
  },
};
