# ⚙️ Formaquestion Settings
<!-- keywords: gear, options, configure help, help settings, turn off search, plain chat -->
<!-- route: formaquestionSettings -->

**Formaquestion Settings** sets how help answers: the AI it uses, its prompts, its Tools and its searches. The mascot has its own page: see [Formaquestion Mascot](Formaquestion-Mascot).

To open it, select the **More Actions** icon button (⋮) in the Formaquestion title bar, then **Settings**. The window closes while the settings are open and opens again when you close them. It has five tabs: **General**, **Endpoint**, **Prompts**, **Tools** and **Mascot**.

This device keeps each setting. The settings are not in a backup or an export.


## How to Use a Different AI for Help
<!-- keywords: other model, separate ai, help uses another endpoint, change the model for help, faster help, free model for help, different server, own endpoint, answer endpoint, search endpoint, small model -->
<!-- route: formaquestionSettings.endpoint#answer-endpoint -->

1. Select **More Actions**, then **Settings**.
2. Select the **Endpoint** tab.
3. In the editor, select **Duplicate**. The new preset is a copy of the one under the heading, and **Answer Endpoint** moves to it.
4. Enter the endpoint, token and model of the other AI.

Your game keeps its own AI.

- The editor always edits the preset that **Answer Endpoint** uses. To edit another preset, set **Answer Endpoint** to it first.
- To send the **AI Search** request to a small, fast model, set **Search Endpoint** to a preset. See [Endpoint](#endpoint).

## How to Edit the Preset That Help Uses
<!-- keywords: change the endpoint settings, edit the model, edit the url, change the token, which preset am I editing, endpoint editor heading, answer preset, copy a preset, tune a variant, delete a preset, follow active, editor has no list -->
<!-- route: formaquestionSettings.endpoint#answer-endpoint -->

1. Open the **Endpoint** tab in **Formaquestion Settings**.
2. Read the heading above the editor. It says **Edit** and the name of the preset that **Answer Endpoint** uses.
3. To edit another preset, set **Answer Endpoint** to it. The heading and the editor change with it.
4. To try a variant, select **Duplicate**. The copy opens in the editor, and **Answer Endpoint** moves to it. The first preset stays as it was. A built-in engine preset and a hosted preset have no **Duplicate**.

While **Answer Endpoint** is **Use Active Endpoint**, the heading names the active preset and says **Active Endpoint**. A delete of the preset in use moves **Answer Endpoint** back to **Use Active Endpoint**. A change to a preset applies to the game too. See [Endpoint](#endpoint).

## How to Turn On Reasoning for Help
<!-- keywords: thinking, think harder, reasoning model, hard question, effort, reasoning level, show thinking, think before answering, better answers, deep answer, slow answers, thinking block -->
<!-- route: formaquestionSettings.general#reasoning -->

1. Select **More Actions**, then **Settings**. The **General** tab opens first.
2. Select the **Reasoning** checkbox.
3. Pick a level in the list next to it. The list starts at **Global**, and it is off while the checkbox is clear. An endpoint that takes a budget shows a slider in place of the list.
4. Ask a question. The **Thinking** block above the answer shows how the AI reasoned.

Answers take longer with reasoning on. The row shows a note instead of the checkbox when your model cannot reason. See [General](#general).

## How to Turn On Sort Questions
<!-- keywords: sort questions, faster answers, small talk, chat with the mascot, kinds of questions, sorting request, sorting endpoint, less context, smaller request -->
<!-- route: formaquestionSettings.general -->

1. Select **More Actions**, then **Settings**. The **General** tab opens first.
2. Select the **Sort Questions** checkbox.
3. Ask a question.

The sorting request goes out at the same time as the **AI Search** request. It reads your question, your last question and answer, and the open screen. The answer request then holds:

| Sorted as | What the answer request holds |
|---|---|
| 💬 Small talk | Your question and your earlier questions, with no guide and no world |
| ❓ How-to | The guide and your world, without the help for scripts |
| 🧩 Code | Everything, the same as with **Sort Questions** off, always with the help for scripts, and without the **Creation** part |
| 🌍 Your world | Your world, and in a game the story so far, with no guide |
| 🛠️ Make something | With **Creation** on, in the World Editor: your world's name, description and entity names, and two of your entities as samples, with no guide. On any other screen: your question, and a reply that making entities works in the World Editor. With **Creation** off: everything, the same as with **Sort Questions** off |

- Your AI decides from the question, not the open **Scripts** tab, whether a question is about code.
- Each of your own Tools goes only to the kinds it lists in **Sorted As**. See [Tools](#tools).
- A question about your world with no world open gets a reply that no world is open.
- With **Read the World** off, a question about your world goes as it does with **Sort Questions** off.
- When you ask for two things at once, your AI answers the first one and asks you to send the second one next.
- When the reply of the sorting request is unclear, or the request fails, the question goes as it does with **Sort Questions** off.
- **Sorting Endpoint** on the **Endpoint** tab sets where the sorting request goes. See [Endpoint](#endpoint).

## How to Turn On Semantic Search
<!-- keywords: search by meaning, meaning search, embedding, download search model, better matches, similar words, find sections by idea, small model download, smarter search, retry download, recommended, offer, card, turn on, no thanks, dismiss -->
<!-- route: formaquestionSettings.general#semantic-search -->

1. Select **Turn On** on the **Semantic Search** card at the top of the window. See [The Semantic Search Card](Formaquestion#the-semantic-search-card).
2. Wait while the app downloads the small model. The card shows a progress bar.
3. Ask a question, or type in the **Search** tab. When the download is done, both also find sections by meaning.

If no card shows, use the setting instead:

1. Select **More Actions**, then **Settings**. The **General** tab opens first.
2. Select the **Semantic Search** checkbox. A progress bar shows on the row.

If the download fails, the checkbox clears and **Retry** shows. The card has **Retry** too. Until the model is ready, questions use the other sources.

## How to Write Your Own Help Prompt
<!-- keywords: change how answers read, custom prompt, edit the help prompt, answer style, shorter answers, tone of help, duplicate default, rewrite instructions, reset prompt, compare to default, prompt chips -->
<!-- route: formaquestionSettings.prompts#preset -->

1. Select **More Actions**, then **Settings**.
2. Select the **Prompts** tab.
3. Select **Duplicate & Edit**, or **Add New Preset…** in the preset list.
4. Select a prompt, such as **Answer**, and edit the text. Keep the chips that the app reads back.
5. Close the dialog and ask a question. The next request uses your text.

**Default** is read-only, so your copy is the one you edit. Select **Compare** to see what a new release changed, or **Reset** to start again. Select **Preview** above a prompt to read it as your AI gets it. See [Prompts](#prompts).

## How to Change the Length of a Help Reply
<!-- keywords: tokens, token limit, temperature, repetition penalty, shorter replies, longer answers, creative, sampler, search options, lookup options, custom checkbox, reply length, cut off answer -->
<!-- route: formaquestionSettings.prompts#preset -->

1. Open the **Prompts** tab in **Formaquestion Settings**.
2. Select a custom preset. **Default** shows its options read-only.
3. Select **Options** under **Answer**, **Search**, **Sorting**, **Creating** or **Lookup**.
4. Check **Max Output**, **Custom Temperature** or **Custom Repetition Penalty**, then set a value.

- Each prompt has its own options for its own request. **Code**, **Editor World** and **Game World** have none: they go out with the answer request.
- Clear a box to return that field to the value of **Default**.
- The preset file carries the options. See [Prompts](#prompts).

## How to Add a Tool to Formaquestion
<!-- keywords: custom tool, own tool, new function, chat assistant, world lookup, create a tool, tool for help, function call, my tools, script tool, give the ai a function, extend the assistant -->
<!-- route: formaquestionSettings.tools#new-tool -->

1. Select **More Actions**, then **Settings**.
2. Select the **Tools** tab.
3. Under **My Tools**, select **New Tool**.
4. Fill in **Definition**, **Parameters** and **Handler**.
5. Select **Save Tool**. The new Tool is on.
6. Open a world in the game or the editor.
7. Ask a question that needs the Tool.

Your AI calls the Tool when the question needs what it returns. The endpoint must take function calls. See [Tools](#tools).

## How to Move a Custom Preset to Another Device
<!-- keywords: export preset, import preset, back up help prompts, share my prompts, copy to a new pc, transfer, preset file, help-preset.json, send to a friend, sync prompts, new computer -->
<!-- route: formaquestionSettings.prompts#preset -->

1. On the first device, open the **Prompts** tab.
2. Select your custom preset.
3. Select **Export**. On a narrow screen, open the **Preset Actions** menu first. Formamorph saves a `.help-preset.json` file.
4. Copy the file to the other device.
5. On the other device, open the **Prompts** tab.
6. Select **Import** and choose the file.

The import adds the preset and selects it. See [The Preset File](#the-preset-file).

## How to Use Formaquestion as a Plain Chat
<!-- keywords: chat assistant, no guide, ordinary chat, talk to the ai, turn off search, no sources, bare question, general chatbot, roleplay assistant, stop the guide, only my question -->
<!-- route: formaquestionSettings.general#keyword-search -->

1. Select **More Actions**, then **Settings**. The **General** tab opens first.
2. Clear **Keyword Search**.
3. Clear **AI Search**.
4. Clear **Semantic Search**.
5. Clear **Use the Open Screen**.
6. Select the **Tools** tab and check that **read_guide** is off.
7. Ask a question.

The request now holds your question alone.

- A question about code still sends the **Quick Reference** and the **Code** prompt.
- The answer shows no notice that it is not from the guide.
- To give the chat a purpose, write your own prompt and add Tools.
- Set **History Length** to the number of earlier exchanges you want it to keep.

## General
<!-- keywords: mascot switch, turn off the mascot, turn on the mascot, chat style, window style, reasoning, thinking, effort, reasoning budget, answer reveal, answer animation, fade in, keyword search, ai search, open screen, history length, extra request, earlier questions, no guide, sort questions, small talk, faster answers -->
<!-- route: formaquestionSettings.general -->

The **General** tab sets how the window looks and how your AI answers. It also sets how a question finds its guide sections, and what the request holds.

- Its rows are in four groups: **Window**, **Answer**, **Search** and **Request**.
- **Mascot**, **Chat Style**, **Mascot Position**, **Mascot Scale**, **Backdrop** and **Confirm Before Opening the Wiki** are in **Window**.

| Setting | Default | What it does |
|---|---|---|
| **Mascot** | On | Shows the mascot with the chat and answers in its **Voice**. It takes effect at once, with no **Save**. With it off, the **Mascot** tab disables every control and shows a link back to this row. |
| **Chat Style** | Auto | Sets how the window looks: **Auto**, **Minimal** or **Full**. **Auto** uses **Bubble** while the **Mascot** is on. The **More Actions** menu has the same three choices. |
| **Mascot Position** | Outside | Sets where the mascot appears around the chat: **Above**, **Below**, **Inside** or **Outside**. The **More Actions** menu has the same choices. Under **Bubble**, only **Inside** and **Outside** show. Hidden while the mascot is off. |
| **Mascot Scale** | 25% | Sizes the mascot. **Auto** fits the height of the chat. A percent, from 25% to 150%, is a share of the base image's size in pixels. This device keeps it, outside your mascot card. Hidden while the mascot is off. |
| **Backdrop** | 60% | Shades the screen behind the chat so the text stands out, from 0 to 100% in steps of 5. The backdrop shows with the **Bubble** and **Minimal** styles. Set 0 for none. |
| **Confirm Before Opening the Wiki** | On | Asks before **Open Wiki** opens your browser. **Don’t Ask Again** in the confirm clears it. See [How to Open the Wiki](Formaquestion#how-to-open-the-wiki). |
| **Reasoning** | Off | Lets your AI reason before it answers, so answers take longer. The levels and the budget come from the **Answer Endpoint**. **Global** follows **Native Reasoning** under Settings → Output. The **AI Search** request never reasons. For a model that cannot reason, a note shows in place of the control. |
| **Answer Reveal** | Fade | Sets how each answer appears as it streams. **Choose reveal animation…** opens the same dialog as **Narration Reveal**, with its own values: a change to one never changes the other. With every effect off, answers show with no animation. |
| **Keyword Search** | On | Finds the guide sections that have the words of your question |
| **AI Search** | On | Sends one more request for each question, in which your AI chooses guide sections from the list of headings |
| **Semantic Search** | Off | Finds guide sections by meaning, with a small model on your device. The first time you turn it on, the app downloads the model and shows the progress. If the download fails, the checkbox clears and **Retry** starts it again. Until the model is ready, questions use the other sources. A card at the top of the window offers it first. See [The Semantic Search Card](Formaquestion#the-semantic-search-card). |
| **Sort Questions** | Off | Sends one short request first, in which your AI sorts your question: small talk, a how-to, code, your world, or a request to make something. Each kind then sends only what it needs. See [How to Turn On Sort Questions](#how-to-turn-on-sort-questions). |
| **Use the Open Screen** | On | Sends the open screen, your selected item, and its guide section |
| **Read the World** | On | Sends the parts of the open world that match your question. See [How to Ask About Your World](Formaquestion#how-to-ask-about-your-world). |
| **Creation** | Off | Lets you ask for entities in the World Editor and add them. See [How to Add an Entity From an Answer](Formaquestion#how-to-add-an-entity-from-an-answer). |
| **History Length** | 4 | Sets how many earlier questions and answers each request holds, from 0 to 20. 0 sends each question alone. |

- **The selected item.** A stat, trait, entity, location or dictionary entry open in the World Editor, or the entity open in the Entity Editor. Its name goes with the screen, such as "Scripts tab of the stat Courage".
- **Questions about code.** A question about code always sends the **Quick Reference** of the Scripts Guide. On the **Scripts** tab of a stat, a trait or the world, it comes second, after the tab's own section. From any other screen, it comes first, and the answer request does not name the screen.
- **No search.** With **Keyword Search**, **AI Search** and **Use the Open Screen** all off, no other guide section can reach your AI. A question that is not about code then goes alone. The answer shows no notice that it is not from the guide.
- **No match.** When a search runs and finds no section, the answer still shows that notice.

## Endpoint
<!-- keywords: different model, other endpoint, separate ai, small model for search, help endpoint, answer endpoint, search endpoint, sorting endpoint, follow active, same as answer, same as search -->
<!-- route: formaquestionSettings.endpoint -->

The **Endpoint** tab sets where help questions go. Help can use a different AI than your game.

| Setting | Default | What it does |
|---|---|---|
| **Answer Endpoint** | **Use Active Endpoint** | Sends your questions to this endpoint for answers |
| **Search Endpoint** | **Same as Answer** | Sends the **AI Search** request to this endpoint. A small, fast model works well here. |
| **Sorting Endpoint** | **Same as Search** | Sends the sorting request of **Sort Questions** to this endpoint. A small, fast model works well here. |
| **Creating Endpoint** | **Same as Answer** | Sends requests to make an entity to this endpoint, while **Sort Questions** and **Creation** are on |

- **Use Active Endpoint** follows the endpoint you pick in **Settings** → **Endpoints**.
- A preset you choose shows whether it answers. Select **Recheck** to check again.
- If you delete a preset that a setting names, that setting goes back to its default.
- The **Ask** tab says when your AI is not connected. It checks the **Answer Endpoint**.

**Answer Endpoint** and **Search Endpoint** share one row. **Sorting Endpoint** and **Creating Endpoint** are under them. Under the four is the same preset editor as **Settings** → **Endpoints**, on the same presets.

- The editor has no preset list. It always edits the preset that **Answer Endpoint** uses. Its heading, **Edit** and the preset's name, changes when you change **Answer Endpoint**. While **Answer Endpoint** follows the active endpoint, the heading names that preset and says **Active Endpoint**.
- The preset actions beside the heading are icon buttons, and each tooltip reads its name. On a narrow screen, they are in the **Preset Actions** menu.
- **Duplicate** adds a copy of the preset you are editing. **Answer Endpoint** moves to the copy, and the copy opens in the editor.
- Delete the preset that **Answer Endpoint** uses, and **Answer Endpoint** goes back to **Use Active Endpoint**.
- A change to a preset applies everywhere that preset is used, the game included.

## Prompts
<!-- keywords: help prompt, compare to default, edit prompt, custom prompt, prompt preset, duplicate preset, rename preset, delete preset, reset prompt, chips, answer prompt, search prompt, lookup prompt, code prompt, code rider, stat code answers, read-only, export preset, import preset, preset file, move preset, another device -->
<!-- route: formaquestionSettings.prompts -->

The **Prompts** tab holds the help prompts: the text that tells your AI how to answer. The prompts are in a preset, apart from the prompt presets of your game. A change to the game's preset never changes help.

| Prompt | What it does |
|---|---|
| **Answer** | Tells your AI how to answer from the guide sections in the request |
| **Search** | Tells your AI how to choose guide sections from the list of headings, for the **AI Search** request |
| **Sorting** | Tells your AI how to sort a question by the help it needs, for the sorting request of **Sort Questions** |
| **Creating** | Tells your AI how to make entities in the World Editor, for a request to make an entity while **Sort Questions** and **Creation** are on |
| **Lookup** | Tells your AI how to answer when it can read more sections through the lookup function |
| **Code** | Tells your AI how to write scripts. It goes after a question about code, and after any question from the **Scripts** tab of a stat, a trait or the world while **Use the Open Screen** is on |
| **Editor World** | Tells your AI how to explain your world. It goes after a question that sends parts of your world in the World Editor |
| **Game World** | Tells your AI how to answer about your story without spoilers. It goes after a question that sends parts of the world in a game |

- **Default** is read-only. Its text comes from the app, so each release updates it.
- **Duplicate & Edit** in the notice above a Default prompt makes a copy of the preset and opens it for edits. The **Duplicate** icon button beside the preset list does the same. Each icon button beside the list has a tooltip that reads its name. **Add New Preset…** in the list asks for a name first.
- A custom preset has **Rename**, **Reset** and **Delete** beside the list. On a narrow screen, they are in the **Preset Actions** menu. **Reset** returns every prompt and its options to the text of this release, after it asks. When you delete the preset in use, help goes back to **Default**.
- **Reset** at the bottom right of a custom prompt returns that one prompt to the text of this release, after it asks. A custom preset does not get the updates of a release on its own.
- **Compare**, beside **Reset**, opens a diff of your text against the text of this release. The button is off for a prompt that equals the default.
- In the diff, text you added is tinted, and text you removed is struck through. **Raw** shows your text as it is.
- This device keeps the presets, with the other Formaquestion settings.
- **Export** beside the list saves the preset to a file, with your **My Tools** and the switches of the **Tools** tab. **Default** exports too, and importing that file adds a custom preset.
- **Import** beside the list adds the preset from a file and makes it the one in use.

Each prompt editor is a chip editor, as in **Settings** → **Prompts**. The chips are the parts the app reads back or names elsewhere:

| Chip | In | What it sends |
|---|---|---|
| **Not in Guide Marker** | Answer, Lookup | The line your AI writes first when the guide does not cover the question. The app reads that line and shows the notice above the answer. |
| **Lookup Function** | Lookup | The name of the function your AI calls to read more guide sections |
| **Search Limit** | Search | The most sections one search reply names. The app reads that many sections at most, whatever the prompt says. |
| **Reply Format** | Search | The rule for how the search reply is written, so the app can read it |
| **Sorting Format** | Sorting | The rule for how the sorting reply names the kind of help, so the app can read it |
| **Mascot Voice** | Answer, Lookup, Creating | Your mascot's name and Voice: "You are Morphie." for the mascot that comes with the app, then the Voice, with a line that keeps the guide's steps and control names as the guide writes them. With the mascot off, or an empty Voice, it sends nothing. |

- A chip sends its text. Without the chip, nothing goes in its place. For example, remove the **Not in Guide Marker** chip from a custom Answer prompt, and your AI is not told to mark an answer that is not from the guide.
- The guide sections and your question are not in a prompt. The app builds that part of the request.

Each prompt editor has an **Edit** tab and a **Preview** tab. **Preview** shows the prompt as your AI gets it, with each chip replaced by its text. **Mascot Voice** shows your mascot's Voice while the mascot is on.

Each prompt that sends its own request has an **Options** row under it in the list of prompts. **Code**, **Editor World** and **Game World** have none. The options apply to that prompt's request:

- **Answer**: the answer request
- **Search**: the **AI Search** request
- **Sorting**: the sorting request
- **Creating**: a request to make an entity
- **Lookup**: the answer request when your AI can call **read_guide**

| Option | Default | What it does |
|---|---|---|
| **Max Output** | 800 tokens for **Answer**, **Lookup** and **Creating**, 150 for **Search**, 40 for **Sorting** | Sets how long the reply can run |
| **Custom Temperature** | 0.2, 0 for **Sorting**, and 0.7 for **Creating** | Sets how freely the reply is worded |
| **Custom Repetition Penalty** | 1 | Sets how hard the reply avoids repeated words |

Each preset has its own options, and a copy of a preset takes them. **Default** shows them read-only, so each release updates them. A box that is off uses the default.

### The Preset File

For the steps, see [How to Move a Custom Preset to Another Device](#how-to-move-a-custom-preset-to-another-device). The file holds:

- the eight prompts and the options of each prompt
- your **My Tools**, with their **Sorted As** lists
- the switches and **Max Calls per Request** of the **Tools** tab
- the **Read the World** switch

It holds no endpoint, token or other setting.

- If you already have a preset with that name, the import adds a number to the new name.
- If you already have a Tool with that name, the import skips that Tool and names it. Your Tool keeps its own switch.
- The switches in the file apply to its Tools and to the built-in functions, such as **read_guide**.
- A file with a Script Tool that is on shows a warning, because a script runs code when the AI calls it.
- A file from a different version, or a file that is not complete, is refused. Nothing changes. A file with no **Sorting**, **Creating**, **Editor World** or **Game World** prompt, or no **Read the World** switch, still imports: those parts take their defaults.

## Tools
<!-- keywords: functions, function calls, guide lookup, lookup mode, read_guide, read more sections, local model, max calls, tool calls, not supported, my tools, own tools, custom tools, chat assistant, new tool, import tools, export tools, tool pack, world text, dice, roll, random number, test stat code, check code, test_script, code test, broken code -->
<!-- route: formaquestionSettings.tools -->


The **Tools** tab lists the functions your AI can call while it answers. It uses the layout of **Settings** → **Tools**: the list on the left, and the selected function on the right. **Built-In** holds the functions that ship with the app. **My Tools** holds the Tools you make for help questions.

| Function | Default | What it does |
|---|---|---|
| **read_guide** | Off | The guide lookup. It starts off, and it runs only while the **Answer Endpoint** takes function calls. Your AI reads more guide sections when the sections in the request don't answer the question. It can search the guide by words or read sections by id. It roughly quadruples the input tokens of a question. |
| **roll** | Off | A dice roll. Ask your AI to roll, such as "roll two six-sided dice", and it rolls and gives you the total. |
| **test_script** | On | The code test. On a question about scripts, your AI checks its code and runs it once before it answers, as **Test Code** does. It tests a script in any timing, on a stat, a trait or the world. A During AI Output script rewrites a sample sentence, and a When a Trait Switches script fires on a sample trait. It reads the world you have open, so the names of its stats, traits, entities, placeholders and dictionaries can go to your **Answer Endpoint**. When your AI names no stat or trait, it tests the stat you have selected. It never changes the world. With no world open, it checks the code without the names and does not run it. Your AI is told to fix what the test finds, and to give its best code and name the error that remains after its last call. |

- **Enabled** turns a function on or off. This device keeps the switches, for every help preset.
- **Max Calls per Request** sets how many times your AI can call the function for one question, from 1 to 20. Leave it blank for the default: 3 for **read_guide**, 4 for **roll**, 3 for **test_script**.
- The panel also shows the text your AI reads about the function, and its parameters.
- **read_guide**, **roll** and **test_script** are part of the app. You can't edit, copy or delete them.
- The **Tools** switch under **Settings** → **Output** does not apply to Formaquestion.

A function goes out only when the **Answer Endpoint** takes function calls. If it doesn't, or the app hasn't confirmed it yet, the tab shows a note. Each question then goes out as one request with no function.

### How to Let Your AI Read More of the Guide
<!-- keywords: lookup mode, read more sections, local model, function calls, read_guide, deeper answers, search the guide itself, tool calls, bigger context -->

1. Set **Answer Endpoint** to a model that takes function calls, such as a local model.
2. Open the **Tools** tab, select **read_guide**, and turn on **Enabled**. It starts off.
3. Ask a question. Your AI reads more sections when it needs them, and the answer lists them under **Sources**.

Turn **Enabled** off to skip the extra input tokens. Each question then goes out as one request with the matching sections in it.

### My Tools

Make your own Tools for help questions, and Formaquestion can work as a chat assistant for the world you have open. They are a list of their own:

- A Tool you make here never goes to a game prompt.
- A Tool from **Settings** → **Tools** does not show here.

The controls of **My Tools**:

- **New Tool** opens the same editor as **Settings** → **Tools**. See [The Tool Editor](Tools#the-tool-editor). A Tool can't take the name of a built-in function: **read_guide**, **roll**, **test_script** or **set_face**, the mascot's face call.
- **Enabled** turns a Tool on or off. A Tool you save here starts on, and a Tool from a Tool pack is off until you turn it on. A help preset file sets the switches of its own Tools. This device keeps the switches.
- **Max Calls per Request** caps the calls for one question. Leave it blank for the default of 4.
- **Sorted As** sets which kinds of question get the Tool: **Small talk**, **How-to**, **Code**, **Your world** and **Make something**. A new Tool goes to **How-to**, **Code** and **Your world**.
- **Sorted As** matters only with **Sort Questions** on. With it off, or when the sorting reply is unclear, every Tool that is on goes with every question. See [How to Turn On Sort Questions](#how-to-turn-on-sort-questions).
- **Edit** and **Delete** act on the selected Tool. **Delete** can't be undone.
- **Try It** runs the Tool on the world you have open in the game or the World Editor, else on a sample world.

A Tool that's on reads the world you have open, so text from that world can go to your **Answer Endpoint**. The tab says so under the list.

- In the game, a Tool reads the playthrough as a game Tool does.
- In the World Editor, it reads the world as you have it, unsaved edits included.
- With the World Editor open from the game, a Tool reads the editor's world until you close it.
- On the Main Menu, a Tool reads no world and returns its empty result.

### How to Share Tools With the Game's List
<!-- keywords: tool pack, tools.json, import tools, export tools, move a tool, gameplay tool, copy a tool, share a tool, pack file -->

1. Next to **My Tools**, select **Export Tools** to save `tools.json`, or **Import Tools** to add Tools from a file.
2. Open the file in the other list. It is the same Tool pack as **Settings** → **Tools**, so a pack from one list opens in the other.

- An import skips a Tool you already have, and names it.
- A file with a Script Tool shows a warning, because a script runs code when the AI calls it.
