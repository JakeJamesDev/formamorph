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

The AI gets your earlier questions and its answers, so you do not have to say the topic again. To start again on a new topic, select **Clear** above the conversation.

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

---

## The Window
<!-- keywords: f1 key behavior, stays on top, remembers position, off screen, focus cursor, narrow or wide, disappeared, always visible -->

Formaquestion is one window for the whole app. It shows above every dialog, and it keeps its conversation, its search text and its open section while the app is open.

| Control | What it does |
|---|---|
| Title bar | Drag it to move the window |
| **Formaquestion Settings** | Opens the settings of Formaquestion. See [Formaquestion Settings](#formaquestion-settings) |
| **Wide View** | Changes between the narrow and the wide layout |
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
- **Clear** removes every question and answer, and ends an answer that is coming in.
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

**Formaquestion Settings** opens from the gear in the Formaquestion title bar. It has four tabs: **General**, **Endpoint**, **Prompts** and **Tools**.

- The Formaquestion window stays above the settings, so you can change a setting and ask a question to see the effect.
- This device keeps each setting. The settings are not in a backup or an export.

### General
<!-- keywords: reasoning, thinking, effort, reasoning budget, answer reveal, answer animation, fade in, keyword search, ai picks, open screen, history length, extra request, earlier questions, no guide -->

The **General** tab sets how your AI answers, how a question finds its guide sections, and what the request holds.

| Setting | Default | What it does |
|---|---|---|
| **Reasoning** | Off | Lets your AI reason before it answers, so answers take longer. The levels and the budget come from the **Answer Endpoint**. **Global** follows **Native Reasoning** under Settings → Output. The **AI Picks** request never reasons. For a model that cannot reason, a note shows in place of the control. |
| **Answer Reveal** | Fade | Sets how each answer appears as it streams. **Choose reveal animation…** opens the same dialog as **Narration Reveal**, with its own values: a change to one never changes the other. With every effect off, answers show with no animation. |
| **Keyword Search** | On | Finds the guide sections that have the words of your question |
| **AI Picks** | On | Sends one more request for each question, in which your AI picks guide sections from the list of headings |
| **Semantic Search** | Off | Finds guide sections by meaning, with a small model on your device. The first time you turn it on, the app downloads the model and shows the progress. If the download fails, the switch goes off and **Retry** starts it again. Until the model is ready, questions use the other sources. |
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

**How to send help to a different AI:**

1. Open **Formaquestion Settings**, then the **Endpoint** tab.
2. In the editor, select **Add New Preset**, and enter the endpoint, token and model of the other AI.
3. Set **Answer Endpoint** to the new preset.

## On Mobile
<!-- keywords: full screen sheet, small screen, keyboard covers, slides in, touch, no resizing -->

On a screen narrower than 768 pixels, Formaquestion fills the screen. It has the **Ask**, **Search** and **Guide** tabs of the narrow layout.

- The sheet slides in from the edge that holds the **Help** tab. The tab hides while the sheet is open.
- The sheet opens above an open dialog. When you close the sheet, the dialog is as you left it.
- The keyboard does not open until you select a field. With the keyboard open, the sheet fits the space above it.
- The sheet has no **Wide View**, and you cannot move it or change its size.
- **Formaquestion Settings** fills the screen, so the sheet hides while it is open. When you close the settings, the sheet shows again as you left it, and an answer that was coming in continues.
- On Android, the back action closes the sheet first, before a dialog under it.

## The Help Tab
<!-- keywords: side handle, edge button, sideways text, opener, reduced motion, floating label, click vs drag, rotated -->

The **Help** tab opens and closes Formaquestion. It starts on the right edge of the screen, at the middle.

- The tab stays flat against one of the four edges. Its text turns with the edge.
- A press with no move opens the window. A drag moves the tab.
- This device keeps the place of the tab.
- The window opens from the tab and closes into it. If your system reduces motion, the window shows and hides at once.
