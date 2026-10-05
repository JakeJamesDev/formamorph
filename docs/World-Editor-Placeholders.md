# 🧩 World Editor: Placeholders
<!-- keywords: random text, fill in blanks, mad libs, dynamic wording, reusable snippets -->
<!-- route: worldEditor.placeholders -->

> 🛠️ Part of the [World Editor](WorldEditor) guide.

Placeholders are reusable pieces of world text: an eye color, a street name, a deity. You define one, then put it into your writing as a chip. Each placeholder has a **Name** and a list of **Values**. When the story runs, each chip shows one of those values.

The **Placeholders** tab, the palette strip and value pins are **Advanced mode only**. The `{` menu, the [Built-in chips](#built-in-chips) and the [**Values** tab](#the-values-tab) work in both modes.

## Why it exists
<!-- keywords: replayability, variety, different each time, avoid rewriting, same detail everywhere -->

Placeholders let a world change without a rewrite. Write *"the {{Eye Color}} stranger"* one time, and it reads as a real detail in each playthrough. It can be the same detail each time, or a new one.

## How to Make a Placeholder
<!-- keywords: wildcard, variable, random, macro, template, curly braces, random value, brace menu, list of options, randomizer, snippet, pick from list, constant -->
<!-- route: worldEditor.placeholders#list-toolbar -->

1. Switch the World Editor to Advanced mode, and open the **Placeholders** tab.
2. Type the name in the search box, such as *Eye Color*.
3. Select **+**, then **Add Placeholder**. The new placeholder opens.
4. Under **Values**, type a value and press Enter. Repeat for each value.
5. Leave **Kind** on **Wildcard** to pick one value at random, or select **Object** to show all values. A placeholder with one value is a Variable. Use it for one fact that you edit in one place.
6. Open a field that has the chip picker, such as an entity's **AI-Facing Description**. Type `{` and pick the placeholder.

Or type `{` in a field and the new name, then pick **New Placeholder "…"** in the menu. A placeholder needs one value at least, or its chip shows nothing.

## How to Weight Values
<!-- keywords: chance, probability, odds, rarity, random, likely, percent, more often, rare, common, frequency, bias, favor, never pick, ratio -->
<!-- route: worldEditor.placeholders -->

A Wildcard with two values or more can weight them.

1. Select the placeholder.
2. Under **Values**, select a value chip. A pop-out opens.
3. Type a number in **Draw Weight**. A value with weight 2 rolls twice as often as a value with weight 1.
4. Optional: in the **Chips** style, select the eye button beside **Values**. Its tooltip reads **Show roll chances**, and each chip then shows its chance.

In the **Multiline** style, each value has its own weight box. Weight 0 keeps the value in the list and never picks it.

## How to Pin a Value
<!-- keywords: fixed, lock, force, condition, override, trait, location, always same, set when, depends on, tie to perk, stop random, hard set, conditional text -->
<!-- route: worldEditor -->

A pin keeps a placeholder at one value while a condition is true. To pin from a trait:

1. Select the trait, and open its **Pins** tab. The tab needs Advanced mode.
2. Under **Placeholder Pins**, select **Add Placeholder Pin**.
3. Pick the placeholder, then pick or type the value.

To pin from a location, use the location's **Pins** tab the same way. To pin from a stat band, use the pin button on the [descriptor row](World-Editor-Stats#pins-on-a-descriptor).

To see or add every pin aimed at one placeholder:

1. Select the placeholder.
2. Under **Placeholder Pins** at the bottom of the panel, select **Add Pin**.
3. Pick the kind of source: **Stat Descriptor**, **Location**, **Trait** or **Placeholder Value**.
4. Pick the source, then type or pick the value in the new row.

## How to Override a Copy
<!-- keywords: blueprint, per entity, change for one, entity version, customize, npc own options, adjust npc wording, restore, undo edits, different outfit, extra option, remove option, character specific -->
<!-- route: worldEditor.placeholders -->

A copy is an entity's own version of a [blueprint](#blueprints). It appears by itself when a trait needs it.

1. In the **Placeholders** tab, find the entity's name in the list, and select the copy under it, such as *Albus.Class Garb*.
2. Under **Blueprint Values**, change a value's text or weight, or select its remove button.
3. Optional: under **Own Values**, select **Add Value** to add a value only this entity has.
4. To undo one value, select its **Reset**. To undo every change, select **Reset to Blueprint** in the footer.

To change the value for every copy, select **Edit Blueprint** in the footer and edit the blueprint.

## The Panel
<!-- keywords: sample output, try a roll, list style -->

| Control | What it does |
|---|---|
| **Name** | The name the chip shows |
| **Kind** | **Wildcard** or **Object**. The line under it says what the placeholder resolves to. |
| **Preview** | Shows a sample roll. It shows when the placeholder has a value. |
| **Values** | The list of values. **Chips** and **Multiline** pick how you edit them. |
| **Placeholder Pins** | Every pin aimed at this placeholder. **Advanced mode only.** |

In the **Chips** style, type a value and press Enter. In the **Multiline** style, select **Add Value**. Multiline suits long values and values with line breaks.

## Kind
<!-- keywords: difference, all at once, comma list, single constant, which to choose, one at random, nested template -->

The **Kind** row says what a placeholder is:

| Kind | Resolves to | Use it for |
|---|---|---|
| **Wildcard** | One value, picked at random. Every World chip of it shows that pick. | Variety |
| **Object** | All its values, joined with commas | A thing made of parts |
| **Variable** | Its one value. Either kind is a Variable while it has one value. Edit the value here, and every chip updates. | One fact in many places |

The toggle offers **Wildcard** and **Object**. A Variable has no button: the line under the toggle reads *A Variable* while the placeholder has one value. A new placeholder starts as a Wildcard. A placeholder with no values shows nothing, so give it one value at least.

> 💡 **A Variable can still roll.** When its one value contains Wildcard chips, the value is a template. The chips in it roll, and its own chips take World or Unique like a Wildcard.

## Draw Weight
<!-- keywords: benched, disable an option, zero means never, default is one, turn off option -->

Each value of a Wildcard with two values or more has a **Draw Weight**. A value with no weight counts as 1. Weight 0 keeps the value in the list and never picks it. The pop-out then reads **Benched**.

## Parts
<!-- keywords: nested, inside another, compose, sub item, pieces, combine several, arrow name -->

A value that is exactly one chip is a **part** of the placeholder that holds it. You address it as `Name › Part`. This is how you build an Object from other placeholders. Away from its owner, a part's chip reads with the owner's name, such as `Molly › Eyes`.

## World or Unique
<!-- keywords: same everywhere, different each spot, consistent across text, separate roll, duplicates, repeat result, scope, per use, two must differ -->

Each chip of a Wildcard chooses how it shares the roll. Select the placed chip to open its pop-out, and pick **World** or **Unique**:

| Scope | Behavior |
|---|---|
| **World** | Every World chip of this placeholder shows the **same** rolled value. One town name, the same in the whole world. |
| **Unique** | Each chip rolls on its own. Ten Unique *Eye Color* chips give ten independent rolls. |

A placeholder that can't roll locks the choice on **World**.

> ⚠️ **Independent doesn't mean different.** Two Unique chips can roll the same value. Three chips from a list of ten values show a repeat about 28% of the time. Where two chips *must* differ, such as two towns, give each its own placeholder with values the other doesn't have.

## How a chip reads in the editor
<!-- keywords: letter suffix, what does a mean, letters changed, custom caption, hover tooltip, display name, braces in text -->

| Chip | Reads as | Example |
|---|---|---|
| **World** | The placeholder's name | `Town Name` |
| **Unique** | The name plus a letter, one sequence per placeholder | `Town Name (A)`, `Town Name (B)` … `Town Name (AA)` |
| **Labeled** | The label you typed in the chip's pop-out | `Hometown` |

The letters follow the order of the world: entities first, in the order of the Entities tree. Then locations, traits, trait groups, stats, dictionaries, the world's own prompt fields and openings, and last the placeholders' own values.

- **Letters aren't stored.** Remove the first chip, and the next one becomes **(A)**. A letter tells two chips apart, but it isn't a permanent name.
- **Give a Unique chip a Label** in its pop-out when you want a name that stays. Only Unique chips have the **Label** field.
- **Hover a chip** to see its mode and its values.
- A chip in longer text keeps its braces where the name prints as plain text: `The {Tavern Name (A)} Inn`.

## The Values Tab
<!-- keywords: resolved text, preview filled in, edit inline, cycle options, tab greyed out, current result, see real wording -->

A text field that holds a chip has a **Values** tab beside **Edit**. It opens every chip in place and shows its current value.

- **Edit a value in place.** The change writes to the placeholder's value, or to the pin that sets it.
- **Step through the values** with **Previous Value** and **Next Value**.
- **Edit Value** in a chip's pop-out opens this tab.

The tab shows when the world has a placeholder. It is disabled until the text holds a chip.

## Built-in Chips
<!-- keywords: user macro, char macro, insert my name, hero name, double braces, sillytavern style, predefined, you or the player -->

The `{` menu lists two chips under **Built-in**, above your own placeholders. They need no placeholder of their own.

| Chip | Typed form | Reads as | Offered in |
|---|---|---|---|
| **Player Name** | `{{user}}` | The persona's name. With no persona: "you" in an opening, "the player" elsewhere. | Every prose field |
| **Character Name** | `{{char}}` | The name of the entity the text belongs to | An entity's own fields |

Type the typed form in any prose field, and it becomes the chip. In trait text the player carries, **Character Name** reads as **Player Name**. See [The Player Name Chip](Persona-Authoring#the-player-name-chip) and [The Character Name Chip](Persona-Authoring#the-character-name-chip).

## The roll stays for the playthrough
<!-- keywords: change mid game, persist, stays the same, reroll, decided when, after loading, fresh result, locked in, random -->

> 💡 A Wildcard rolls **one time, when a game starts**, and the save keeps the result. The stranger with gray eyes on turn one still has them on turn ninety. A loaded save changes nothing. A new game rolls again.

## Pins
<!-- keywords: precedence, ranking of sources, temporary, returns afterwards, script can set, where set from, four kinds, gathered in one list -->

A pin keeps a placeholder at one value while a condition is true. The playthrough keeps its own roll, and the roll shows again when the pin ends. Four things can pin a placeholder:

| Pin source | Active while | Set it on |
|---|---|---|
| A stat descriptor | The stat is in that band | The pin button on the [descriptor row](World-Editor-Stats#pins-on-a-descriptor) |
| A location | The player is there | The location's [**Pins** tab](World-Editor-Locations#placeholder-pins) |
| A trait | The trait is active | The trait's [**Pins** tab](World-Editor-Traits#placeholder-pins). A trait can [pin a blueprint](World-Editor-Traits#pins-by-blueprint), and each bearer's copy takes the pin. |
| A placeholder value | That value is the placeholder's current value | The pin button beside the value. Its pop-out has **Add Placeholder Pin**. |

When two sources pin the same placeholder, the higher row in this table wins. [Stat code](StatCodeGuide) can also pin and unpin a placeholder, and a code pin wins over all four.

The **Placeholder Pins** list at the bottom of a placeholder's panel gathers every pin aimed at it. A change there is a change on the source. **Add Pin** picks the kind of source, then the source, and adds an empty pin there for you to fill in.

## Where chips work
<!-- keywords: which fields, supported places, cant insert, shows raw text, not replaced, listing blurb, menu order, allowed boxes -->

Chips resolve **both** in the text the AI reads and in the text the player sees. Type `{` in each field that has the chip picker:

- names and descriptions of entities, locations, stats and traits
- stat descriptors and dictionary entries
- image tags
- openings
- both readme tabs
- the world's AI-Facing Description
- the values of other placeholders

The `{` menu lists the **Built-in** chips first, then ungrouped placeholders, then each group, then the placeholders of each owner. In an owner's own fields, that owner's placeholders come first.

A [blueprint chip](#blueprint-chips) works only in the text of an original trait and in blueprint and copy values.

> ⚠️ **The world's Player-Facing Description takes no chips.** The library shows it before a playthrough exists, so there are no rolls to use.

## Placeholders that belong to an entity or a dictionary
<!-- keywords: npc own variables, travels with card, portable, exported together, lorebook own list, private to one, owner -->
<!-- route: worldEditorEntity.placeholders -->

An entity, a dictionary book and a library persona can each have their own placeholders, on their **Placeholders** tab. These placeholders travel with their owner in an entity card, a dictionary file and a published listing. They show under their owner in the list, not in a group.

## Groups
<!-- keywords: organize variables, tidy shared list, sort tokens, folder tree -->

Groups are folders for the shared list, like the groups on the **Entities** tab. The **+** menu offers **Add Group**, **Add Placeholder** and **Add Blueprints Group**. Drag a placeholder under a group to put it there, and drag a group under another group to nest it.

Groups are for the editor only. They **never reach the AI**, and an entity card or a dictionary file doesn't keep them.

## Blueprints
<!-- keywords: template variable, per character version, move refused, cant drag out, in use notice, one per holder, why refused -->

A blueprint is a placeholder that exists to be copied. Each entity that needs it gets its own [copy](#copies), so one *Class Garb* can read a different value on each bearer.

Select **+**, then **Add Blueprints Group**. A group named **Blueprints** appears. It works like the [Blueprints group of the Traits tab](World-Editor-Traits#blueprints):

- **A world has one Blueprints group.** It stays at the top level and holds world placeholders and groups. **Add Blueprints Group** leaves the menu while one exists.
- **A blueprint is never a World placeholder.** One placeholder never reads different values in different places. With no Custom Persona entity, the player is the one bearer, so a blueprint reads its own values there.
- **A move out of the group is refused while something uses the blueprint.** A trait's text or pin, a blueprint value or a copy counts as a use. The notice names each use.
- **Remove the group, and the same check runs.** An unused group removes with no notice.

Move a world placeholder into the group to make it a blueprint. The move is refused while a chip or pin outside the allowed places names it, such as world text, a location or a stat descriptor.

## Copies
<!-- keywords: appeared on its own, auto created, cant rename, cant move, dimmed option, where did it come, dotted name, leftover, reword for one npc, joins another world -->

A copy is a placeholder that an entity owns. It reads its blueprint live, and it appears by itself.

- **A copy appears when a trait needs it.** Add, link or move a trait that pins or places a blueprint, and its bearer gets a copy. Copies of the blueprints that its values place come with it.
- **A top-level trait makes copies for every Playable and Persona-Only entity** and for the Custom Persona entity, so each playable persona can customize them.
- **A copy is named after its blueprint**, such as *Albus.Class Garb*. You can't rename it. Each owner has one copy per blueprint.
- **A copy stays with its owner.** A drag to another owner, the world list or a group is refused. **Duplicate** is hidden.
- **An untouched copy goes when its last use leaves.** A copy you edited stays, so your work is never deleted. The Test Bench notes it.

A copy's panel lists **Blueprint Values** and **Own Values**. A copy is **live until edited**. You change one value at a time:

| Change | What it does |
|---|---|
| Reword a value | The copy reads your text for that value |
| Change a weight | Set 0 to keep a value in the list and never pick it |
| Add a value | **Add Value** under **Own Values** adds an option that only this bearer has |
| Remove a value | The value stays in the list, dimmed and marked **Removed**. **Reset** restores it. |

A value that the blueprint adds later shows in every copy. A copy keeps its blueprint's value ids, so a pin that names a value still finds it after you reword it. **Reset** returns one value. **Reset to Blueprint** returns them all. **Blueprint changed** shows on a value when the blueprint changed it after your edit. **Edit Blueprint** in the footer selects the blueprint.

### Copies in Other Worlds

An entity card carries the blueprints its copies reach, so a copy keeps its origin. A library persona's links keep their overrides.

When an entity joins a world, each copy binds to a blueprint by id, then by unique name. With no match, the copy becomes a plain owned placeholder with its values, and the pins that named the blueprint move to it.

## Blueprint Chips
<!-- keywords: link icon on token, paste refused, cant use here, one text many npcs, holder own wording, fallback order, needs an owner -->

A blueprint chip reads the bearer's own copy. It shows a link glyph. Write one *Paladin* description with a *Class Garb* chip, and each Paladin's text reads that Paladin's garb.

Blueprint chips work in the text of an original trait, and in the values of a blueprint or a copy. Every other field refuses them, because a blueprint chip needs a bearer. The refusal covers typing, paste, the palette strip, find and replace, and import.

- **An original's Preview reads the blueprint's own values.** You see sensible text without picking a bearer.
- **The Test Bench can read the chip for a real bearer.** Use it to check each bearer's text.
- **A bearer with no copy reads the blueprint.** In a library persona's game, the persona's copy wins, then the Custom Persona entity's copy, then the blueprint.
- **A cast entity's pin changes only that entity's copy.** Albus's class never changes the player's description.
