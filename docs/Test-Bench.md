# 🧪 Test Bench
<!-- keywords: playtest, trial run, sanity check, simulator, free to use, lint, without spending tokens -->

The Test Bench checks a world before you play it. It lives in the World Editor and works in Simple and Advanced mode.

The bench shows only what the app computes from your world. It never calls the AI, so it works offline, costs nothing and updates as you type. To see what the AI writes, play a turn.

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
2. Paste story text into the **Scene text** box. If you've played this world, select **Paste Last Turn** to fill it from your latest save.
3. Read **Dictionary**. Each entry says why it fired, or why it stayed out.
4. Select a marked word in your text to jump to the entity or entry it matched.

To test scan depth, open **History** and paste earlier messages, oldest first.

## How to Preview the Opening
<!-- keywords: first message, intro, start, greeting, test, see, first turn, simulate new game, beginning scene, what newcomers see, reroll randoms, initial values, as a different class, sample run -->
<!-- route: worldEditorBench.opening#placeholder-rolls -->

1. Open the Test Bench, then select the **Opening** tab.
2. In **Testing as**, pick who you play.
3. Read the **Opening Pool**. Select an opening to see what it sends on turn one.
4. Select **Reroll** to draw new Wildcard values.

If the world has more than one starting location, pick one in the **Starting Location** list.

## What the Bench Shows
<!-- keywords: is it accurate, reliable results, what it cannot tell, unable to predict ai, same as real game, simulation scope -->

The bench runs the same functions a real turn runs, so its results match play. It shows the text and lists the AI receives. It doesn't guess what the AI does with them.

Where a result ends in the AI's choice, the bench says so. For example, **AI Context** lists every place a player can go. Whether an action counts as travel is the AI's call.

## Opening the Bench
<!-- keywords: where to find it, beaker button, orange counter, dock or float, detach panel, side by side, simulate as a class, choose test place, instruments list -->

The **Test Bench** flask button sits at the right of the World Editor's header. Its badge counts findings.

- An amber badge counts new findings: ones you haven't seen yet.
- A gray badge counts every finding, after you've seen them all.

### The Bench Popover

The flask opens the Bench Popover first. It holds only the **World Doctor** list, so you can fix a few findings without the full bench. Select **Open Test Bench** at its foot for the full panel. Select the flask again to close it.

### The Full Panel

The full panel has a tab for each Instrument. Each Instrument answers one question about your world.

| Tab | Answers |
|---|---|
| **Issues** | What is wrong with this world? |
| **Triggers** | What does this text make fire? |
| **AI Context** | What does the AI get from this location? |
| **Opening** | What does a new game look like? |

On desktop, the panel can sit inside the editor's list panel or beside it. Select **Pop Out** or **Embed in Editor** in the panel's header to move it. The app remembers your pick. On mobile, the panel opens as a sheet over the editor.

### Testing As and At

**Triggers**, **AI Context** and **Opening** read the bar under the tabs: **Testing as** who you play, **at** a location.

- **Testing as** lists the traits in groups where the player picks one. **Anyone** tests with no pick.
- **at** lists every location. **Nowhere** tests with no location.

Your pick stays when you switch tabs. A broken pin on your **Testing as** pick shows in red under the bar.

## Issues
<!-- keywords: ignore a warning, suppress, silence a finding, bring back hidden warning, world too large, file size meter, linter, simple mode hides findings -->
<!-- route: worldEditorBench.issues -->

The **Issues** tab is the World Doctor. It checks your world's structure: broken links, unused placeholders, stats that start out of range and more. It never judges your writing.

- **Publish Size** shows how much of the publish limit the world uses. Images, sounds and 3D models count toward it.
- Each finding is one row with the items it names. A **New** tag marks a row you haven't seen.
- **Fix** repairs a row when the fix is safe. **Fix All** repairs every item in the row.
- The eye button dismisses a row. Open **dismissed** at the bottom, then select the restore button to bring it back.
- **Mark All Seen** clears the **New** tags. Closing the bench also marks the list seen.

Some checks run only when you ask:

- **Check Stat Code** runs each stat's code and lists what fails. It shows in Advanced mode when a stat has code.
- **Check Sources** asks the server whether the library items this world's copies follow still exist. It shows when a copy follows a published item. A copy whose source is gone gets a repair list and **Apply**.

In Simple mode, findings about hidden fields fold into one line. Switch to Advanced mode to see them.

## Triggers
<!-- keywords: vector search, similarity matching, rag, near miss, name detection test, quoted names ignored, lore token budget, chat history depth -->
<!-- route: worldEditorBench.triggers -->

The **Triggers** tab is the Activation Tester. Paste text, and it shows what that text makes fire.

- **Entities Present** lists each entity the text names, and whether its name, part of its name or an alias matched. A name only inside quotes is a mention, so it doesn't count.
- **Dictionary** lists every entry, book by book. A fired entry shows the keyword that matched. An entry that stayed out says why, for example a keyword that almost matched.
- **Rendered Context** shows the lore text the AI would get, with its token cost.
- **History** holds earlier messages, so you can test an entry's scan depth.

**Semantic** adds meaning-based matches. It's off each time you open the bench, so a keyword result never looks like a semantic one. It needs embeddings, which the app builds when you play the world with **Semantic Lore** on.

Matching warnings from **Issues** show on the rows they name, with the same **Fix**.

## AI Context
<!-- keywords: prompt size, context window, token budget, exits from here, unreachable place, where can players travel, sent in full, per location cost -->
<!-- route: worldEditorBench.aiContext -->

The **AI Context** tab shows what the AI gets from the location in the **at** list.

- The top line estimates a turn's token cost from here.
- **Context Blocks** lists each block of text the prompts can use, with its cost. Select a block to read it.
- **Destinations** lists every place a player can go from here. A place not on the list can't be reached.
- **Entities the AI Is Told About** shows whether each entity arrives in full, as a summary or by name only.

## Opening
<!-- keywords: odds of each intro, probability, likelihood of repeat, raw first request, perks at start, try different stat levels, what wildcards rolled, custom presets ignored -->
<!-- route: worldEditorBench.opening -->

The **Opening** tab shows turn one of a new game for your **Testing as** pick.

- **Persona** picks who you play, when the world has persona choices.
- **Opening Pool** lists every opening a new game here can draw, with its chance.
- **Stats at Game Start** shows each stat's starting value. Drag a slider to see which descriptor the AI gets at other values. Dragging never changes the world.
- **Active Traits** lists the traits in force at the start, with their pins and stat changes.
- **Placeholder Rolls** shows what each Wildcard drew, every value's chance, and the chance of a repeat.
- **First Prompt** shows the **System Prompt** and **Opening User Turn**. An Opening Narration shows **Page One** instead, since no request goes out on turn one.

The **First Prompt** uses the default prompts. Custom prompt presets aren't read here.

## Related

- [🛠️ World Editor](WorldEditor)
- [📖 Dictionary](World-Editor-Dictionary)
- [🎬 Openings](World-Editor-Openings)
- [🔗 Linked Content](LinkedContent)
