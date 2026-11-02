# ❓ Formaquestion
<!-- keywords: in-app manual, documentation, built-in tutor, what is this window, user guide, helper -->

Formaquestion is the help window. You can ask it a question, search this guide and read each guide page. The guide is part of the app, so the search and the pages work with no network and no AI.

> 📱 On a mobile-size screen, Formaquestion opens as a full-screen sheet. See [On Mobile](#on-mobile).

The steps on this page use the **Full** chat style, the framed window with tabs.

- **More Actions** is the ⋮ icon button in the title bar. Its tooltip reads "More Actions".
- The **Bubble** and **Minimal** styles have **More Actions** in the pill. They reach **Search** and **Guide** through **More Actions**, then **Open Guide**. See [How to Change the Chat Style](#how-to-change-the-chat-style).
- To set up the AI behind help, see [Formaquestion Settings](Formaquestion-Settings). To make your own mascot, see [Formaquestion Mascot](Formaquestion-Mascot).

## How to Open Formaquestion
<!-- keywords: help, assistant, f1, faq, support, guide window, question mark, get assistance, shortcut key, hotkey, side tab, stuck, dismiss -->
<!-- route: formaquestion -->

1. Select the **Help** tab on the edge of the screen, or press F1.
2. To close the window, select **Close** at its top right. On Android, you can also use the back action.

The window stays open when you go to a different screen or open a dialog. You can use the dialog and the window together. Escape closes the dialog and leaves the window open.

## How to Ask a Question
<!-- keywords: help, ai help, chat, assistant, support, faq, answer, chatbot, citations, where it came from, query, explain to me, bot, inquire -->
<!-- route: formaquestion.ask#question-field -->

1. Open Formaquestion.
2. Select the **Ask** tab. In the wide layout, the conversation is on the right.
3. Type your question in **Ask a Question**.
4. Select **Send**, or press Enter.
5. To read where the answer came from, select a section under **Sources**.

Your AI writes the answer from the guide sections that match your question. To end an answer early, select **Stop**. The text so far stays. See [Ask](#ask).

## How to Ask a Follow-Up Question
<!-- keywords: more, another, next, keep, continue, conversation, clear, new topic, reset chat, start over, thread, wipe history, remembers previous -->
<!-- route: formaquestion.ask#question-field -->

1. Ask a question.
2. After the answer, type your next question in **Ask a Question**, such as "and then?".
3. Select **Send**.

The AI gets your earlier questions and its answers, so you do not have to say the topic again. To start again on a new topic, select **Clear Conversation** in the **More Actions** menu.

## How to Ask About Your World
<!-- keywords: my world, explain my world, why does my tool not fire, my script, my stat code, my entity, lorebook entry, world prompt, unsaved edits, world sources, read the world -->
<!-- route: formaquestion.ask#question-field -->

1. Open a world in the World Editor.
2. Open Formaquestion and ask about a part of your world, such as "What does my Dawn Bell script do?".
3. To open a part that the answer used, select its name under **Sources**.

In the World Editor, your AI gets the parts of your world that match your question, together with the guide sections. It can explain entities, locations, items, traits, stats and their code, scripts, World Tools, dictionary entries and the world prompts. It reads your edits before you save them. Placeholders show as you wrote them, not as a roll.

- The world sections have a size limit of their own, so they never push a guide section out of the request.
- To keep your world out of help requests, turn off **Read the World** in Formaquestion Settings → **General**. A question then sends the guide alone.

## How to Add an Entity From an Answer
<!-- keywords: make an entity, create a character, draft an npc, generate an entity, entity card, add to world, creation, new entity from help, add button on answer -->
<!-- route: formaquestionSettings.general -->

1. Select **More Actions**, then **Settings**.
2. On the **General** tab, turn on **Creation**.
3. Open a world in the World Editor.
4. Ask for an entity, such as "Make me a gate guard for this town".
5. On the card in the answer, select **Add**.

Each entity in the answer shows as a card with its name and AI description. **Add** puts the entity in the world you have open, ungrouped, and selects it on the **Entities** tab. Every other field starts blank, so you edit the rest in the World Editor. Undo removes the entity.

- **Copy** copies the card's text.
- A warning icon next to the name means your world already has an entity with that name. **Add** still adds a second one.
- **Add** works in the World Editor only, including the World Editor you open from a game. On any other screen it's unavailable.
- Your next question tells your AI which entities you added.
- With **Sort Questions** on, a request to make an entity sends your world's name, description and entity names, and two of your entities as samples, with no guide. On any other screen, your mascot tells you to ask again in the World Editor.
- A card that has fields other than the name and the AI description, or an AI description longer than four sentences, shows as a code block with **Copy** instead.

## How to Ask About Your Story
<!-- keywords: in game, who is, who was, what happened, story so far, recap, lore, characters i met, places i visited, my items, my stats, spoilers, what should i do next, stuck, hint -->
<!-- route: formaquestion.ask#question-field -->

1. Play a world, or load a save.
2. Open Formaquestion and ask about the story, such as "Who was the woman at the gate?" or "What is the Ashen Pact?".

In the game, your AI gets only what you have met, together with the guide sections:

- 📖 **The story so far.** The memories and the recent turns, as the narrator gets them. With **Memory Summaries** off, the recent turns only.
- 🧭 **What you have met.** The entities, locations and items you have met, with the descriptions the game shows you. Your visible stats and your own traits.
- 📚 **Lore.** The dictionary entries whose keywords are in your question, the story so far or what you have met. With **Semantic Lore** on, an entry close in meaning to your question also counts.

Your AI never gets an AI description, a diary, a hidden stat or a hidden trait.

- The one exception is an entity that the narrator made up during the game. Its description is AI text, and it counts as what you have met.
- Your AI gets only the entities, locations and items you have met, plus the world's lore entries that your question or the story brings up. A lore entry can name something you have not met yet.
- When you undo a turn, your AI forgets what that turn showed.
- When you ask what to do next, your AI gives what it would try as its own opinion, not the solution.
- The names under **Sources** do not open the editor, so selecting one can't show you spoilers.
- The story so far has a size limit of its own.
- **Read the World** turns all of this off too.
- Open Chat worlds follow the same rules.

## How to Go to the Screen an Answer Describes
<!-- keywords: take me there, jump, go there, open the screen, open the tab, navigate, link, shortcut, show me where, find the control, button under the answer, open settings from help, direct me, takes me to the dialog -->
<!-- route: formaquestion.ask#question-field -->

1. Ask a question.
2. Under the answer, select **Take Me There**.

The button sits next to **Sources**. It opens the screen, dialog or tab that the top source under **Sources** describes.

- The top source is the one whose steps the answer copies. When the answer copies none, it's the first one that is not the guide section of the screen you have open.
- On a desktop screen, the window stays open, so you can read the steps while you work. On a mobile-size screen, the sheet closes.
- When the source names a control, the button scrolls to it, puts focus on it and pulses a ring around it once. With reduced motion, the ring stays still. When the control is not on the screen, the button opens its tab with no ring.
- When the button needs you to leave a game in progress, the app asks first. Select **Cancel** to stay. The game does not change.
- When the button needs you to close a World Editor that has unsaved changes, the editor asks first, as it does when you close it. A jump to **Settings** opens over the editor and does not ask.
- The button does not show when the answer is not from the guide, when the top source has no screen, or when the answer stopped or failed.

## How to Ask the Community
<!-- keywords: ask the community, ask people, ask other players, post a question, community question, answer not enough, still stuck, forum, ask a human -->
<!-- route: formaquestion.ask#question-field -->

1. Ask a question.
2. When the answer is not enough, select **Ask the Community** under the answer.
3. Add what you tried, and select **Post Question**.

The **Send Feedback** dialog opens over the help window on a new question. Your question to the help window is already its title. Other players can answer it and vote on it, and replies show under **Questions** in your profile.

- The button shows once the answer is done. It also shows when the answer stopped or failed. It does not show while the answer is writing.
- When you have an unsent draft, the dialog asks first. Select **Replace** to start the new question, or **Keep Draft** to go back to your draft.
- When you are signed out, the button asks you to sign in first.

## How to Ask About a Screenshot
<!-- keywords: image, picture, paste, upload, attach, what is this, screen capture, photo, snip, print screen, vision model, clipboard, identify button, show my screen, drag file -->
<!-- route: formaquestion.ask#question-field -->

1. Turn on **Image Attachments**. See [Settings](Settings).
2. Open Formaquestion and select the **Ask** tab.
3. Paste a screenshot into **Ask a Question**, drop it on the field, or select **Attach images** and pick a file.
4. Type your question, such as "what is this?".
5. Select **Send**.

Your model must read images. The screenshot goes with that question only. A follow-up does not send it again.

## How to Search the Guide
<!-- keywords: find, look up, docs, wiki, manual, help, without ai, offline, keyword, documentation, results list, topic, query box, no network, filter -->
<!-- route: formaquestion.search#search-field -->

1. Open Formaquestion.
2. Select the **Search** tab.
3. Type two or more letters in **Search the Guide**.
4. Select a result to read its section.

The best matches are first. Each result shows the section, its page and the start of its text. In the wide layout and the full-screen Guide, a result leaves out the start of its text.

## How to Read a Guide Page
<!-- keywords: docs, wiki, manual, browse, contents, table of contents, help, chapters, topic list, article, index, all topics, back to list, documentation pages -->
<!-- route: formaquestion.guide -->

1. Open Formaquestion.
2. Select the **Guide** tab.
3. Select a page to see its sections.
4. Select a section.

To go back to the list of pages, select **Contents** above the section.

## How to Open the Guide Full Screen
<!-- keywords: bigger guide, large view, read the docs at length, expand, maximize, enlarge the manual, big reader, full-screen reader, open guide button, wider reading, read more at once -->
<!-- route: formaquestion -->

1. Open Formaquestion.
2. Select **Open Guide** in the title bar. Or select **More Actions**, then **Open Guide**.
3. Type in **Search the Guide**, or select a page in the contents on the left.
4. Select a section. It shows on the right.
5. To go back to the small window, select **Close**, or press Escape.

- The **Open Guide** button is in the title bar of the **Full** style, next to **Wide View**.
- The **Minimal** and **Bubble** styles have **Open Guide** in the **More Actions** menu only.
- The full screen and the small window share one Guide view. They have the same search text, open pages and section, so you keep your place both ways. See [Guide](#guide).

## How to Open the Wiki
<!-- keywords: wiki, browser, website, online docs, github wiki, read outside the app, external docs, same page in the browser, open docs in my browser, leave the app, confirm, don't ask again, stop the question -->
<!-- route: formaquestion -->

1. Open Formaquestion, and open the section that you want to read in the wiki.
2. Select **More Actions**, then **Open Wiki**. In the full-screen Guide, select **Open Wiki** in the header.
3. In the confirm, select **Open**.

Your browser opens the wiki on the page and heading of the section that shows. With no section open, it opens the wiki home page. See [The Wiki Confirm](#the-wiki-confirm).

## The Wiki Confirm
<!-- keywords: open the wiki question, leave the app, open in browser, don't ask again, skip the confirm, cancel, which page opens -->
<!-- route: formaquestionWikiConfirm -->

The confirm shows before your browser opens the wiki. It names the wiki page that opens.

- **Open** opens the page in your browser.
- **Cancel** closes the confirm, and the app stays as it is. The confirm stays on, also with the box checked.
- **Don’t Ask Again**, checked when you select **Open**, skips the confirm next time.
- To turn the confirm back on, select the **Confirm Before Opening the Wiki** checkbox in the **Window** group of the **General** tab. See [General](Formaquestion-Settings#general).

## How to Go Back and Forward in the Guide
<!-- keywords: previous section, next section, history, return to the last page, undo a link, browser buttons, arrows, alt left, alt right, mouse side buttons, retrace, where was I, step back, step forward -->
<!-- route: formaquestion -->

1. Select **Wide View** in the title bar, or open the Guide full screen.
2. Open a few sections.
3. Select **Back** or **Forward**, next to the title.

- While the cursor is in the window, Alt+Left goes back and Alt+Right goes forward.
- While the pointer is over the window, the mouse back and forward buttons do the same. They never change the screen of the app.
- A button is off when there is no step in its direction.
- In **Wide View**, a change to the conversation is a step too. See [The Window](#the-window).

## How to Get Help for the Screen You Have Open
<!-- keywords: this page, current, where am i, context, here, contextual, this dialog, this menu, relevant section, what am i seeing, explain this tab, suggested topic -->
<!-- route: formaquestion -->

1. Open the screen, dialog or tab that you need help with.
2. Open Formaquestion.
3. Select the row under **Help for This Screen**.

The row names the guide section for the screen, the dialog and the tab that you have open. It changes when you open a different one.

- The row is on the **Search** tab, under **Search the Guide**, and first on the **Guide** tab. The wide layout and the full-screen Guide show it under the search field too.
- A screen with no guide section shows no row.
- The row does not show while you search.

## How to Move and Resize the Window
<!-- keywords: drag, bigger, smaller, size, position, wide view, layout, title bar, corner handle, in the way, covers the screen, side by side, split, enlarge, relocate -->
<!-- route: formaquestion -->

1. Drag the title bar to move the window. In the minimal chat, drag the grip on the pill.
2. To resize, move your pointer near any side or corner of the window. Drag the handle that shows there.

- A side changes one dimension. A corner changes both.
- On a touch screen, only the corners show handles.
- Each chat style keeps its own size.
- In **Bubble**, the side handles are not there. Drag the corner grip on the speech bubble to change the chat's width and height. Drag the grip on the mascot to change its size.

To see the contents and a section side by side, select **Wide View** in the title bar. Select it again to go back.

## How to Move the Help Tab
<!-- keywords: drag, edge, side, button, reposition, out of the way, blocking, left or bottom, arrow keys, floating, relocate, covers something, hide it, corner -->

1. Drag the **Help** tab along the edge of the screen. It goes to the nearest of the four edges.
2. Release it.

With the keyboard, press Tab until the **Help** tab has focus. Then press the arrow keys.

## How to Change the Chat Style
<!-- keywords: window style, bubble, speech bubble, minimal, full, auto, framed window, bare column, no title bar, switch chrome, pill, frame, title bar back, bring back the frame, unframed, chat log, old style -->
<!-- route: formaquestionSettings.general#chat-style -->

1. Select **More Actions** in the title bar, or in the pill above a bare column or over the mascot.
2. Under **Chat Style**, select **Auto**, **Minimal** or **Full**.

You can also set it in the **Window** group of the **General** tab. Both places change the same setting.

- **Auto** is **Bubble** while the mascot is on, and **Full** while it's off.
- **Bubble** shows the mascot speaking the newest answer from a speech bubble. It needs the mascot, so **Auto** is the only way to it.
- In **Bubble**, drag the mascot to move the window.
- In **Bubble**, the pill and the mascot's grip show when the window opens and hide after one second. They come back when your pointer is over the mascot or a piece, when keyboard focus is on a piece, and while the **More Actions** menu is open. On a touch screen, they stay up. With reduced motion, they show and hide with no fade.
- In **Bubble**, the chat's grip stays in view, on the chat corner with the most free screen beyond the window.
- **Minimal** is a bare chat column. **Full** is the framed window.
- **Full** with the mascot on keeps the mascot beside the frame.
- The window stays where it was, and your conversation stays. Each style keeps its own size. See [The Window](#the-window).

## How to Make the Bare Chat Easier to Read
<!-- keywords: hard to read, text over my screen, busy background, see through, transparent, backdrop, panel behind the chat, contrast, readability, scrim, opacity, dim, minimal chat text -->
<!-- route: formaquestionSettings.general#backdrop -->

1. Select **More Actions**, then **Settings**. The **General** tab opens first.
2. Under **Window**, move the **Backdrop** slider.

The backdrop is a panel behind the bare chat column, in the color of the app. It shows behind the **Bubble** and **Minimal** styles.

- A higher value hides more of the screen behind the text.
- The setting runs from 0 to 100% in steps of 5, and starts at 60%.
- Set 0 to draw no panel.

## How to Return to the Newest Answer
<!-- keywords: scroll down, jump to the end, long conversation, old messages, bottom, latest answer, down arrow, scroll to end, lost my place, newest message -->
<!-- route: formaquestion.ask#scroll-to-end -->

1. Scroll up in the conversation to read an earlier answer.
2. Select **Scroll to End**, the round arrow above the question field.

- The arrow shows when the end of the conversation is more than half a window height away. It goes away when you get near the end.
- After you select it, new text keeps scrolling into view as it arrives.
- The framed window, the bare column and the speech bubble all have the arrow. See [Ask](#ask).

## How to Put the Mascot Under the Chat
<!-- keywords: mascot below, mascot under the chat, mascot beside, mascot position, move the mascot, short chat, tall chat, mascot stands, beside or below -->
<!-- route: formaquestionSettings.general#mascot-position -->

1. Select **More Actions** in the title bar, or in the pill above a bare column.
2. Under **Mascot Position**, select **Above**, **Below**, **Inside** or **Outside**.

You can also set it in the **Mascot Position** dropdown in the **Window** group of the **General** tab. Both places change the same setting, and this device keeps it.

- **Above** stands the mascot over the chat, and **Below** under it. The chat stops growing at a set share of the screen height, so the mascot always has room. If the chat is taller when you select one of them, it shrinks to that height.
- **Inside** stands the mascot beside the chat, toward the middle of the screen. **Outside** stands it beside the chat, toward the nearer edge of the screen.
- The side flips only when the piece you drag crosses the middle of the screen. Drag the pill and the chat crosses to the mascot's other side; drag the mascot and the chat crosses to hers.
- The reader stays beside the chat.
- Under **Bubble**, only **Inside** and **Outside** apply, so the dropdown and the **More Actions** menu offer those two. Without the mascot, there is nothing to place, so they are hidden.
- The **More Actions** menu of the mobile-size sheet has no **Mascot Position** choices, since the sheet shows no mascot.

## How to Change the Size of the Mascot
<!-- keywords: bigger mascot, smaller mascot, scale, resize mascot, mascot too big, mascot too small, size slider, auto size, fit the chat, percent -->
<!-- route: formaquestionSettings.general#mascot-scale -->

1. Select **More Actions**, then **Settings**.
2. On the **General** tab, move the **Mascot Scale** slider in the **Window** group.

- The first stop is **Auto**. **Auto** fits the mascot to the height of the chat, and follows the chat when you resize it.
- Any other stop is a percent of the base image's size in pixels, from 25% to 150%. A percent mascot stays level with the bottom of the chat column and rises above it. It never grows past the room on the screen.
- The **Mascot** tab's preview does not change with **Mascot Scale**. The window does.
- This device keeps the setting, outside your mascot card.
- The slider is hidden while the mascot is off. See [Formaquestion Mascot](Formaquestion-Mascot).

## How to See What the App Sent for a Question
<!-- keywords: debug a question, wrong answer, why this answer, inspect the request, see the prompt, trace, missing section, request log, export json, bug report, what was sent to the ai -->
<!-- route: formaquestionAiContext -->

1. Ask a question.
2. Select **More Actions**, then **AI Context**.

The dialog shows one question per page, the newest first, with its request cards. See [AI Context](#ai-context).


---

## The Window
<!-- keywords: f1 key behavior, stays on top, remembers position, off screen, focus cursor, narrow or wide, disappeared, always visible, chat style, minimal, full, framed window, bare column -->
<!-- route: formaquestion -->

Formaquestion is one window for the whole app. It shows above every dialog, and it keeps its conversation, its search text and its open section while the app is open.

| Control | What it does |
|---|---|
| Title bar | Drag it to move the window |
| **Back** and **Forward** | Move through the sections you opened. They show next to the title while **Wide View** is on. See [How to Go Back and Forward in the Guide](#how-to-go-back-and-forward-in-the-guide). |
| **Wide View** | Changes between the narrow and the wide layout. It stays lit while the wide view is on |
| **Open Guide** | Shows the Guide full screen. The **Full** style has it in the title bar. See [Guide](#guide). |
| **More Actions** | The ⋮ icon button. Opens a menu with **Clear Conversation**, the **Chat Style** choices, the **Mascot Position** choices, **Open Guide**, **Open Wiki**, **AI Context** and **Settings**. The mobile-size sheet has no **Mascot Position** choices. |
| **Close** | Closes the window |
| Bottom right corner | Drag it to change the size of the window |

F1 does one of three things:

| When you press F1 | Result |
|---|---|
| The window is closed | The window opens |
| The window is open, and you are typing somewhere else | The cursor goes to the window |
| The cursor is in the window | The window closes |

- The window stays whole on the screen. When the browser window gets smaller, Formaquestion moves back inside it.
- This device keeps the place of the window and a size for **Minimal** and **Full**. It keeps the mascot's own place for **Bubble**. A change between **Minimal** and **Full** keeps the place. These are not in a backup or an export.
- The narrow layout shows one tab at a time. The wide layout shows the search field and the contents on the left, and the conversation or a section on the right. **Back to Conversation**, above a section, shows the conversation again. The layout changes at a width of 560 pixels, so the corner changes it too.
- The Back and Forward history holds the last 50 steps. Each section you open is a step. In **Wide View**, a change from a section to the conversation is a step too. **Back** returns you to the place you had in that section.
- The history stays when you close the window or change the layout. A reload clears it. A section you open after **Back** replaces the steps ahead of it.
- The **Minimal** and **Bubble** styles read in a separate reader beside the chat. That reader adds no steps and has no **Back** or **Forward**. Alt+Left, Alt+Right and the mouse buttons work there only in the full-screen Guide, which has **Back** and **Forward** in every style.
- In the full screen, **Back** and **Forward** skip the conversation. They go to the closest section in their direction.
- While the welcome animation plays, the **Help** tab does not show and F1 does nothing.
### Chat Styles

The **Chat Style** sets how the window looks. Pick a style in the **More Actions** menu or on the **General** tab. See [How to Change the Chat Style](#how-to-change-the-chat-style).

- **Full** is the framed window this page describes.
- **Minimal** is a bare chat column with no title bar, no tabs and no **Wide View**.
- **Bubble** shows the mascot speaking the newest answer.
- **Auto** is **Bubble** while the mascot is on, and **Full** while it's off.

To make your own mascot, see [Formaquestion Mascot](Formaquestion-Mascot).

**Bubble.** With the mascot on and the **Chat Style** at **Auto** or **Bubble**, the mascot speaks the newest answer from a speech bubble that points at its head.

- A long answer grows up to the top of the screen, then scrolls inside the bubble.
- Under the bubble, a strip holds **Previous Answer** and **Next Answer** at its ends. Between them are the answer's **Thinking** toggle, **Sources** and **Take Me There**.
- The open **Thinking** text shows inside the bubble.
- **Sources** opens a list of the guide sections the answer used. Select one to open it in the reader.
- Your question and the ask field stand at the mascot's feet. Before your first question, only the mascot and the ask field show.
- Drag the mascot, or the pill over its head, to move the window.
- The bubble stands on the side of the mascot with more room. It moves to the other side when you drag the mascot past the middle of the screen.
- Drag the corner grip on the bubble to change the chat's width and height. The **Backdrop** fills the size you set. A short answer's bubble stays small inside it, as in the minimal column.
- Drag the grip on the mascot's top corner to change its size. It sets the same **Mascot Scale** as the **General** tab.
- In the head view, the bubble, the head with the pill, the strip, your question and the ask field stand in one column.

**Minimal.** With the **Chat Style** at **Minimal**, Formaquestion has no frame, no title bar and no tabs. It is a bare chat column with the mascot beside it.

- The mascot stands on the side of the column that has more room on the screen. It moves to the other side when you drag the column past the middle of the screen. The head on the pill moves to the same end.
- Select a source name under an answer to open the guide section in a reader on the other side of the column. Close the reader with **Close Reader**. The column and the mascot stay.
- The pill above the column holds the grip, the **More Actions** menu and **Close**. The grip moves all three pieces.
- Drag the corner under the ask field to change the column's size.

**Full.** With the **Chat Style** at **Full**, the whole mascot stands beside the framed window, on the same side rule. Its height follows the frame while **Mascot Scale** is **Auto**. A mobile-size screen shows no mascot with the framed sheet.

## Ask
<!-- keywords: privacy, what is sent, reads my saves, hallucinate, inaccurate, general knowledge note, history lost, send disabled, which model answers, reload -->
<!-- route: formaquestion.ask -->

The **Ask** tab sends your question to your AI, together with the guide sections that match it. The answer shows as the AI writes it.

Until the answer starts, a line under your question says what it waits on:

| Line | What it waits on |
|---|---|
| **Checking your AI…** | A connection check |
| **Searching with your AI…** | The **AI Search** request |
| **Searching the guide…** | **Semantic Search** |
| **Waiting for your AI…** | The answer request |
| **Looking up…** | The AI reads more of the guide |

While the model reasons, the **Thinking** header shows the wait instead.

With the mascot on, these lines say its name. A custom mascot's lines use its own name. For Morphie:

- **Morphie is getting ready…**, **Morphie is choosing guide sections…**, **Morphie is thinking…** and **Morphie is reading the guide…**
- **Morphie did not answer**, and **Morphie did not finish** for an answer that stopped partway
- The empty conversation asks you to **Ask Morphie how to do something in Formamorph**.

- **Sources**, under an answer, lists the guide sections that the AI got. Select one to read it. Select **Sources** to fold the list to **Sources (N)**. Later answers start the same way.
- A code block in an answer has **Copy**. It also has **Insert**, which adds the code as a new script of the timing you pick, on the stat, trait or world whose **Scripts** tab is open. With no **Scripts** tab open, **Insert** is off.
- **Take Me There**, next to **Sources**, opens the screen that the top source describes. See [How to Go to the Screen an Answer Describes](#how-to-go-to-the-screen-an-answer-describes).
- **Ask the Community**, under a finished answer, opens a new community question with your question as its title. See [How to Ask the Community](#how-to-ask-the-community).
- **Thinking**, above an answer, shows how the AI reasoned, when your model reasons. It starts closed. Open or close one, and later answers start the same way.
- When the guide does not cover your question, the AI answers from general knowledge. A note above the answer says that it is not from the guide and can be wrong about Formamorph. **Nearest Sections** then takes the place of **Sources** and lists the guide sections closest to your question.
- The request holds your question and those guide sections. While **Read the World** is on, it also holds parts of the world you have open: see [How to Ask About Your World](#how-to-ask-about-your-world) and [How to Ask About Your Story](#how-to-ask-about-your-story). **test_script** and your **My Tools** can read that world too. See [Tools](Formaquestion-Settings#tools).
- The request also holds your last four questions and the AI's answers to them, as text. It does not hold their guide sections again. **History Length** sets how many.
- Before the answer, the app sends one more short request, while **AI Search** is on. In it, your AI gets the list of every guide heading and chooses the sections that answer your question. The answer then uses those sections together with the sections that the other searches find. When that request fails or chooses no section, the answer uses the other searches alone.
- The search for a follow-up also uses your previous question, so a short question such as "and then?" finds the same topic.
- With **Image Attachments** on, a question can carry up to 4 images, the same as an action. **Attach images** shows next to the field, and a paste or a drop on the field adds an image. The images go with that question only, and the app does not store them.
- **Clear Conversation**, in the **More Actions** menu, removes every question and answer, and ends an answer that is coming in.
- While a game turn generates, **Send** waits. **Search** and **Guide** still work.
- The answer is in your **AI Language**. Control names stay as the guide writes them, and names from your world stay as the world writes them. See [Settings](Settings).
- Enter sends the question. Shift+Enter starts a new line.
- **Stop** ends an answer and keeps its text.
- **Scroll to End**, the round arrow above the question field, shows while the end of the conversation is more than half a window height away. Select it to go to the end and keep following the answer. See [How to Return to the Newest Answer](#how-to-return-to-the-newest-answer).
- With no AI connected, **Send** shows the guide sections that match your question. The Demo AI always counts as connected.
- When the AI does not answer, an error message shows, and the guide sections that match your question show in place of the answer. Text that came before the failure stays.
- The conversation stays while the app is open, also when you close the window or go to a different screen. The app does not store it, so a reload or a restart empties it.
- The answer comes from the **Answer Endpoint**, with the **Reasoning** setting. See [Formaquestion Settings](Formaquestion-Settings).

An answer can be wrong. Use **Sources** to check it against the guide.

## Search
<!-- keywords: ranking, results order, plural, nothing found, release notes, minimum letters, latest changes, scoring, typo, misspelling, partial word -->
<!-- route: formaquestion.search -->

The **Search** tab finds sections by the words you type. It needs no network and no AI.

With [Semantic Search](Formaquestion-Settings#how-to-turn-on-semantic-search) on, it also finds sections by meaning. The word matches show at once. The meaning matches join them when you stop typing. Until the model is on your device, the tab uses words alone.

- A search starts at two letters.
- A word in a section's heading counts more than a word in its text.
- A section that has more of your words is higher in the list than a section that repeats one word.
- A plural finds the singular: "blueprints" finds **Blueprint**.
- The start of a word, or a word with a typo, also finds sections. The first four letters of **Placeholder** find it, and so does the word with one letter missing. The search tries this only when no section has the word in any form, and only for words of four letters or more. A word as you typed it counts more.
- Guide sections are higher in the list than changelog sections.
- A question such as "what's new?" or "what changed?" lists the newest release first. Name a version, such as "what changed in 3.1.1?", to see that release first.
- **No sections match** shows when no word matches. With Semantic Search on, it also needs no section close in meaning.

The search reads each page of this guide, the [Glossary](Glossary), the [World Format](WorldFormat) page and the newest releases in the [Changelog](Changelog).

In the wide layout, the results replace the contents on the left while the search field has two or more letters.

## Guide
<!-- keywords: chapter list, part numbers, on this page, internal links, external website, expand page, collapse -->
<!-- route: formaquestion.guide -->

The **Guide** tab lists each page of this guide. Select a page to show or hide its sections.

- **Introduction** is the text at the top of a page.
- A long section is in parts. Each part has a number, such as **(Part 2)**.
- **On This Page**, under a section, lists the other sections of the same page.
- A link to a guide page opens that section in the window.
- A link to a website opens in your browser.
- **Open Guide** shows the Guide full screen. See [How to Open the Guide Full Screen](#how-to-open-the-guide-full-screen).

The full screen has the search field and the contents on the left, and the section on the right.

- With no section open, the right side says **Select a section to read**.
- The header holds **Back** and **Forward**, **Open Wiki** and **Close Guide**.
- Escape closes the full screen too, and the window shows the section you ended on.
- A mobile-size screen shows one part at a time. It shows the contents, or a section with **Contents** above it.

## The Semantic Search Card
<!-- keywords: first open, ask me to turn on, search by meaning prompt, download once, card won't go away, card gone, decide later, failed download -->
<!-- route: formaquestion -->

The card offers [Semantic Search](Formaquestion-Settings#how-to-turn-on-semantic-search) at the top of the window. It says **Recommended** and that the app downloads a small model once. It shows in each chat style. You can ask a question while it shows.

| Button | What it does |
|---|---|
| **Turn On** | Turns on Semantic Search and starts the download. The card shows the progress, then hides when the model is ready. |
| **No Thanks** | Hides the card. It does not show again. The **Semantic Search** checkbox in **General** still works. |
| **Retry** | Shows after a failed download. Starts the download again. |
| **Dismiss** | Shows after a failed download. Hides the card. **Retry** stays on the **Semantic Search** row in **General**. |

- You see the card until you choose, also when you used Formaquestion before.
- Close the window with no choice, and the card shows again the next time you open it.
- The card does not show when you already set the **Semantic Search** checkbox.
- The card does not show when the model is already on your device. Semantic Search turns on with no card.
- After a reload, a failed download shows no card. Use **Retry** on the **Semantic Search** row.

## AI Context
<!-- keywords: debug a question, see the request, inspect help, sorted as, wrong section, trace, export json, bug report, search block, samplers, request card -->
<!-- route: formaquestionAiContext -->

**AI Context** shows what each question of the conversation sent to your AI, and what came back. Use it to find why an answer went wrong: a section the search missed, or a prompt you changed.

1. Select **More Actions**, then **AI Context**.

The dialog has the layout of the game's [AI Context Inspector](How-to-Play#the-ai-context-inspector).

- Each question of the conversation is one page, and the dialog opens on the newest.
- The line above the blocks says **Question N of M** and quotes the question.
- The pager at the bottom turns to another question.
- The window closes while the dialog is open and opens again when you close it.

| Block | What it shows |
|---|---|
| **Search** | The screen you had open, the item you had selected, and whether **Use the Open Screen** was on, the help preset, how **Sort Questions** sorted the question while it was on, and each search the question ran. For each search: the sections each source ranked, then the merged order. A section marked **sent** reached your AI. **Sent** lists those sections in the order of the request. It also names the searches that were on, the lead section, and the **Take Me There** target. |
| **Request N: Sorting** | The sorting request of **Sort Questions**, and the reply your AI wrote |
| **Request N: AI Search** | The **AI Search** request, and the lines your AI chose |
| **Request N: AI World Search** | The request in which your AI chose the parts of your world to send, while **Read the World** and **AI Search** are on with a world open |
| **Request N: Creating** | A request to make an entity, in place of the answer request, and the reply your AI wrote |
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
- **Open Guide** in the title bar shows the Guide full screen. See [Guide](#guide).
- With the mascot on, the sheet shows the mascot's head at the left of the pill, over a dimmed backdrop. A source name opens its section on the wiki in your browser, not in a reader. See [Mascot](Formaquestion-Mascot).
- **Formaquestion Settings** and **AI Context** fill the screen, so the sheet hides while one is open. When you close it, the sheet shows again as you left it, and an answer that was coming in continues.
- On Android, the back action closes the sheet first, before a dialog under it.

## The Help Tab
<!-- keywords: side handle, edge button, sideways text, opener, reduced motion, floating label, click vs drag, rotated -->

The **Help** tab opens and closes Formaquestion. It starts on the right edge of the screen, at the middle.

- The tab stays flat against one of the four edges. Its text turns with the edge.
- A press with no move opens the window. A drag moves the tab.
- This device keeps the place of the tab.
- The window opens from the tab and closes into it. If your system reduces motion, the window shows and hides at once.
