# 🧪 Test Bench
<!-- keywords: playtest, trial run, sanity check, simulator, free to use, lint, without spending tokens -->

The Test Bench checks a world before you play it. It is in the World Editor and works in Simple and Advanced mode.

The bench shows only what the app computes from your world. It never calls the AI, so it works offline, costs nothing and updates as you type. Only **Check Sources** needs the server. To see what the AI writes, play a turn.

## How to Check a World for Issues
<!-- keywords: errors, warnings, problems, bugs, validate, doctor, broken, debug, fix, flask icon, health check, diagnose, scan for mistakes, auto repair, verify before upload, number on beaker -->
<!-- route: worldEditorBench.issues -->

1. In the World Editor, select the **Test Bench** flask button at the right of the header. The **World Doctor** popover opens.
2. Read the findings. Errors come first, then warnings, then info.
3. Select a name on a finding to go to that item in the editor.
4. Select **Fix** or **Fix All** when a finding has one. Otherwise, edit the item yourself.

The list updates as you edit. To see the full bench, select **Open Test Bench** at the bottom of the popover.

## How to Test Which Dictionary Entries Trigger
<!-- keywords: keywords, lorebook, activate, fire, debug, scan depth, matched, lore not showing up, world info, why was it skipped, entry ignored, simulate a message, paste sample story, codex -->
<!-- route: worldEditorBench.triggers#scene-text -->

1. Open the Test Bench, then select the **Triggers** tab.
2. Paste story text into the **Scene text** box. If you've played this world, select **Paste Last Turn**. It fills the box and **History** from your latest save.
3. Read **Dictionary**. Each entry says why it activated, or why it didn't.
4. Select a marked word in your text to go to the entity or entry it matched. Select it again to step through every row that shares the word.

To test scan depth, open **History** and paste earlier messages, oldest first, with a `---` line between them.

## How to Preview the Opening
<!-- keywords: first message, intro, start, greeting, test, see, first turn, simulate new game, beginning scene, what newcomers see, reroll randoms, initial values, as a different class, sample run -->
<!-- route: worldEditorBench.opening#placeholder-rolls -->

1. Open the Test Bench, then select the **Opening** tab.
2. In **Testing as**, pick the trait to test, such as a class. If the world has personas, pick one in **Persona**.
3. Read the **Opening Pool**. Select an opening to see what it sends on turn one.
4. Select **Reroll** to draw new Wildcard values.

If a new game can start in more than one place, pick one in the **Starting Location** list. With no location marked as a start, every location is in the list.

## What the Bench Shows
<!-- keywords: is it accurate, reliable results, what it cannot tell, unable to predict ai, same as real game, simulation scope -->

The bench runs the same functions a real turn runs, so its results match play. It shows the text and lists the AI receives. It doesn't guess what the AI does with them.

Where a result depends on the AI's choice, the bench says so. For example, **AI Context** lists every place a player can go. The AI decides whether an action counts as travel.

## Opening the Bench
<!-- keywords: where to find it, beaker button, orange counter, dock or float, detach panel, side by side, simulate as a class, choose test place, instruments list -->

The **Test Bench** flask button is at the right of the World Editor's header. Its badge counts the rows on the **Issues** tab. Dismissed rows don't count.

- An amber badge counts new findings: ones you haven't seen yet.
- A gray badge counts every finding, after you've seen them all.

### The Bench Popover

The flask opens the Bench Popover first. It holds only the **World Doctor** list, so you can fix a few findings without the full bench. Select **Open Test Bench** at the bottom of the popover for the full panel. Select the flask again to close it.

### The Full Panel

The full panel has a tab for each Instrument. Each Instrument answers one question about your world.

| Tab | Answers |
|---|---|
| **Issues** | What is wrong with this world? |
| **Triggers** | What does this text match and activate? |
| **AI Context** | What does the AI get from this location? |
| **Opening** | What does a new game look like? |

On desktop, the panel can sit inside the editor's list panel or beside it. Select **Pop Out** or **Embed in Editor** in the panel's header to move it. The app remembers your pick. On mobile, the panel opens as a sheet over the editor.

### Testing As and At

**Triggers** and **AI Context** read the bar under the tabs: **Testing as** a persona, **at** a location. **Opening** reads **Testing as** only, and starts at its own **Starting Location** pick.

- **Testing as** lists the personas this world offers, plus **None** or your Custom Persona. It starts on the persona a new game would start on.
- **at** lists every location. **Nowhere** tests with no location. Picking a persona moves it to that persona's start, until you pick a location yourself.

Your pick stays when you switch tabs. A broken pin on an active trait, the **at** location or a starting stat shows in red under the bar. The bar also names the stats your persona adds or removes.

## Issues
<!-- keywords: ignore a warning, suppress, silence a finding, bring back hidden warning, world too large, file size meter, linter, simple mode hides findings -->
<!-- route: worldEditorBench.issues -->

The **Issues** tab is the World Doctor. It checks your world's structure: broken links, unused placeholders, stats that start out of range and more. It never judges your writing.

- **Publish Size** shows how much of the publish limit the world uses. Images, sounds and 3D models count toward it. A world over the limit adds a warning that opens the **Media** tab, where you can find the heavy files.
- Each finding is one row with the items it names. A **New** tag marks a row you haven't seen.
- **Fix** repairs a row when the fix is safe. **Fix All** repairs every item in the row.
- **Dismiss** hides a row. It is an eye icon button on the row, and its tooltip reads "Dismiss". A row about a missing source can't be dismissed.
- To bring a row back, open **dismissed** at the bottom, then select **Restore** on the row. **Restore** is an icon button with that tooltip.
- **Mark All Seen** clears the **New** tags. Closing the bench also marks the list seen. A row whose text changes shows as **New** again.
- This browser remembers seen and dismissed rows for each world. An update to a downloaded world clears the seen marks.
- A world with no findings shows **No Problems Found**.
- In **Advanced** mode, a row lists the scripts that write one stat field, in the order they run. Each script reads what the one before it wrote, so check that the writes add up the way you want.

Some checks run only when you ask:

- **Check Scripts** runs every script of the world, every stat and every trait, entities' included. Each runs once, in its own timing, in the order of the **Scripts** tab, and reads what the scripts above it wrote. A script on a trait that is off still runs, but later scripts don't read its writes. The list shows what fails. Each finding names the script by its name, or by its owner and timing. It shows prompts as it runs: each `player` question shows, one after another, for you to answer. It shows in Advanced mode when the world has a script with code.
- **Check Sources** asks the server whether the library items this world's copies follow still exist. It shows when a copy follows a published item. A copy whose source is gone gets a repair list and **Apply**. The repairs are **Replace from Library**, **Unlink and Keep Content** and **Remove from World**. When the server can't be reached, **Retry Check** asks again.

After a run, each button reads **Check Again**.

In Simple mode, findings about hidden fields fold into one line. Switch to Advanced mode to see them.

## Triggers
<!-- keywords: vector search, similarity matching, rag, near miss, name detection test, quoted names ignored, lore token budget, chat history depth -->
<!-- route: worldEditorBench.triggers -->

The **Triggers** tab is the Activation Tester. Paste text, and it shows what that text matches and activates.

- **Entities Present** lists each entity the text names, and whether its name, part of its name or an alias matched. A name only inside quotes is a mention, so it doesn't count.
- **Dictionary** lists every entry, book by book. An activated entry shows the keyword that matched. An entry that didn't activate says why, for example a keyword that almost matched.
- **Rendered Context** shows the lore text the AI would get, with its token cost.
- **History** holds earlier messages, so you can test an entry's scan depth.

**Semantic** adds meaning-based matches. It's off each time you open the World Editor, so a keyword result never looks like a semantic one. It needs embeddings, which the app builds when you play the world with **Semantic Lore** on.

Matching warnings from **Issues** show on the rows they name, with the same **Fix**.

## AI Context
<!-- keywords: prompt size, context window, token budget, exits from here, unreachable place, where can players travel, sent in full, per location cost -->
<!-- route: worldEditorBench.aiContext -->

The **AI Context** tab shows what the AI gets from the location in the **at** list.

- The top line estimates a turn's token cost from here.
- **Context Blocks** lists each block of text the prompts can use, with its cost. Select a block to read it.
- **Destinations** lists every place the story can move the player to from here, up to 3 steps away. A place more than one step away shows the places on the way. A place not on the list can't be reached in one turn.
- **Entities the AI Is Told About** shows whether each entity arrives in full, as a summary or by name only.

The bench places entities as a new game does at the opening hour. A Unique entity is at the location of its first [start](World-Editor-Entities#starts). A Generic entity is at the location of each of its starts.

## Opening
<!-- keywords: odds of each intro, probability, likelihood of repeat, raw first request, perks at start, try different stat levels, what wildcards rolled, custom presets ignored -->
<!-- route: worldEditorBench.opening -->

The **Opening** tab shows turn one of a new game for your **Testing as** pick.

- **Opening Pool** lists every opening a new game here can draw, with its chance.
- **Stats at Game Start** shows each stat's starting value. Drag a slider to see which descriptor the AI gets at other values. Dragging never changes the world. When traits change a stat, the row shows by how much.
- **Active Traits** lists the traits that are on at the start, with their pins and the stats they add or remove.
- **Placeholder Rolls** shows what each Wildcard drew, every value's chance, and the chance of a repeat.
- **First Prompt** shows the **System Prompt** and **Opening User Turn**. An Opening Narration shows **Page One** instead, since no request goes out on turn one.

The **First Prompt** uses the default prompts. Custom prompt presets aren't read here.

The bench places entities as a new game does at the opening hour. A Unique entity begins at its first [start](World-Editor-Entities#starts). A Generic entity begins at each of its starts.

## Related

- [🛠️ World Editor](WorldEditor)
- [📖 Dictionary](World-Editor-Dictionary)
- [🎬 Openings](World-Editor-Openings)
- [🔗 Linked Content](LinkedContent)
