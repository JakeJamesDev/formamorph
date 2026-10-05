# ⚙️ Settings
<!-- keywords: options, preferences, configuration, config, gear icon, customize app -->
<!-- route: settings -->

Settings controls how the app looks, what the AI writes each turn, which AI it connects to, and some stored data. Your settings stay on this device.

To open it, select **Menu** on the main menu, then **Settings**. During a game, open the **Menu** and select **Settings**.

> The **Prompts** and **Tools** tabs have their own pages: [Prompts](Prompts) and [Tools](Tools). This page covers the other four tabs.

## How to Change the Narration Layout
<!-- keywords: chat mode, pages mode, view, display, look, style, chat bubbles, book, messenger, conversation format, switch format, sillytavern like, toggle, single page -->
<!-- route: settings.display#narration-layout -->

1. Open **Settings**.
2. Open the **Display** tab.
3. In the **Narration** section, select **Pages** or **Chat** under **Narration Layout**.

The game changes at once. See [Narration](#narration) for what each layout shows.

## How to Color Quoted Speech
<!-- keywords: dialogue, highlight, talking, italic, colour, text, quotation marks, spoken lines, tint, stand out, distinguish, custom hex, what people say, emphasis -->
<!-- route: settings.display#quote-color -->

1. Open **Settings**.
2. Open the **Display** tab.
3. In the **Accessibility** section, select the **Quote Color** checkbox.
4. To use your own color, set **Light Mode Color** or **Dark Mode Color**. The row names the mode on screen. **Reset to Theme** brings back the theme's color.

To set quoted speech in italic, select **Quote Italic**. It works with or without **Quote Color**.

## How to Change the Narration Font
<!-- keywords: text, typeface, bigger text, size, readability, style, dyslexia, serif, hard to read, larger letters, line spacing, low vision, small print, legible, zoom -->
<!-- route: settings.display#narration-font -->

1. Open **Settings**.
2. Open the **Display** tab.
3. In the **Accessibility** section, pick a typeface in the **Narration Font** list.
4. To tune it, select **Customize…** beside the list.

The font changes the story text only. **Use Global** uses the app's **Font**.

## How to Turn On a Thinking Mode
<!-- keywords: reasoning, planning, smarter, better answers, chain of thought, cot, think first, improve quality, plan ahead, step by step, deliberate, more coherent, small model help, director -->
<!-- route: settings.output#thinking-mode -->

1. Open **Settings**.
2. Open the **Output** tab.
3. In the **Reasoning** section, select **Inline**, **Planning** or **Staged** under **Thinking**.

The line under the control says what the picked mode does. **Native** adds no thinking step. See [Reasoning](#reasoning) for the cost of each mode.

## How to Limit Active Characters
<!-- keywords: entities, max, cap, too many, speed, staged, fewer, npc count, crowd, slow turns, reduce requests, people in scene, cast size, big party, restrict -->
<!-- route: settings.output#thinking-mode -->

1. Open **Settings**.
2. In the switch next to the title, select **Advanced**.
3. Open the **Output** tab.
4. Under **Thinking**, select **Staged**. The **Limit Active Characters** row shows only in this mode.
5. Select the **Limit Active Characters** checkbox.
6. Type the largest number of entities to stage each turn. The default is 5.

## How to Restore Default Worlds
<!-- keywords: get back, deleted, bundled, built-in, starter, reinstall, recover, original, sample, accidentally removed, missing, stock, preinstalled, undelete, came with the app -->
<!-- route: settings.data#settings-mode -->

1. Open **Settings**.
2. In the switch next to the title, select **Advanced**.
3. Open the **Data** tab.
4. In the **Storage** section, select **Restore Default Worlds**. The button is off when you have deleted none of the bundled worlds.
5. Select **Confirm** in **Restore Default Worlds**.

Each deleted bundled world comes back at its latest version. Worlds you still have stay as they are.

---

## Simple and Advanced
<!-- keywords: missing setting, missing tab, expert mode, show everything, basic mode, more options, dot indicator, hidden option, power user -->

A switch next to the **Settings** title shows **Simple** or **Advanced**.

| Mode | What it shows |
|---|---|
| **Simple** | The settings for everyday play: appearance, scene, narration, reading, the core turn passes, the endpoint connection and autosave |
| **Advanced** | Every setting, plus the **Prompts** and **Tools** tabs |

The mode only changes what you see. A hidden setting still applies. A dot on **Advanced** tells you that a hidden setting is off its default.

In the tables below, **Advanced** marks a row that shows in Advanced mode only.

## Display
<!-- keywords: dark mode, night theme, color scheme, mute music, background image, translate, other language, typing animation, accent color, show thoughts -->
<!-- route: settings.display -->

What you see and hear.

### Appearance

| Setting | What it does |
|---|---|
| **Theme** | **Light**, **Dark** or **System**. **System** follows the light or dark setting of your operating system. |
| **Theme Color** | Sets the color palette for both themes. **Preview theme…** shows the palette on sample controls, and you can edit each color there. |
| **Font** | Sets the typeface for the whole app. **Customize…** tunes its **Font Size**, **Bold Weight**, **Italic Slant**, **Line Height** and **Letter Spacing**. |

### Scene

| Setting | What it does |
|---|---|
| **Background Music** | Plays the music of each location during the scene |
| **Location Background** | Shows the location image behind the game |
| **Background Fade** | Fades the location image toward the background color, so the text is easier to read. Shows when **Location Background** is on. |
| **Scene Images** | Makes an image of each turn. See [Scene Images](Image-Generation#scene-images). Your next action waits for the image, so each turn takes as long as your image server needs. Shows when **Enable Image Generation** is on. |

### Narration

| Setting | What it does |
|---|---|
| **Narration Layout** | **Pages** shows one turn at a time, and the page buttons go back. **Chat** shows every turn in one list that you scroll, with your actions on the right. |
| **Narration Reveal** | **Choose reveal animation…** sets how each sentence appears as it streams: **Fade**, **Move in**, **Scale** and **Blur**, with an easing and a minimum speed. The dialog has a preview. |
| **AI Language** | Sets the language or style of the narration, the choices and the answers in [Formaquestion](Formaquestion). Pick a suggestion or type your own, such as *formal English*. |
| **Paragraph Limit** | **Advanced.** **None**, **Single** or **Auto**. **Auto** fits the paragraph count to **Max Output Tokens**, so the turn has a planned ending. With **None**, a long turn can stop at the token cap with no real ending. |
| **Markdown Formatting** | **Advanced.** Lets the narration use bold, lists and tables. See [Text Formatting](TextFormatting). |

### Accessibility

These settings change the story text only, not the rest of the app.

| Setting | What it does |
|---|---|
| **Narration Font** | Sets a different typeface for the story text. The list has typefaces for dyslexia and low vision. **Use Global** uses the **Font** above. |
| **Narration Text Size** | Scales the story text |
| **Line Spacing** | Sets the gap between lines of story text |
| **Quote Color** | Colors text in double quotes, in the narration and in your own lines. Single quotes and apostrophes stay plain. |
| **Light Mode Color**, **Dark Mode Color** | Replaces the theme's quote color in the mode on screen. **Reset to Theme** removes your color. Shows when **Quote Color** is on. |
| **Quote Italic** | Sets quoted speech in italic, also on the choice buttons. It works with or without **Quote Color**. |

**Reset Size & Spacing** sets **Narration Text Size** and **Line Spacing** back to their defaults.

### Inspection

**Advanced.** These settings show work that the app usually does out of sight. They change nothing the AI writes.

| Setting | What it does |
|---|---|
| **Show Reasoning** | Shows the model's private reasoning as a **Thinking…** note above the turn. The app saves the reasoning either way, so past turns show it when you turn this on. |
| **Show Silent Requests** | Shows background requests in the status bar and the context viewer: memory summaries, diaries and notes on new entities |

## Output
<!-- keywords: slow turns, speed up, too many requests, disable stats, auto move, parallel, npc diaries, extra passes, performance, describe new npcs -->
<!-- route: settings.output -->

What the AI makes each turn, and what it carries forward. Most of these settings add or remove a request per turn. More requests give more features but make each turn slower.

### Turn Extras

| Setting | What it does |
|---|---|
| **System Prompts** | Three checkboxes for the requests that run after the narration: **Choices**, **Stat Updates** and **Location Change**. Turn one off and its feature stops, and its editor in the **Prompts** tab hides. |
| **Move Automatically** | Applies the move in your action before the scene is written, so the scene happens in the new location. It skips the **Move to…?** question. Shows when **Location Change** is on. |

### Reasoning

**Thinking** sets how the AI plans a turn before it writes it.

| Mode | What it does | Cost |
|---|---|---|
| **Native** | Adds nothing. A reasoning model thinks as usual; other models answer at once. | One request per turn |
| **Inline** | Reasons privately, then narrates, in the same request | One request per turn |
| **Planning** | Plans the turn in its own request, then writes it. The most reliable mode for small models. Marked recommended. | One extra request per turn |
| **Staged** | A director picks who is in the scene. Each staged entity plans its motivation. A storyboarder makes the plan. The best mode for a consistent cast. | Several extra requests per turn. The slowest mode. |

Turn on **Show Reasoning** to read what a mode wrote.

| Setting | What it does |
|---|---|
| **Limit Active Characters** | **Advanced**, **Staged** only. Sets the largest number of entities the director stages each turn. Each staged entity adds its own request. With the checkbox off, the scene stages as many as it needs. |
| **Native Reasoning** | **Advanced.** Sets whether a reasoning model thinks, and how hard. The checkbox turns reasoning off. The list sets the effort, and **Model Default** sends no hint. Every prompt set to **Global** follows this row. A model with no native reasoning shows a note here in place of the control. A model that always reasons keeps the checkbox on, with a note. |

### Tools

**Advanced.** **Tools** lets the AI call Tools to get information it does not have. Each round of calls adds a request, so turns take longer. Only endpoints that support Tools get them. On other endpoints, the row shows a note in place of the checkbox. The **Tools** tab sets which Tools each prompt can use. See [How to Turn On Tools](Tools#how-to-turn-on-tools).

### Memory

**Advanced.** **Memory Summaries**, **Semantic Memory**, **Memory Cap** and **Scene Recall** decide what the AI keeps from older turns. [Memory Settings](Memory#memory-settings) lists each one with its default. To stop memories, see [How to Turn Memory Off](Memory#how-to-turn-memory-off).

**Semantic Memory** downloads a small model of about 23 MB the first time you turn it on. A progress bar shows here while it downloads. **Semantic Lore** and **Diary Recall** use the same model.

### Time

**Advanced.** Shows when **Memory Summaries** is on.

| Setting | What it does |
|---|---|
| **Time in Memory** | Marks each memory with when it happened, such as day and time of day. Without it, the AI guesses how long ago things were. |
| **Measured Clock** | Lets the events of each turn set how much story time passes. Without it, each action takes one hour. Adds one small request per turn. |

See [When Each Memory Happened](Memory#when-each-memory-happened).

### Lore

**Advanced.** **Semantic Lore** activates [dictionary](World-Editor-Dictionary) entries by meaning, not only by keyword. Keyword activation does not change; this only adds entries. It uses the on-device model from **Semantic Memory**.

### Characters

**Advanced.**

| Setting | What it does |
|---|---|
| **Describe New Characters** | Writes a description for each entity the story invents. One extra request the first time a new entity is named. See [How to Get Descriptions for New Entities](Entities#how-to-get-descriptions-for-new-entities). |
| **Character Diaries** | **Staged** only. Each entity present writes a diary entry as turns age out. Its recent entries shape its motivation. One extra request per entity. |
| **Diary Recall** | Adds older diary entries that fit the moment. It costs nothing extra. Shows when **Character Diaries** and **Semantic Memory** are on. |

### Choices

**Continue the Story** adds a **[Continue the Story]** button under the choices. Like any choice, it puts its text in the action box, and you send it. The story reads it as a push to keep going, not as something you do. **Off** removes it. **On** shows it with the choices. **Always** shows it also when the **Choices** request is off.

### Attachments

**Image Attachments** adds an attach button to the action box, for up to 4 images with one action. The images go with that turn only. It also lets you attach images to a question in [Formaquestion](Formaquestion). Your model must read images; a text-only model returns an error. Each prompt's **Include Attachments** option sets which requests get the images.

### Performance

**Advanced.** **Concurrent Requests** sends the choices, the stat updates and the location change at the same time, not one after another. Turns are faster on endpoints that handle parallel requests. Turn it off if a local model with little memory slows down under the load.

## Endpoints
<!-- keywords: temperature, samplers, creativity, response length, cut off, context size, gpu layers, out of memory, api key, repetitive text -->
<!-- route: settings.endpoints -->

Which AI the app connects to. The tab has its own tabs: **Text**, **Image** and, in Advanced mode, **Tag Prompt**. To set up a text endpoint, follow [Connect Your Own AI](Connect-Your-Own-AI).

### Text

The **Preset** list holds your saved endpoints. **Demo AI** is the shared cloud endpoint, and you cannot edit it. On the desktop app, **Built-In Engine** runs a model on your PC. **Add New Preset…** makes a new one. **Rename**, **Reset** and **Delete** act on the preset you made.

| Setting | What it does |
|---|---|
| **Endpoint URL** | The address of your model server. The line under it shows the full URL that requests go to. **Trouble Connecting?** opens a checklist. |
| **API Token** | The token for a hosted service. Leave it empty for a local server. |
| **Model Name** | The model the endpoint uses, exactly as the server names it |
| **Context Window (tokens)** | **Advanced.** How much the model keeps in context. **Detect** asks the server. |
| **Max Output Tokens** | **Advanced.** Caps how long each answer can be. It does not cap reasoning. Select **Override Endpoint Limit** to set it; without it, there is **No Limit**. |
| **Sampling** | **Advanced.** A section of five rows: **Temperature**, **Repetition Penalty**, **Top-p**, **Top-k** and **Min-p**. Each has a checkbox. An unchecked row sends nothing. Per-prompt values and built-in prompt values come before **Temperature** and **Repetition Penalty**. |

**Reset AI Endpoint**, at the bottom of the tab, sets the URL, model name, token and limits back to their defaults.

### Built-In Engine

On the desktop app, the **Built-In Engine** preset shows the engine's own panel in place of the fields. It has its own **Simple** and **Advanced** switch. Every row below **Local Model** is in the **Engine** section. See [The Desktop Engine](Connect-Your-Own-AI#the-desktop-engine).

| Setting | What it does |
|---|---|
| **Local Model** | **Manage Models…** opens the **Local model** dialog to download and load a model |
| **Context Size** | How much recent story the model can see. More context uses more GPU memory. Lower it first when a model does not fit. |
| **GPU** | **Simple** on the panel. Runs the model on the GPU. Off runs it on the CPU, which is slower. |
| **GPU Layers**, **Layers** | **Advanced** on the panel. **Auto** puts as many layers on the GPU as fit. **Max** puts all of them there and can run out of memory. **Custom** sets the count in **Layers**. |
| **GPU Device** | Which GPU loads the model. **Auto** uses your discrete GPU, or all of them when you have more than one, or the integrated GPU when you have none. **All GPUs** always splits a model across every GPU. Pick a GPU by name to use only that one. Shows while the GPU is in use. |
| **Flash Attention** | **Advanced** on the panel. Uses less GPU memory and is often faster. Turn it off only if an old GPU cannot run it. |
| **Parallel Requests** | **Advanced** on the panel. How many requests the model answers at the same time. More is faster, but each request gets less context and more GPU memory goes to them. |
| **Temperature** | How much randomness the model uses when it picks each word. About 0.7 fits most story models. |
| **Max Output Tokens** | Caps how long each answer can be. An answer at the cap ends at its last full sentence. |
| **Top-p**, **Top-k**, **Min-p**, **Repetition Penalty** | **Advanced** on the panel. Sampling limits on which words the model picks. |

Sampling changes apply on the next turn. The other changes need **Save & Reload Model**. **Reset to Defaults** sets the panel back.

### Image

| Setting | What it does |
|---|---|
| **Preset** | Your saved image endpoints. You can edit each one, **Default** too. |
| **Enable Image Generation** | Shows the **Generate with AI** buttons. Off hides the rest of this tab and **Scene Images**. |

The **Connection** section sets which server makes the images. The setup steps for each provider are in [Image Generation](Image-Generation).

| Setting | What it does |
|---|---|
| **Provider** | ComfyUI, InvokeAI, Automatic1111 / Forge, NovelAI, or an OpenAI-compatible service on the desktop app. **How to Set Up** shows the steps for the picked provider. |
| **Endpoint URL**, **API Token** | The image server address and its token |
| **Model** | The checkpoint that makes the image |

The **Image** section sets how each image is made.

| Setting | What it does |
|---|---|
| **Prompt Prefix** | Quality and style tags put before every image prompt |
| **Negative Prompt** | Tags the image must not have |
| **Portrait (W × H)**, **Landscape (W × H)** | **Advanced.** Image sizes. Portraits are for entities. Landscapes are for locations and thumbnails. |
| **Steps / CFG** | Sampling steps and how closely the image follows the prompt |
| **Sampler** | The sampling method |
| **Face Fix** | Automatic1111 / Forge and InvokeAI only. Draws faces again in a second pass. On Automatic1111 / Forge it needs the **ADetailer** extension on your server. On InvokeAI it about doubles the time. |
| **Workflow (API Format)** | **Advanced**, ComfyUI only. Replaces the default ComfyUI graph. **How to Get This** shows how to export one. |
| **Board** | **Advanced**, InvokeAI only. The InvokeAI board that gets the images |
| **Qwen3 Encoder**, **Z-Image VAE**, **Anima VAE** | **Advanced**, InvokeAI only. Shows for a Z-Image or Anima model. Leave them empty to pick one automatically. |

### Tag Prompt

**Advanced.** Shows when **Enable Image Generation** is on. It is the prompt that your text model gets to turn a description into image tags. **Reset to Defaults** brings back the original text.

## Data
<!-- keywords: clear cache, free up space, tutorial again, show tips again, wipe downloaded pictures, guided tour, auto saving toggle, housekeeping -->
<!-- route: settings.data -->

Saves, the Authoring Tour, and stored data. To back up your worlds, saves, library entities and library dictionaries, use [Backup & Restore](Saves-and-Backup#the-backup--restore-dialog) in the main menu's **Menu**. See [How to Make a Backup](Saves-and-Backup#how-to-make-a-backup).

### Saves

**Autosave** saves after every turn to an **Autosave** slot for each world. It never changes your own saves. The slot shows under **Load Game** with an **Auto** tag. Autosave starts after the opening scene.

### Authoring

**Start Authoring Tour** opens the World Editor on a new world and shows an example for each step. See [The Authoring Tour](WorldEditor#the-authoring-tour). Your other worlds do not change. This section shows only when you open Settings from the main menu.

### Storage

**Advanced.** Each button asks you to confirm, and each is off when it has nothing to do.

| Button | What it does |
|---|---|
| **Restore Default Worlds** | Brings back the bundled worlds you deleted. See [How to Restore Default Worlds](#how-to-restore-default-worlds). |
| **Clear Cached Images** | Deletes the copies of linked images on this device. The app downloads them again when you are online. Your worlds and saves do not change. |
| **Reset Tutorials** | Shows the one-time tutorial notes again |

## Related

- [🔌 Connect Your Own AI](Connect-Your-Own-AI): set up a text endpoint or the desktop engine
- [🧠 Story Memory](Memory): what the Memory and Time settings do to a story
- [🎭 Entities in Play](Entities): the entities the story invents, and their descriptions
