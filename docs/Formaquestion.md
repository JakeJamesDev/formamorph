# ❓ Formaquestion
<!-- keywords: in-app manual, documentation, built-in tutor, what is this window, user guide, helper -->

Formaquestion is the help window. You can ask it a question, search this guide and read each guide page. The guide is part of the app, so the search and the pages work with no network and no AI.

> 📱 On a mobile-size screen, Formaquestion opens as a full-screen sheet. See [On Mobile](#on-mobile).

## How to Open Formaquestion
<!-- keywords: help, assistant, f1, faq, support, guide window, question mark, get assistance, shortcut key, hotkey, side tab, stuck, dismiss -->

1. Select the **Help** tab on the edge of the screen, or press F1.
2. To close the window, select **Close** at its top right. On Android, you can also use the back action.

The window stays open when you go to a different screen or open a dialog. You can use the dialog and the window together. Escape closes the dialog and leaves the window open.

## How to Ask a Question
<!-- keywords: help, ai help, chat, assistant, support, faq, answer, chatbot, citations, where it came from, query, explain to me, bot, inquire -->

1. Open Formaquestion.
2. Select the **Ask** tab. In the wide layout, the conversation is on the right.
3. Type your question in **Ask a Question**.
4. Select **Send**, or press Enter.
5. To read where the answer came from, select a section under **Sources**.

Your AI writes the answer from the guide sections that match your question. To end an answer early, select **Stop**. The text so far stays. See [Ask](#ask).

## How to Ask a Follow-Up Question
<!-- keywords: more, another, next, keep, continue, conversation, clear, new topic, reset chat, start over, thread, wipe history, remembers previous -->

1. Ask a question.
2. After the answer, type your next question in **Ask a Question**, such as "and then?".
3. Select **Send**.

The AI gets your earlier questions and its answers, so you do not have to say the topic again. To start again on a new topic, select **Clear Conversation** in the title bar's **⋮** menu.

## How to Ask About a Screenshot
<!-- keywords: image, picture, paste, upload, attach, what is this, screen capture, photo, snip, print screen, vision model, clipboard, identify button, show my screen, drag file -->

1. Turn on **Image Attachments**. See [Settings](Settings).
2. Open Formaquestion and select the **Ask** tab.
3. Paste a screenshot into **Ask a Question**, drop it on the field, or select **Attach images** and pick a file.
4. Type your question, such as "what is this?".
5. Select **Send**.

Your model must read images. The screenshot goes with that question only. A follow-up does not send it again.

## How to Search the Guide
<!-- keywords: find, look up, docs, wiki, manual, help, without ai, offline, keyword, documentation, results list, topic, query box, no network, filter -->

1. Open Formaquestion.
2. Select the **Search** tab.
3. Type two or more letters in **Search the Guide**.
4. Select a result to read its section.

The best matches are first. Each result shows the section, its page and the start of its text.

## How to Read a Guide Page
<!-- keywords: docs, wiki, manual, browse, contents, table of contents, help, chapters, topic list, article, index, all topics, back to list, documentation pages -->

1. Open Formaquestion.
2. Select the **Guide** tab.
3. Select a page to see its sections.
4. Select a section.

To go back to the list of pages, select **Contents** above the section.

## How to Get Help for the Screen You Have Open
<!-- keywords: this page, current, where am i, context, here, contextual, this dialog, this menu, relevant section, what am i seeing, explain this tab, suggested topic -->

1. Open the screen, dialog or tab that you need help with.
2. Open Formaquestion.
3. Select the row under **Help for This Screen**.

The row is the first item on the **Search** tab and on the **Guide** tab. It names the guide section for the screen, the dialog and the tab that you have open. It changes when you open a different one. A screen with no guide section shows no row. The row does not show while you search.

## How to Move and Resize the Window
<!-- keywords: drag, bigger, smaller, size, position, wide view, layout, title bar, corner handle, in the way, covers the screen, side by side, split, enlarge, relocate -->

1. Drag the title bar to move the window.
2. Drag the bottom right corner to change its size.

To see the contents and a section side by side, select **Wide View** in the title bar. Select it again to go back.

## How to Move the Help Tab
<!-- keywords: drag, edge, side, button, reposition, out of the way, blocking, left or bottom, arrow keys, floating, relocate, covers something, hide it, corner -->

1. Drag the **Help** tab along the edge of the screen. It goes to the nearest of the four edges.
2. Release it.

With the keyboard, press Tab until the **Help** tab has focus. Then press the arrow keys.

## How to Use a Different AI for Help
<!-- keywords: other model, separate ai, help uses another endpoint, change the model for help, faster help, free model for help, different server, own endpoint, answer endpoint, pick endpoint, small model -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**.
2. Select the **Endpoint** tab.
3. In the editor, select **Add New Preset**.
4. Enter the endpoint, token and model of the other AI.
5. Set **Answer Endpoint** to the new preset.

Your game keeps its own AI. To send the **AI Picks** request to a small, fast model, set **Pick Endpoint** the same way. See [Endpoint](#endpoint).

## How to Turn On Reasoning for Help
<!-- keywords: thinking, think harder, reasoning model, hard question, effort, reasoning level, show thinking, think before answering, better answers, deep answer, slow answers, thinking block -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**. The **General** tab opens first.
2. Select the **Reasoning** checkbox.
3. Pick a level in the list that appears.
4. Ask a question. The **Thinking** block above the answer shows how the AI reasoned.

Answers take longer with reasoning on. The row shows a note instead of the checkbox when your model cannot reason. See [General](#general).

## How to Turn On Semantic Search
<!-- keywords: search by meaning, meaning search, embedding, download search model, better matches, similar words, find sections by idea, small model download, smarter search, retry download -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**. The **General** tab opens first.
2. Select the **Semantic Search** checkbox.
3. Wait while the app downloads the small model. A progress bar shows on the row.
4. Ask a question. When the download is done, the search also finds sections by meaning.

If the download fails, the checkbox clears and **Retry** shows. Until the model is ready, questions use the other sources.

## How to Write Your Own Help Prompt
<!-- keywords: change how answers read, custom prompt, edit the help prompt, answer style, shorter answers, tone of help, duplicate default, rewrite instructions, reset prompt, compare to default, prompt chips -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**.
2. Select the **Prompts** tab.
3. Select **Duplicate & Edit**, or **Add New Preset…** in the preset list.
4. Select **Answer**, **Picks** or **Lookup**, and edit the text. Keep the chips that the app reads back.
5. Close the dialog and ask a question. The next request uses your text.

**Default** is read-only, so your copy is the one you edit. Select **Compare to Default** to see what a new release changed, or **Reset to Default** to start again. See [Prompts](#prompts).

## How to Add a Tool to Formaquestion
<!-- keywords: custom tool, own tool, new function, chat assistant, world lookup, create a tool, tool for help, function call, my tools, script tool, give the ai a function, extend the assistant -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**.
2. Select the **Tools** tab.
3. Under **My Tools**, select **New Tool**.
4. Fill in **Definition**, **Parameters** and **Handler**.
5. Select **Save Tool**. The new Tool is on.
6. Open a world in the game or the editor.
7. Ask a question that needs the Tool.

Your AI calls the Tool when the question needs what it returns. The endpoint must take function calls. See [Tools](#tools).

## How to Move a Custom Preset to Another Device
<!-- keywords: export preset, import preset, back up help prompts, share my prompts, copy to a new pc, transfer, preset file, help-preset.json, send to a friend, sync prompts, new computer -->

1. On the first device, open the **Prompts** tab.
2. Select your custom preset.
3. Select **Export**. Formamorph saves a `.help-preset.json` file.
4. Copy the file to the other device.
5. On the other device, open the **Prompts** tab.
6. Select **Import** and choose the file.

The import adds the preset and selects it. See [The Preset File](#the-preset-file).

## How to See What the App Sent for a Question
<!-- keywords: debug a question, wrong answer, why this answer, inspect the request, see the prompt, trace, missing section, request log, export json, bug report, what was sent to the ai -->

1. Ask a question.
2. Select **⋮** in the Formaquestion title bar, then **AI Context**.

The dialog shows one question per page, the newest first, with its request cards. See [AI Context](#ai-context).

## How to Use Formaquestion as a Plain Chat
<!-- keywords: chat assistant, no guide, ordinary chat, talk to the ai, turn off search, no sources, bare question, general chatbot, roleplay assistant, stop the guide, only my question -->

1. Select **⋮** in the Formaquestion title bar, then **Settings**. The **General** tab opens first.
2. Clear **Keyword Search**.
3. Clear **AI Picks**.
4. Clear **Semantic Search**.
5. Clear **Use the Open Screen**.
6. Select the **Tools** tab and check that **read_guide** is off.
7. Ask a question.

The request now holds your question alone. The answer has no note that it is not from the guide. To give the chat a purpose, write your own prompt and add Tools. Set **History Length** to the number of earlier exchanges you want it to keep.

---

## The Window
<!-- keywords: f1 key behavior, stays on top, remembers position, off screen, focus cursor, narrow or wide, disappeared, always visible -->

Formaquestion is one window for the whole app. It shows above every dialog, and it keeps its conversation, its search text and its open section while the app is open.

| Control | What it does |
|---|---|
| Title bar | Drag it to move the window |
| **Wide View** | Changes between the narrow and the wide layout. It stays lit while the wide view is on |
| **⋮** | Opens a menu with **Clear Conversation**, **AI Context** and **Settings** |
| **Close** | Closes the window |
| Bottom right corner | Drag it to change the size of the window |

F1 does one of three things:

| When you press F1 | Result |
|---|---|
| The window is closed | The window opens |
| The window is open, and you are typing somewhere else | The cursor goes to the window |
| The cursor is in the window | The window closes |

- The window stays whole on the screen. When the browser window gets smaller, Formaquestion moves back inside it.
- This device keeps the place and the size of the window. They are not in a backup or an export.
- The narrow layout shows one tab at a time. The wide layout shows the search field and the contents on the left, and the conversation or a section on the right. **Back to Conversation**, above a section, shows the conversation again. The layout changes at a width of 560 pixels, so the corner changes it too.
- While the welcome animation plays, the **Help** tab does not show and F1 does nothing.

## Ask
<!-- keywords: privacy, what is sent, reads my saves, hallucinate, inaccurate, general knowledge note, history lost, send disabled, which model answers, reload -->

The **Ask** tab sends your question to your AI, together with the guide sections that match it. The answer shows as the AI writes it.

- **Sources**, under an answer, lists the guide sections that the AI got. Select one to read it.
- **Thinking**, above an answer, shows how the AI reasoned, when your model reasons. It starts closed. Open or close one, and later answers start the same way.
- When the guide does not cover your question, the AI answers from general knowledge. A note above the answer says that it is not from the guide and can be wrong about Formamorph. **Nearest Sections** then takes the place of **Sources** and lists the guide sections closest to your question.
- The request holds your question and those guide sections. It holds nothing from your worlds or your saves.
- The request also holds your last four questions and the AI's answers to them, as text. It does not hold their guide sections again. **History Length** sets how many.
- Before the answer, the app sends one more short request, while **AI Picks** is on. In it, your AI gets the list of every guide heading and picks the sections that answer your question. The answer then uses those picks together with the sections that the search finds. When that request fails or picks no section, the answer uses the search alone.
- The search for a follow-up also uses your previous question, so a short question such as "and then?" finds the same topic.
- With **Image Attachments** on, a question can carry up to 4 images, the same as an action. **Attach images** shows next to the field, and a paste or a drop on the field adds an image. The images go with that question only, and the app does not store them.
- **Clear Conversation**, in the **⋮** menu, removes every question and answer, and ends an answer that is coming in.
- While a game turn generates, **Send** waits. **Search** and **Guide** still work.
- The answer is in your **AI Language**. Control names stay as the guide writes them. See [Settings](Settings).
- Enter sends the question. Shift+Enter starts a new line.
- **Stop** ends an answer and keeps its text.
- With no AI connected, **Send** shows the guide sections that match your question. The Demo AI always counts as connected.
- When the AI does not answer, an error message shows, and the guide sections that match your question show in place of the answer. Text that came before the failure stays.
- The conversation stays while the app is open, also when you close the window or go to a different screen. The app does not store it, so a reload or a restart empties it.
- The answer comes from the **Answer Endpoint**, with the **Reasoning** setting. See [Formaquestion Settings](#formaquestion-settings).

An answer can be wrong. Use **Sources** to check it against the guide.

## Search
<!-- keywords: ranking, results order, plural, nothing found, release notes, minimum letters, latest changes, scoring -->

The **Search** tab finds sections by the words you type. It needs no network and no AI.

- A search starts at two letters.
- A word in a section's heading counts more than a word in its text.
- A section that has more of your words is higher in the list than a section that repeats one word.
- A plural finds the singular: "blueprints" finds **Blueprint**.
- Guide sections are higher in the list than changelog sections.
- A question such as "what's new?" or "what changed?" lists the newest release first. Name a version, such as "what changed in 3.1.1?", to see that release first.
- **No sections match** shows when no word matches.

The search reads each page of this guide, the [Glossary](Glossary), the [World Format](WorldFormat) page and the newest releases in the [Changelog](Changelog).

In the wide layout, the results replace the contents on the left while the search field has two or more letters.

## Guide
<!-- keywords: chapter list, part numbers, on this page, internal links, external website, expand page, collapse -->

The **Guide** tab lists each page of this guide. Select a page to show or hide its sections.

- **Introduction** is the text at the top of a page.
- A long section is in parts. Each part has a number, such as **(Part 2)**.
- **On This Page**, under a section, lists the other sections of the same page.
- A link to a guide page opens that section in the window.
- A link to a website opens in your browser.

## Formaquestion Settings
<!-- keywords: gear, options, configure help, help settings, turn off search, plain chat -->

**Formaquestion Settings** opens from **Settings** in the **⋮** menu of the Formaquestion title bar. The window closes while the settings are open and opens again when you close them. It has four tabs: **General**, **Endpoint**, **Prompts** and **Tools**.

- The Formaquestion window stays above the settings, so you can change a setting and ask a question to see the effect.
- This device keeps each setting. The settings are not in a backup or an export.

### General
<!-- keywords: reasoning, thinking, effort, reasoning budget, answer reveal, answer animation, fade in, keyword search, ai picks, open screen, history length, extra request, earlier questions, no guide -->

The **General** tab sets how your AI answers, how a question finds its guide sections, and what the request holds. Its rows are in three groups: **Answer**, **Search** and **Request**.

| Setting | Default | What it does |
|---|---|---|
| **Reasoning** | Off | Lets your AI reason before it answers, so answers take longer. The levels and the budget come from the **Answer Endpoint**. **Global** follows **Native Reasoning** under Settings → Output. The **AI Picks** request never reasons. For a model that cannot reason, a note shows in place of the control. |
| **Answer Reveal** | Fade | Sets how each answer appears as it streams. **Choose reveal animation…** opens the same dialog as **Narration Reveal**, with its own values: a change to one never changes the other. With every effect off, answers show with no animation. |
| **Keyword Search** | On | Finds the guide sections that have the words of your question |
| **AI Picks** | On | Sends one more request for each question, in which your AI picks guide sections from the list of headings |
| **Semantic Search** | Off | Finds guide sections by meaning, with a small model on your device. The first time you turn it on, the app downloads the model and shows the progress. If the download fails, the checkbox clears and **Retry** starts it again. Until the model is ready, questions use the other sources. |
| **Use the Open Screen** | On | Sends the screen you have open and its guide section |
| **History Length** | 4 | Sets how many earlier questions and answers each request holds, from 0 to 20. 0 sends each question alone. |

With **Keyword Search**, **AI Picks** and **Use the Open Screen** all off, no guide section can reach your AI. The request then holds your question alone, and the answer has no note that it is not from the guide.

When a search runs and finds no section, the answer still gets that note.

### Endpoint
<!-- keywords: different model, other endpoint, separate ai, small model for picks, help endpoint, answer endpoint, pick endpoint, follow active, same as answer -->

The **Endpoint** tab sets where help questions go. Help can use a different AI than your game.

| Setting | Default | What it does |
|---|---|---|
| **Answer Endpoint** | **Use Active Endpoint** | Sends your questions to this endpoint for answers |
| **Pick Endpoint** | **Same as Answer** | Sends the **AI Picks** request to this endpoint. A small, fast model works well here. |

- **Use Active Endpoint** follows the endpoint you pick in **Settings** → **AI Endpoints**.
- A preset you choose shows whether it answers. Select **Recheck** to check again.
- If you delete a preset that a setting names, that setting goes back to its default.
- The **Ask** tab says when your AI is not connected. It checks the **Answer Endpoint**.

Under the two settings is the same preset editor as **Settings** → **AI Endpoints**, on the same presets.

- Its preset list chooses the preset to edit. It does not change where the game or help sends requests.
- **Add New Preset** adds a copy of the preset you are editing, and opens it in the editor.
- A change to a preset applies everywhere that preset is used, the game included.

### Prompts
<!-- keywords: help prompt, compare to default, edit prompt, custom prompt, prompt preset, duplicate preset, rename preset, delete preset, reset prompt, chips, answer prompt, pick prompt, lookup prompt, read-only, export preset, import preset, preset file, move preset, another device -->

The **Prompts** tab holds the help prompts: the text that tells your AI how to answer. The prompts are in a preset, apart from the prompt presets of your game. A change to the game's preset never changes help.

| Prompt | What it does |
|---|---|
| **Answer** | Tells your AI how to answer from the guide sections in the request |
| **Picks** | Tells your AI how to pick guide sections from the list of headings, for the **AI Picks** request |
| **Lookup** | Tells your AI how to answer when it can read more sections through the lookup function |

- **Default** is read-only. Its text comes from the app, so each release updates it.
- **Duplicate & Edit** in the notice above a Default prompt makes a copy of the preset and opens it for edits. The **Duplicate** button beside the preset list does the same. **Add New Preset…** in the list asks for a name first.
- A custom preset has **Rename** and **Delete** beside the list. When you delete the preset in use, help goes back to **Default**.
- **Reset to Default** above a custom prompt returns that one prompt to the text of this release. A custom preset does not get the updates of a release on its own.
- **Compare to Default** above a custom prompt opens a diff of your text against the text of this release. Text you added is tinted. Text you removed is struck through. **Raw** shows your text as it is. The button is off for a prompt that equals the default.
- This device keeps the presets, with the other Formaquestion settings.
- A custom preset has **Export** beside the list. It saves the preset to a file, with your **My Tools** and the switches of the **Tools** tab. **Default** has no export.
- **Import** beside the list adds the preset from a file and makes it the one in use.

Each prompt editor is a chip editor, as in **Settings** → **Prompts**. The chips are the parts the app reads back or names elsewhere:

| Chip | In | What it sends |
|---|---|---|
| **Not in Guide Marker** | Answer, Lookup | The line your AI writes first when the guide does not cover the question. The app reads that line and shows the notice above the answer. |
| **Lookup Function** | Lookup | The name of the function your AI calls to read more guide sections |
| **Pick Limit** | Picks | The most sections one pick reply names. The app reads that many picks at most, whatever the prompt says. |
| **Reply Format** | Picks | The rule for how the pick reply is written, so the app can read the picks |

A chip sends its text, and no chip sends nothing. Remove the **Not in Guide Marker** chip from a custom Answer prompt, and your AI is not told to mark an answer that is not from the guide. The guide sections and your question are not in a prompt: the app builds that part of the request.

The **Answer** prompt has an **Options** row under it in the list of prompts:

| Option | Default | What it does |
|---|---|---|
| **Max Output** | 800 tokens | Sets how long an answer can run |
| **Custom Temperature** | 0.2 | Sets how freely the answer words its steps |
| **Custom Repetition Penalty** | 1 | Sets how hard the answer avoids repeated words |

Each preset has its own options, and a copy of a preset takes them. **Default** shows them read-only, so each release updates them. A box that is off uses the default. The **Picks** request keeps its own values.

#### The Preset File

See [How to Move a Custom Preset to Another Device](#how-to-move-a-custom-preset-to-another-device) for the steps. The file holds the three prompts, the answer options, your **My Tools**, and the switches and **Max Calls per Request** of the **Tools** tab. It holds no endpoint, token or other setting.

- If you already have a preset with that name, the import adds a number to the new name.
- If you already have a Tool with that name, the import skips that Tool and names it. Your Tool keeps its own switch.
- The switches in the file apply to its Tools and to the built-in functions, such as **read_guide**.
- A file with a Script Tool that is on shows a warning, because a script runs code when the AI calls it.
- A file from a different version, or a file that is not complete, is refused. Nothing changes.

### Tools
<!-- keywords: functions, function calls, guide lookup, lookup mode, read_guide, read more sections, local model, max calls, tool calls, not supported, my tools, own tools, custom tools, chat assistant, new tool, import tools, export tools, tool pack, world text, dice, roll, random number -->


The **Tools** tab lists the functions your AI can call while it answers. It uses the layout of **Settings** → **Tools**: the list on the left, and the selected function on the right. **Built-In** holds the functions that ship with the app. **My Tools** holds the Tools you make for help questions.

| Function | Default | What it does |
|---|---|---|
| **read_guide** | Off | The guide lookup. Your AI reads more guide sections when the sections in the request don't answer the question. It can search the guide by words or read sections by id. |
| **roll** | Off | A dice roll. Ask your AI to roll, such as "roll two six-sided dice", and it rolls and gives you the total. |

- **Enabled** turns a function on or off. This device keeps the switches, for every help preset.
- **Max Calls per Request** sets how many times your AI can call the function for one question, from 1 to 20. Leave it blank for the default: 3 for **read_guide**, 4 for **roll**.
- The panel also shows the text your AI reads about the function, and its parameters.
- **read_guide** and **roll** are part of the app. You can't edit, copy or delete them.
- The **Tools** switch under **Settings** → **Output** does not apply to Formaquestion.

A function goes out only when the **Answer Endpoint** takes function calls. If it doesn't, or the app hasn't confirmed it yet, the tab shows a note, and each question goes out as one request with no function. The default cloud endpoint takes no function calls.

#### How to Let Your AI Read More of the Guide
<!-- keywords: lookup mode, read more sections, local model, function calls, read_guide, deeper answers, search the guide itself, tool calls, bigger context -->

1. Set **Answer Endpoint** to a model that takes function calls, such as a local model.
2. Open the **Tools** tab, select **read_guide**, and turn on **Enabled**.
3. Ask a question. Your AI reads more sections when it needs them, and the answer lists them under **Sources**.

**My Tools.** Make your own Tools for help questions, and Formaquestion can work as a chat assistant for the world you have open. They are a list of their own: a Tool you make here never goes to a game prompt, and a Tool from **Settings** → **Tools** does not show here.

- **New Tool** opens the same editor as **Settings** → **Tools**. See [The Tool Editor](Tools#the-tool-editor). A Tool can't take the name of a built-in function: **read_guide** or **roll**.
- **Enabled** turns a Tool on or off. A Tool you save here starts on, and a Tool from a Tool pack is off until you turn it on. A help preset file sets the switches of its own Tools. This device keeps the switches.
- **Max Calls per Request** caps the calls for one question. Leave it blank for the default of 4. There is no **Offered To**, because one request takes every Tool that is on.
- **Edit** and **Delete** act on the selected Tool. **Delete** can't be undone.
- **Try It** runs the Tool on the world you have open in the game or the World Editor, else on a sample world.

A Tool that's on reads the world you have open, so text from that world can go to your **Answer Endpoint**. The tab says so under the list. In the game, a Tool reads the playthrough as a game Tool does. In the World Editor, it reads the world as you have it, unsaved edits included. With the World Editor open from the game, a Tool reads the editor's world until you close it. On the Main Menu, a Tool reads no world and returns its empty result.

#### How to Share Tools With the Game's List
<!-- keywords: tool pack, tools.json, import tools, export tools, move a tool, gameplay tool, copy a tool, share a tool, pack file -->

1. Next to **My Tools**, select **Export Tools** to save `tools.json`, or **Import Tools** to add Tools from a file.
2. The file is the same Tool pack as **Settings** → **Tools**, so a pack from one list opens in the other. An import skips a Tool you already have, and names it. A file with a Script Tool shows a warning, because a script runs code when the AI calls it.

## AI Context
<!-- keywords: debug a question, see the request, inspect help, wrong section, trace, export json, bug report, search block, samplers, request card -->

**AI Context** shows what each question of the conversation sent to your AI, and what came back. Use it to find why an answer went wrong: a section the search missed, or a prompt you changed.

1. Select **⋮** in the title bar, then **AI Context**.

The dialog has the layout of the game's [AI Context Inspector](How-to-Play#the-ai-context-inspector). Each question of the conversation is one page, and the dialog opens on the newest. The line above the blocks says **Question N of M** and quotes the question. The pager at the bottom turns to another question. The window closes while the dialog is open and opens again when you close it.

| Block | What it shows |
|---|---|
| **Search** | The screen you had open and whether **Use the Open Screen** was on, the help preset, and each search the question ran. For each search: the sections each source ranked, then the merged order. A section marked **sent** reached your AI. **Sent** lists those sections in the order of the request. |
| **Request N: AI Picks** | The **AI Picks** request, and the lines your AI picked |
| **Request N: Answer** | The answer request, its **Tool Rounds** when the lookup ran, its reasoning, and the answer as your AI wrote it |

- A request card has the same blocks as a request in the game's inspector. Its header names the endpoint that served it, its reasoning fields, its **Max Tokens**, and its sampler values. A **Custom Prompt** mark shows when the prompt of that request differs from the default text.
- **Collapse all** and **Expand all** fold or open every block of the open page.
- **Export** downloads every question and its trace as a `.json` file, for a bug report.
- **Clear Conversation** removes the traces with the conversation. A reload empties them.

## On Mobile
<!-- keywords: full screen sheet, small screen, keyboard covers, slides in, touch, no resizing -->

On a screen narrower than 768 pixels, Formaquestion fills the screen. It has the **Ask**, **Search** and **Guide** tabs of the narrow layout.

- The sheet slides in from the edge that holds the **Help** tab. The tab hides while the sheet is open.
- The sheet opens above an open dialog. When you close the sheet, the dialog is as you left it.
- The keyboard does not open until you select a field. With the keyboard open, the sheet fits the space above it.
- The sheet has no **Wide View**, and you cannot move it or change its size.
- **Formaquestion Settings** and **AI Context** fill the screen, so the sheet hides while one is open. When you close it, the sheet shows again as you left it, and an answer that was coming in continues.
- On Android, the back action closes the sheet first, before a dialog under it.

## The Help Tab
<!-- keywords: side handle, edge button, sideways text, opener, reduced motion, floating label, click vs drag, rotated -->

The **Help** tab opens and closes Formaquestion. It starts on the right edge of the screen, at the middle.

- The tab stays flat against one of the four edges. Its text turns with the edge.
- A press with no move opens the window. A drag moves the tab.
- This device keeps the place of the tab.
- The window opens from the tab and closes into it. If your system reduces motion, the window shows and hides at once.
