# 🎮 How to Play
<!-- keywords: basics, tutorial, beginner, gameplay loop, controls, what do i do, rules -->

You play by writing what you do. The AI narrator writes what happens next. The story moves one turn at a time.

> New to a world? [Starting a Game](Starting-a-Game) covers everything before page one.

## How to Take an Action
<!-- keywords: play, type, write, do something, move, respond, reply, input, send, enter, talk, say, message box, text field, submit, stop generating, cancel response, interrupt, new line, chat with npc, command -->
<!-- route: gameViewer -->

1. Select the action box under the story. Its placeholder reads *Type your action... [square brackets] direct the story as the author*.
2. Write what you do, in the first person: *I ask her where the road leads.*
3. Press **Enter**, or select the **Send** button. **Shift+Enter** starts a new line.

While the AI writes, the **Send** button turns red and becomes **Stop generating**. Select it to stop the turn.

> 💡 Success isn't guaranteed. The narrator decides how your attempt goes, and your stats shape it.

## How to Use a Choice
<!-- keywords: options, suggestions, pick, select, buttons, ready-made, click, combine, suggested actions, multiple choice, quick replies, prewritten, ctrl click, append, long press, tap answer -->
<!-- route: gameViewer -->

1. Read the choices under the story. Each one is a ready-made action.
2. Select a choice. Its text replaces what is in the action box.
3. Edit the text if you like, then send it.

To add a choice to what you already typed, **Ctrl+click** it (**Cmd+click** on Mac). On a touch screen, press and hold it. The choice joins the box as a new sentence, so you can stack two choices.

## How to Continue the Story
<!-- keywords: keep going, go on, next, more, proceed, advance, wait, skip turn, do nothing, pass, idle, empty message, nudge, let it play out, auto advance, without acting -->
<!-- route: gameViewer -->

1. Select **[Continue the Story]** under the choices. It shows once page one is on screen and the AI is done.
2. Send the action.

The text is in brackets, so the narrator reads it as a push to keep going, not as something you do. **Settings** → **Output** → **Choices** → **Continue the Story** sets when it shows. See [Choices](Settings#choices).

## How to Turn Choices Off
<!-- keywords: disable, hide, remove, options, suggestions, buttons, stop suggesting, free text only, no multiple choice, get rid of, write everything myself, re-enable, fewer requests -->
<!-- route: settings.output -->

1. Select the **?** button beside the action box. The **How to Play** dialog opens.
2. Open the **Choices** tab.
3. Clear the **Choices** checkbox.

The same checkbox is in **Settings** → **Output** → **Turn Extras**. With choices off, you write every action yourself.

## How to Direct the Story
<!-- keywords: brackets, ooc, out of character, author, control, steer, force, outcome, tell the ai, square brackets, god mode, meta command, guarantee success, time skip, set tone, override, system note, make npc do, instruct narrator, plot -->
<!-- route: gameViewer -->

1. In the action box, write your action as usual.
2. Add what should happen in square brackets: *I climb on behind her. [She agrees, and they ride off.]*
3. Send the action.

The AI reads text in brackets as direction from the author, not as something you do. Use it to decide an outcome, skip ahead, or keep a tone. The narration doesn't quote the bracketed text, and the story's memory leaves it out.

> 💡 Brackets direct one turn. For a fact the AI should keep in mind every turn, use the [Notes](#notes) tab.

## How to Attach Images to an Action
<!-- keywords: picture, photo, screenshot, upload, paste, drop, vision, send, add, multimodal, show the ai, clipboard, paperclip, jpg png, how many allowed, model is blind, reference art -->

1. Open **Settings** → **Output**.
2. In the **Attachments** section, select the **Image Attachments** checkbox.
3. In the game, select the **Attach images** button beside the action box. You can also paste an image, or drop image files on the action box.
4. Write your action and send it.

Each action takes up to 4 images. They go with that turn only. Select a thumbnail to view it, or its **Remove image** button to take it off.

> ⚠️ Your model must read images. A text-only model returns an error. The game shrinks an image over 1568 px on its long side before it sends it.

The attach button shows after the game starts, not on the opening turn.

## How to Re-generate a Turn
<!-- keywords: redo, retry, reroll, try again, different answer, last, swipe, did not like, regen, new response, another version, bad output, refresh, alternate, new options, do over -->
<!-- route: gameViewer -->

1. Find the latest turn's action row, under its narration.
2. Select **Re-generate Narration**.

The game goes back to the state before the turn and sends the same action again, with the same images. On page one, it draws another opening. See [Regenerating Page One](Entities#regenerating-page-one).

To re-roll only the choices, select **Re-generate Choices** beside them.

## How to Edit Narration
<!-- keywords: change, fix, rewrite, correct, ai text, response, reply, typo, modify story text, alter output, retcon, amend, wrong detail, what ai wrote, bot message, manually adjust -->
<!-- route: editText -->

1. On a turn's action row, select **Edit**.
2. Change the text in the **Edit Text** dialog. **Edit full screen** gives the editor the whole window.
3. Select **Save**.

Saving rewrites the turn's narration. The game reads the edited text for entities again. It also clears that turn's memory and diary entries, and your own edit to that memory. The story then writes them again from your version.

## How to Edit Your Action
<!-- keywords: change, fix, typo, rewrite, my message, input, correct, what i typed, my post, sent by mistake, amend, own line, user turn, remove picture, after sending -->
<!-- route: gameViewer -->

1. Right-click your action line, or press and hold it on a touch screen.
2. Select **Edit**.
3. Change the text, or remove an attached image.
4. Select **Save**.

Only the action text and its images change. The narration stays as it is.

## How to Rewind to an Earlier Turn
<!-- keywords: undo, go back, rollback, roll back, revert, previous, delete, restore, reset, take back, backtrack, erase turns, remove last messages, start over from, branch, mistake, time travel, wipe later -->
<!-- route: gameViewer -->

1. Go back to the turn you want to keep. In Pages, use the page buttons. In Chat, scroll up.
2. On that turn's action row, select **Rewind to Here**. The latest turn has no **Rewind to Here**, so go back at least one turn.
3. Select **Confirm** in the **Confirm Rollback** dialog.

> ⚠️ You can't undo a rewind. It removes every later turn, with its stats, its location, the entities the story invented in it, and its scene images. Your notes go back to that turn's notes.

## How to Read Earlier Turns
<!-- keywords: history, scroll back, previous pages, past, log, look back, page number, reread, old messages, what happened before, review, backlog, first turn, browse story -->
<!-- route: gameViewer -->

1. In Pages, select **Previous**, or a page number under the story.
2. To jump far back, select the current page number, type a page in the box, and select **Go**.
3. Select **Next** or the last page to come back to the live turn.

An earlier page is read-only. The side panel shows a banner, *Viewing turn n of total*, and the turn's notes, stats and location. In Chat, scroll up. **Jump to Latest** takes you back down.

## How to Change Location
<!-- keywords: travel, move, go somewhere, map, place, teleport, walk, leave, fast travel, navigate, room, area, zone, relocate, wrong scene, visit -->
<!-- route: location -->

1. In the right panel, open the **Location** tab.
2. Select **Current Location**. The **Change Location** dialog opens.
3. Select a place on the **List** tab, or a box on the **Map** tab.

You move at once. Travel costs no turn and writes no narration. The narrator can also suggest a move: select **Go** in the *Move to …?* bar, or **Dismiss**.

## How to Export the Story
<!-- keywords: save as text, download, txt, markdown, copy, transcript, share, print, log, novel, archive, read later, ebook, document, pdf, keep the text, post online -->
<!-- route: export -->

1. Select the **More narration options** button at the top right of the story.
2. Select **Export Story**.
3. Select **Plain text (.txt)** or **Markdown (.md)**.

The file holds every turn's narration. Markdown keeps the formatting; plain text doesn't. To keep your progress, use **Save Game** in the game menu instead.

## How to See What the AI Read
<!-- keywords: context, prompt, debug, inspector, raw, request, sent, tokens, log, behind the scenes, payload, full input, troubleshoot, what model saw, why did it, under the hood, api call -->
<!-- route: aiContext -->

1. Select the **Show the full AI context sent each turn** button at the top left. On mobile, open the **Menu** and select **AI Context**.
2. Use the turn pager to pick a turn.
3. Open a request to read its **Raw Input** and **Raw Output**.

See [The AI Context Inspector](#the-ai-context-inspector) for the search and the highlights.

## How to Read a Turn Aloud
<!-- keywords: tts, text to speech, voice, speak, audio, narrator voice, listen, kokoro, sound, narrate, spoken, hear, audiobook, out loud, voice acting, webgpu, playback speed, blind -->
<!-- route: gameViewer -->

1. On the latest turn's action row, select **Text to Speech**. The **Text to Speech** dialog opens.
2. Select **Load Model**. The voice model runs in your browser and needs WebGPU.
3. Pick a voice under **Voice Selection**, and set the **Speed**.
4. Select **Start**.

**Stream narration audio** starts speaking each sentence as it arrives. **Highlight while speaking** marks the sentence you hear. **Unload Model** frees the memory the model uses. After the model loads, **Regenerate Audio** is under the turn's **More** button.

## How to Report an Error
<!-- keywords: bug, crash, problem, failed, copy, details, send feedback, broken, something went wrong, issue, not working, glitch, support, tell developers, stack trace, contact -->
<!-- route: errorDetails -->

1. On an error message, select **View Details →**. The **Error Details** dialog opens.
2. Select **Copy** to copy the full details, or **Report Bug** to send them.
3. If you aren't logged in, log in first.
4. Check the pre-filled **Send Feedback** form, then select **Send Report**.

**Report Bug** shows only when community features are on.

---

## The Game Screen
<!-- keywords: interface, hud, ui overview, hide panels, distraction free, mute music, status line, where is everything, immersive -->
<!-- route: gameViewer -->

| Area | What it holds |
|---|---|
| The story | The narration, the choices and the action box. A status line above the box names the request that is running, such as *Generating Narration…* |
| The left panel | The **Entities**, **Notes**, **Memory** and **Logs** tabs. In a world with a 3D model, an **Avatar** / **Entities** switch sits above it. |
| The right panel | Your persona, the in-game date and time, and the **Stats**, **Traits** and **Location** tabs |
| Top left | The music button and the AI Context button |
| Top right | **Edit World** and the **Menu** |
| Bottom left | **Hide UI**, which hides the panels so only the story shows |

On mobile, three tabs at the top switch between **Character** (the left panel), **Game** (the story) and **Status** (the right panel). The **Character** tab also has an **Avatar** tab for the 3D model. **Edit World** and **AI Context** move into the **Menu**. **Hide UI** and the music button don't show.

## Turn Actions
<!-- keywords: buttons under text, more menu, copy to clipboard, message options, toolbar, icons below, three dots, long press -->

Each turn has an action row under its narration. Some actions sit under its **More** button. Right-click the turn, or press and hold it on a touch screen, for the full list.

| Action | Shows on |
|---|---|
| **Re-generate Narration** | The latest turn |
| **Re-generate Stats** | The latest turn, under **More**, when stat updates are on |
| **Generate Scene Image** | Under **More**, when [image generation](Image-Generation#how-to-make-an-image-of-one-turn) is on and the turn has no image |
| **Write Scene Tags** | Under **More**, when image generation is on |
| **Edit** | Every turn |
| **Text to Speech** | The latest turn |
| **Copy Text** | Every turn |
| **Regenerate Audio** | Under **More**, after you load the **Text to Speech** model |
| **Rewind to Here** | Earlier turns only |

No actions show while the AI writes a turn.

## The Side Panel Tabs
<!-- keywords: author note, inventory, reminder for ai, event history, edit my stats, cheat stats, toggle trait, always tell ai, sidebar, standing facts -->
<!-- route: gameViewer -->

| Tab | What it is |
|---|---|
| **Entities** | Who the story counts as present. See [Entities in Play](Entities). |
| **Notes** | Your standing notes for the AI. See [Notes](#notes). |
| **Memory** | What the story remembers. See [Story Memory](Memory#the-memory-tab). |
| **Logs** | A record of what changed. See [Logs](#logs). |

On narrow desktop windows the tabs show icons only. Hover an icon to read its name.

### Notes

The **Notes** tab is one free-text box. Its text goes to the AI with every action, so standing facts belong here: who you pretend to be, what you carry, the goal you work toward.

Notes are part of your save, and each turn keeps its own copy. An earlier page shows that turn's notes, and **Rewind to Here** restores them.

> [!NOTE]
> The narration prompt reads your notes through a placeholder. If a custom prompt leaves it out, the tab warns that the prompt doesn't include it.

### Logs

The **Logs** tab lists what the game changed: your starting traits and location, traits that switched on or off, moves, rewinds and saves. The tab label counts the entries, such as **Logs (12)**.

- A story event starts with the in-game time, such as *[Day 1, 08:00]*.
- An app event, such as a save or a failed load, shows in italic with no time.
- A repeated entry shows its count, such as *(3)*.

### The Right Panel

| Part | What it does |
|---|---|
| Language box | Sets the language or style the AI writes in, the same as **AI Language** in **Settings** |
| Persona row | Shows who you play. **Change** opens **Change Persona**. See [Change It in Game](Personas#change-it-in-game). |
| **Stats** | Your stats. **Edit Stats** lets you drag them; **Re-generate Stats** asks the AI again. Shows only when the world has stats you can see. |
| **Traits** | Your active traits. Filter them, or switch one on or off. |
| **Location** | Where you are, its description and the places it connects to |

## The Entity Dialog
<!-- keywords: npc profile, character sheet, portrait, bio, unknown name, who is this, click a name, cast details -->
<!-- route: entity -->

Select a name in the **Entities** tab to open it. On desktop with the avatar showing, the first select shows that entity's picture in the panel.

The dialog shows the entity's image or 3D model, its player-facing description, and its sound. An entity the story invented also has **Edit** and **Regenerate** for its description. **Regenerate** shows a **New Description** to **Keep** or **Discard**.

An entity the story hasn't revealed yet shows as its alias or *Unknown*, and doesn't open.

## The Change Location Dialog
<!-- keywords: world map, zoom, pan, places tree, sub areas, pin marker, minimap, overview of places -->
<!-- route: location -->

| Tab | What it shows |
|---|---|
| **List** | Every location as a tree, with sublocations indented. Expand or collapse a parent. Your location is highlighted. |
| **Map** | The author's map, read-only. A pin marks your location. Drag to pan, and pinch to zoom. |

The dialog opens on the tab you used last.

## The Game Menu
<!-- keywords: pause menu, quit, leave, hamburger, back to title, options, exit without saving, suggestion -->

Select the **Menu** button at the top right.

| Item | What it does |
|---|---|
| **Save Game** | Saves your progress under a name |
| **Load Game** | Opens a saved game |
| **Edit World** | Opens the World Editor on this world. Mobile only; desktop has its own button. |
| **AI Context** | Opens the AI Context inspector. Mobile only. |
| **Settings** | Opens **Settings** |
| **Send Feedback** | Sends a bug report or a suggestion. Shows when you are logged in to Community Creations. |
| **Exit to Main Menu** | Leaves the game. Unsaved progress is lost. |

## Narration Layout
<!-- keywords: difference between, paginated, continuous, scrolling feed, what each shows, jump to newest, dashed bubbles -->
<!-- route: gameViewerLayout.pages -->

| Layout | How the story reads |
|---|---|
| **Pages** *(default)* | One turn per page. Your action shows above its narration. The page buttons read back. |
| **Chat** | Every turn in one list that you scroll. Your actions show on the right, and the choices show as dashed bubbles. **Jump to Latest** takes you to the newest turn. |

Both layouts have the same turn actions and the same choices.

The layout, the quote color and the narration font are in **Settings** → **Display**. See [How to Change the Narration Layout](Settings#how-to-change-the-narration-layout).

## The AI Context Inspector
<!-- keywords: which lore triggered, raw reasoning, tool calls, export log json, find in prompt, debug window, request list, legend -->
<!-- route: aiContext -->

The inspector shows exactly what the game sent to the AI each turn, and what came back. Use it to learn why the story did something.

| Control | What it does |
|---|---|
| Search box | Finds terms in the turn. **Enter** goes to the next match, **Shift+Enter** to the previous one. |
| **Dictionary** / **Hydrations** | Picks what the text highlights. **Dictionary** marks the dictionary entries. Select a legend chip to hide its highlights. |
| **Current context only** | Hides turns that were re-generated, rewound or stopped. On by default. |
| **Collapse all** / **Expand all** | Collapses or expands every section |
| **Export** | Downloads the full turn history as a `.json` file |

Each request lists its **Raw Input**, **Tool Rounds**, **Raw Reasoning** and **Raw Output** where it has them. Before your first action it has nothing to show.

## Error Details
<!-- keywords: diagnostics, toast, error code, what went wrong, red popup, failure info, paste in discord, technical info -->
<!-- route: errorDetails -->

Most error messages have a **View Details →** link. The **Error Details** dialog shows the error and the full diagnostics behind it.

| Button | What it does |
|---|---|
| **Copy** | Copies the details, so you can paste them in a bug report or a chat |
| **Report Bug** | Opens **Send Feedback** with the error as its title and the details as its text |

## The Demo AI Notice
<!-- keywords: free model, badge, trial, default narrator, popup at start, weak ai, upgrade, no setup -->
<!-- route: demoAI -->

In the browser and on Android, Formamorph starts on the **Demo AI**, a small free model that needs no setup. The first time you start a game on it, **You're Playing on the Demo AI** opens. A **Demo AI** badge at the top right of the story opens it again.

| Button | What it does |
|---|---|
| **Keep Playing** | Closes the notice |
| **Get the Desktop App** | Opens formamorph.ai, where you can get the desktop app. Shows on devices that can run it. |
| **Connect an AI** | Opens **Settings** → **Endpoints** |

A stronger model writes better narration and keeps each entity consistent. See [Connect Your Own AI](Connect-Your-Own-AI).

## The Like Prompt
<!-- keywords: enjoying popup, heart, rate this world, thumbs up, upvote, stop asking, favorite, review -->
<!-- route: likePrompt -->

After 15 turns in a world you downloaded from Community Creations, a card under the story asks *Enjoying …?*

| Button | What it does |
|---|---|
| **♥ Like** | Likes the world's listing, so its author knows |
| **Not Now** | Closes the card |

After either button, the card doesn't show again for that world on this device. It doesn't show for your own worlds, the bundled worlds, or a world you already liked. If the like fails to send, the card asks again on a later turn.

## Related

- [🚪 Starting a Game](Starting-a-Game): everything before page one
- [🎭 Entities in Play](Entities): the cast, and how a game opens
- [🧠 Story Memory](Memory): what the story remembers
- [🪪 Personas](Personas): who you are in the story
- [🔌 Connect Your Own AI](Connect-Your-Own-AI): moving past the Demo AI
