# ❓ Formaquestion

Formaquestion is the help window. You can ask it a question, search this guide and read each guide page. The guide is part of the app, so the search and the pages work with no network and no AI.

> 📱 On a mobile-size screen, Formaquestion opens as a full-screen sheet. See [On Mobile](#on-mobile).

## How to Open Formaquestion
<!-- keywords: help, assistant, f1, faq, support, guide window, question mark -->

1. Select the **Help** tab on the edge of the screen, or press F1.
2. To close the window, select **Close** at its top right. On Android, you can also use the back action.

The window stays open when you go to a different screen or open a dialog. You can use the dialog and the window together. Escape closes the dialog and leaves the window open.

## How to Ask a Question
<!-- keywords: help, ai help, chat, assistant, support, faq, answer -->

1. Open Formaquestion.
2. Select the **Ask** tab. In the wide layout, the conversation is on the right.
3. Type your question in **Ask a Question**.
4. Select **Send**, or press Enter.
5. To read where the answer came from, select a section under **Sources**.

Your AI writes the answer from the guide sections that match your question. To end an answer early, select **Stop**. The text so far stays. See [Ask](#ask).

## How to Ask a Follow-Up Question
<!-- keywords: more, another, next, keep, continue, conversation, clear -->

1. Ask a question.
2. After the answer, type your next question in **Ask a Question**, such as "and then?".
3. Select **Send**.

The AI gets your earlier questions and its answers, so you do not have to say the topic again. To start again on a new topic, select **Clear** above the conversation.

## How to Ask About a Screenshot
<!-- keywords: image, picture, paste, upload, attach, what is this, screen capture -->

1. Turn on **Image Attachments**. See [Settings](Settings).
2. Open Formaquestion and select the **Ask** tab.
3. Paste a screenshot into **Ask a Question**, drop it on the field, or select **Attach images** and pick a file.
4. Type your question, such as "what is this?".
5. Select **Send**.

Your model must read images. The screenshot goes with that question only. A follow-up does not send it again.

## How to Search the Guide
<!-- keywords: find, look up, docs, wiki, manual, help, without ai, offline -->

1. Open Formaquestion.
2. Select the **Search** tab.
3. Type two or more letters in **Search the Guide**.
4. Select a result to read its section.

The best matches are first. Each result shows the section, its page and the start of its text.

## How to Read a Guide Page
<!-- keywords: docs, wiki, manual, browse, contents, table of contents, help -->

1. Open Formaquestion.
2. Select the **Guide** tab.
3. Select a page to see its sections.
4. Select a section.

To go back to the list of pages, select **Contents** above the section.

## How to Get Help for the Screen You Have Open
<!-- keywords: this page, current, where am i, context, here -->

1. Open the screen, dialog or tab that you need help with.
2. Open Formaquestion.
3. Select the row under **Help for This Screen**.

The row is the first item on the **Search** tab and on the **Guide** tab. It names the guide section for the screen, the dialog and the tab that you have open. It changes when you open a different one. A screen with no guide section shows no row. The row does not show while you search.

## How to Move and Resize the Window
<!-- keywords: drag, bigger, smaller, size, position, wide view, layout -->

1. Drag the title bar to move the window.
2. Drag the bottom right corner to change its size.

To see the contents and a section side by side, select **Wide View** in the title bar. Select it again to go back.

## How to Move the Help Tab
<!-- keywords: drag, edge, side, button, reposition, out of the way -->

1. Drag the **Help** tab along the edge of the screen. It goes to the nearest of the four edges.
2. Release it.

With the keyboard, press Tab until the **Help** tab has focus. Then press the arrow keys.

---

## The Window

Formaquestion is one window for the whole app. It shows above every dialog, and it keeps its conversation, its search text and its open section while the app is open.

| Control | What it does |
|---|---|
| Title bar | Drag it to move the window |
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

The **Ask** tab sends your question to your AI, together with the guide sections that match it. The answer shows as the AI writes it.

- **Sources**, under an answer, lists the guide sections that the AI got. Select one to read it.
- When the guide does not cover your question, the AI answers from general knowledge. A note above the answer says that it is not from the guide and can be wrong about Formamorph. **Nearest Sections** then takes the place of **Sources** and lists the guide sections closest to your question.
- The request holds your question and those guide sections. It holds nothing from your worlds or your saves.
- On an endpoint that supports Tools, the AI can also search the guide and read the other sections it picks. **Sources** lists those sections first. This is part of Formaquestion, so it works with the **Tools** checkbox clear, and each read adds a request.
- The request also holds your last four questions and the AI's answers to them, as text. It does not hold their guide sections again.
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
- The answer comes from your active text endpoint, with reasoning off. See [Connect Your Own AI](Connect-Your-Own-AI).

An answer can be wrong. Use **Sources** to check it against the guide.

## Search

The **Search** tab finds sections by the words you type. It needs no network and no AI.

- A search starts at two letters.
- A word in a section's heading counts more than a word in its text.
- A section that has more of your words is higher in the list than a section that repeats one word.
- A plural finds the singular: "blueprints" finds **Blueprint**.
- **No sections match** shows when no word matches.

The search reads each page of this guide, the [Glossary](Glossary), the [World Format](WorldFormat) page and the newest releases in the [Changelog](Changelog).

In the wide layout, the results replace the contents on the left while the search field has two or more letters.

## Guide

The **Guide** tab lists each page of this guide. Select a page to show or hide its sections.

- **Introduction** is the text at the top of a page.
- A long section is in parts. Each part has a number, such as **(Part 2)**.
- **On This Page**, under a section, lists the other sections of the same page.
- A link to a guide page opens that section in the window.
- A link to a website opens in your browser.

## On Mobile

On a screen narrower than 768 pixels, Formaquestion fills the screen. It has the **Ask**, **Search** and **Guide** tabs of the narrow layout.

- The sheet slides in from the edge that holds the **Help** tab. The tab hides while the sheet is open.
- The sheet opens above an open dialog. When you close the sheet, the dialog is as you left it.
- The keyboard does not open until you select a field. With the keyboard open, the sheet fits the space above it.
- The sheet has no **Wide View**, and you cannot move it or change its size.
- On Android, the back action closes the sheet first, before a dialog under it.

## The Help Tab

The **Help** tab opens and closes Formaquestion. It starts on the right edge of the screen, at the middle.

- The tab stays flat against one of the four edges. Its text turns with the edge.
- A press with no move opens the window. A drag moves the tab.
- This device keeps the place of the tab.
- The window opens from the tab and closes into it. If your system reduces motion, the window shows and hides at once.
