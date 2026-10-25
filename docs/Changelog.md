# 📝 Changelog

All notable changes to Formamorph. This fork's first line is **2.0.0** — a full TypeScript rebuild of the upstream JavaScript app ([FieryLionite's Formamorph](https://fierylion.itch.io/formamorph), ~v1.2) — with feature parity as the baseline plus new features on top.

> ✅ **3.0.0 – 3.4.0 are released** (collapsed below). Releases 2.0.0 – 2.19.x are in [Changelog-v2](Changelog-v2). New work lands under **🚧 In Progress** — an unnumbered section, so changes accumulate without pinning a version. When a batch earns a release its section is marked **Released** and collapsed, and a fresh In Progress opens. `package.json` reads **3.4.0** — the latest released version.

Each release groups changes as **Major** / **Minor**, then **Added** / **Removed** / **Fixed**, and within those by audience: 👤 user-facing · 🛠️ developer tooling · ⚙️ backend. Where two or more changes touch the same feature, they sit together under that feature's name.

---

## 🚧 In Progress

_Unreleased — new work accumulates here until it earns a version bump. The next batch will pin its own version; `package.json` reads **3.4.0** (just released below)._

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Entity Avatars:**
    - **A world holds several Avatars in its Media tab, and each world entity picks one in its Avatar dropdown.** Upload or copy one from your library, then rename, replace, download or delete it. A delete names the entities that use it.
    - **Mark one library Avatar as your default from its tile menu, and User's Default shows it.** The tile gets a **Default** badge. With no default, User's Default shows the bundled Avatar.
    - **Library entities pick an Avatar from your Avatar library, and a library persona shows it while you play.** Adding one to a world copies its Avatar into the world once. Deleting a library Avatar names the library entities that use it, and they show no Avatar.
    - **Enter World shows the avatar step when the persona you pick has an Avatar.** The button switches between **Continue to Avatar** and **Start Game** as you change persona. You pick a library Avatar only under User's Default, starting on your default.
    - **In play, one entity view shows each entity's Avatar, 3D model or image, and replaces the separate Avatar tab.** It shows the Avatar first, then the model, then the image, unless you pick another with **Display by Default**. Select an entity to see it. On mobile, the **View** tab holds it.
    - **Exported character cards and published entities carry the entity's Avatar, and importing one adds it to your Avatar library.** Importing the same Avatar twice keeps one copy. Publish counts the Avatar toward the 25 MB entity limit before upload.
    - **The World Editor's Import Entity adds a card's Avatar to your library only when you confirm the import.** Cancel the import, and your Avatar library stays as it was.
    - **A library entity's Avatar dropdown shows Missing Avatar when its Avatar isn't on this device, as the link review does.** Pick another option to replace it.
    - **Each Avatar in the World Overview has a Preview button that shows it in 3D, with Export.** Export saves the file under the Avatar's name. History names the Avatar you add, rename or delete.
  - **Local Model:**
    - **Unified KV Cache is on by default, so parallel requests share one context.** Turn it off in **Advanced** to give every request the full Context Size.
    - **K Cache Type, V Cache Type and KV Cache in RAM give you more control over the context's memory.** Q8_0 or Q4_0 shrink the context. KV Cache in RAM moves it out of VRAM, but replies get much slower. Find them in **Advanced**.
    - **Local vision models see the images in your story when their projector sits beside the model.** Recommended vision models download theirs with them and show a **Vision** badge. A text-only model still drops images.
    - **Context Overflow chooses what happens when a story is longer than Context Size.** Truncate Middle keeps the system prompt and your first message. Rolling Window keeps the system prompt and drops the oldest messages. Stop at Limit shows an error. Find it in **Advanced**.
    - **World Tools work on the desktop engine, and the model reads each Tool's result before it answers.** Context Overflow keeps the current Tool round whole and drops an older round only as a unit.
  - **Media Tab:**
    - **The World Editor's new Media tab shows every image, sound, 3D Model and Avatar in the world, with sizes.** Cards sit in sections that follow your groups and locations, and an entity's images stack into one card. Select a card to preview, download or go to it.
    - **The Media tab header shows Publish Size and lets you group, sort and filter the gallery.** Group by type, show the largest files first, or filter to linked, embedded, rule-bearing or over-budget images. An over-limit world's warning now opens this tab.
    - **The Media tab's panel can now replace or remove a sound, 3D Model, background, thumbnail or cover image.** A replaced file keeps its slot, and each change undoes in one step.
    - **Optimize Images moves into the World Editor's Media tab header in both modes, and now shrinks dictionary cover images.** The app bar no longer has the button. Sizes and the meter update when a run ends.
    - **An entity's or location's image opens one Media tab panel with its gallery, and the framed image's actions sit below.** Reorder, generate, replace, download or remove images there. Each image also gets its Visibility rule editor, and an entity's links to its Avatar.
    - **The Media tab's No Images filter lists entities, locations, the thumbnail and the Map Background with no image.** Select a blank card to add its first image. Dictionaries without a cover image stay out.
    - **Trait requirements and image Visibility rules can check the time of day, such as evening or night.** Pick **Time of Day**, then turn on the dayparts. The game checks once per turn, after the turn's time passes.
    - **In the World Editor, a location's background is now a gallery, and each image can take a Visibility rule.** In play the backdrop shows the first visible image. A condition with no owner reads your persona. Older worlds load with their background first.
    - **The Locations canvas can show a Map Background image, and the in-game Map draws it behind the locations.** Right-click the canvas to set it, then drag, resize and fade it under Adjust Background. In the Media tab, add more map images with Visibility rules so the map changes in play.
  - **Request Status Strip:**
    - **The request status strip shows a small animated icon for each request, such as a compass for Plan.** The icon holds still when your system's reduced-motion setting is on.
    - **The request status strip shows a quill for Narration, a forking path for Choices, and masks for Cast and Motivation.** Between turns, memory and diary passes show a book. The Thinking header shows a thought cloud in place of its pulsing dot.
    - **The request status strip shows how long the turn has run, after 3 seconds.** The timer counts the whole turn, not each request. Background passes show no timer.
  - **Placeholders:**
    - **An entity's Pronouns field now takes placeholder chips.** Type `{` or drag a chip in. The AI and play-time scripts read the pronouns the entity's own placeholders resolve to.
    - **A connection's Travel Hints now take placeholder chips in the World Editor.** Linked hints share one roll both ways. Unlink them, and each direction rolls on its own. The editor's map shows the values in braces.
    - **An entity's Relationship labels now take placeholder chips.** Type `{` or drag a chip in. Each label resolves with the entity's own placeholders, even when its line prints on the persona's block.
  - **Scripts:**
    - **Scripts can now read the hour and minute of the story clock, with `clock.hour` and `clock.minute`.** `clock.previous` has both for the start of the turn. They match the clock in the panel. Hover cards and the Variable menu list them.
    - **Scripts can now read the player's action and the turn number, with `turn.action` and `turn.number`.** The number matches each memory's turn, and undo and re-roll rewind it. Between turns, the action is empty. Test Code reads a sample action.
    - **Scripts can now hide or show a stat during play, with `hidden`.** The stat leaves or joins the panel with this turn's changes. Undo takes it back. Hover cards and the Variable menu list it.
    - **Scripts can now read a location's parent, children and exits, with `location.parent`, `.children` and `.exits`.** Each exit has the place's name and travel hint, from the same list the AI picks a move from. Hover cards and the Variable menu list them.
  - **Feedback Questions:**
    - **Feedback has a Questions tab, where you ask the community, reply and vote on questions you share.** It opens on everyone's unanswered questions, most voted first. **Ask a Question** opens the form. Staff can move a thread between bug, suggestion and question.
    - **While you type a question's title, the Feedback dialog lists Similar Questions.** Select one to read it, vote and reply in the dialog. **Back** returns to your draft.
  - **Listing Review:**
    - **Your listings show a Pending Review or Resubmitted badge while a mod reviews them.** After you publish, a message says when your listing went to review. The badges show on the card, the details window and your profile's creations.
  - **The Requires picker in a large world opens on Traits, Any Trait in a Group and Stats.** Each list splits by owner and shows a count of targets you can still add. Search still finds every target.
- **🛠️ Developer tooling**
  - **Typing `/turn test` in the action box plays a real turn on canned replies, with no model.** Its two-sentence narration keeps the choices in view. The turn lands in the story, so Rewind removes it. Add a profile such as `slow` to change the pace.
- **⚙️ Backend**
  - **Llama Server Engine:**
    - **The desktop build bundles a pinned llama-server.** One llama.cpp release tag names the version, and a fetch step downloads its Windows, macOS and Linux builds.
    - **The desktop engine now runs models through the bundled llama-server instead of node-llama-cpp.** Every engine setting maps to a server flag. A failed GPU load retries once on the CPU, and the server exits with the app, even on a crash.
    - **The engine's proxy shapes each chat request the way node-llama-cpp read it.** It merges system messages at the top, sends the last message as a user turn, drops images a text-only model can't see, and passes the model's thoughts in a separate reasoning field.
    - **The VRAM viewer reads the engine's share from llama-server's own load log.** The share sums the model, context and compute buffers on the GPU. The device line shows the free VRAM llama-server saw at load.
  - **Dependencies:**
    - **The app runs on React 19.** React, React DOM and their types move to 19.3, with next-themes 0.4.6 and react-resizable-panels 2.1.9. The code editor keeps newer keystrokes when a render lags, and surface requests reach dialogs that mount late.

#### ➖ Removed

- **👤 User-facing**
  - **Entity Avatars:**
    - **The 3D Player Avatar checkbox and the Custom Player Avatar uploader leave the World Overview.** An older world that had the checkbox on still shows the same Avatar. Its old Avatar now sits in the world's Avatars.
    - **The Enter World avatar step no longer has a Delete button.** Delete an Avatar from its tile menu on the library's **Avatars** tab, which names the saves and entities that use it.
- **⚙️ Backend**
  - **Llama Server Engine:**
    - **The desktop build no longer ships node-llama-cpp.** Its dependency, its prebuilt packages and its packaging rules are gone, and the Windows payload is 4 MB smaller.

#### 🔧 Fixed

- **👤 User-facing**
  - **Turning off Flash Attention in the Local Model panel now turns it off when the model loads.** A box you unchecked before stays unchecked. A quantized V Cache Type needs Flash Attention on.
  - **The bundled model's out-of-VRAM error names your Context Size and Parallel Requests settings.** It said "sequences" before and gave no next step. Now it tells you which setting to lower.
  - **Editing a stat's or trait's script on the Scripts tab no longer slows down per keystroke and crashes the editor.** Each edit nested the script's stat and owner inside the script, and the next edit nested that again. A long edit ran the browser out of memory.
  - **The Hidden list in Community Creations now scrolls, so you can unhide one world from a long list.** With many hidden worlds, the list grew past the screen and you couldn't reach most of them.
  - **Indented lists and paragraphs in narration and model thoughts now show as text, not as code blocks.** A model that indented its outline by four spaces got a code box. Fenced code still shows as code.
  - **Unchecking Native Reasoning under Settings → Output now turns reasoning off on every prompt.** Before, only prompts set to Global followed it, so planning prompts kept reasoning at Low. Each prompt keeps its own setting for when you check it again.
  - **Test Code on a linked stat now routes writes through `owner.stats` to the stat itself, as play does.** The stat panel and the Scripts tab now give one report for one script. A Blueprint trait's script cards and Find All Uses now list the entities that link it.
  - **Choices now stream word by word at the end of a turn in long stories, instead of appearing at once.** Long stories re-read the whole history on each narration sentence and choice word, which froze the screen. A row that still shows late keeps its pace.
  - **The turn's action row now slides open after the narration finishes, and the choices stream in after it.** Before, the row appeared mid-stream and pushed the choices down, and numbered choices showed all at once. **Continue the Story** now comes last.
  - **The request status strip floats over the bottom of the narration, so the Pager and the action box stay still.** It works the same in Pages and Chat. A fade keeps the label readable over the text.
  - **One drag of a World Editor slider or color picker now undoes in one step.** A drag that started while another field had focus used to split into many undo steps.
  - **The Test Bench's AI Context tab now reads each entity's text with that entity's own traits and placeholders.** Descriptions, pronouns and relationship labels show what play shows, and Character Name shows the entity's name. A location's pins still win, as in play.
- **🛠️ Developer tooling**
  - **`npm test` passes on a busy machine and lists slow tests with how much load slowed each.** Timeouts now catch only hangs. Delay checks run on a fake clock, and speed checks compare sizes instead of timing a budget. A file that only timed out reruns alone once.

---

<details>
<summary><strong>✅ 3.4.0 — Released 2026-10-22</strong> — Entities that follow you, move between locations and stand at random starts — entity relationships the AI reads — scripts that read locations, memories and dictionaries — NovelAI character prompts — the You pill (click to expand)</summary>

### Major Changes

#### ➕ Added

- **👤 User-facing**
  - **Entity Presence:**
    - **An entity can stand at one random location from its list in each new game.** Set **One, at Random** under **Entities Here** on a location's **Presence** tab. Saves keep where it stands.
    - **The AI can know of an entity anywhere inside the locations you pick, without placing it there.** Set it under **Known Here** on a location's **Presence** tab. **Nearby Through Connections** lets entities one Connection away reach the AI as nearby.
    - **An entity set to Can Follow the Player comes with you when you invite it, and keeps following.** It travels with you on every move, Map travel too, until it stays behind. Each such entity adds one short AI request per turn. **Entity Movement** turns the requests off.
    - **An entity set to Moves Between Its Locations walks between them, one Connection at a time.** The AI moves it when the story sends it to one of its locations. It comes along with you only into its own locations, and it never keeps following.
    - **Pick an entity on the full-screen Locations Canvas to place it and set where the AI knows of it.** Click a location to add or remove it. In **Known In** mode, a pick covers every location inside it. The card also sets **Presence** and **Movement**, and warns when a moving entity can't reach one of its locations.
    - **The Entities tab marks who follows you, and the Map shows where the entities you've met are now.** A footprints icon marks each follower. Each Map location shows a count of the met entities there, and its tip names them. Entities you haven't met never show.
    - **Scripts can now move any entity, make it follow the player, or send it away.** Call `entities.<Entity>.move()`, `.follow()` or `.unfollow()`. The writes apply when the turn ends, after the AI's answers, and a moved **Free** entity keeps its position.
    - **One member of an entity listed in several places can follow you, and so can entities added in play.** The original stays at every listed location. One member follows at a time; once it stays behind, another can come.
    - **In the bundled worlds, the AI now knows who is one Connection away from you.** Every location that a Connection leaves turns on **Nearby Through Connections**.
  - **Entity Relationships:**
    - **Entities can list their relationships in the World Editor, and the AI reads each one as a sentence.** On an entity's **Profile** tab, pick another entity and type its role, such as mother. The AI reads "Kate is Tera's mother" once per prompt. When two entities list each other, the AI reads one: the persona's if either is.
    - **Absent relatives of anyone in the scene join Entities Known Here, so the AI knows who they are.** When Tera is present, Entities Known Here lists her mother Kate with her summary. The AI doesn't put Kate in the scene.
    - **Relationships can target Persona, and the AI knows the played persona's relationships in every scene.** Pick **Persona** in the list, and "Kate is Rowan's mother" uses the name of the persona the player picks. A persona the player doesn't pick sends none of its relationships.

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **NovelAI Character Prompts:**
    - **On NovelAI V4 and later, a `|` in an image prompt now starts a separate character prompt.** The first part describes the whole image. Other providers read a ` | ` with spaces as a comma, and NovelAI V3 keeps its own Prompt Mixing.
    - **Scene images on NovelAI V4 and later now send each entity as its own prompt, so their looks don't mix.** The scene tag line under the image shows each entity's part after a `|`. Edit one part to change only that entity.
  - **You Pill:**
    - **Your persona now carries a You pill after its name in the side panel, the Traits tab and Enter World.** It replaces the "(You)" text and the colored "You" word, including in the Stats panel picker.
    - **A requirement on your persona's traits now reads your persona's name with the You pill.** In the World Editor, the owner list and the condition read **Persona** instead of **You**. Worlds and saves don't change.
  - **Scripts:**
    - **Scripts can now read every location and who stands at each one.** `locations.<Location>.present` lists the entities there, the persona first. `location` has the same fields. Each entity reads its `location`, `following`, `description`, `summary` and `aliases`.
    - **Scripts can now read the story's memories as the Memory panel lists them, with `memories`.** Each memory has its turn, story time, daypart, text and pins. `memory.add` and `memory.pin` are now `memories.add` and `memories.pin`, and worlds are rewritten when they load.
    - **Scripts can now pin, forget, edit or remove a memory, as the Memory Manager does.** Call `memories[0].forget()` or another verb on an entry. The change lands when the turn ends and shows in the Memory Manager. A pin or forget on a Custom memory is ignored and listed.
    - **Scripts now add a diary line through the entity, with `entities.Mira.diary(line)`.** A world that calls `diary("Mira", line)` is rewritten to the new form when it loads. The Variable menu inserts a one-item call, such as `discover`, directly.
    - **Scripts can now read a dictionary's entries by name, with each entry's Trigger Keywords and Value.** Use `dictionaries.Lore.entries["Iron Crown"].keys` or `.value`. A disabled entry isn't listed. Hover cards and the Variable menu show them.
    - **Your own Tools' scripts now read the world as a Script does, with the same names and no writes.** Use `entities`, `locations`, `memories`, `stats` and the other Script names. `world` and `scene` are gone. Scripts and Tools also read the player's notes as `notes`. Try It lists each write a Tool ignores.
    - **Formamorph now rewrites your own Tools' scripts that read `world` or `scene` to the new names when it loads them.** It rewrites only where the result stays the same. The editor marks every other old read and names what to use instead. It rewrites imported Tool packs too.
    - **Script hover cards now explain one memory or one entity in a list, as in `memories[0].text`.** Cards also work in `find` and `filter` callbacks and `for` loops. The Variable menu lists a memory's fields and a `present` entity's fields.
    - **The Variable menu now lists each group's fields first and its calls last.** Entities, memories, **Clock**, **Location** and placeholders keep each set in its old order, so `move` or `pin` sits at the bottom.
    - **The Variable menu now shows each row's type, and marks the rows that scripts can only read.** A lock marks a read-only row. A call shows its form, such as `(line) => void`. The menu is wider.
    - **The Scripts Guide and the Tools guide now document the new script names and how old Tool scripts move.** Read the locations, memories and dictionary entries sections. Help answers from the new text.
  - **The Stats tab in the game's side panel now lays out stats the way the Traits tab lays out traits.** Each owner's stats sit in a card that folds. Groups show as headings, with ungrouped stats first.
  - **The Player Name chip is now called Persona Name in the World Editor and the wiki.** Type `{{user}}` or search "player name" to find it. It still reads "you" or "the player" with no persona.
  - **A world persona's Locations are now where you can start as it, and its Starting Location dropdown is gone.** Enter World lists each of them beside the world's starting locations. It picks the first that is a starting location, else the first listed. A world that named a start loads without it.
  - **Image presets can now keep weights and NovelAI syntax in your entity and location tags.** Turn off **Clean Up Tags** in the image preset. Scene images and AI-generated tags then keep `{tag}`, `1.5::tag ::` and `source#hug` as written.
  - **A new tile in your library now pulses once, the first time it is on screen.** It shows a world you just downloaded or made. Tiles you already had don't pulse after the update.
  - **A downloaded world's library tile now shows its image optimizing, and the world opens once that finishes.** You can't delete it until then either. The world's card in Community Creations shows the same bar.
- **🛠️ Developer tooling**
  - **A new probe measures the entity location request against the player's location request on the Emberwatch cast.** It reports reply accuracy, false and missed moves, and how long the fan-out adds to the stage.
  - **The relationship probe measures whether narration uses an absent relative without placing them in the scene.** It runs an A/B, relationship off vs on, on the shipped prompts.

#### ➖ Removed

- **👤 User-facing**
  - **Stats no longer cap the AI's change at 20 per turn.** A big reward or loss moves a wide stat, such as gold, in full. Each stat still stays inside its own minimum and maximum.

#### 🔧 Fixed

- **👤 User-facing**
  - **Scripts:**
    - **A script asks the player for typed text with `player.input`, renamed from `player.askText`.** Worlds and Tools that call the old name load with the new one.
    - **A trait you toggle keeps the memory, pinned memory and diary lines its When a Trait Switches script writes.** They land on the latest turn, and a rewind past that turn removes them.
    - **Script and Tool script hover cards now read in one voice.** Card lines open with their subject, the Variable menu's **Owner** line matches its card, and each memory and entity field is one sentence.
  - **The Test Bench's Openings preview now names the persona you pick, or says no persona under None.** Code cards mark an entity you can play as **Persona: Playable**. The author-note ⓘ line in Settings says "your persona".
  - **On NanoGPT, Native Reasoning now knows which models think and which strengths they take.** Short prompts such as Choices give a thinking model room and no longer fail with "The model reached its token limit before it wrote an answer."
  - **The token-limit error now names the prompt that failed.** Error Details show it on a Prompt line. For a prompt with a Max Output setting, they also tell you to raise it.
  - **Summaries and Diary now ship with Native Reasoning off, so turns finish sooner on a thinking model.** Prompts you already set keep your setting.
  - **The status bar now names the request a turn is still waiting on.** After choices land, it shows the memory or diary pass that is still running.
  - **In the Chat layout, you can pick a choice as soon as choices land.** The pick fills your action. You can send it when the turn finishes.
  - **Narration now bolds only loud words, and thinking models spend less of each turn's thinking on formatting.** The Markdown Guidance chip now has one form. Prompts that used Definitions keep working.
  - **The Default preset's narration prompt is shorter and states each rule once.** It no longer repeats the ban on option menus at the end, or asks for concise prose next to the length setting.
  - **The default prompts now call their entity sections Entities and tell the AI what each section holds.** A Known Here entity reads as elsewhere right now. People in the scene may speak of it.
  - **A stat now opens at its authored value everywhere, and an authored zero stays zero.** Play, the Test Bench, Test Code, the trait picker, code cards, new Link Base Values and older saves agree. No change shows on turn one. A value outside the range opens at the nearest edge.
  - **Test Code and the Test Bench now check a Script against the same turn-one world as play.** They read `clock` by timing and a switched-off stat as off. Test Code's `entities` holds a new game's cast, without persona-only entities. An unknown `diary` name warns. A trait Script whose entity is gone reads `self` as not held.
  - **Error Details and bug reports now show a server's HTML error page as one line: its title and Ray ID.** A report from **Report Bug** keeps its details in a code block, so markup in them shows as written.
  - **The Stats panel picker now lists an absent entity only once the story has named it.** Absent entities you haven't met no longer show as Unknown.
  - **Close buttons on dialogs and panels are now easier to tap on mobile.** A dialog's close button takes a 44-pixel tap area, and every close icon is a little larger. Nothing else moves.
  - **Full-screen fields, panels, the Locations map and the Guide now exit from one button in the top-right corner.** The button sits in the same place as a dialog's close button and has the same 44-pixel tap area.
  - **A new item in your library now lands after your last tile, not in a gap between your tiles.** It goes right of the last tile on the bottom row, or starts a new row when that row is full. Every tile you placed stays where it was.
  - **A downloaded world now shows in your library even when you close Community Creations before the download finishes.** You no longer have to reopen Community Creations to see it.

</details>

---

<details>
<summary><strong>✅ 3.3.3 — Released 2026-10-18</strong> — Native Reasoning and Tools that follow the loaded model — Edit Stats for entity and persona stats — saves that survive an unreadable record — Blueprint stat gates in the Test Bench (click to expand)</summary>

### Minor Changes

#### 🔧 Fixed

- **👤 User-facing**
  - **The Test Bench no longer flags a Blueprint trait whose requirement reads a Blueprint stat its entities hold.** It checks each entity that links the trait, and names one that lacks the stat.
  - **Edit Stats in the Stats panel now edits every visible stat, entity and persona stats included.** It now works in a world whose only visible stats belong to entities. Your edit doesn't count as the turn's change.
  - **Autosave and the save list no longer crash on a save the browser can't read.** The unreadable save stays stored but doesn't show, and your other saves load and autosave as usual.
  - **Native Reasoning and Tools now match the model LM Studio or llama.cpp has loaded when you use `default`.** Switching back to a model reuses its answer with no request. Both rows get Recheck and name the model they describe.
- **⚙️ Backend**
  - **The built-in engine updates to node-llama-cpp 3.22.2 with llama.cpp v0.7.0.** The update brings two llama.cpp releases of Vulkan fixes, including a fix for device start-up.

</details>

---

<details>
<summary><strong>✅ 3.3.2 — Released 2026-10-18</strong> — World Tools that run scripts and change the game — scripts that move the location, advance the clock and write memories — code templates for every timing — timed suspensions — a llama.cpp Reasoning Budget fix (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **World Tools:**
    - **Worlds can now hold Tools, which every playthrough of the world offers to the AI.** Add them in the World Editor's new Tools tab, in Advanced mode. A World Tool replaces a same-name Tool in its world. The Tool status line now names the Tools the AI calls.
    - **Scripts can now move the location, advance the story clock and discover a new entity.** Call `location.move`, `clock.advance` or `discover` from any script. Each write replaces the AI's answer for that turn and drops with a regenerate. Test Code lists them.
    - **Scripts can now add a memory line, a pinned memory or a diary line for the turn.** Call `memory.add`, `memory.pin` or `diary`. Lines join the AI's summary and diary, a pin is sent with every request, and a regenerate drops all three.
    - **A World Tool's script can run when the AI calls it, or after the AI, and change the game.** An On Call Tool returns its script's value. An After the AI Tool sends its Reply, and its script runs with the After the AI scripts. A regenerate drops the changes.
    - **A During AI Output World Tool rewrites every narration sentence after the AI calls it.** Called Tools run in Tools-tab order, before the world's output scripts. The rewrite is what the screen, the save and read-aloud get.
    - **You can test a World Tool in the editor, and renames and Find All Uses cover its script.** Try It lists the reply and each staged write, and applies none. Renaming a location also updates its `location.move` calls. Test Code warns on a diary name the world lacks.
    - **A stat re-roll keeps the changes a World Tool made during the turn.** An After the AI Tool runs again with the AI's call. An On Call Tool's changes come back as they were, so a random result still matches the story.
    - **A script's clock advance shows in the prompts the turn builds after it.** A Tool the planner, the director or a character pass calls changes the place, time and stats that later passes and the narration read. The turn charges its time, regen and starvation once.
    - **The drone world ships lock_target, a World Tool that marks the enemy the AI locks onto.** For the rest of that reply, the target shows in bold with a reticle. The Tools page and the Scripts Guide explain World Tools.
    - **Try It in the Tool editor becomes a tab when the editor is narrow.** It keeps your values and last result when you switch tabs. It returns to its column when the editor widens.
  - **Code Templates:**
    - **A code template can now run in several timings, and each script box lists the templates for its own timing.** At Game Start, During AI Output and When a Trait Switches no longer show the After the AI set. When you save a template, pick each timing under **Runs**. Older template packs still import.
    - **Seven new code templates fit At Game Start, When a Trait Switches and During AI Output.** They set a random or trait-based starting value, react to a trait switch, and replace, count or bold a word in narration.
    - **A World Tool's Script box has a Templates button that lists starter code for the Tool's timing.** A parameter input picks one of the Tool's Parameters, or its **New** row adds the Parameter the template reads. Save, export and import your own World Tool templates beside your stat templates.
    - **Code templates can now pick an entity's or persona's stats, and an entity stat's trait inputs list its own traits.** In your own templates, `{{s:stat(who)}}` lists the stats of the entity picked in `who`, and `{{s:stat(persona)}}` lists persona stats. Owner traits show first, under **Owner**.
    - **A world script's box now has a Templates button with eight starter templates.** They set the opening location, advance time, pin memories and diary lines, and replace words. Save, export and import your own beside the others. A new location input picks one of the world's locations.
  - **Timed Suspensions:**
    - **In the Admin Panel's Users tab, Suspend asks for a length and the table shows when each suspension ends.** Pick 3 to 30 days or **Until Lifted**. **Suspend** also works on a suspended account.
    - **A suspended account's profile now shows its end date, and the Audit Log shows suspensions that end on their own.** Filter the log by **Suspension expired**. Each Suspended entry shows the end that staff chose.
- **🛠️ Developer tooling**
  - **The During AI Output run takes a Narration Stream listener that drops a retracted round's writes.** A sentence run still in progress at the retract leaves no write either. Output triggers build on this seam.

#### 🔧 Fixed

- **👤 User-facing**
  - **On a llama.cpp server, a prompt's Reasoning Budget slider now sets how long it thinks.** The budget is a percent of Max Output, as on other servers. Before, a model whose template had no strengths was stuck at Model Default's room.
  - **Test Code now reads the clock as play does in every timing but After the AI.** At Game Start, During AI Output and When a Trait Switches read a zero `clock.deltaHours`. Test Code ran them as a one-hour turn, so it could show a change that play never makes.
  - **Test Code now reads an entity's `type` and `pronouns` as authored.** A script that read them in Test Code got empty text. Play read them correctly.

</details>

---

<details>
<summary><strong>✅ 3.3.1 — Released 2026-10-16</strong> — Scripts with five timings on stats, traits and the world — scripts that ask the player questions and rewrite narration — refreshed bundled worlds — Extra Parameters per endpoint — Native Reasoning Thinking Room — a long tail of fixes (click to expand)</summary>

### Major Changes

#### ➕ Added

- **👤 User-facing**
  - **The eight bundled worlds now have new writing and show scripts, trait gates, trait modes, pick limits and weighted openings.** Each world keeps its title, hook and core cast. Each file is stored the way the World Editor saves it. A save of an older bundled world still loads and plays.

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Scripts:**
    - **Stats, traits and the world now hold Scripts: code boxes with a timing, replacing a stat's two code tabs.** Add Script adds a box; its dropdown picks Before the AI, After the AI, During AI Output, At Game Start or When a Trait Switches. A trait's scripts run only while it is active. Old code loads as scripts.
    - **The World Editor's Scripts tab lists every script by timing in run order and edits it in place.** Drag a script within its timing to set the order. Add Script there makes a world script that belongs to no stat or trait. A link jumps to the script's owner.
    - **Selecting a timing on the Scripts tab describes it, and the Scripts help has four tabs.** A timing's panel says when it runs and what it is for. The help tabs are Overview, Timings, Variables and Stat Writes.
    - **A script with the When a Trait Switches timing runs when a trait turns on or off in play.** A trait's own script sees its switches, its switch-off included. A stat or world script runs on every switch and reads `trait`, with `enabled` as the new state. Setup picks and loading a save fire nothing.
    - **A script with the At Game Start timing runs once before a new game's opening.** Its writes shape the opening prompt. Loading a save never runs it, and a regenerated page one on a save skips it.
    - **A During AI Output script rewrites each narration sentence as it completes.** Assign `narration.sentence` or return a string, and read `narration.sent` and `narration.buffered` for the sentences around it. The reveal, read-aloud, save and next request carry the rewrite.
    - **A script can ask the player a question with `player.ask`, `player.confirm` or `player.askText`.** The script waits for the answer with no `await`. Closing the prompt fails that script and drops its writes. `player.tell` and `player.toast` show the player a message. During AI Output refuses every `player` call.
    - **Script prompts show as a line under the narration, in play and in the editor.** Pick a pill, the dropdown or the text field, then OK where shown. Cancel or Escape closes it. A `player.tell` stays with its turn, survives save and load, and never reaches the AI.
    - **A trait you switch during a script prompt keeps your setting, and scripts read a changed persona's cast.** After a persona change, `persona` and `entities` show the new cast; the left persona's traits switch off. A library persona's scripts wait for it to load.
    - **Test Code, the Test Bench and the help's script test run every script timing on stats, traits and the world.** A During AI Output box shows a Sample Sentence's rewrite. Tests show script prompts, and findings name the script. The bench flags unknown stat names and reading delta before the AI. Moving a stat stops when any script reads it.
    - **The help window, Scripts Guide and hover cards now explain each script timing, `narration`, `player` and `trait`.** The Stat Code Guide is now the Scripts Guide, and searching "stat code" finds it. The Variable menu lists each name for its timing. A world script's `self` card reads empty.
    - **The help window writes scripts for every timing, and Insert adds them to the open stat, trait or world.** On a trait's or the world's Scripts tab, every question is a code question, and the code test runs there. Naming a timing also counts. A block's tag, such as `start`, picks the timing.
  - **Image Generation:**
    - **ComfyUI's Model row shows the model a workflow loads itself.** A workflow without `%ckpt%` ignores the Model setting, so the row shows its own model file, grayed out.
    - **ComfyUI's File Name setting sets the folders and name for each saved image.** By default, images go in `formamorph/<world>/`, named for their entity, location or turn. A `/` in the pattern makes a folder. A custom workflow needs `%prefix%` in its save node.
  - **A setting, Strip Links And Images, sends past narration without markdown links and images.** It's under Settings → Display → Narration in Advanced mode, and on by default. A link becomes its text and an image goes. It covers the last story, memory summaries, diary entries and recall results.
  - **Buttons and menu items that send an AI request now show which endpoint gets it.** **Send** and the World Editor's generate buttons show it in their tooltip. **Re-generate Narration**, **Re-generate Stats**, **Re-generate Choices** and **Write Scene Tags** show it as a second line in the More and right-click menus.
  - **Each text endpoint has Extra Parameters: a JSON object added to every request sent to it.** A field the app sets for a request wins. You can't set `model`, `messages`, `stream`, `tools`, `tool_choice`, `response_format`, `n` or `stop`. If the text has an error, requests go out without it.
  - **A prompt's Native Reasoning now shows its Thinking Room beside the strength, such as "Low · 1,024 tok".** The readout updates when you change the strength. With Max Output off, it replaces the Reasoning Budget slider and its note.
  - **A disabled stat now reads "Off" and dims on the Stats tab and on its rows in the Scripts tab.** The marker shows in the world and entity stat trees.
- **🛠️ Developer tooling**
  - **`projectDrop` in `src/lib/treeProjection.ts` finds where a dragged row lands in the group, location and placeholder trees.** Each tree passes the rule for which rows can take children. The same file hides collapsed rows and reads a missing parent as the top level.
  - **`planTreeDrop` in `src/lib/treeProjection.ts` runs the shared start of a drop in the group, location and placeholder trees.** It projects the drop, refuses a hidden target or a cycle, and moves the row. Each tree writes the result to its own data.
  - **`applyOwnerTreeDrop` in `src/lib/ownerTree.ts` runs drops in a tree with entity nodes, and the Traits tab's tree runs on it.** An owner adapter gives the item lists, the entity rows, the refusals and the write-back. Trait drops give the same result as before.
  - **The Stats tab's tree now runs its drops on `applyOwnerTreeDrop` in `src/lib/ownerTree.ts`.** A source can name entity rows its own way, so stat rows keep their `entity/id` ids. Stat drops give the same result as before.
  - **The trait and stat trees now share one copy of each owner-tree helper in `src/lib/ownerTree.ts`.** This covers Blueprints groups, node placement, links in tree order, picker rows and list writes. The stat-only copies are gone.
  - **`world-probe.cli.ts` plays a bundled world against an older revision of itself in the real app.** It interleaves the arms on the cloud endpoint, scripts included, and reports leaks, choices, stat passes and placeholders per arm. Blind transcripts feed the baseline rubric. It replaces `world-narration-probe.mjs`.

#### 🔧 Fixed

- **👤 User-facing**
  - **Native Reasoning:**
    - **Models that always reason now have room to answer small prompts like Location Change.** Each strength gives a fixed Thinking Room, from Minimal at 128 tokens to Max at 16,384. Max Output limits only the answer, so turning it off no longer shrinks the room.
    - **With Max Output off, models that take a thinking budget now get the strength's Thinking Room as that budget.** Before, no budget went out, so the model could think without a limit.
    - **On a llama.cpp server, a looping thought now stops at the Thinking Room and the model writes its answer.** Switching Native Reasoning off now stops thinking for every llama.cpp model.
    - **A thought that uses its whole Thinking Room now says so in the error.** Error Details list the room and its strength beside `max_tokens`.
  - **ComfyUI with an empty Model now uses the first checkpoint the server lists.** It used to send an empty checkpoint name, which ComfyUI rejects. The Model placeholder says which one is used.
  - **World music or ambient sound your browser can't play now stays silent instead of showing an error.** This covers a new game, a loaded save and a move to a new location.
  - **The world library now opens when one stored world can't be read.** An unreadable world stopped the library's one-time update, with the error "Cannot read properties of null", on every launch. The update now skips that world.
  - **Duplicating a location from the filtered list now gives the copy its own Unique chip rolls.** The copy no longer shares the source's values, the same as in the tree.
  - **Signed out, the app no longer sends a login token with community requests.** Every community service now shows the server's own error text. The world list and comment list used to hide it.
  - **Login now shows the server's reason when it refuses you.** A login or password change that gets an error page shows "Login failed" or its own fallback, not a parse error.
  - **Story export now leaves out turns that can't be read, so no error text lands in your story.** The history size estimate also counts turns saved in a looser format.
  - **A library entity with two links to one stat now uses the same link in the editor and in play.** Play keeps the link higher in the stat tree, and adding the entity to a world now keeps that one too.
  - **Formaquestion's code test function is now named `test_script`, and its description and code rider say "script."** They said "stat code" before.
  - **Deleting an entity, trait, location or placeholder group keeps your item order.** The group's items take its place in the list.
  - **Arrange on the location canvas no longer freezes on a world whose locations hold each other in a loop.** Every walk up the location, group and placeholder trees now stops at a loop.
  - **A stuck semantic search no longer hangs Help or the Test Bench.** Every embedding call now gives up after a set time and leaves no timer running.
  - **Undo no longer empties a name field that loaded after you opened it.** Chip name fields now treat a late-arriving value as the starting text, not as an edit.
  - **A failed share-code copy shows an error, Copy Paths resets, and Community sorts server dates as UTC.** Listings keep their order in every time zone.
  - **Pressing Enter while a keyboard suggestion is open no longer saves a chip you are still editing.** Editing a chip on Android now finishes the word first, like the tag field.
  - **Stat code templates load again after a failed first open.** The template list now retries the database on the next use instead of staying empty until you reload.
  - **Load World in the editor now accepts the same file twice.** Player avatar uploads, event images and profile images reset the same way.
  - **Editing narration now updates the turn's entities and the Entities tab, and discovers new ones.** A name that only appears in dialogue no longer counts as present. A new name you write in becomes an entity.
- **🛠️ Developer tooling**
  - **Tests run on half the hardware threads, and the ticket test gate retries a `findBy` or `waitFor` that gave up.** One fork per thread ran the 5-second tests at 4.6 s idle, so a peer's load timed them out. The retry alone still fails on a real miss.

</details>

---

<details>
<summary><strong>✅ 3.3.0 — Released 2026-10-14</strong> — Entities own stats — stat code reads and writes any stat through `owner` — hover cards in every code editor — global stats and traits — Visibility rules and stat Conditions — Formaquestion Semantic Search and a full-screen Guide — a long tail of fixes (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Entity Stats:**
    - **Entities can own stats, set on a Stats tab in the entity panel in Advanced mode.** The tab works like the Stats tab, with the same search, **+** menu and stat fields. Stats save and export with the world.
    - **Stats now go in groups on the Stats tab and on each entity's Stats tab.** Groups nest, reorder and take a description. The stat panel shows each group as a collapsible heading. Clear **Show Heading to AI** on a trait or stat group to group only for yourself.
    - **The Stats tab shows a node for each entity that owns stats, and Blueprints give one stat to many entities.** Drag stats and groups between owners, or drop a Blueprint on an entity to link it. **Link Stat** and **Link To…** follow the Blueprint live; **Detach** makes it the entity's own. A note explains a refused move.
    - **An entity's own traits and trait links now change its own stats, in the World Editor and in play.** They never change the player's stats. The Issues tab warns about a change to a stat the entity doesn't own. The Test Bench lists each entity's starting stats, and world setup lists each trait's stat changes.
    - **An entity stat's Body Sliders now shape that entity's own 3D model in play.** The picker lists the entity model's sliders. The entity view, its model window and the entity card show the stats of the turn on screen.
    - **Library characters keep their stats on a character card, and the library editor has a Stats tab.** The card carries stats, stat groups and stat links, and a library character then acts like an authored entity. A link stays dormant until a world has its Blueprint.
    - **Stat code now reads and writes any stat, and `owner` holds the entity that owns the stat.** `stats` is the world's stats in every box. Reach the others through `owner.stats`, `entities.Bram.stats` or `persona.stats`. Writes apply in owner order, and the last one wins. A dropped write is reported.
    - **Stat code tools now follow `owner` and writes to any stat: the editor, Test Code, Issues, renames and the guide.** The Variable menu and templates pick owner or world stats. Test Code lists every write and drop. Renaming a stat updates the code in every box. The Stat Code Guide has an Owner section.
    - **Entity stats change during play: regen and both code boxes run each turn for every entity, present or not.** A save keeps the values.
    - **The Stats tab shows the selected entity's stats under yours, with a picker at the top.** Pick an entity, or **(None)** to hide the section. Each entity stat shows its change this turn with the same timing as yours. Hidden stats stay hidden.
    - **Your played entity's stats now join yours in the stat panel, the AI's stat updates and the Stats chip.** A stat that shares an earlier stat's name stays separate and reads with a number, such as "Trust (2)". Each entity keeps its values when you switch persona.
    - **The AI now updates every entity's stats with yours, in blocks for your persona, each entity and global stats.** Bundled worlds give their persona stats and traits to a Custom Persona. An older save of a bundled world shows both stat sets and loses its trait picks until a new game.
    - **A refused stat request falls back to stat-change lines in your preset's style, updating your persona's and loose stats only.** Custom prompts and a world's own Stats prompt go as written.
    - **The Entities chip sends each present entity's stats, in their groups, to the AI.** The **Include** row in the chip's Chip Options turns it off. Stats are on for the Here and In Scene scopes and off for Sub-Locations and Reachable until you turn them on, with Full or Summary content.
  - **Code Hover Cards:**
    - **Hovering a name in stat code, a Tool script or the template editor now shows a card that explains it.** It shows the name's kind, type, a Writable or Read-Only badge and a description. The completion list shows it beside the selected option. The first Escape closes the card.
    - **The Variable menu and the Tool script reference now state whether each field is writable or read-only.** Help lines for stat code, Tool script and completion names also follow one writing style.
    - **Press Ctrl+K Ctrl+I in a code box to open the card for the name at the caret.** Tapping a name on a touch screen opens it after a short pause. Typing closes it, and a screen reader announces a card opened from the keyboard.
    - **A stat's hover card in stat code now shows its range, start value, regen, owner and who sees it.** A Link's card shows its own Overrides. Cards on `self` and `owner` name this box's stat and owner, and a Blueprint stat's card lists its owners.
    - **Hovering a declared name or template slot in the code editor now shows a card.** A declared name shows its kind and a Go to Line link. A slot shows its type and default.
    - **Hover cards in stat code now show a trait's requirements and effects, and a placeholder's values and weights.** Entity, dictionary and `persona` cards list what they hold. Faded values never roll. Completion offers the owner's traits and placeholders after `owner`.
    - **A hover card in a stat's code now has Open, which jumps to the item in the World Editor.** An entity's own stat or trait opens on that entity's Stats or Traits tab with its row selected. Open leaves full screen first. The template dialog, the Tool editor and the library editor show no Open.
    - **A code error with a near name now offers a fix, such as Change to Health for `stats.Helth`.** Click it in the error card or press Ctrl+. at the caret. In full screen, a lightbulb beside the line lists the fixes.
    - **A hover card on `self`, `stats`, `clock` and the other code globals now has Read in the Guide.** It opens the global's section. Tool script globals link to new headings in the Tools doc.
    - **Hover cards in stat code now have Find All Uses, listing every line that uses that exact item.** It works for stats, traits, placeholders, entities and dictionaries. Each row names the box and line, and a click opens that box at the line. Same-named items on other owners stay out.
    - **Hover cards on `persona` and Blueprint `owner` names now show the item each reached entity holds.** Where those entities hold different items, the card lists only the entities. With one playable entity, a `persona.stats` card shows that entity's own values.
  - **Formaquestion:**
    - **The Formaquestion Search tab finds guide sections by meaning while Semantic Search is on.** Word matches show at once, and meaning matches join them when you stop typing. Until the model is on your device, the tab uses words alone. In Ask, weak meaning matches stay out.
    - **A card on the first open of Formaquestion offers Semantic Search, with Turn On and No Thanks.** Turn On downloads a small model once and shows its progress. A model already on your device turns Semantic Search on with no card.
    - **Formaquestion's search now finds partial words and words with typos, on the Search tab and in Ask.** Type the first letters of a word, or the word with one letter wrong, to find its sections. A word spelled as you typed it still ranks first.
    - **You can now read the Guide full screen from the help window.** Select **Open Guide** in the **⋮** menu, or the button beside it in the title bar. The window and the full screen show the same section, and Esc closes it.
    - **You can now open the wiki from the help window, on the page and heading you're reading.** Select **Open Wiki** in the **⋮** menu or the full-screen Guide. Check **Don't Ask Again** to skip the confirm, and turn it back on in General settings.
    - **The Guide reader has Back and Forward buttons in Wide View and the full-screen Guide.** They step through the sections you opened, and restore your scroll place. Alt+Left, Alt+Right and the mouse side buttons do the same.
    - **The Formaquestion wiki page now covers Open Guide, Open Wiki, Back and Forward, and the Semantic Search card.** It adds steps for each, a title-bar row, a **General** settings row and a section on the card.
  - **Global Scope Split:**
    - **The Traits and Stats tabs now list global traits and stats under a Global heading.** Your persona's stats stay under its own name. A global trait's hover card reads `(global trait)`.
    - **The trait editor now lets any entity's trait change a global stat, played or not.** Stat rows have a **Global** group on every entity. A row acts once for each entity that holds the trait.
    - **A trait requirement that names a global trait, group or stat now checks global scope from any owner's trait.** **You** reads the played entity and is unmet with none. **Same Owner** on a global trait never reads the persona's traits, and the Test Bench warns on that row. The picker lists **Global Stats** with no owner.
    - **The AI now reads global traits and stats under Global headings, before your persona's block.** Your persona's block holds the stats and traits of every entity you play. Under a library persona, that includes the Custom Persona entity. Saved custom prompts keep their own headers and order. A world with none drops the heading.
    - **World, character and library files now store a trait stat row's target as `global`.** Files with `player` load as `global`. A requirement that names a global item drops its stored owner. New exports write `global`, so apps older than this change misread those rows.
    - **The wiki and help window now say global stats, global traits and persona stats.** The Glossary and the Traits, Stats, Persona, World Format and Stat Code pages explain the split and its gate change. Ask the help window about a city stat.
  - **Persona:**
    - **A chip's Header can now hold the Player Name built-in, in every format.** It reads your persona's name, or "the player" with no persona. The default prompts keep the plain "Player Character" heading, since the block opens with the name.
    - **The AI's notes now list your persona's own stats inside its block, and your world's global stats under Global Stats.** The **Persona** chip gains a **Stats** toggle. The choices prompt now reads your persona's summary, with its traits and stats.
    - **Under Staged thinking, each character now plans its turn with its own stats in view.** Its planning request lists its stats after its background, as the narration sees them. It still never sees your stats.
    - **The Test Bench's AI Context tab now lists a Persona block, before Stats and Traits.** It shows your Custom Persona entity's traits and stats as the AI reads them. A world with no Custom Persona entity shows it empty.
  - **Stat Code:**
    - **A stat code bound write sets the number, and traits and the AI move it from there.** A code bound no longer hides trait changes. Deleting the code keeps the bounds. Saves keep the bounds they show.
    - **A new Dice Roll With Consequences template rolls a d20, pins a placeholder, and changes two other stats.** Find it in the **Templates** menu of the **After the AI** box. A 1 halves one stat and a 20 adds 1 to another.
    - **A stat's code now keeps a value above its old max when other code or a trait raises that max.** A code min no longer drops below the authored min. The Test Bench warning skips writes inside strings and stats switched off, and reads a duplicate stat name as stat code does.
  - **Stat Conditions:**
    - **The Availability tab can gate a trait on a stat, such as Rage >= 80.** Pick a stat from the **Requires** picker, then pick the operator from a list and set the number and Raw or %. **Not** flips it.
    - **Stat-gated traits turn off and return in play as their stat crosses the threshold.** Each turn reads the stats once, after AI changes, regen and stat code land. A trait's own effects never flip it back that turn. Hand switch-offs stay off.
    - **Test Bench warns when a trait requires a stat it changes, or a percent of a stat with no range.** A Condition on a stat its owner lacks shows as an unresolved requirement.
  - **Visibility Rules:**
    - **Each gallery image now has a cog that sets its Visibility rule.** A badge marks an image with a rule, and a "Shown while" line reads it under the framed image. The primary image warns that it ignores its rule outside play.
    - **An entity's image in play now follows its Visibility rules as the story changes.** The panel, zoom viewer and persona row show the first visible image and page through visible images only. A past turn shows that turn's images.
    - **Test Bench warns when a Visibility rule names something missing or every image of an entity can hide.** It also warns on a percent of a stat with no range. Two images with opposite conditions, such as Health < 20% and Health >= 20%, never both hide.
    - **The wiki and help window now explain Visibility rules and stat Conditions.** Ask how to show a portrait only when hurt. Take Me There opens the entity's Profile tab and a trait's Availability tab.
  - **The World Editor now says Owner, not Bearer, for the entity or dictionary that holds a trait, stat or placeholder.** The picker says **Same Owner**, and hover cards show one Owners row. World files save a requirement's owner under `owner`; files with `bearer` still load. Apps from v3.1 and v3.2 misread these requirements until they update.
  - **Selecting a placed chip now opens Chip Options, a dialog that shows what the AI reads as you pick.** Entities and Persona chips gain **Only With**, **Include** and **Stat Detail** rows, and a filter icon when Only With is on. Those picks show as raw text in older versions.
  - **The AI now updates your stats with fewer wrong-direction and made-up changes.** It answers with a change for every stat, 0 included. An endpoint that can't take that format gets the old reply style, and the AI context viewer notes it.
  - **The World Editor's Content group now lists Entities first and Stats last.** The order is Entities, Locations, Traits, Stats on the side rail and the mobile Sections list.
  - **A new Time Per Turn setting sets the story time each turn adds while Measured Clock is off.** It's under **Output** → **Time**, one hour by default. Enter an amount and pick a unit, or enter 0 to hold the clock still. The Time section now shows without Memory Summaries; only Time in Memory needs them.
  - **The stat panel's Regen field now takes a unit, so a stat can regen 1 per day.** Pick **Minute**, **Hour**, **Day** or **Week** beside the number. Hour is the default, so existing stats don't change. Initial Value is now **Base Value** and comes first in the row, since traits can still change where a stat starts.
  - **A new Autosaves Kept setting keeps the last few autosaves for each world, named by turn.** It's under **Data** → **Saves**, and starts at one, as before. Each turn adds an autosave until the world has that many, then replaces the oldest. A re-generate replaces its turn's autosave.
  - **Four bundled worlds now show placeholder ownership on the World Editor's Placeholders tab.** Drone, Slime and Valentines give a placeholder to the entity or dictionary book that uses it. Slime's neighbor now rolls a name and a matching habit. Open Chat's five style placeholders sit in a Chat Style folder.
  - **The Tool script's Variable menu now works like stat code's, one level at a time down to a field.** It lists the arguments, the scene, and the world's entities, locations, dictionary entries and placeholders by name. Pick a field to insert its full path.
- **🛠️ Developer tooling**
  - **Entity Stats:**
    - **`entity-stats-probe.cli.ts` compares three request shapes for entity stats against today's stat pass.** One call with text lines, one call per entity, and one call with a JSON schema run on Sedge Landing cases with shared stat names. It reports exact replies, misses, invented and misattributed changes, latency and tokens.
    - **`entity-stats-chip-probe.cli.ts` compares the Entities chip with its stats piece on and off.** It runs narration, planner and choices cases on Sedge Landing and reports uptake, leaks, choice contract and dialogue share.
    - **`entity-stats-probe.cli.ts` names each missed and invented change, and tests stat prompts from any git ref.** The `S0` arm sends the stat prompts as committed at `--s0-ref`. A cell table lists each case's missed and invented changes per arm.
    - **`persona-stats-chip-probe.cli.ts` compares the Stats chip with and without the played persona's stats.** It runs narration, storyboard and choices cases on Sedge Landing, with a name clash, and reports uptake, leaks and numbered names.
  - **The Design System page and showcase now document the code hover card and the Find All Uses list.** The showcase shows the card for each kind of name, and the list, in the light and dark themes.
  - **Trait Availability rules can compare a stat to a number in world and card JSON.** Six operators, raw or percent of the span, any owner. Setup reads each stat's authored start.
  - **Gallery images in world and card JSON are now objects that can carry a Visibility rule.** Each `images` element is `{ data, requires? }`, and string galleries migrate on load. A card's `extraImages` follow, and `primaryImageRequires` holds slot 0's rule.
  - **The player name header probe compares the narration prompt with and without the player's name in its persona heading.** It scores name leaks and stat tabulation on the default endpoint.
  - **The Likers dialog now removes Anonymous Likes with the same icon button as account likes.** An address with one like shows the button on its row. An address with more shows it on a frame around its rows. A like too old for an address shows the button dimmed, and its tip says why.
- **⚙️ Backend**
  - **Request Anatomy:**
    - **Digests and diaries now show their Request Anatomy in the AI-context viewer.** The Background Pass Queue builds them from the same pass records as a live turn, so each request is labeled.
    - **Re-rolled choices and stats now show their Request Anatomy in the AI-context viewer.** A re-roll builds its request from the same pass record as a live turn, so it sends the same prompt and cap.
  - **Saves now write global stats and global traits under their own names.** Older saves load with the same values. Apps on v3.1 to v3.2 load a new save without them.

#### ➖ Removed

- **🛠️ Developer tooling**
  - **Code now holds global stats and traits in their own `global` slot, with no player owner key standing in.** Gates, the trait runtime, stat requests and stat change chips read the slot beside the entity owners. Code names say global where they said player.

#### 🔧 Fixed

- **👤 User-facing**
  - **A new turn no longer shows the previous turn's thought while it waits for its own.** The thought panel clears when you send an action, re-generate or rewind, and fills again as the new reasoning streams. Each saved turn keeps its own thought. A loaded save or a new game starts with none.
  - **The placeholder and tag suggestion lists of an editor field no longer cover the help window.** A click where a list and the help window overlap now reaches the help window.
  - **Compare shows a changed line as the old line over the new one, marking only the words that differ.** Both lines are faintly tinted and the reworded words are solid. A line rewritten from scratch is tinted whole, and its replacement starts on a line of its own.
  - **The in-game Map no longer shows Connection travel hints, only the lines.** Hints often hold clues or spoilers about a route. The World Editor canvas still shows them.
  - **Loading a save in game no longer shows stat changes from the turn before the load.** Your stats and every entity's stats start with no change shown.
  - **A dictionary entry's Whole Words checkbox now works with Regex keywords.** `wands?` no longer matches inside *wander*. Letters with accents now count as part of a word, so *caf* no longer matches inside *café*. Imported SillyTavern regex entries with whole words on now match whole words only.
  - **The World Editor refuses a drag into Blueprints while something still reads the trait or stat.** That is a requirement, a stat change or toggle, or stat code. A note names the reader.
  - **A click or Escape in the help window no longer closes a menu, popover, list or dialog below it.** A menu inside the help window still closes when you click elsewhere in it.
  - **Regenerate Memory and a character's Regenerate wait for background passes, with a spinner you can cancel.** Each button waits its turn instead of staying unavailable or racing a pass. Leaving the game or loading a save also stops them.
  - **An image request that can't reach the image server now names the server and what to check.** The toast's Fix Connection link opens that server's setup guide. Before, it showed only "Failed to fetch". A dropped connection while ComfyUI draws no longer stops the image.
  - **The World Editor's Auto Save setting is now Autosave, the name the game's saves use.** The Save menu, Settings, the unsaved-changes prompt and the Guide all say **Autosave** and **Autosave Pause**.
  - **Code completion now lists members after chains with spaces or `?.`, and nothing in comments.** `stats . Health .` and `scene?.location.` list their members.
  - **Escape in a code box inside a dialog now closes only the completion list.** The next Escape closes the dialog, as before.
  - **A prompt routed to an endpoint now uses that endpoint's detected context window in game.** Before, it could fall back to 10,750 tokens while Settings showed the right size. A server you start after Formamorph is now found within two minutes.
  - **Community Creations thumbnails now show in browsers that can't cache them, such as Safari.** When the thumbnail cache fails, the image loads straight from the server. Before, the card showed its placeholder.
- **⚙️ Backend**
  - **Background Pass Queue:**
    - **Backfilled digests and character descriptions now run oldest turn first.** The oldest turn leaves the context window first. In serial mode, a new character can wait behind older unknown names.
    - **Background passes now wait while a scene render runs.** A pass no longer competes with the image server for one graphics card. It starts again when the render ends.
    - **Background passes between turns follow Concurrent Requests, and a failing pass no longer stalls the ones behind it.** With the setting off they run one at a time, and with it on they run together. Leaving the game or loading a save stops a running pass.
    - **A new character's diary now carries its description, and a name that never becomes a character gets no diary.** Descriptions and diaries run in the background queue, and the status bar shows "Describing character…". A short name like "Aldric" now finds "Sergeant Aldric" for its diary.

</details>

---

<details>
<summary><strong>✅ 3.2.3 — Released 2026-10-10</strong> — Undo, redo and History in the World Editor — World Editor Auto Save — trait requirement rows with And, Or and Not — choices stream in word by word — tooltips close on scroll and press — a long tail of fixes (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **History:**
    - **The World Editor has undo, redo and a History list for your world's edits.** Press Ctrl+Z, or open History in the app bar to jump to any earlier point.
    - **Undo in the World Editor returns you to the tab where you made the edit.** An edit made on another tab's record, such as a location's entities, opens that tab with the same record selected.
    - **Undo in the World Editor returns you to the sub-tab or view where you made the edit.** An edit on the Openings sub-tab, an entity tab, or the Locations list or canvas opens that same sub-tab or view. An Overview edit with no prompt panel open closes the panel.
    - **Undo and redo in the World Editor restore every location you had selected on the canvas.** Locations that no longer exist drop out of the selection.
    - **Undo and redo in the World Editor scroll to the text field you edited and pulse it.** It pulses on every press, even when you're already on the field. Keyboard focus stays where it was. With reduced motion, the field shows a still ring.
    - **Typing in a different field, tab or selection starts a new undo step in the World Editor.** Undo then takes you back to the field you edited. Typing in one field joins into one step.
    - **Undo and redo in the World Editor pulse the checkbox, select or option group you changed.** A chip's pop-out edit pulses the prompt field that holds the chip.
  - **Auto Save:**
    - **The World Editor's Save button now has a menu with Export World, and Optimize Images is its own icon.** Select the arrow beside **Save** to export, even when Save is dim. In Advanced mode, the **Optimize Images** icon shows a spinner, and its tooltip shows progress. The **More world actions** menu is gone.
    - **The World Editor's Save button shows Saving…, then Saved, and fades back to a dim Save.** A failed save shows **Failed** in red until a save works; select it to try again. On mobile, the Save icon changes the same way. A good save no longer shows a pop-up message.
    - **The World Editor saves on its own after about 300 characters or 30 actions, or after a 30-second pause.** Turn it off with **Auto Save** in the **Save** menu. A new world waits for its first save by hand. A failed auto save pauses until you save. History keeps its Saved mark.
    - **Settings now has Auto Save and Auto Save Pause for the World Editor.** Under **Authoring**, turn Auto Save on or off and set the pause from 10 seconds to 5 minutes.
    - **The World Editor asks which copy to keep when another tab saves or deletes the same world.** Auto save stops until you answer. After a save, **Reload** opens the other copy and **Keep Mine** keeps yours. After a delete, **Keep Mine** saves it back.
    - **The World Editor asks before you close or reload the tab with unsaved changes.** It works in the menu and in the in-game editor, and in the desktop app's window close.
    - **Leaving the World Editor waits for a save that is still running.** A failed **Save & Exit** in the in-game editor keeps it open with your changes. The prompt says **Auto Save** kept your changes only after an auto save ran.
  - **Traits:**
    - **The Requires field in the World Editor takes rows: a row unlocks the trait when all its requirements hold.** **And** adds a requirement to a row, and **Or Another Way** adds a row. The lock line reads the same rule. Existing worlds and character cards open with one requirement per row.
    - **A requirement can require a trait to be off: flip its chip to Not.** The lock line reads "not Paladin". Picking an excluded trait turns the other off with the banner, and dropping the pick brings it back.
    - **The Availability tab shows Mode, Starts and In Game as three rows with one rule sentence.** **Automatic** is the new name of Always On. Starts and In Game dim under Automatic and Hidden. **Requires** adds a world trait at once when only You can hold it.
    - **Test Bench flags requirements that loop through Not and rows that can never hold.** A loop such as "A requires B, B requires not A" is an error. "Paladin and not Paladin" is a warning. Two traits that exclude each other pass.
  - **Ctrl+S saves the world in the World Editor.** On a Mac, use Cmd+S. It works while you type in a field, and the **Save** tooltip shows it.
  - **Ctrl+B and Ctrl+I make text bold or italic in fields with a formatting toolbar.** On a Mac, use Cmd+B and Cmd+I. Press the key again to remove the formatting. The **Bold** and **Italic** tooltips show the shortcut.
  - **Choices stream in word by word, one choice after another, once the narration finishes.** They use your narration reveal effects and pace. A choice's row appears with its first word. Choices you page back to show at once.
- **🛠️ Developer tooling**
  - **Trailer:**
    - **`marketing/trailer/` renders the trailer: a wide Steam cut under 90 seconds, a 60-second tall cut and a poster.** It is a Remotion package with its own dependencies and scripts. `npm run render` checks each file's size, frame rate, length and 6-second loop.
    - **`npm run capture` in `marketing/trailer/` writes the trailer's UI frames from the real app, and `capture:diff` flags UI changes.** It sets up each shot in `captures.json` on its own dev server. A clip capture fails on a jump in motion.
    - **Every trailer shot floats as a tilted glass card over one glowing stage, with word-by-word headlines and pill captions.** Each card holds one crop. The cut opens on the goo wordmark and ends on "Play free at formamorph.ai". `npm run sheet` writes a contact sheet per cut.
    - **The trailer shows the real narration reveal, stat-bar animation, traits, travel, the desktop engine, the community and Morphie.** Title cards come before the traits and help shots. The README lists the Steam checks and the steps to re-render after a release.
    - **The trailer render checks each line's reading time, each dense card's hold and each card's camera.** It fails a line under 1.5 s or over 12 characters per second, a dense card under 5 s, and a card that zooms or loses its subject. `npm run check` runs the checks without a render.
  - **Slash Commands:**
    - **Typing `/` in the action box lists the commands, and each later word lists its own options.** The list opens under the word you're typing. Arrow keys move through it; Enter or Tab picks.
    - **Typing `/choices test` in the action box plays a scripted turn with one paragraph and 4 choices.** It plays in the Pages or Chat turn layout, with a live turn's timing. Add a profile name such as `slow` or `burst` to change the narration's pace.
  - **The ticket test gate reruns files that failed only by timeout, alone, once.** A run starved by another session's gates is not a verdict. Any other failure stops the gate as before.
  - **The changelog lint lets a feature group hold one entry under In Progress.** The first ticket of an effort names the group. The release lint still needs two entries, and close-spec drops a header that stayed alone.

#### 🔧 Fixed

- **👤 User-facing**
  - **Narration:**
    - **Paging away from narration that is still fading in, then back, now shows all the text that has arrived.** It no longer fades in again from the start. Text the AI writes after you return fades in as usual.
    - **Fade-in narration now keeps an even pace with slow models.** The first sentence is timed from the stream, so no long pause follows it, and the last sentences no longer speed up.
    - **The narration card now grows with the words as they fade in.** It no longer shows blank lines ahead of the text.
  - **Tooltips:**
    - **A tooltip now closes when you scroll.** It no longer stays on screen after its control moves. Scrolling a page, list, panel or scrollbar, or scrolling by keyboard, closes it. It opens again on the next hover or focus.
    - **A tooltip now closes when you press, right-click or start a drag.** None opens while you hold a mouse button, so dragging across the library board or the Trait Tree opens none.
    - **A tooltip now closes when focus moves elsewhere, the window loses focus or the tab is hidden.** Tabbing to another control still opens that control's tooltip.
    - **The Copied bubble on a help code block now closes when you scroll, press, right-click or start a drag.** It no longer floats in place when its button scrolls away. Each copy shows it again.
  - **Exit Without Saving in the in-game World Editor now drops the edits you made since the last save.** After Auto Save saved the world, the prompt says so.
  - **The app and the wiki now say In Game for the time after a game starts.** The trait toggle, the Authoring Tour pane and the Entities page use the same term.
  - **Test Bench now names the right requirements when a linked trait's default starts unselected.** The message names the entity, quotes the link's rows and opens the link.
  - **The markdown Preview now shows every edit inside a list, a quote or a multi-line paragraph.** Formatting and text changes in a list item, for example, now show at once instead of keeping the old text.
  - **Player Name and Character Name chips line up with other chips, and the Values tab shows what they become.** Values shows each one locked, as Preview reads it, instead of an empty box that broke the line. The chips carry a pencil icon, so they no longer look like AI generate buttons.
  - **A supporter's profile image sits centered in its ring in comments and notifications.** The image no longer covers the bottom of the ring. Supporter and staff badges are the same height on every screen.
  - **A toast's close button and View Details link now work while a dialog is open.** Before, a click went through the toast to the dialog behind it.
  - **The Open External Link confirm on a markdown link now works over a dialog.** Its buttons take your click, Esc closes only the confirm, and focus goes back to the link. It now matches the app's other confirms.
  - **The ring that undo and Take Me There draw around a field shows in full at a scroll area's edge.** The ring follows the field as it scrolls.
  - **On Novita, GLM-5.3 and GLM-5.3 Flash now get room to think on prompts with Native Reasoning off.** These models always think and ignore Novita's off switch. Short passes such as Location Change no longer fail with "The model reached its token limit before it wrote an answer." They use the prompt's kept strength.
- **🛠️ Developer tooling**
  - **The dev held-updates bar shows the full file paths in a themed tip, not a native tooltip.** The bar now runs in its own React root, so it still works after the app crashes.

</details>

---


<details>
<summary><strong>✅ 3.2.2 — Released 2026-10-07</strong> — Safari and iOS load without an error — Text to Speech loads on first use, so every browser starts faster (click to expand)</summary>

### Minor Changes

#### 🔧 Fixed

- **👤 User-facing**
  - **Safari and iOS open the app without an error toast on every load.** The text-to-speech engine now loads when you first open Text to Speech, not at startup, so every browser starts faster. Text to Speech also works in Safari 26 and in older Android web views.

</details>


<details>
<summary><strong>✅ 3.2.1 — Released 2026-10-07</strong> — Side rail and one app bar for the World Editor and Community Creations — large worlds open, edit and save fast — crash recovery screens — Clear Search on every search box — a long tail of fixes (click to expand)</summary>

### Major Changes

#### ➕ Added

- **👤 User-facing**
  - **Side Rail:**
    - **The World Editor and Community Creations move their sections to a collapsible side rail.** Lines split the rail's groups, and the rail remembers if you collapse it.
    - **The World Editor and Community Creations keep the back arrow in the same place on every screen.** Every header now shares one back button, one height and one side spacing.
    - **In the World Editor, the side rail sits inside the list.** It shows only icons when the list is narrow, and stays in place but unavailable while the Test Bench fills the list.
    - **In Community Creations, the side rail sits below a full-width header.** The sort select, the order toggle and refresh now end the header row.
    - **On desktop, one World Editor bar above both panes holds the world's name, Search World, the world actions and Save.** A long name cuts off with "…" and shows in full on hover. The mode select, Export World (or the More world actions menu in Advanced), the Test Bench and Save end the bar. It has no help button.
    - **On desktop, type in the World Editor's Search World field to search the whole world.** It shows the match count, and the arrows, Enter and Shift+Enter step through the matches. **Ctrl+F** focuses it and Escape clears it.
    - **On desktop, the World Editor's Search World field expands into Find and Replace over the bar.** Select its expand button or press **Ctrl+H**. **Match case** and **Match whole word** stay on when you collapse it, and an icon in the field shows each one.
    - **On mobile, the World Editor's header holds the mode select, the Test Bench and Search, with no help button.** Search and the Test Bench sit at the right. The Sections list splits its groups with lines, in the same order as the desktop rail. Morphie and the guide answer questions about each tab.
    - **On mobile, Community Creations picks its section from a Sections bar under a one-row header.** The header holds back, search and a Filters icon with a count of active filters. Refresh moves into the Filters panel, beside sort.
  - **Settings swaps its Simple/Advanced switch for a mode select that says what each mode shows.**

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **A crash of the whole app now shows a recovery screen with Copy Error Details, Export World and Reload.** Export World appears when you have unsaved edits. A toast with View Details now shows unhandled errors.
  - **A placeholder's panel in the World Editor splits into Details and Pins tabs.** The Pins tab lists every pin aimed at the placeholder. It needs Advanced mode. The tab you pick stays open as you select other placeholders.
  - **A crash in one World Editor panel shows a card there, and the rest of the editor keeps working.** Your unsaved edits stay. **Try Again** remounts the panel, and **View Details** opens the error with Copy and Report Bug.
  - **The World Editor's list boxes now read Filter, such as Filter Stats and Filter Entities.** Typing still narrows the list, and the **+** button still adds the typed name.
  - **On Entities and Dictionary, the + menu now holds Add From Library and Import.** The footer's Add Entity and Add Dictionary buttons are gone. The + is a menu in Simple mode too.
  - **On mobile, the World Editor's footer now fits on one row, and a selected item's detail fills the full height.** Save is an icon in the bottom-right corner, next to the world actions. Overview shows Export World once.
  - **Search boxes now show a Clear Search X while they hold text.** Select the X to empty the box and show the full list again. The cursor goes back into the box.
- **🛠️ Developer tooling**
  - **CI splits the test suite across four parallel runners, so a check takes about 5 minutes, not 20.** A tag push runs the checks once, through the Release workflow. A **Build Android APK** run skips them.

#### 🔧 Fixed

- **👤 User-facing**
  - **The Main Menu lists your worlds without loading each one in full.** Large libraries open faster and use less memory. Your library updates itself once; older Formamorph builds can't open it afterward.
  - **The Locations Canvas opens fast on large worlds, and shows dashed travel arrows only for the hovered or selected locations.** Click a dashed arrow to author a Connection. Arrows hide while you drag. A selected location keeps its arrows on touch screens.
  - **The Map shows travel arrows from your location, and from the one you hover on a desktop.** Arrows draw on the Map again. The Map renders only the boxes in view.
  - **The desktop app recovers from a crashed or frozen window, and Android gives the app more memory.** The desktop app shows a message, then reloads. When the window hangs, you can wait or reload.
  - **A failed world save always shows an error, and full storage shows the space left with an Export World button.** Saves never hang. Save & Exit in play and the Authoring Tour show the same message. Linked library items change only after the world saves.
  - **Editor lists on large worlds draw only the rows on screen and redraw only the rows that change.** Typing a name and dragging a row in the Entities, Locations, Traits and Placeholders lists stay responsive with hundreds of rows. A drag starts without a pause and still scrolls to any row. The lists look and work as before.
  - **Dragging a location on the Locations Canvas checks drop targets faster on large worlds.** The canvas no longer rechecks every location's ancestry on each pointer move, and group frames redraw only when the drop target changes.
  - **The World Editor uses far less memory on large worlds while you edit and save.** It no longer keeps extra copies of the world to track unsaved edits. Saving a large world also finishes faster.
  - **The location and persona pickers stay quick while you type in a large world.** The Connect To, Starting Location and Starts On lists redraw only the items that changed. They look and work as before.
  - **Importing a large world and publishing one no longer freeze the app.** The Main Menu reads and upgrades the world file in the background, and Publish builds its upload there too. Messages stay the same.
  - **Opening and typing in the World Editor stay responsive on large worlds.** The Test Bench checks the world in the background, and its badge shows a count once the first check ends.
  - **On the Mascot tab of Formaquestion Settings, a dragged overlay stays inside its layer and drops in place.** It no longer jumps back to its old slot and slides to the new one.
  - **The Test Bench checks pin conflicts quickly on placeholders pinned from hundreds of sources.** The check and the conflict note under each pin read a placeholder's pins once. They report the same conflicts and winners.
  - **A trait or location that pins hundreds of placeholders opens its Pins tab faster.** Each pin's picker builds its list only when you open it, and an edit updates only the pin you changed. Pins look and work as before.
  - **The selected tool in Settings and the selected code template now stand out from the hovered one.** Both lists fill the selected row with the primary color.
  - **Dialogs no longer open with an outline around the close button.** The ring still shows when you reach the button with the keyboard.
  - **The selected section in the World Editor and Community Creations side menus now stands out from the hovered one.** The selected section takes the primary color. Hover keeps the softer accent color. Enter World categories and the mobile Sections bar match.
  - **A list row's delete button now turns red on hover.** It applies to World Editor lists, library lists and Formaquestion Mascot lists. A selected row shows a red chip.
  - **Each world element type now shows the same icon on every screen.** Traits, entities, stats, worlds, Blueprints, Personas and Avatars no longer change icon between the editor, the game panels and the library.
  - **A picked choice in Chat stays filled, and a hovered choice shows only a light tint.** Keyboard focus looks like hover with a ring.
  - **A placeholder's Placeholder Pins section opens quickly with dozens of pins.** Each pin's source list loads when you open or focus it. The lists look and work as before.
  - **Right-click menus inside a window, like the Locations Canvas menu, now highlight the row you hover.** The arrow keys move through the rows again.
- **🛠️ Developer tooling**
  - **The multi-select and the endpoint badge cancel their updates at unmount, so the full test suite exits 0.** The pin picker test, which opens four heavy pickers, has its own 20-second limit.

</details>

---

<details>
<summary><strong>✅ 3.2.0 — Released 2026-10-05</strong> — Formaquestion, the in-app help window with its mascot Morphie — stat code reads any entity, persona and dictionary — Patreon Supporter flair — new wiki pages — Bug and Suggestion search and filters (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Formaquestion:**
    - **Press F1 or select the Help tab to open Formaquestion, a help window that answers your questions from the guide.** On the **Ask** tab, your AI answers from the matching guide sections, and **Sources** opens each one. Ask follow-ups, or attach up to four screenshots. An answer from outside the guide is marked.
    - **Formaquestion finds guide sections from the words players use, and its Search and Guide tabs work offline.** Search matches player words such as "folder" for a Group. Before each answer, your AI also picks sections from the guide's headings. With no AI connected, **Ask** shows the matching sections.
    - **Formaquestion knows the screen, dialog and tab you have open, so "what does this tab do?" works.** **Help for This Screen** opens the guide section for where you are. The request names what you have open by label and holds no text from your worlds or saves.
    - **The Formaquestion window stays open above dialogs and across screens, and it moves, resizes and remembers its place.** Drag the **Help** tab to any screen edge. **Chat Style** picks **Full**, with a title bar and **Wide View**, or **Minimal**, a bare column over a **Backdrop**. On mobile it opens as a full-screen sheet.
    - **Formaquestion Settings set the search sources, History Length, Reasoning, Answer Reveal and the endpoints for help questions.** Open them from **Settings** in the **⋮** menu. **Answer Endpoint** and **Search Endpoint** each default to your game's endpoint, so AI Search can use a small, fast model.
    - **The Prompts and Tools tabs of Formaquestion Settings edit help prompts and help Tools apart from the game's.** Prompts open in the chip editor with **Reset** and **Compare**, and a preset exports to one file. Turn on **read_guide** for more guide lookups or **roll** for dice, or make your own Tools.
    - **Morphie, the Formaquestion Mascot, stands beside the chat, answers in a playful voice and changes her face as she works.** She waves before your first question and shows her thinking look while your AI works. **Mascot Position** and **Mascot Scale** on the **General** tab place and size her.
    - **The Bubble chat style shows Morphie speaking each Formaquestion answer from a speech bubble.** **Auto** picks **Bubble** while the Mascot is on. **Previous Answer** and **Next Answer** step through the conversation. Drag Morphie to move the window.
    - **On the Mascot tab of Formaquestion Settings, build your own mascot from layered images, with its own looks and voice.** Choose its head, its **Initial**, **Idle** and **Thinking Looks**, and a **Transition** between them. **Morphie** is read-only, so **Duplicate** her to start. **Export** shares a mascot as one `.webp` image.
    - **AI Context, in the Formaquestion ⋮ menu, shows what each question sent and what came back.** It lists the sections each search source ranked and the sections that reached your AI. **Export** downloads every trace as a `.json` file for a bug report.
    - **Select Take Me There under a Formaquestion answer to open the screen it describes and point at the control.** It needs no AI call, so every endpoint gets it. It asks first before it leaves a game or unsaved World Editor changes.
    - **Formaquestion answers stat code questions with tested code that Insert writes into the open stat's code box.** Each code block has **Copy** and **Insert**. When your endpoint takes function calls, **test_stat_code** runs the code once on your open world, and your AI fixes what the test finds.
  - **Stat Code:**
    - **Stat code reads the story clock from one read-only `clock` object.** Use `clock.day`, `clock.daypart`, `clock.deltaHours` and `clock.elapsedHours`, and `clock.previous` for the start of the turn. The old names and `currentStatId` are gone; use `self.id`. Loaded worlds move to the new names.
    - **Stat code reads and switches any entity's traits through `entities`, as in `entities.Mira.traits.Wounded.enabled`.** `entities` lists the cast, the played persona and the library entities you add at Enter World, by code name. `persona` is the played persona's entry. The code editor completes entity and trait names.
    - **Stat code reads read-only identity and state fields on entities, traits, placeholders and stats, such as `entities.Mira.inScene` and `traits.Oath.available`.** A trait entry has `available` and `playerToggle`, so a script can see why a switch had no effect. A write to a read-only field is ignored and logged to the browser console.
    - **Stat code reads and pins an entity's or a dictionary's own placeholders through its entry, as in `entities.Molly.placeholders.Hair` and `dictionaries.Weather.placeholders.Sky`.** `dictionaries` lists the dictionaries in play by code name. `placeholders` holds only the world's own placeholders. Loaded worlds move to these paths, so `placeholders.Molly.Hair` becomes `entities.Molly.placeholders.Hair`.
    - **Stat code flags a `clock` field that does not exist.** In a stat's Code tab, a field such as `clock.time` or `clock.previous.hour` shows an error underline with the closest real field when one is near. Test Code reports the same error.
    - **Stat code flags a whole stat used as a number.** In a stat's Code tab, `stats.Courage >= 50` shows an error underline that suggests `stats.Courage.value`. Test Code reports the same error.
    - **In the Code Templates dialog, stat, trait, entity and placeholder slots open a searchable list with each name's group.** Type a name, or a group or folder name, to narrow the list. The Preview tab of the template editor uses the same lists.
    - **The Variable menu in each stat code box opens level by level, down to your world's names and their fields.** Select a field to insert its whole path at the caret, such as `stats.Health.value`. Hover a field to read what it holds. A list of names opens with its search box ready.
    - **The Stat Code Guide documents `persona`, `entities` and `dictionaries`, and two new templates read them.** **Bonus From Persona Trait** and **Penalty From Entity Trait** are in the **Templates** menu of the **After the AI** box. In your own templates, `{{who:entity}}` picks an entity and `{{t:trait(who)}}` picks its trait.
    - **The Stat Code Guide has a Quick Reference table of every object that stat code reads or writes.** Each row lists the object's members with one line to read it and one to write it. Formaquestion sends the Quick Reference with every question about code.
  - **Help and Wiki:**
    - **The wiki has a new Settings page that explains each setting in the Display, Output, Endpoints and Data tabs.** It marks the settings that show in Advanced mode only, and gives numbered steps for common changes, such as the narration font.
    - **The wiki's new How to Play and Starting a Game pages explain how a game starts and how turns work.** Starting a Game covers Enter World, Quick Start and Library Additions. How to Play gives numbered steps to take an action, re-generate, rewind and export the story. The **?** help beside the action box links to it.
    - **The wiki has new Prompts and Tools pages that explain the Prompts and Tools tabs in Settings.** Prompts covers presets, the chip editor and per-prompt options. Tools lists each built-in Tool and gives numbered steps to turn on, make, try and share a Tool.
    - **The wiki has new pages, Saves and Backup and Library, that explain saving, backups and the main menu's library.** Saves and Backup gives steps to save, load, back up and restore, and says where each platform stores your data. Library gives steps to import, export and group items.
    - **The wiki has a new Community Creations page that explains browsing, downloading, Likes, publishing, contests, Reports and your account.** It gives numbered steps to download, publish and report a listing, enter a contest and delete your account.
    - **The wiki's new Test Bench page and longer World Editor page explain world checks and the editor.** Test Bench gives steps to check a world for issues and test dictionary triggers. World Editor gives steps to switch editor mode, find and replace text, and save changes.
    - **The wiki's new Avatars and Image Generation pages explain your 3D player model and how to connect an image server.** Avatars gives steps to import, customize and export an Avatar. Image Generation gives steps to connect ComfyUI, InvokeAI, Automatic1111 / Forge, NovelAI and OpenAI-compatible services.
    - **The wiki has a new Glossary page that defines each Formamorph term, such as Persona, Blueprint and Pick Count.** Each term links the page that explains it. The wiki's home page lists every page.
    - **The wiki has a new Formaquestion page that explains the help window, its settings and the Mascot.** It has how-to sections for Chat Style, Backdrop, the down arrow, Scale, the Mask handles, the Endpoint editor and the prompt Options.
  - **Presets:**
    - **The preset header in Settings → Prompts and the text endpoint editor shows icon buttons and adds Duplicate.** Point at an icon to see its name. **Duplicate** copies the active preset as "*preset name* (copy)", built-in presets included. The text endpoint editor has no Import or Export, so an API token never lands in a file.
    - **The preset header in Settings → AI Endpoints → Image shows icon buttons with tooltips, and adds Duplicate.** Point at an icon to see its name. On a narrow screen, every action is in the **Preset Actions** menu. **Duplicate** copies the active preset and selects it.
    - **Every prompt you can edit in Settings → Prompts and Formaquestion Settings has Reset and Compare buttons.** **Compare** opens a diff that tints added text and strikes through removed text. **Reset** asks you to confirm. Both are disabled while the text matches the default.
    - **The text endpoint preset in Settings → AI Endpoints and on the Formaquestion Endpoint tab shows whether its server answers.** The badge reads Checking…, Reachable, Didn't answer or Not checked, and **Recheck** tests again. The check asks for the server's model list and never sends a prompt, so it costs nothing.
    - **The image preset in Settings → AI Endpoints → Image and the Generate image dialog shows whether its server answers.** ComfyUI, InvokeAI and Automatic1111 / Forge are checked in every build, and OpenAI-compatible servers in the desktop app. The check never generates an image or costs credits.
  - **Bugs and Suggestions:**
    - **Bug and Suggestion lists in the Admin Panel and the Feedback dialog have a search bar for titles and descriptions.** The list searches when you stop typing, or at once when you press Enter. **Clear Search** shows the full list again. The search stays when you open a thread and go back.
    - **Bug and Suggestion lists in the Admin Panel and the Feedback dialog sort by Oldest and Recently Active.** Recently Active puts the thread with the latest reply or status change first. Suggestions add Most Voted. The Feedback dialog shows Sort in every list.
    - **Bug and Suggestion lists show search and the main filters on one row, and the rest under a Filters button.** A badge on **Filters** counts the filters you changed. **Reset Filters** returns every filter to its default and keeps your search.
  - **Patreon Supporters:**
    - **`formamorph.ai/account` and your profile's Settings tab have a Patreon section to link Patreon and show Supporter Flair.** The section shows your tier and how long you've supported. Clear **Show Supporter Flair** to hide your flair. **Unlink** asks first and removes the flair at once.
    - **A supporter's name shows a Supporter or Supporter+ badge, the tier color and a ring around their Profile Image.** It shows on community cards, listing details, comments, feedback, notifications and profiles. Point at the badge to see how long they've supported. Staff keep their staff badge only.
    - **`formamorph.ai/supporters` lists the Patreon supporters who linked their account and kept Supporter Flair on.** Supporter+ names come first, and the longest-standing supporter leads each section. Each name links to the profile. The landing page footer and the account page link to it.
  - **On the World Editor's Locations tab, List and Canvas are icons with tooltips at the end of the search row.**
  - **In Backup & Restore, each save shows the name of its world at the right of its row.** Point at the row to see the full name when it is too long to fit.
  - **The User Profile dialog has a Settings tab with your email, Change Password and Delete Account.** You can add or change your account email there, and resend the verification email. The dialog header now shows only **Log Out**.
- **🛠️ Developer tooling**
  - **Formaquestion:**
    - **A help probe scores Formaquestion answers against the app's docs, beside a control that gets no docs.** `help-probe.cli.ts` scores keyed control names, bold names, steps, declined answers and names that are nowhere in the docs. `--alt`, `--lookup`, `--flag` and `--before` add arms in the same batch.
    - **`npm run probe:help` runs a fixed question set through Formaquestion and reports how often the answers are right.** Each question in `help-baseline-cases.json` has keyed facts and forbidden names, and a text match scores it. The report gives the grounded-correct rate per arm and a first cause for the worst questions.
    - **A test fails when a docs page has under two keyed baseline questions or a missing keyed name.**
    - **`help-retrieval-probe.cli.ts` scores the Formaquestion docs search alone, with no model.** It scores each "How to…" heading and the player-worded questions in `help-baseline-cases.json`, and compares against an earlier commit.
    - **`help-flag-history-probe.cli.ts` asks follow-ups after a Formaquestion answer that is not from the guide.** It runs with and without the general-knowledge marker on that answer in the history.
    - **`npm run build:help-vectors` writes the guide section vectors that the semantic search source of Formaquestion reads.** The source ships off. The script embeds only changed sections, and a test fails when the vectors come from another embedding model. Run it before a release.
    - **`npm run probe:help-recall` scores how often the right guide section reaches the AI.** `--ai --arms shipped` uses the search sources as they ship. `--screen library`, `stats` or `game` asks every question over that open screen.
    - **A docs check fails any "How to…" section that has no hidden keyword line of player words under its heading.** Write the line as an HTML comment that starts with `keywords:`. The Docs Index ranks those words like heading words and hides the line from the reader and the AI.
    - **`node scripts/cutMascotRig.mjs` cuts the Formaquestion mascot's layered file into the default rig's images.** It runs headless GIMP 3 under a timeout and writes one WebP per layer to `src/lib/formaquestion/mascotAssets/`. It stops when a layer is missing from its name table, or a listed layer is gone.
    - **The Mascot card is a new export shape: a `.webp` with the mascot data in its `XMP ` chunk.** The chunk holds `formamorphKind: "mascot"`, `version: 1`, `appVersion`, an optional `name`, an `images` table of base64 data URLs and the rig. Any other `version` is refused. The parser is `src/lib/formaquestion/mascotCard.ts`.
  - **Design System:**
    - **The guide documents the Breadcrumb Picker and shows it live in a new Breadcrumb Picker reference.** Open `#dev?modal=designSystem&tab=breadcrumb-picker` to see default, picked, no breadcrumb, disabled, empty and no-match states. Lists of world content use the Breadcrumb Picker, and short fixed option sets keep Select.
    - **The guide documents the Preset Header and shows it live in a new Preset Header reference.** Open `#dev?modal=designSystem&tab=preset-header` to see both widths, the built-in state and every reachability badge state. `PresetHeader` takes a `layout` of `wide` or `narrow`, and `EndpointReachabilityView` draws a badge with no probe.
    - **The guide documents the Landing Pulse, the ring a Take Me There landing pulses once, in a new reference.** Open `#dev?modal=designSystem&tab=landing-pulse`, pick a row, and press **Play Landing**. `pulseLanding` in `src/lib/landingPulse.ts` adds the class and removes it when the animation ends.
  - **`node scripts/buildGate.mjs <commit>` runs the production build only when a change since that commit can alter the bundle.** A change to tests, test helpers, `docs-internal/specs/`, `docs-internal/notes/` or `docs/Changelog.md` skips the build and prints why. Any other path runs `npm run build`, and the script lists the paths that forced it.
  - **`node scripts/affectedTests.mjs <commit>` runs only the tests that your changes since that commit can affect.** It runs `vitest related` and adds files the import walk can't see, such as `?raw` imports and fixtures read by path. Config or lockfile changes run the full suite. `--list` prints the selection.
  - **`node scripts/changedLint.mjs <commit>` lints only the files changed since that commit.** It lints everything when the ESLint setup changed. `npm run test` and `npm run lint` still run everything.
  - **`npm run typecheck` reuses the last run's work, so a warm check takes about 4 seconds instead of about 21.** It runs `tsc --noEmit --incremental` through `scripts/typecheck.mjs`. A new ticket worktree first copies a seed from the main checkout on the same drive. The script prints whether the run was cold, warm or seeded.
  - **A ticket branch writes its changelog entry as a fragment in `docs-internal/changelog.d/`, and prepare folds it in.** The fragment names its bucket on line 1. A lead that is already unreleased gains only the new sentences. The `union` merge driver is gone, and a direct changelog edit on a ticket branch is refused.
  - **A native scrollbar in app source now fails the tests.** A source file with a native overflow scroller must use `ScrollArea` or carry a `scroll-guard: allow` comment that names its Design System exception. Every existing native scroller carries one.
  - **`buildVariableTree` in `src/lib/statCodeVariableTree.ts` builds the stat code Variable menu as a drill-down tree of globals, world names and fields.** Each field inserts a complete path. A test runs every field's path in the stat code sandbox and fails when one throws or names the wrong entry.
- **⚙️ Backend**
  - **A help-code probe checks that Formaquestion's Code rider brings back stat code that runs.** `help-code-probe.cli.ts` runs each code fence in the real stat-code sandbox. The `rider` arm sends the Default rider, and the `control` arm sends an empty one. On the cloud default model, code answers run 86% of the time (control 3%).

#### 🔧 Fixed

- **👤 User-facing**
  - **Backup & Restore:**
    - **Backup & Restore saves and restores a library backup of any size.** Restore reads one item at a time in the background, so the app keeps responding. It skips an item that already exists unless you choose to overwrite it.
    - **Backup & Restore stays inside its window when an item has a long name.** A long name shortens with "…", and the list uses the app's thin scroll bar.
  - **Bugs and Suggestions:**
    - **Every Bugs and Suggestions list opens on the threads that still need work.** Bugs open on Unresolved and Suggestions on Still Open. The Feedback dialog has a new **Status** filter, so **All statuses** brings closed threads back.
    - **In the Admin Panel's Bugs and Suggestions queues, Unresolved and Still Open show every matching thread on every page.** The queue asks the server once for all the statuses, and the page count is exact. Before, the queue sent one request for each status, and a page could come back short with a warning.
    - **In Bugs and Suggestions, Back from a thread returns to the page and scroll position you opened it from.** This works in the Feedback dialog and in the Admin Panel queues. When the page no longer exists, for example after triage moved the thread out, the list shows the last page. Before, Back always returned to page 1.
  - **Prompts:**
    - **The Persona chip sends the active traits of the persona you play inside the persona's block.** It does this as the Entities chip does for each entity. Full content lists each trait's AI-Facing Description under its name, and Summary gives one "traits:" line of names.
    - **When the Location, Entities or Persona chip sends an authored AI Summary, the AI reads it under "summary", not "description".** This applies in every format. A chip set to Summary still sends the full description, under "description", when no summary is written.
  - **The built-in engine loads on the GPU you pick in GPU Device on a machine with an integrated GPU.** The engine looks up each card's real device number before it loads. If it gets another card, the load stops with a message that names both. The engine updates to node-llama-cpp 3.22.1 with llama.cpp v0.5.0.
  - **The World Editor opens a world file that has no `id` field.** Before, loading such a file blanked the whole app.
  - **In a chip's pop-out, the Label, Header, Prepend and Append fields keep the cursor where you type.** They keep every key you press.
  - **The Continue the Story ⓘ help in Settings says the button puts its text in the action box to send.**
  - **The wiki's World Format page lists every world file field, with steps to add a stat, trait or entity.** It shows the chip form for hand-written text and which older fields still load. It covers placeholders, Blueprints, links, persona marks and openings on locations.
  - **Settings now reads the Context Window from a llama.cpp server.** Each detected value stays with its endpoint and model.
  - **In Settings → Endpoints → Text, Reset AI Endpoint sits in the tab's footer, so you see it without scrolling.** The help and status lines on the Text and Image tabs are clearer. The Max Output checkbox reads **Override Endpoint Limit**. The **Negative Prompt** field shows example tags.
  - **Turning off Enable Image Generation keeps the Image tab in place and shows "Image generation is off".** The settings stay hidden and keep their values. The preset list and its buttons turn off too, and only **Enable Image Generation** stays usable.
  - **Placeholders in the library entities and dictionaries you add at Enter World now show their values in the story.** Before, their chips read empty in narration. Each value is rolled once and stays the same for the whole playthrough, after a save and a reload too.
  - **Stat code now reads the played persona's traits correctly, through `persona.traits`.** `traits` lists only the world's own traits. `persona.traits['Scarred'].enabled = false` switches the persona's trait off. `persona.name` gives the persona's name. The code editor completes the persona trait names.
  - **A search in a multi-pick list shows its matches when you type over the old search.** This works in lists such as a location's entities.
  - **In a trait's Requires field, the Add Requirement list keeps each name readable when its group path is long.** A path of three or more parts shows only its first and last, as in "Lore › … › Deep". Point at the row to see the full path.
  - **Semantic Memory, Semantic Lore, Scene Recall and Diary Recall load the files that run their model from the app.** Before, each load downloaded these files, about 21 MB, from cdn.jsdelivr.net, even with the model already downloaded.
  - **Long dialogs keep their title and buttons on screen, and only the content between them scrolls.** This covers the adult content check, the policy prompts, **Send Feedback**, **Edit This Report**, event announcements and **Custom Code Execution**. These dialogs use the app's thin scroll bar.
  - **Scene images now draw the persona you play.** The tag pass lists the persona with the other people in the picture and uses the persona's Image Tags. The planner decides when the player is in the picture; with planning off, the persona is always drawn.
  - **The app and the formamorph.ai account pages open in your theme from the first frame.** This covers your color preset, and your saved theme on the account pages.
- **🛠️ Developer tooling**
  - **The Enter World tests in `MainMenu.entry.test.tsx` finish inside Vitest's 5-second limit during a full `npm test` run.** `EnterWorldFlow` holds the setup choices, so a pick renders only the setup dialog. A test fails when a pick renders the whole main menu again.
  - **The Stat Code guide's last example now closes its code block, and a docs check fails on any unclosed one.** The help window sends that section to the model as written. The check names the page and line.

</details>

---

<details>
<summary><strong>✅ 3.1.2 — Released 2026-09-30</strong> — Image attachments — contest likes hidden until results — two-column profiles — faster Community Creations — help and wiki that match the app (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **In Community Creations and on profiles, a contest entry shows its like count as a dash until staff announce the winners.** A tooltip says when the likes will show. The heart still likes and unlikes the entry. The author and staff see the number, with a tooltip that says only they see it. A sort by likes puts hidden entries with the entries that have no likes.
  - **A profile lists the author's work in two columns, most recently updated first, in the game and on formamorph.ai.** Phones show one column. The profile window is wider and has less empty space around its content. A line sets Prompts apart from the other kinds, as in Community Creations. The list opens on the kind of work the author updated last.
  - **Turn on Image Attachments in Settings → Output to attach up to 4 images to an action, and the AI gets them with your text.** An attach button beside the action box opens a file picker. You can also paste an image into the box or drop image files on it. The images wait above the box, where you can remove one, and leave with the action when you send it. Each prompt has an **Include Attachments** option on its **Options** tab. **Narration** has it on, and every other prompt has it off. The option travels in a shared preset. An image over 1568 px on its long side is shrunk to that size, and every image is sent as JPEG. Your past actions show their images, and a click opens the image viewer. **Re-generate Narration** sends the turn's images again, and with the setting off it sends none but keeps them. **Edit** on an action keeps its images and lets you remove one. A model that can't read images returns its error in the usual error toast. The bundled local engine can't read images, so it runs the turn on text and shows one warning per session. A save keeps the images, so a loaded save shows them again, on any machine.
- **🛠️ Developer tooling**
  - **`VITE_FM_HOLD_UPDATES=1` makes the dev server hold every edit until you apply it from a bar at the top of the page.** The bar names the changed files and says whether they are styles only or code that may reset what's open. **Apply** swaps them in without a reload. When a change needs a full reload, the bar shows **Reload** instead.

#### 🔧 Fixed

- **👤 User-facing**
  - **Community Creations:**
    - **Community Creations shows its window at once when you open it again, and the cards fill in after.** Before, the window waited for every card to draw, which took over a second on a slow device. Scroll, search, and **Back** stay responsive while the cards draw. When the latest catalog arrives, only the cards that changed draw again. Tooltips now share one popup, so every screen with many tooltips draws faster, not only this one.
    - **In Community Creations, press Tab to reach a card's name, then Enter or Space to open its details window.** Before, a card opened only with a pointer. Clicking the card works as before, and the like, download and hide buttons do not open the card.
    - **In Community Creations, a contest's entries stay shuffled while the contest is judged, and sort by likes only after staff announce the winners.** Before, judging put the most-liked entries first, which gave away the like order. The winners still lead once announced.
    - **For staff, a scheduled contest stays off the Contest tab in Community Creations until it starts.** Before, it showed there as being judged. It still shows under **Scheduled** in the Events tab.
    - **A listing's details window always shows the Changelog | Comments switch, so the right column no longer jumps when the window opens.** **Changelog** stays dimmed until the listing has entries. On your own listing it works at once, so you can start a changelog. The window reads the entry and comment counts from the catalog, so **Changelog** works at once when the listing has entries, and the comment count shows while the comments load. Gray rows hold the place of the comments, and a listing with no comments shows its empty message at once. A tab you press while the window loads stays selected when the listing details arrive. **Linked Content** and **Compatible Worlds** now sit at the end of the left column, so when they arrive they push nothing above them.
    - **A listing's details window in Community Creations fills in sooner: a listing you opened before shows its details at once, and a card you rest on starts to load before you open it.** The latest details replace the ones kept from before when they arrive. If the server doesn't answer, the details you saw last stay on screen. A listing deleted or hidden since your last visit doesn't show them. Signing in, signing out or switching accounts never shows you details kept for someone else. Declining the age gate clears them with the rest of the Community Creations data on your device. Keyboard focus that rests in a card loads it too. Moving across cards loads nothing, and touch never loads ahead.
    - **On formamorph.ai, declining the adult-content warning clears the Community Creations catalog, images and listing details saved on that device.** The same happens while the warning is unanswered. Before, only the game cleared them, so a reader who declined on the site kept them.
  - **Help and Wiki:**
    - **The World Editor's Overview tab has a ? help button, and the wiki's Overview, Openings, Stats, Entities, Locations and Dictionary pages now match the editor.** Each page starts with numbered steps for common tasks. Before, the Entities page said `{{char}}` imports as plain text. The Stats page named chip options that don't exist, and it said Regen adds once per turn. The Dictionary help said to separate keywords with commas. The **?** help for entities, aliases, locations, location pins, stats and the dictionary now links to its section of the page.
    - **The wiki's Traits, Placeholders and Personas for Authors pages now match the World Editor, and each now has numbered steps for common tasks.** Before, the Traits page put **Requires** on the wrong tab, put **Link To…** on the wrong tab, and named a **Begin** button that doesn't exist. The **?** help for traits, stat changes, stat availability, placeholder pins and placeholders now links to its section of the page.
    - **The ? help in the Memories dialog, the in-game Entities tab, a stat's Code tab and the linked-content dialogs now matches the app.** **Learn more** opens the matching section of the wiki page. The Memories help names each button by its tooltip. The Entities help says you can also remove an entity you added under **Library Additions**. The stat code help says `traits` holds the world's own trait list, not traits an entity owns. The wiki pages for Memory, Entities, Personas, Connect Your Own AI, Install on Android, Text Formatting, the Stat Code Guide and Linked Content gain numbered "How to…" steps and now match the app.
  - **For staff, a profile window shows only the list for the selected tab, Creations or Likes.** Before, the Likes list stayed on screen under Creations after you switched back.
  - **Image generation with a blank Endpoint on A1111, ComfyUI or InvokeAI calls `http://localhost` on that server's port.** Before, it called `127.0.0.1`, which fails for a server that listens only on IPv6.
  - **In the World Editor, the buttons that write a summary, image tags or the other description work on models that think before they answer.** Before, a thinking model such as DeepSeek V4 Flash on Novita used up the reply on thinking, and the button failed with "Empty summary response." The buttons now switch thinking off on every endpoint that allows it. They also use your endpoint's sampler and Max Output settings, like the prompts in play.
- **🛠️ Developer tooling**
  - **Image presets from `VITE_DEFAULT_IMAGE_PRESETS` reset to their `.env` values and follow later `.env` edits.** A preset now saves only the fields you change. Each other field reads its `.env` entry on every load. Before, **Reset** went to the built-in defaults, and a `.env` edit never reached a preset that was already saved.

</details>

---

<details>
<summary><strong>✅ 3.1.1 — Released 2026-09-30</strong> — Persona entities own stat traits — trait links point only at Blueprints — Custom Persona stats at game start — Novita thinking switch — whole words in tables (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **In the World Editor, a Playable, Persona-Only or Custom Persona entity can own traits with Stat Changes and Stat Availability.** They apply while the player plays as that entity and reverse on a switch. Drag a stat trait or a group holding one onto the entity, or detach a link, and the stats stay. Such a trait has a Stats tab with a line that says when its stats apply. Any other entity still refuses stat traits. Remove an entity's persona mark, and its stat traits stay, but their stats do nothing. A character card keeps an entity's own stat traits. The Test Bench checks them like any other stat trait.

#### ➖ Removed

- **👤 User-facing**
  - **In the Traits tab, a trait link can point only at a Blueprints trait or group, never at a top-level one.** **Link To…** shows only on Blueprints items. A drag of a Blueprints item out of Blueprints is refused while an entity links it or something in it, and the notice names those entities. Removing the Blueprints group turns each link into it into that entity's own trait and deletes the linked originals. Unlinked Blueprints traits move to the top level. The confirmation gives the link count and names each cast entity whose copies lose their stat changes. A world made with 3.1.0 loses its links to top-level traits, with their overrides, when it opens. A character card's link binds only to a Blueprints trait or group, by id or by name.

#### 🔧 Fixed

- **👤 User-facing**
  - **In the Traits tab, dragging a top-level trait or group onto an entity moves it to that entity in Basic and Advanced alike.** Before, Advanced tried to link it, and the Custom Persona entity refused it because the player already had it.
  - **The Test Bench's pinned placeholder check reads traits an entity owns.** Before, it read only the world's top-level and Blueprints traits.
  - **A new game as None applies the Custom Persona entity's stat traits.** Their Stat Changes now land at the start and show in the Enter World preview. Before, the stats they turned on opened at their authored value.
  - **On Novita, DeepSeek V3.1 and later and GLM 4.5 and later stop thinking on prompts with Native Reasoning off.** Short passes such as Location Change and Time Passed no longer fail with "The model reached its token limit before it wrote an answer." Each request sends Novita's `enable_thinking: false`.
  - **Tables in narration and world descriptions wrap only between words.** A narrow column no longer splits a short word such as a name across lines.

</details>

---

<details>
<summary><strong>✅ 3.1.0 — Released 2026-09-29</strong> — Tools the AI can call during play — traits on entities, trait links and Blueprints — trait requirements, pick counts and Always On or Hidden traits — Custom Persona and Self openings — Emberwatch world — Authoring Tour — Error Details on every error toast (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Tools:**
    - **Settings → Advanced has a Tools tab that lists your Tools and which prompts offer each one.** It sits between Prompts and Endpoints. Every preset lists the built-in Tools and your own under **My Tools**. Select a Tool to read its description and the schema the AI receives.
    - **In the Tools tab, each Tool's Enabled box and Offered To list set which prompts send it.** **Enabled** turns a Tool on for the preset in the tab's **Preset** selector. **Offered To** picks the prompts that send it. **Max Calls per Request** sets how many calls it gets in one request.
    - **The Tools tab's Duplicate, Delete, Import and Export buttons manage your own Tools.** **Duplicate** copies a built-in Tool into My Tools as `<name>_copy`. **Delete** removes one of yours from every preset. **Import** and **Export** move Tools as a `tools.json` pack.
    - **A prompt preset you export or publish carries copies of the Tools it turns on.** Importing it adds each Tool whose name you don't have, turned on for that preset only. When you already have that name, the preset turns yours on. A warning shows when it adds a Script Tool.
    - **The Tools tab's New Tool and Edit buttons open an editor for your own Tools.** **Definition** holds the name and the description the AI reads. **Add Outline** starts the description with Purpose, Use when, Input and Output. **Parameters** sets the values the AI passes. A built-in Tool has no **Edit**.
    - **The Tool editor's Handler tab picks Lookup, Template or Script as what the Tool runs.** **Lookup** finds entities, locations or dictionary entries by one parameter. **Template** returns text you write with parameters as chips. **Script** runs code with completions for `args`, `world`, `scene` and `placeholders`.
    - **Try It in the Tools tab runs a Tool before you save it and shows what the AI reads back.** It takes one value per parameter. It runs on the world you have open, or on a sample world outside a game. A script error shows as a plain message.
    - **During play, the AI can call the Tools your prompts offer and write with what they return.** Each prompt sends its enabled Tools to an endpoint and model known to take them. Narration streams in the same as without Tools. **Stop** ends a tool round like any other request.
    - **With Show Silent Requests on, play shows a Looking up… line and AI Context shows each tool round.** AI Context lists each round's calls, arguments, results and reasoning. With the setting off, you see neither.
    - **Settings → Output has a Tools switch that turns every prompt's Tools on or off.** It's on by default and marked Experimental. Each Tool still needs its own **Enabled** box. The row is dimmed when your text endpoint doesn't support Tools.
    - **A built-in `roll` Tool lets the AI roll fair dice.** The AI sends dice notation such as `2d6+1` and gets back each die, the modifier and the total. It's off on every preset and offered to narration.
    - **Every preset lists the built-in Tools `get_location` and `get_dictionary_entry`, turned off.** `get_location` finds a location by name and returns its full description. `get_dictionary_entry` finds an entry by its name or any trigger keyword. Your own dictionary **Lookup** Tools match entry names too.
    - **Every preset lists `recall`, a built-in Tool that searches the story's memories, turned off.** The AI passes a few words about a past event and gets up to five matches, each with its turn number. It searches turn memories and character diaries. It finds nothing while **Memory Digests** is off.
    - **With Semantic Memory on, the `recall` Tool finds a memory by its meaning as well as its words.** So "the promise to her" can find "agreed to escort Mira to the ferry". While the embedding model isn't loaded, every match is by words, so recall never waits for a download.
    - **A Script Tool can read each placeholder's value in this playthrough.** `placeholders["Hair Color"]` gives a shared placeholder's value, with pins, rolls and nested chips resolved. Each entity and dictionary entry carries its own placeholders the same way. A script can't change a value.
  - **Blueprints:**
    - **In Advanced, dragging a world trait or group onto an entity in the Traits tab links it.** One trait then serves many entities. The link reads the original live, so an edit to the original reaches every link. A linked group shows the original's traits and keeps its pick-one rule.
    - **With Advanced off, dragging a world trait or group onto an entity in the Traits tab moves it there.** The entity then owns it. The move is refused while any entity links the item, or while a trait in it has stat changes.
    - **Link To… on a world trait's or group's details links it to entities without a drag.** It lists your entities by group, and the list stays open so you can link several. An entity that already has the trait can't be picked.
    - **A trait link's This Link section changes the linked trait for that entity alone.** It sets **Enabled by Default**, **Player Can Toggle In-Game**, **Requires**, **Stat Changes** and **Placeholder Pins**. A changed field shows **Reset**. **Edit Blueprint** opens the original, where an edit reaches every link.
    - **Detach turns a trait link into the entity's own copy, and Remove Link leaves the original alone.** **Detach** gives the copy new ids. Deleting a linked trait or group asks first and names how many links go with it.
    - **At Enter World and in play, an entity's page lists its trait links where the author placed them.** One trait linked by two entities is a row on each, and picking it on one leaves the other alone. A linked trait's stat changes apply only to the persona you play.
    - **In Advanced, the Traits tab's + menu adds a Blueprints group for traits you only link.** Traits under Blueprints aren't offered at Enter World or in play. They reach play only through links. Removing the group moves its traits to the top level after a confirmation.
    - **In Advanced, the Placeholders tab's + menu adds a Blueprints group, and each placeholder in it is a blueprint.** The group stays at the top level and holds world placeholders and folders. A drag in or out is refused while something uses the placeholder, and a note names each use.
    - **On the Placeholders tab, each entity gets its own copy of every blueprint placeholder its traits pin or place.** You never make a copy by hand. A copy shows under its entity, named like `Albus.Class Garb`. An untouched copy goes away when nothing needs it.
    - **On the Placeholders tab, a blueprint copy opens as a value list you change for that entity alone.** Reword a value, change its weight, remove it, or add values of your own. A changed value shows **Reset**. Values the blueprint adds later show in every copy.
    - **A blueprint chip in a world trait's text reads the copy of whoever has the trait.** Each entity with the trait reads its own copy in play, at Enter World and in the AI's context. The chip shows a link icon. Fields outside trait text and blueprint values refuse it.
    - **A trait pin on a world placeholder sets each bearer's own copy in play.** So Albus's Paladin sets Albus's garb, and Mira's sets Mira's. A bearer with no copy sets the placeholder itself.
    - **A character card or library entity carries the blueprints its copies read.** In a world with a blueprint of the same id or name, the copy follows that blueprint. Without one, the copy becomes the entity's own placeholder.
    - **The Test Bench checks each entity's linked traits and blueprint copies.** An error names a link that can never unlock. Warnings flag links that add nothing, pins on removed values, missing copies, and blueprint chips in fields that refuse them. **Open** goes to the problem.
  - **Entity Traits:**
    - **An entity can own traits and trait groups in the World Editor.** In Advanced, the entity's **Traits** tab holds them, and the entity gets a node in the **Traits** tab. Drag the node into one of the world's groups or anywhere at the top level. Owned traits don't change stats.
    - **Trait requirements work across owners, so an owned trait can require a world trait and the reverse.** The **Add Requirement** list shows an owned trait as "Ash's Tamed". A trait dragged to another owner keeps its id, so its requirements still work.
    - **An entity's World Editor Persona setting can be Persona-Only, so it exists only while you play it.** In Advanced, the **Persona** control offers **Cast**, **Playable** and **Persona-Only**. When you play someone else, the entity is out of the scene, and its openings never draw. Use it for a blank slot such as "Custom Character".
    - **The World Editor's Custom Persona role gives an entity's traits and links to a player with no world persona.** It applies when you play with no persona or a library persona. The entity never joins the cast. One entity per world can have the role, set from its **Persona** control in Advanced.
    - **At Enter World and in Change Persona, the Custom Persona entity stands in None's place with your own name.** Pick it, and fill **Name** and **Description**. **Name** replaces the entity's name in the story, and **Description** follows the author's. A save keeps your entry. A world without the entity keeps **None**.
    - **In Advanced, the Traits tab's + menu adds a trait or group straight onto an entity.** **Add Trait to Entity** and **Add Group to Entity** open a list of your entities by group. The new item lands at the end of that entity's traits and opens for editing.
    - **The entity panel's Traits tab edits that entity's traits without leaving the entity.** In Advanced, it shows the entity's traits, groups and Links in the same tree as the **Traits** tab, with a search box and a **+** menu. Select a row, and its details slide in over the list.
    - **A trait requirement means the same bearer, or it can name a bearer.** "Smite requires Paladin" holds only when the entity with Smite also has Paladin. **Add Requirement** offers **Same Bearer**, **You**, or an entity that bears the target. A named requirement reads "Albus: Paladin".
    - **Enter World lets you pick the traits of every entity that owns some.** Each such entity has a page in the trait list, with its picture, name and description. Its default traits start picked. The entity you play is marked "You". Saves keep each entity's picks.
    - **The in-game Traits tab shows each entity that owns traits, and you can switch its traits during play.** The entity you play is marked "You". Locks and the banner work as for your own traits, and gates hold across owners. The banner and the story log name the owner, such as "Grey Wolf's Loyal to Paladins".
    - **The AI reads each entity's active traits, and the traits of the entity you play as your own.** An entity's full description lists its active traits, and its summary gets a "traits:" line. In a trait's text, `{{char}}` reads as the name of whoever has the trait.
    - **An entity's active traits pin placeholders in that entity's own text, on top of your traits' pins.** Your traits pin locations, the world prompt, narration and every entity's text. An entity's own traits pin its name, descriptions and trait cards, and they win where both pin.
    - **A library entity's traits come with it into any world.** Character cards, **Save to Library** and world bundles carry an entity's traits, groups and links. On arrival, each requirement and link binds to the world's target by id, then by unique name. A requirement with no match stays locked.
    - **The library entity editor has a Traits tab with the World Editor's tree, search box and + menu.** Requirements there point only inside the entity. At Enter World, your library persona and each library character you add get a trait page with their defaults picked.
  - **Openings:**
    - **An opening card collapses to one line, and a list of three or more openings opens collapsed.** The line keeps every control, and you can drag it to reorder. Press the arrow to open a card. **Collapse all** in the list's header closes or opens every card.
    - **A placeholder with three or more values opens with its value cards collapsed in the Multiline editor.** A list of one or two values still opens expanded.
    - **Every Openings tab in the World Editor and the library has a search box and a + button.** Type in the box, and only the openings whose text matches show. Press **+** to add an opening.
    - **A persona's opening can be Self in the World Editor, so it starts the game when you play that persona.** Each persona opening has an **Others | Self** switch. When you play the persona, its Self openings replace every other opening in the draw. A persona with none starts on the usual openings. The library has the switch too.
    - **In Advanced, a location can have openings that draw when a game starts there.** A location's new **Openings** tab works like an entity's. Its openings join the draw only when that exact location is the start. A persona's Self openings replace them.
    - **On the World Editor's Openings panel, a Starting Location filter shows the openings that can come up at one start.** It replaces the **Chances At** picker. **All Locations** shows every opening. Pick a starting location to see only its openings, with their chances.
    - **The Test Bench's Opening tab has a Persona picker that shows which openings a game draws for that persona.** Pick a persona, and the pool shows its Self openings when it has any. **None** shows the Custom Persona entity's Self openings. The pool also lists the starting location's own openings.
  - **Authoring Tour:**
    - **The World Editor offers an Authoring Tour that walks you through making a world one field at a time.** The offer shows once. On a new world, the tour fills that world. On any other world, it starts a new one. Start it any time from **Settings** → **Data** → **Start Authoring Tour**.
    - **The Authoring Tour covers the Overview, two locations, an entity, a stat, a trait and a dictionary entry.** Each step has **Use Example**, which fills the field or loads one of the tour's own pictures. **Next** waits for a value you chose.
    - **The Authoring Tour's In Play pane shows each item as players see it and as the AI reads it.** It marks the step's field and updates as you type. Each AI block sits under the header your active prompt preset gives it. On mobile, **Show Effect** opens it as a bottom sheet.
    - **The Authoring Tour's dictionary step tests a line against the entry's trigger keywords.** In Play shows whether the entry fires, and on which keyword. **Try a Miss** and **Try a Hit** swap in a line without or with a keyword.
    - **The Authoring Tour saves your world after each step and picks up where you left off.** It keeps the editor in Simple while it runs. If you delete an item the tour added, it goes back to that add step.
    - **The Authoring Tour's last step offers Play, which saves your world and enters it.** The step before it points at the Test Bench flask. **No Thanks** on the offer retires it for good.
  - **Built-in Placeholders:**
    - **`{{char}}` in an entity's own text shows that entity's current name in play.** It works in the entity's descriptions, summary and openings, in any spelling. A renamed entity never leaves its old name in its text. Anywhere else, `{{char}}` shows nothing.
    - **The placeholder palette and the `{` menu list Player Name and Character Name first, under a Built-in heading.** Character Name shows only in an entity's own fields. Player Name shows in every text field that takes placeholders, except prompts. Type `{user` or `{char` to find them by their SillyTavern names.
    - **A SillyTavern card you import keeps `{{char}}` as a Character Name chip.** It works in the entity's AI-Facing Description and openings, so a rename reaches its text. The card's lorebook still names the character as plain text. Entities you imported before keep their text.
    - **In an entity's fields, the Preview tab shows a Character Name chip as the entity's current name.** It works in the World Editor, the world's Openings tab and your library. With no name yet, the chip shows its label.
    - **A placeholder you make from an entity's opening joins that entity's placeholders, like one made from its descriptions.**
  - **Trait Requirements:**
    - **A trait in the World Editor has an Availability tab with its checkboxes and a new Requires field.** **Add Requirement** picks another trait, any trait in a group, or a persona to play as. Requirements show as chips joined by "or". A requirement whose target is gone turns red.
    - **The Enter World trait step locks a trait until one of its requirements is picked.** A locked trait shows a lock and a line such as "Requires Paladin or Knight". Removing a requirement turns off the traits that need it, along the chain. A banner says what turned off and why.
    - **The in-game Traits tab locks a trait until one of its requirements holds.** Switching a trait off or changing persona turns off the traits that need it, with the same banner. Each gives back its stat changes. A trait turned off this way comes back when its requirement holds again.
    - **The Test Bench reports traits that can never unlock, requirements that point at nothing, and defaults that start unselected.** An error lists traits no pick can unlock, such as two that only require each other. An error names each requirement whose target was deleted. A warning flags a default that starts unselected with every persona choice.
  - **Morph Art:**
    - **Your library shows Morph art for an entity or Avatar with no picture.** Each one gets its own picture: its first letter made of goo, on a color picked from the entity. The same entity always gets the same picture. It follows your **Font** setting and your theme.
    - **A character card exported from an entity with no picture shows Morph art.** It replaces the initials on a flat color. Cards you already exported keep their initials.
    - **Community Creations shows Morph art for an entity or Avatar published without a picture.** It replaces the purple silhouette on the card, the details window and the author's profile. An entity you download shows the same picture in your library.
  - **A trait group in the World Editor sets how many of its traits the player can pick.** **Pick Count** replaces **Exclusive** with **Any**, **Exactly One**, **Up to One** or **Custom**. At Enter World, a group short of its minimum keeps **Start game** disabled. In play, you can't switch off a trait that leaves its group short.
  - **A trait in the World Editor can be Always On, so it's active whenever its requirements hold.** The **Mode** control on the trait's Availability tab picks **Optional** or **Always On**. The player can never switch it. A curse can require a cursed item: pick the item and the curse arrives.
  - **A trait in the World Editor can be Hidden: it works like Always On, but the player never sees it.** The AI reads it, and its stat changes apply. Enter World, the in-game Traits tab, the turn log and the banner never name it. The Prompt viewer and the Test Bench show it.
  - **A trait link can set its own Mode, so one entity has a trait Always On while another picks it.** Open a linked trait and use **Mode** on its Availability tab. The link reads the original's Mode until you change it, and **Reset** puts it back.
  - **The Test Bench catches trait group pick counts that a player can't meet.** Errors flag defaults below the minimum, a minimum too few traits can unlock, and a minimum above the maximum. A warning flags more defaults than the maximum. The rule "Trait Group Multiple Defaults" is now "Trait Group Defaults Over Max".
  - **Emberwatch joins the bundled worlds: a high-fantasy frontier keep built as an example RPG race-and-class system.** Build a character from a **Race** and a **Class**, or play **Albus** the Human Paladin or **Sylvie Thornwhistle** the Elf Rogue. Its readme ends with **How this world is built**, which names the world's example of each authoring feature.
  - **A world persona can name its own starting location, and Enter World selects it when you pick that persona.** In Advanced, a persona has a **Starting Location** dropdown in the World Editor. Enter World's persona picker shows "Starts at Old Road" under it. You can still change the location.
  - **The World Editor's Overview tab splits Persona Choice into Allowed Personas and Starts On.** **Allowed Personas** is **Any** or **World Only**, which offers no library personas. **Starts On** picks the persona a new player starts on. Worlds you made with Persona Choice load with the same behavior.
  - **The Markdown Guidance chip has a Definitions variant, and the Experimental preset uses it.** It lists the inline syntax the story displays, and what each one means to a reader. It gives no direction on when to use them. It's empty while **Markdown Formatting** is off.
  - **The World Editor's Overview tab labels its two descriptions Player-Facing Description and AI-Facing Description, each with an ⓘ tip.** Players see the Player-Facing Description on the library card, and the AI never reads it. The AI reads the AI-Facing Description on every turn. Saved worlds don't change.
  - **On mobile, a detail panel's back button is an arrow in the panel's own header.** The arrow leads the panel's tab strip, or its first row. Point at it to see the list it returns to. The placeholder strip above a panel starts collapsed on mobile.
  - **A world that placed in a contest wears its place as a gold, silver or bronze chip.** It shows on the community card, the library card and both details views. In Community Creations, clicking it opens that contest's tab.
  - **Community Creations and the library's Detailed view show entities and Avatars as wide cards with a tall image.** The tall image shows a face in full. The details window shows the image tall too, with the author, counts, dates, tags and download button beside it.
  - **The library's Avatars tab has a Detailed view, and each tab remembers its own view.** An Avatar's card text names the authors its file credits.
  - **Your persona always heads the in-game Entities tab, marked (You).** It shows in every scene and opens like any other entity: its picture in the side view, or its card.
  - **AI Context shows each request's raw reasoning in its own section.** **Raw Reasoning** sits between **Raw Input** and **Raw Output**, on the turn it was generated. Search finds text in it, and the export includes it. The thinking is never sent back in later turns.
  - **The Test Bench's Triggers tab says when an entry missed only because of Case-Sensitive.** An entry with **Case-Sensitive** on that finds its keyword in another case reads, for example, “bell” appears only as “Bell”. The entry still doesn't activate.
  - **Community Creations refuses the default Avatar.** When you publish it from the **Avatars** tab, a message tells you to upload your own VRM. A copy under a new name is refused too, because the check reads the file's bytes.
  - **Publish World refuses a bundled world you haven't edited.** The publish dialog doesn't open, and a message tells you to edit the world first. Save an edit to the world's text, and it publishes as before. A world you made always publishes.
  - **In the World Editor, each Connection direction has its own Travel Hint, and the AI reads the one you travel.** A two-way Connection shows two boxes, **To** and **From** the other location. A link toggle beside them makes the top hint apply to both directions. Worlds you already have keep each hint in both directions.
  - **The World Editor's Traits search finds each entity's own traits and Links, not only the world's traits.** An entity's trait or Link shows the entity's name first, such as "Ash › Tamed". Click a row to open its trait or Link.
  - **The World Editor's Placeholders search lists every matching placeholder: the world's, each entity's and each book's.** An entity's or book's placeholder shows its owner's name first, such as "Molly › Eyes". Each row has the same **Duplicate** and **Delete** buttons as its tree row.
  - **The World Editor's Dictionary tab and the library dictionary editor search their entries.** The list shows the matching books and entries flat, each entry with its book's name first. Each row keeps its tree buttons. In the library editor, **Add entry** names the new entry from the text.
  - **In the World Editor, an entity's or book's Placeholders tab has a search box and a + button.** **+** adds a placeholder named from the text. Select a row, and its details slide in over the list. A blueprint copy opens its copy editor.
  - **In the library entity and dictionary editors, the Placeholders tab has a search box and a + button.** **+** adds a placeholder named from the text. In an entity, a blueprint copy opens over the blueprint the entity carries, so you never change the blueprint.
  - **In the library entity and dictionary editors, the placeholder palette sits at the top of the right pane.** It shows on the Traits, Placeholders and Dictionary tabs, whether or not anything is selected. Click a chip to put the placeholder into the field you are editing.
  - **Each World Editor tab keeps its own selection.** Open a trait, go to Stats, and come back to Traits: the trait is still open. A search hit or a Test Bench finding selects its item on its own tab only.
  - **An Avatar card's menu lets you pick its thumbnail: the image from the file, or a generated portrait.** Right-click an Avatar and pick **From File** or **Generated** under **Thumbnail**. **Generated** draws a head-and-shoulders portrait. Your next publish sends the image you picked. The Avatar file doesn't change.
  - **An Avatar's details start collapsed, and its Export and Publish buttons share one row.** The 3D preview gets the room. Open **Details** to read the author, format, size and license. **Export** and **Publish** sit side by side at equal width.

- **🛠️ Developer tooling**
  - **Chip Values:**
    - **Chip Values is one module that turns a Chip Scene into a value for every scene-derived chip.** A Chip Scene is a plain value for one moment of play. A drift guard fails when a registry token has no value. The World Editor's Preview tab and the Opening instrument read it.
    - **The Settings Preview's sample chips come from Chip Values.** A small sample world in code becomes a Chip Scene through the authored adapter. The sample text uses play's layout, such as `Health: 82/100 (Bruised)` for stats.
    - **Play reads Chip Values through a live adapter.** A hook builds a Chip Scene from the playthrough, and a second one from a stat-code before box in flight. The game view's own context builder and the standalone scene-token function are gone.
    - **The Test Bench's AI Context instrument and the stat-update request read Chip Values.** Each AI Context block now shows the value its chip carries, and the Dictionary block joins Background and Foreground lore. The stat-update request renders its Stats chips through the module's Stats renderer. Neither decodes chip tokens anymore.
  - **Narration Tool-Call Probe:**
    - **The probe can open the model's thinking with authored text.** `reasoningPrefill` adds the thought-channel token and an opening sentence to the first request only. `narration-prefill.cli.ts` crosses two openers with a control, and records which entities each trial fetched.
    - **The probe measures reasoning kept between tool rounds.** `narration-reasoning-rounds.cli.ts` compares echoing the model's `reasoning_content` between rounds with removing it, and records the prompt tokens of each shape. `narration-selection-score.ts` scores a trial under the involved-entity rule.
  - **The World Editor's search box and + control are one shared widget that every editor list can use.** It holds the search term, renders the box and the + control, hands each add the trimmed text, and clears the box. The placeholder-aware match is a helper beside it.
  - **Every multi-select dropdown has Select All, and its Clear and Close buttons stay in view.** Select All shows in a location's **Entities**, an entity's **Locations** and a stat's body slider dropdowns. **Clear** and **Close** sit in a footer below the list.
  - **The library trait editor is one entity traits editor that takes a Trait Store, a layout, and its selection.** `EntityTraitsEditor` renders the toolbar, the tree or search list, and the detail panel, side by side or stacked. `ListDetail` gains a `stacked` option. The Trait Store's one-entity root is `entityRoot`.
  - **A bearer-resolution module answers which traits each bearer has, with links read live from their originals.** A world file can hold links, a Blueprints group, Custom Persona and persona-only marks, and requirement bearers. `resolveBearers` takes the world and persona, and returns each bearer's tree with links expanded one level.
  - **A blueprint-copies module reconciles every entity's copies in one pure pass, at load and after every editor write.** `neededCopies` names the blueprints each entity needs, and `copyNeeds` gives each need's first reason. `syncBlueprintCopies` creates missing copies and removes untouched ones nothing needs. It returns the same array when nothing changes.
  - **A blueprints module reads trait link overrides and placeholder copies live from their blueprint until edited.** One shape serves both: a blueprint id and a sparse override map. `effectiveRecord` lays the overrides over the blueprint. `lookupCopy` traces a blueprint id to the placeholder one bearer reads. `bindCarriedBlueprints` binds a carried entity's copies.
  - **An owned traits probe compares the AI context with and without entities' active traits.** `owned-traits-probe.cli.ts` gives two Sedge Landing characters and a world persona one trait each. It scores trait uptake in narration and the planner's roster, with leak, length and dialogue checks. `--linked` builds the same traits as links.
  - **A Markdown definition probe compares syntax definitions, usage guidance, and no formatting section in the Experimental preset.** It narrates calm, dialogue, and pivot scenes in Sedge Landing at paired seeds. It counts each defined syntax per reply, and counts stray syntax as false positives.
  - **A Playwright spec walks the whole Authoring Tour as a new author.** `e2e/authoring-tour.spec.ts` makes a world, takes every step, and checks the counter, **Next** and In Play on each. A stub answers the model calls. It runs under `npm run test:e2e` in about 12 seconds.
  - **The request layer runs a tool loop.** It sends Tools only to endpoints and models known to take them, and runs each streamed call through the caller's executor. A Tool's call limit, or the default of 4, ends the loop. A request sends at most 6 rounds.
  - **`npm run fingerprints` writes the list the server uses to refuse bundled worlds and default Avatars.** It fingerprints every git revision of every bundled world, and hashes every revision of both default Avatar files. A fingerprint skips stat code, so migration doesn't change it. A test fails when a bundled world's text is missing.
  - **Admin Panel → Users shows an administrator each account's email and every account's Privacy Policy answer.** The email sits under the username. The new **Privacy** column reads Accepted, Declined or Not Seen. Other staff roles see no email, and their search and sort don't match on it.
  - **The Grouped Context Actions reference shows the item-action section players see.** Its sample is a persona entity on the production entity card. The Main Menu and the reference build the default-persona item from one component. The guide's rule puts the item's own actions last, with **Delete** last.

#### ➖ Removed

- **👤 User-facing**
  - **A new world no longer starts with the World and Player trait groups.** Simple mode can't make or manage groups, so a new world's traits start in one flat list. Worlds that already have the two groups keep them.
  - **Semantic Memory, Scene Recall, Semantic Lore and Diary Recall no longer carry the Experimental flask.** Time in Memory, Measured Clock and the new Tools switch keep it.

#### 🔧 Fixed

- **👤 User-facing**
  - **Reasoning Budget:**
    - **A prompt's Reasoning Budget in Settings → Prompts adds thinking room on top of its Max Output.** The percent is a share of the endpoint's Max Output, so a prompt's **Max Output** row sets only its answer. With a 1,024-token endpoint, Milestone Select at 75% thinks in 768 tokens and keeps 300 for its reply.
    - **The Reasoning Budget slider runs from 50% to 200% and starts higher, so a model finishes thinking before it answers.** Narration starts at 150%, and every other prompt at 75%. A budget you saved below 50% loads as 50%. The readout shows tokens on every prompt.
    - **Formamorph stops a request once its answer passes the prompt's Max Output, without counting the model's thinking.** A cut narration ends on its last full sentence. An endpoint that sends the whole reply at once gets the same cut.
    - **An endpoint that takes no reasoning budget gets room for a long thought before the answer.** Its request allows the answer's cap plus twice the endpoint's Max Output. With **Inline** thinking, narration gets the same extra room.
    - **The story history leaves room for narration's thinking, so a long thought never overflows the context window.** The narration length guidance still counts only the reply.
    - **With the endpoint's Max Output off, the Reasoning Budget slider is disabled, and a note says to set it.** No budget goes out then. A prompt with its own cap allows three times that cap.
    - **A Claude 4.6 or earlier model always gets at least the 1,024 thinking tokens its API needs.**
    - **A thought your server cuts fails the turn with the Failed to process AI request toast, not an empty turn.** **View Details** shows the token limit the request sent. The cut thought is never sent to the model again.
    - **AI Context shows the limit each request sent in a Max Tokens chip beside its reasoning chip.**
  - **Error Details:**
    - **An image generation error toast has a View Details link to the full error.** For ComfyUI, it lists each failing node and what's wrong with it. For other providers, it shows the HTTP status and the full reply. **Copy** puts it all on your clipboard, with your Formamorph version, platform and system.
    - **The "Failed to process AI request" toast has a View Details link to your AI server's reason.** **View Details** shows the endpoint, the model, the HTTP status and the server's message, such as "model not found". A key or token in the endpoint URL shows as `[redacted]`.
    - **A failed delete, quarantine or release toast in Community Creations has a View Details link to the failed request.** It shows the route, the HTTP status and the server's full reply. It never includes your sign-in token.
    - **Error toasts in Feedback, Messages, Backup and the Admin Panel have a View Details link to the full error.** It shows the cause and any failed request with its HTTP status, then your version block. A toast that only asks you to fill in a field has no link.
    - **Error toasts in Settings, the library editors and Community Creations listings have a View Details link to the full error.** A failed save, import, comment, like or report shows its cause and any failed request. When several add-on reviews fail at once, it lists each add-on's reason.
    - **Error toasts in play, the World Editor, the library and downloads have a View Details link to the full error.** This covers a failed game save or load, world import, export, download or AI **Generate**. A failed turn whose AI request already has a link keeps its toast short.
    - **Error Details has a Report Bug button that opens a bug report with the error filled in.** **Report Bug** fills the title with the toast's message and the description with the details. It works in the main menu, the World Editor and play. When you're signed out, it asks you to sign in first.
  - **Openings:**
    - **The Player Action | Narration switch on an opening card keeps its selected pill inside the switch.** The pill was taller than the switch and stuck out of it. Every switch of this kind now fills its pill to the height of its track.
    - **Openings is the last tab in the World Editor's entity panel.** It sat before Placeholders.
    - **The add button under an entity's openings in the World Editor names the entity.** It reads "Add Opening to Guide" instead of "Add Opening", so you see where the new opening goes.
  - **In the World Editor's entity and dictionary panels, the Placeholders tab's editor fills the panel at any window height.** The list scrolls inside the box, with its + button in place. The pushed panel on mobile does the same.
  - **The Output tab's Native Reasoning row follows your active endpoint, not the prompt selected on the Prompts tab.** Every Global prompt follows that row. The prompt's own **Native Reasoning** control on the Prompts tab follows the endpoint that prompt is pinned to.
  - **Settings reads each new LM Studio model's reasoning and Tools support, even with the model left as `default`.** Formamorph reads LM Studio's model list again once per session, so a model you load in LM Studio replaces the last model's answers after a reload. The check costs one quick request and sends no test message.
  - **The dark shade behind a card's name fades smoothly into its picture.** The shade had a visible line where it ended and faint stripes over dark pictures. It now eases out over a longer distance on library and Community Creations cards, and eases out on library tiles too.
  - **A character who introduces themselves in dialogue shows in the Entities tab.** A self-introduction such as "I'm Freya" or "Call me" in a character's own line counts. A new character who introduces themselves joins your cast on sight. Your own introduction never counts.
  - **The persona picker shows each persona's portrait and player-facing description.** In **Enter World** and **Change Persona**, each persona shows a 2:3 portrait and up to three lines of its description. Square entity thumbnails crop from the top, so they show the face.
  - **A stat's default descriptors follow its name when you rename it.** Renaming a stat rewrites each "New Stat is low" style descriptor you haven't edited. A descriptor you wrote yourself stays as written. Stats already saved with the old text don't change.
  - **A changelog entry you write while an update uploads reaches the listing.** The publish attaches the entry as it is when the upload finishes. If the entry popup is still open then, the publish waits for **Attach to Update** or **Cancel**.
  - **The Entities chip with Name content lists only who is in the scene in the Choices and re-roll prompts.** That variant read the whole location roster, past the presence filter the other variants respect. Every variant of the chip now comes from one enumerated set, so a new variant cannot miss the filter.
  - **Each character's planning and diary requests read that character's description with its placeholders filled in.** They sent the raw placeholder tokens before. The planning request runs with Staged thinking. Scene pictures built from a character's description fill them in too.
  - **Drawing a scene again uses the tags you edited.** **Draw again** and **Generate Scene Image** wrote new tags from the narration before, so a redraw after an edit used the old tags and the next one used your edit. Only **Re-roll tags** writes new tags now.
  - **A select's value starts at its left edge, however long it is.** A long value starts at the left, like a short one, and is cut off at the right.
  - **The World Editor's detail panel and the library's entity and dictionary editors keep their tab strip still while fields scroll.** It stays on the stat, entity, location, trait and dictionary panels, with the placeholder palette.

- **🛠️ Developer tooling**
  - **Design System:**
    - **The Settings reference renders the production Display and Output sections, with the Simple/Advanced switch.** The sections run on local values built from the settings defaults, so a change writes no settings and downloads nothing. The font, reveal animation and theme preview dialogs open in the showcase.
    - **The Panel Tab Strip reference shows all five entity tabs, and each tab shows what it holds.** A test fails when a registry gains a tab with no body, or when a heading states the wrong tab count. The Design System guide lists the five entity tabs.
    - **The Narration Turn reference shows the Pages action line and the Stats panel's Edit Stats and Re-generate Stats pair.** Both are production components, `ActionLine` and `StatsActions`, that the game and the reference render. The pair is enabled on the latest turn and disabled on a past turn.
    - **The Prompt Chips reference shows Character Name, and its Preview reads the owning entity's name.** A sample entity owns a new Entity Description field, so the palette lists both Built-in chips. The Design System guide states the Preview rule.
    - **The Community Creation Cards reference shows an entity listing that the server flags as a stand-in.** The card draws its Morph art and never shows the stored file. The entity with no image stays, so the reference shows both ways to Morph art. The Design System guide states the stand-in rule.

</details>

---

<details>
<summary><strong>✅ 3.0.1 — Released 2026-09-23</strong> — Experimental prompt preset — headed prompt chips as self-contained sections — Prepend and Append on World and Dictionary chips — Night Pharmacy and Surveyor's Camp become places (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Settings → Prompts includes an opt-in Experimental preset with a minimal narration role and context definitions.** Each context chip carries its definition in Prepend, beneath its section header. Default, Simple, XML, and saved custom presets keep their current text. Experimental can change as testing continues.

- **🛠️ Developer tooling**
  - **A lore definition probe compares Background and Foreground Lore definitions in the Experimental preset.** It plants one standing fact and one scene detail in Sedge Landing. Then it scores uptake, contradiction, and intrusion into an unrelated turn for each definition arm at paired seeds.
  - **The narration tool probe compares lore-retrieval rules, preparation instructions, and tool-based or ordinary narration against saved trials.** Runners compare minimal and full prompts, lookup descriptions, and narration presets across greeting, object inspection, silent observation, and cached-lore scenes. Variants test decision notes, narration role and context alone, entity summary labels, retrieval before any mention, or an explicit entity definition, with separate vocabulary diagnostics, a fixture-example removal control, definitions beneath populated context headers, entity header/tool naming controls, a combined header/name/parameter/documented-output variant, an expanded-character selection comparison with upcoming-narration, inclusion, retrieval-before-planning, and appearance-prerequisite wording, continuation comparisons with prior reasoning omitted or an unrelated demonstration added, a reasoning-style comparison with identical demonstration narration, three-turn chains comparing concise and background-retrieval demonstrations, and complete paired outputs for review. Comparisons verify saved requests and loaded-model metadata, keep unrelated request settings fixed, and preserve every response. Ordinary narration rejects empty and truncated replies. LM Studio runs allow three minutes per request and remap outgoing call IDs for nine-character-ID templates while retaining original server responses in the evidence.

#### 🔧 Fixed

- **👤 User-facing**
  - **Prompt Chips:**
    - **World and Dictionary chips have Prepend and Append fields.** Text added before or after these chips can be seen and edited in the chip editor.
    - **Long Prepend and Append text can be edited normally.** Removed the 40-character limit that blocked changes to section definitions.
    - **A chip with a Header is a self-contained section.** It adds a blank line, the heading, and its content, and it ends its own line. Place headed chips back to back for one blank line between sections. An empty headed chip adds nothing. Line breaks you type stay as typed. Edit shows the frame with `↵` on otherwise empty lines. Location and Entity lists no longer add an extra blank line before the section that follows an empty one.
    - **Anatomy's Chips view keeps headed sections evenly spaced when sample values are empty.** An empty headed chip still shows its section frame. Inline chips keep their placement, and Resolved view still shows the exact request text.
  - **Slime Outbreak's Night Pharmacy and Veilwood's Surveyor's Camp are now places, not entities.** Each is a sublocation of the district or tree that holds it, so you can travel there. Unedited copies update on next launch.
  - **The website gallery and social preview show the updated interface and load fresh images after each screenshot update.** Captures use a 1600×900 viewport across all five palettes in light and dark themes. The gameplay image shows a submitted player action and its response, with Entities selected. The capture script rejects clipped action text, narration, choices or input and crowded tabs before saving the gameplay image. Website deployments give the gallery, thumbnails, and social preview content-based URLs so cached images do not hide new captures.

</details>

---

<details>
<summary><strong>✅ 3.0.0 — Released 2026-09-22</strong> — Personas and weighted openings — Open Chat and conversation layout — shared prompt presets and native reasoning controls — editable placeholder values (click to expand)</summary>

### Minor Changes

#### ➕ Added

- **👤 User-facing**
  - **Persona:**
    - **A Persona checkbox in both entity editors marks an entity you can play as.** It sits above **Type**. In the library it marks one of your personas. In a world it marks an entity the player can play as. The World Editor shows it in Advanced mode.
    - **Entity editors take pronouns and send them to the AI.** Both entity editors have a **Pronouns** field on the **Profile** tab. It takes free text, such as "she/her". Every entity with pronouns sends them to the AI beside its name and aliases.
    - **The library's Entities tab can show only your personas.** An **All | Personas** switch above the grid picks the view. The Personas view keeps your folders and tile sizes, and it never changes your layout.
    - **You can set one persona as your default in the library.** Right-click a persona in the **Entities** tab and select **Set as Default Persona**. A **Default** badge marks it. The default stays on this device and never goes into an export.
    - **World exports, character cards and published listings keep an entity's pronouns and Persona mark.** An import keeps both, so a shared persona arrives as a persona.
    - **Enter World opens on a Persona category where you pick who you play.** It lists **None**, the world's own personas and your library personas, each with its portrait and name. It shows only when a persona is available. Your pick goes with the new game.
    - **Enter World starts on your last persona pick for that world, then your default persona, then None.** Each world remembers your last pick on this device. **Quick Start** uses the same order.
    - **The game's side panel shows your persona, and you can change it mid-game.** A row above **Stats**, **Traits** and **Location** shows the persona's portrait and name. Select **Change** to pick again from the same list as Enter World. A save from before personas starts on **None**.
    - **You can play as one of a world's own entities.** A world entity with the Persona mark shows under **From This World** in the persona lists. The entity you play leaves the cast for that game. The AI reads that everyone in the world knows this person.
    - **A world's Persona Choice setting in the World Editor says who the player can be.** It sits on the Overview tab in Advanced mode. **Open** lets the player pick any persona. **Fixed** starts the player on **None**. **Cast** lists only the world's own personas.
    - **Saves record the persona you play.** A save stores a world entity, a library entity, or None. A library persona is read from your library each time, so an edit to it reaches the save.
    - **The staged planner treats the persona's name and aliases as the player, in place of trait names.** With no persona, it doesn't read a cast member that shares a trait's name as the player.
    - **A Persona chip in Settings → Prompts sends the persona you play to the AI.** The chip sends it at **Full**, **Summary** or **Name** detail. The built-in presets carry it. A custom preset or a world's own prompt gets the persona only when you add the chip.
    - **A Player Name chip lets world, entity, dictionary and opening text name the player.** Type `{` in one of those fields and pick **Player Name**. In play it reads as your persona's name. With no persona, it reads "you" in an opening and "the player" elsewhere.
    - **A library persona's own placeholders work in play.** Chips in your persona's name and description read the persona's own placeholders. Its Wildcards roll one time when you pick the persona and keep their values in the save.
    - **The Entities tab imports SillyTavern's persona backup.** Select **Import Entity**, then pick the backup `.json` file and your persona avatar images together. Each persona becomes a library persona, and a matching image becomes its portrait. A report lists what didn't match.
  - **Native Reasoning:**
    - **Every prompt has a Native Reasoning switch and a strength, in every Thinking mode.** The **Native Reasoning** row in Settings → Output is a checkbox beside a dropdown of the strengths your endpoint accepts. Each prompt's Options tab has the same switch, with **Global** to follow the Output row.
    - **Each prompt's Native Reasoning ships with its own default switch and strength.** Planning, Director, Character, Storyboard, Summary and Diary ship on at **Low** with a **25%** budget. Stat updates, location, time, scene tags, discovery, milestone picks and Choices ship off. Narration keeps **Global**.
    - **The Inline, Planning and Staged Thinking modes follow each pass's own Native Reasoning switch.** Under **Inline**, the narration call writes its own thinking block, so its native reasoning stays off. A level or **None** you set before loads into the switch as it was.
    - **The Reasoning Budget slider caps thinking on LM Studio as well as the built-in engine.** It shows on a prompt's Options tab when LM Studio reports a reasoning model. Every request carries that cap in tokens. A switched-off prompt sends a cap of zero.
    - **The AI Context viewer shows the reasoning fields each request carried.** Every captured request shows its effort level and its thinking cap beside its endpoint.
    - **Formamorph reads your server's own reasoning capability list instead of testing it.** It reads the lists that Ollama, a llama.cpp server and a cloud gateway publish. The strength dropdown lists only the strengths your server honors. Only an endpoint that publishes nothing gets one test request.
    - **A public model catalog tells Formamorph your model reasons before you take a turn.** For an endpoint that publishes nothing, Formamorph matches the model id against a catalog of about 7,800 models. A well-known reasoning model gets the right controls and no test request.
    - **Formamorph reads a model's replies to tell whether it reasons.** A reply that carries reasoning, in a separate field or a `<think>` block, shows the controls. A reply with no reasoning, after asking for a strength above **None**, hides them. Your server's published list always wins.
    - **Kimi models on a Moonshot endpoint get the reasoning controls their model id supports.** **k3** offers **Low**, **High** and **Max**, and its switch is locked on. **k2.6** has a working switch and no strength. No Kimi model shows the Reasoning Budget slider, because Moonshot takes no token cap.
    - **On OpenRouter, each model gets the reasoning controls it actually takes.** Formamorph reads OpenRouter's model list. A model that takes a thinking cap shows the **Reasoning Budget** slider. The strength dropdown lists only that model's efforts, so a pick never fails a turn.
    - **On a vLLM server, the reasoning controls appear after a reply carries the server's own reasoning.** Until then, Formamorph shows no **Native Reasoning** controls and sends no reasoning field. The built-in hosted endpoint is such a server, so its controls stay hidden. Its Thinking modes work as before.
    - **Anthropic endpoints get the reasoning controls their API takes, with no test request.** The strength dropdown doesn't show, because Anthropic ignores the effort level. Claude 4.6 and earlier show the **Reasoning Budget** slider. Claude 4.7 and later show the switch alone.
    - **Google Gemini endpoints get the reasoning controls their API takes, with no test request.** A 2.5 model shows the **Reasoning Budget** slider. A 3.x model shows a strength dropdown, and its switch is locked on because it can't stop thinking. Gemini 2.0 and 1.x show a short note.
  - **Prompt Settings:**
    - **Settings → Prompts navigation uses smaller subsection labels, a filled active row, and independent scrolling.** Indentation shows the hierarchy. The open prompt stays visible as context.
    - **Settings → Prompts heads every surface of a prompt with the line that says what it does.** The one-line description heads the Anatomy hub, the System Prompt editor, the User Message editor and the Options panel. The hub's how-to-read sentence moved behind its ⓘ.
    - **A Max Output row on a prompt's Options tab sets how many tokens that prompt may write.** It shows on capped prompts such as **Planning**, **Summaries** and **Choices**. Off, it reads **Auto** with the cap the prompt ships with. On, a slider sets the cap from 8 to 2,048 tokens.
    - **The Max Output setting belongs to the prompt preset, so a shared preset carries it.** It is read-only under a built-in preset. A shared preset from an older version imports with every row on **Auto**.
    - **The Reasoning Budget readout on a prompt's Options tab shows its token result beside the percent.** It follows the Max Output row.
    - **Choices, Stat Updates and Location Change send an output cap, so a verbose model stops before the endpoint's limit.** Choices ships at 256 tokens. Stat Updates sizes its cap from the world's stat count, and Location Change from its longest destination name.
    - **A Discover Entity prompt in Settings → Prompts holds the text that writes a new character's note.** It sits under **Story** after **Character** while **Describe New Characters** is on. It has a System Prompt, a User Message and a Max Output row.
    - **A Milestone Select prompt in Settings → Prompts holds the text that picks which turns stay in memory.** It sits under **Memory** while **Memory Summaries** is on. The reply lines the app reads are always added after the User Message, so an edit can't break them.
    - **Prompt-variable chips in Settings and the World Editor take a formatted Header.** Header appears above the chip's Prepend and Append controls. Its **Format** picks Markdown, Simple, or XML presentation. Empty values omit the section. Headers stay when you move, copy, save, or share a chip.
    - **Built-in presets hide empty single-chip sections in every style.** The XML preset keeps Traits and Player Character as separate sections. Markdown Guidance uses its editable Header in place of a fixed Formatting heading.
    - **Chip options open when you select a generated heading, closing tag, affix or chip.** Press Enter in an affix to add a line break, shown as ↵.
    - **Shared prompts that use a chip Header need an updated parser.** Existing custom prompts keep their authored text.
  - **Openings:**
    - **The World Editor's Openings panel holds several openings, and a new game draws one by weight.** Each opening has its text, a draw weight and the chance that weight gives it. Weight 0 keeps an opening without drawing it. The checkbox beside **Openings** turns the list off and keeps the text.
    - **An opening set to open as Narration becomes page one exactly as you wrote it.** Each opening has an **Opens As** toggle. **Player Action** fills the player's input box, and the AI writes page one from it. **Narration** starts the game at once with no narration request.
    - **Re-generate on page one draws an opening the player hasn't seen this session.** It starts the set over when all have been shown. Quick Start draws the same way, and loading a save draws nothing.
    - **Entities carry their own openings, drawn with the world's when the entity is at the starting location.** Both entity editors have an **Openings** tab after **Descriptions**, with the same rows as the World Editor's panel. Openings go with the entity in its character card and published listing.
    - **The Openings checkbox checks itself once the world or one of its entities has an opening.** A world with no openings reads unchecked and disabled, and plays the default opening. After that, uncheck it to bench every opening and keep the text.
    - **Adding an entity that brings openings checks the world's Openings checkbox.** A message names the entity. It works from **Add Entity**, from a character card, and from the library.
    - **The World Editor's Openings panel shows every opening in the world, grouped by owner.** The world's openings come first under **This World**, then one group per entity. You edit any row in place, and the change goes to its owner. Each row's chance is its share of the draw.
    - **Entities you pick at Enter World open the world with their own openings.** When a picked entity has an opening that can be drawn, the draw uses only the picked entities' openings. Otherwise the world's draw applies.
    - **SillyTavern cards import their greetings as Narration openings on the entity.** The first message and each alternate greeting become openings at equal weight, so page one reads as the card's author wrote it. In play, `{{user}}` reads "you".
    - **SillyTavern JSON and PNG card imports keep the creator as author and the tags in the library.** JSON cards keep their avatar URL as a linked image. You can edit the tags in the library.
    - **The Test Bench's Opening tab lists every opening a new game can draw, and what each sends.** It shows each opening's owner, **Opens As** kind and chance. A Player Action opening shows the first prompt. A Narration opening shows its text as page one, with no narration request.
  - **Narration Layout:**
    - **Re-generate Stats sits to the right of Edit Stats in the Stats panel, and both buttons have tooltips.** Pages and Chat share the controls. The button is disabled on past turns and while a reply or scene render runs.
    - **The Chat narration layout shows the story as a conversation.** Pick **Chat** under **Narration Layout** in Settings → Display; **Pages** stays the default. Your action shows as a bubble on the right, and the narration answers it at full width below.
    - **Chat's Jump to Latest button takes you back to the newest text.** It stays hidden before the opening narration. The stats, notes and other panels follow the turn you scroll to.
    - **Chat shows choices as unsent bubbles under the latest reply.** Each reply has its actions in an icon row and on right-click. Past replies offer **Rewind to Here**, and a right-click on your own line lets you edit it.
    - **Chat draws only the turns near the view, so a save of a thousand turns opens in a moment.**
    - **Pages shows each turn on a card with its actions in an icon row under the narration.** Your action is a quiet line above the narration. The row holds the turn number, and a right-click on the narration lists the same actions. A past page offers **Rewind to Here**.
    - **Pages shows unnumbered choices, and a staged choice takes the accent fill.** **Re-generate Choices** shares the **[Continue the Story]** row, or sits under the choices when Continue is hidden.
    - **Re-generate Choices waits for the latest turn's narration in both Chat and Pages.** This includes a turn that returned no choices.
    - **Generate Scene Image sits in More and the right-click menu in both layouts.** Click a scene image to zoom it, and point at it for the browse arrows and delete.
  - **Values Tab:**
    - **World Editor text fields with placeholders gain a Values tab beside Edit and Preview.** On **Values**, each chip opens in place on the value the Preview drew. A header names the placeholder and shows the value's place in the list, such as `2/3`. Settings prompt fields don't get it.
    - **Arrows on a Values tab header step through a placeholder's other values.** The Preview and every other field follow the step. A World chip moves all of that placeholder's World chips; a Unique chip moves only itself.
    - **The Values tab arrows step onto each pin a trait, location, stat band or value lays on a placeholder.** The header names the source, such as **Pinned by Trait: Sworn**. The counter counts values and pins together.
    - **Typing in an open value on the Values tab changes that placeholder's value everywhere.** Every field that uses it shows the new text at once, and the field's own text keeps the chip. Undo takes a value edit back.
    - **Typing in a pinned value on the Values tab rewrites the pin where it lives.** The edit goes to the trait, location, stat band or value that carries the pin. Every chip that reads that pin shows your edit.
    - **Editing keys on the Values tab respect each open value's edges.** The arrow keys step into an open value and out the other side. Backspace at its start and Delete at its end reach nothing outside it. Enter adds a line break.
    - **On the Values tab, only the active value shows an outline and its full label.** The active value holds your cursor or had its header pressed last. Other open values show their fill alone, so a field of many chips reads as text.
    - **An Edit Value button in a placed chip's pop-out opens the Values tab at that value.** One click puts the cursor at the end of the chip's value. The button doesn't show where there is nothing to type into.
  - **Prompt Presets:**
    - **Prompt presets you made have an Overview in Settings → Prompts that goes with them when you share.** **Overview** sits at the top of the prompt list. It holds **Author**, a markdown **Description**, **Tags** and **Models**. **Export** puts it in the `.json` file and the share code.
    - **The Overview's Tags and Models fields suggest values from your endpoints and Community Creations.** **Models** lists the models your endpoints report, or your installed models on the desktop built-in engine. After you browse Community Creations, both fields suggest values from prompt listings. You can still type anything.
    - **You can publish a prompt preset you made to Community Creations.** While you're signed in, **Publish** sits beside **Export** in Settings → Prompts. The listing holds the whole preset and never your endpoint routing. **Models** must name at least one model.
    - **Community Creations has a Prompts section with a Models filter for presets.** **Prompts** sits after **Avatars** in the section list. A prompt's details show its description, author, tags, models and Formamorph version. **Add Filter** has a **Models** field, and `model:` in the search box adds it.
    - **You can download a prompt from Community Creations and switch to it with one button.** **Download Prompt** adds the preset to your list and doesn't change your current preset. **Use This Preset** then makes it yours. When the author updates the listing, the card shows **Update available**.
    - **On a narrow screen, the preset actions in Settings → Prompts sit in one ⋯ menu.** The **Preset Actions** menu lists **Rename**, **Export**, **Publish**, **Reset** and **Delete**. A wide screen keeps the full row of buttons.
  - **Quoted Speech:**
    - **Quoted speech in the story shows in its own dialogue color.** Narration, your typed lines and the choice buttons color the text between double quotes. The color comes from your theme. **Quote Color** in Settings → Display → Accessibility turns it off.
    - **You can pick your own dialogue color for light mode and dark mode.** A color field under **Quote Color** sets it for the mode you're in. **Reset to Theme** brings back the theme's color.
    - **Quote Italic in Settings → Display → Accessibility sets quoted speech in italic.** It works with or without the color, and it's off by default.
    - **Only double quotes get the dialogue color, so apostrophes stay plain.** Straight and curly quotes both count. A quote the model never closes stops at the end of its line.
    - **Preview theme… lists the dialogue color beside a sample line of story text.**
  - **Library Editors:**
    - **The library entity and dictionary editors share one layout.** Both open at the same size, up to 1400px wide on a large screen, and their fields keep a readable width.
    - **The library entity editor has Entity and Placeholders tabs.** **Entity** holds the World Editor's **Profile**, **Descriptions** and **Openings** tabs, with the tags in a column beside them. It opens on **Entity** at **Profile**.
    - **The library dictionary editor puts the book's Name and Description on Overview.** They sit beside its author, tags and cover. Its **Dictionary** tab lists the entries, and a **+** button at the top adds one.
    - **The library editors put Author above Tags, and shared files keep the credit.** Author travels with entity cards, dictionary files and Community Creations uploads. Downloads fill a blank credit with the publisher's name.
  - **Likes:**
    - **The heart in Community Creations works without an account.** Press it on any listing to like it, and press again to take the like back. Likes are kept against this copy of the app, not against you. One connection can give one listing three likes.
    - **The likes you gave before signing in move to your account when you sign in.** A new account starts with the listings you already liked. A listing you liked both ways still counts once.
    - **A world you downloaded asks once, after fifteen turns, whether you like it.** A small card under the story offers **Like** and **Not Now**. Either press answers for that listing. Worlds that ship with the game, worlds you wrote and imported files never ask.
    - **The Privacy Policy covers liking a listing while signed out.** A **Liking while signed out** section says what such a like stores: a random id for that copy of the app, a salted hash of your network address, and a browser family. The hash is blanked after 90 days.
  - **Demo AI:**
    - **The built-in hosted AI endpoint reads Demo AI where it read Default, in Settings and the AI Context viewer.** It's a small free model for trying Formamorph with no setup. Older changelog entries call it the "Default" endpoint. Your selected preset and prompt routing stay as they are.
    - **A one-time dialog explains the Demo AI the first time you play on it.** It says a stronger model gives better narration. **Connect an AI** opens Settings on the Endpoints tab, and **Keep Playing** closes it. It doesn't show when your narration goes to your own AI.
    - **A Demo AI badge shows in the game view while the Demo AI writes your narration.** It sits beside the narration options in both layouts. Click it to open the dialog again.
  - **Library Folders:**
    - **A folder tile in the library's grid layout shows the top-left corner of the folder's own board.** Each member's art stands where it stands in the open folder, at its own size. A `+N` badge counts the members it leaves out. The detailed layout keeps the four-image mosaic.
    - **A library folder opens with a zoom into its tile.** Click a folder tile, or pick **Open Group**. The library board zooms toward the tile while the folder's board grows out of it to full size. The reduced-motion setting keeps the instant swap.
    - **Library in a folder's header zooms back out to the folder's tile.** The folder's board shrinks into the tile while the library board zooms back. The library returns at the scroll position you left.
  - **Contest Podium:**
    - **Two or more worlds can share a place on a contest podium.** Each row below the first in the Podium dialog has a **Tie With Above** checkbox. A tie takes no place away, so two worlds on 1st put the next one on 2nd.
    - **The Podium dialog's entry grid sorts entries by likes and marks ties.** Entries lead with the most-liked world, and every world level on likes is marked **Tied**. Level counts hold a fixed order, earliest published first.
    - **Worlds tied on a contest podium each read as a full win.** Worlds that share 1st place each carry the gold **1st Place** badge. The contest bar reads **2 worlds tied for 1st**. The podium band shows one card per placed world.
  - **Open Chat:**
    - **Open Chat is a new bundled world for talking with an entity from your library.** The world has no story, no stats, and one room, so an imported card's scenario is the only scenario. Existing installs get the world after the update.
    - **Open Chat's Reply Length, Style and Pacing traits set the chat's tone.** **Chat** style reads like a text thread, **Plain** like a short story, and **Literary** like a novel with you as the lead. You can switch a tone trait during play.
  - **The World Editor's Custom Prompts field takes placeholder chips, and play sends each chip's value in the prompt.** Type `{` and pick a placeholder, or drag one in from the palette. In play, each chip reads the value this playthrough rolled. This works in the narration, choices and stats prompts.
  - **Every placeholder chip's pop-out shows World | Unique, and says why it takes no choice where it can't.** For a placeholder that always draws the same value, both items are disabled. A line under them says Unique would change nothing until the placeholder can roll.
  - **A dictionary in the World Editor has Details and Placeholders tabs.** **Details** shows its name, description, **Enabled** switch and entry count. **Placeholders** holds the dictionary's own placeholders in a full-panel editor, in Advanced mode only.
  - **The World Editor tells you when it unlinks a copy whose library item is gone.** A message names the copy, or gives the count when there are two or more. The change leaves the world unsaved.
  - **The game view's side panel tabs have icons and fill the panel, and the narration sits in the exact center.** On a narrow window the labels hide and a tooltip names each tab. The **Stats** tab doesn't show in a world with no visible stats.
  - **Settings copy reads the way a person writes it.** Every setting line, option line and Prompts note starts with the verb or speaks to you, and uses contractions. What each setting does is unchanged.
  - **World Editor help reads the way a person writes it.** Field lines, ⓘ tips, empty states, Test Bench notes and help topics start with the verb or speak to you, and use contractions. What each control does is unchanged.

- **🛠️ Developer tooling**
  - **Anonymous Likes:**
    - **The Likers dialog counts a listing's Anonymous Likes, groups them by address, and removes them.** The heading shows the account total and the anonymous count. **Audit the likes** shows each Anonymous Like in its shared-address group. Each address has a remove action, and **Remove all Anonymous Likes** clears the rest.
    - **A claimed Anonymous Like wears a Claimed marker in the Likers dialog.** The original press shows above it.
    - **The Admin Panel gains a Server tab, where an administrator switches Anonymous Likes off without a deploy.** The tab holds one **Anonymous Likes** box, read from the server. A refused write leaves the box where it was and says why. Likes already given stay counted. Reach it with `#dev?modal=adminPanel&tab=serverSettings`.
  - **Open Chat:**
    - **A narration probe compares the Open Chat world's narration prompt with revision 1 or the built-in one.** `open-chat-probe.mjs` runs under `vite-node` with a card from `open-chat-cards.json`. It scores first-person voice, asterisk actions, name prefixes, reply length and the model leaving the chat. `--no-rider` sends the bare player message.
    - **A choices probe compares the Open Chat world's choices prompt with revision 1 or the built-in one.** `open-chat-choices-probe.mjs` reads each reply through the choices parser. It scores parse success, the player's voice, quotation marks, deed format, choice length and overlap. `--rescore` scores a stored run again and sends nothing.
  - **Persona:**
    - **A persona probe compares a persona with a player named in a trait.** `persona-probe.mjs` runs Narration, Choices, Summaries, Planning and Director on the same identity both ways. It scores stranger-name leaks, second person, the Cast's Player Character bullet, and the dialogue and length regressions.
    - **A world persona probe measures the line that tells the AI the world knows the player.** `world-persona-probe.mjs` runs Narration, Planning and Director on a played world entity, with and without the line. It scores name use, recognition, stranger treatment, second person and the Cast's Player Character bullet.
  - **The standalone narration tool-call probe can run the reviewed batch against LM Studio.** A local mode records the selected model and fixed seed in every request. The offline cloud preview and explicit cloud command stay. Scripted full-trial tests cover lookups, tool results, failures, budgets, cancellation and timeouts.
  - **Quote-color tests wait for the picker to close after Escape.** The check verifies dismissal before switching themes, including when the full suite delays popover cleanup.
  - **Built-in Header probes compare narration, planning, and choices output before and after template changes.** They use production rendering, committed test cases, sampler pins, and paired seeds.
  - **A stat-reasoning probe measures whether the stat pass should think.** `stat-reasoning-probe.mjs` runs the live stat-updates prompt over the gold cases under several native-reasoning arms. It scores relevance, and reasoning spilled into the answer that hits the output cap. The gold cases gain three idle turns.
  - **The dev event samples carry a tied contest beside one won outright.** `devEventSample('end')` serves a podium whose 1st place is shared, so the banner, results poster and contest bar show the tied form through `#dev`.
  - **A dev fixture boots a 1000-turn save in one call.** `#dev?view=gameViewer&fixture=thousandTurns` cycles real Sedge Landing narration with a scene image on every twentieth turn. `e2e/chat-scale.spec.ts` uses it to check Chat's open, pin, and scroll on a long save.
  - **A dev fixture starts a new game with a picked entity.** `#dev?view=gameViewer&fixture=pickedOpening` boots the white room with one picked entity whose Opening Action replaces the world's own, so the input box shows which pool the draw used.
  - **A dev hook names why a world reads as unsaved.** `__fmDev.dirtyDiff()` returns each path where the open world differs from its saved baseline, with both values, under the same comparison the Save indicator uses. An empty list means the world is clean.
  - **The contest e2e journey announces a tie through the Podium dialog and checks it on the player surfaces.** `e2e/contest-entry.spec.ts` builds a shared 1st through **Tie With Above**, then checks the contest bar, the podium band and the 1st-place badges. It runs under `npm run test:e2e`, outside the four gates.
  - **A Playwright spec measures the folder camera frame by frame.** `e2e/folder-fly-in.spec.ts` records the folder tile's and the region's rectangles once per frame and holds them to one pixel through a fly-in and a fly-out. It runs under `npm run test:e2e` in about two minutes.
  - **A shared ColorPicker component opens a saturation square, a hue bar and a hex field from a swatch.** It lives in `src/components/ui/color-picker.tsx`. Its popover is modal, so it works inside a dialog. The **Control States** reference in the design-system showcase shows it.

- **⚙️ Backend**
  - **Chip Editor:**
    - **The chip editor's Lexical library moves from 0.46 to 0.50.** It brings four releases of selection and clipboard fixes. Both behavior changes were checked against the app. 0.50 adds experimental named slots, which the **Values** tab uses.
    - **The chip editor keeps an open placeholder chip's value in a Lexical named slot.** `VariableNode` keeps its value in a `ValueBoxNode` shadow root under the `value` slot, so the field still serializes to its tokens. `OpenValuesPlugin` opens and closes chips in `history-merge` updates, so undo records no step.
    - **An open value's edges are decided by a pure module, and one plugin owns the keys.** `valueEdges.ts` cuts edge whitespace and reads whether a caret sits in an edge run, with no DOM. `ValueEdgesPlugin` registers the arrow and delete behavior. `OpenValuesPlugin` ejects edge spaces on every other caret exit.
    - **A relay carries a chip's flyout ask to the value that answers it.** `EditValueContext` holds `{ ask, asked, settle }`. `VariableChip` asks by node key, `PromptField` switches the tab, and `OpenValueChip` answers from its own mount. The ask outlives the opening render, because Lexical renders a decorator after its update listeners.
    - **A pure module computes an open value's outline and header place, and one plugin lays out the editor.** `openValueShape.ts` merges client rects into line boxes, traces them as one SVG path, and places every header in one pass. `OpenValueLayoutPlugin` feeds it measurements after every update, resize and `ResizeObserver` change.
    - **One pure rule decides an open value's active state, and the header pages over the view's position.** `activeValueKey(caretKey, fieldFocused, pressed)` lets the caret win, and with none the last header press stands. `OpenValueView` carries `pager: { index, count, step }`, so the header renders the position without parsing a string.
    - **A placeholder's pins are stops the Values tab steps onto.** `placeholderStops` lists a placeholder's values, then every pin row aimed at it, folding a pin that names a listed value into that stop. `openStopIndex` picks the stop a chip opens on. Play-time resolution never sees a step.
    - **An author draw reports which value laid each pin.** `drawPins` holds a `{ text, placeholderId, valueId }` record per pinned placeholder. `PlaceholderField` uses it to write a pin edit back to its carrying value. No export shape changes.
    - **`PromptVariantAxis` gains `readOnly` and `readOnlyHelp`.** The placeholder vocabulary returns the World | Unique axis for every known chip and marks it read-only where `placeholderRandomizes` is false. `promptVocabulary` is untouched.
  - **Native Reasoning:**
    - **One resolver fills the reasoning capability record and replaces the seven-request effort probe.** `resolveReasoningCapability(target, fetch)` walks the LM Studio, Ollama, llama.cpp and gateway model lists and returns the first record that answers. Only when none answers does it send one `reasoning_effort: "none"` request.
    - **The resolver identifies each source by its body shape, not its status code.** LM Studio answers a foreign path with HTTP 200 and an error payload. `probeMemo` records 404, 405, 415 and a 200 with an `error` key, so a foreign endpoint is asked once per session.
    - **The capability record names the endpoint's reasoning dialect, and a table spells every request.** `reasoningDialect.ts` holds one row per dialect, naming the budget key, the off spelling, and whether off is allowed. `reasoningDialectBody` writes the request slice from that row alone. The `unknown` row keeps the existing body byte for byte.
    - **`DebugEndpointInfo.reasoningFields` holds the reasoning keys each endpoint received.** The AI Context viewer reads them. A dialect that rejects off sends no reasoning field for a switched-off prompt.
    - **Reasoning is stored as a switch plus a strength and resolved per request kind.** `ReasoningSetting` and `PromptReasoningSetting` (`{ enabled, level }`) replace the plain level strings. `parseReasoningSetting` reads both shapes, so stored values and older shared presets migrate on read. `resolvePromptReasoning` returns `none` only for Inline narration.
    - **A first-party endpoint's own address names its reasoning dialect.** `reasoningIdentity.ts` holds one row per first-party API, with its hostnames and a model-id function. `reasoningIdentityAnswer(url, model)` sends no request, and `identitySource` runs first in the resolver chain.
    - **Anthropic has two dialect rows, because Claude 4.7 and later reject a manual thinking budget.** `anthropic-adaptive` sends `thinking.type: adaptive` and no budget, while `anthropic-budget` keeps `budget_tokens`. A budget under `budgetMin` is raised to it, or dropped when the output cap leaves no room.
  - **Quoted Speech:**
    - **One quote segmenter, one span class and one theme token drive the dialogue color.** `quoteSegments.ts` pairs double quotes in a run of text. `rehypeQuoteSpans.ts` wraps each quoted run in `span.dialogue-quote` after the sanitizer, skipping code. A `--dialogue` token lands in all sixteen theme blocks.
    - **`MarkdownRenderer` gains a `dialogue` prop that picks one of four module-constant plugin arrays.** This keeps Streamdown's per-block memoization intact.
    - **The quote settings write attributes on the document root, so a switch paints without a re-render.** `quoteColor` writes `data-quote-color`, and `quoteItalic` writes `data-quote-italic`. The active mode's custom color lands on the root as `--dialogue-custom`.

#### ➖ Removed

- **👤 User-facing**
  - **Audit the likes on a listing writes no audit log entry.** Staff run the check often, and each run filled the log with a **Linked accounts viewed** row. Opening **Linked** on an account in Admin Panel → Users is still logged.

#### 🔧 Fixed

- **👤 User-facing**
  - **Prompt and Placeholder Chips:**
    - **Prompt and placeholder chips share dragging and undo in Settings → Prompts and the World Editor.** A palette drop creates one placement at the drop caret, including in empty and unfocused fields. A prompt toolbar targets its own field.
    - **A chip drag shows its drop caret inside the field on the target line.** Starting a drag doesn't insert a copy at the old caret. Crossing fields clears the previous insertion indicator.
    - **Dragging a chip over its own prepend or append text leaves the chip in place.** No drop target shows.
    - **Blank affix lines show a highlighted ↵ marker in Edit.** The stored text keeps its original line breaks.
  - **Community Creations:**
    - **A creation's details open with one fade on the website.** Opening a creation on formamorph.ai dimmed the page, cleared it and dimmed it again, so the background flashed twice. The details now open once and stay open.
    - **Community Creations thumbnails stay cached between launches when you are signed in.** The launch check of your adult-content answer emptied the thumbnail caches, so every thumbnail downloaded again. The caches empty only when the warning is unanswered or declined.
  - **The narration reveal's Move, Scale and Blur effects stay visible on a fast model.** A fast stream cut each word's animation to a frame or two. **Min fade duration** defaults to 250ms. Set it to **Unlimited** for the old pacing. An install that already ran keeps its stored value.
  - **An entity that stays in the scene stays in the Entities tab while the next reply streams.** With Thinking set to **Off** or **Inline**, a new reply rebuilt the scene list. The list only gains names while a reply streams, and an entity that left goes when the reply ends.
  - **The audit log reads account deletions and privacy policy resets as sentences.** A deletion request, its cancellation, the erasure and the two privacy policy resets each read as an unrecognized action. All five have their own label and tint in the action filter.
  - **A field's Preview keeps a placeholder's drawn value when you re-spell that value on the Placeholders tab.** Every Preview shows the same value with its new spelling, where it used to draw a different one. Removing the value still draws a new one.
  - **The library editors use only the entity's or dictionary's own placeholders.** Parts of both editors read and changed the placeholders of the last world you opened. Each editor reads and writes only its own item's placeholders. The **Placeholders** tab is the one place to edit them.
  - **The Admin Panel's tabs are reachable on mobile.** Six of eight tab labels were cut off at mobile width. The row becomes a dropdown of the current section wherever the labels don't fit, as Settings does.
  - **Selected text in a stat code field is readable.** The field tinted a selection with the theme's accent color, which left the text under it hard to read. It now uses a pale tint of your system's selection color, and the selected code keeps its syntax colors.
  - **The Privacy Policy on `formamorph.ai` says what the one in the app says.** The public page had fallen a revision behind. It didn't say that a verified address receives verification and password-reset mail, or name **Resend**, which delivers it. The two texts match in full.
  - **Deleting a location in the World Editor removes it from every entity and Connection.** The delete took the location off the list only, and entities and Connections kept its id. The delete clears both, and its sub-locations move up one level. **Exit Without Saving** brings it all back.
  - **The Notes tab warns only when the narration prompt really has no Notes chip.** The warning looked for the bare `<NOTES>` text, so a chip with options showed it anyway. The tab checks the prompt the game sends.

- **🛠️ Developer tooling**
  - **Baseline Harness:**
    - **The baseline harness enters a world again.** It clicks the enter dialog's **Start game** button and the contest popup's **Got It** button. When the game screen doesn't mount, its error names the buttons and dialogs on screen.
    - **The baseline runner logs page errors, console errors and navigations.** A game screen that unmounts mid-run says why.
    - **The baseline screen scorer refuses to pad a multi-seed score with dumps from another day.** A failed run once reported a July score as a fresh one.
  - **`npm test` exits clean when every test passes.** Seven surfaces left a timer or fetch running after they unmounted, so the suite exited non-zero with every test green. Each surface stops on unmount, and a new test fails if the grid's countdown outlives its drag.
  - **World Editor connection tests find the library picker while a tutorial is open.** The confirmation helper now finds the picker by its name, so a tutorial's dialog cannot make the query ambiguous. Tutorials stay enabled, and the existing selection and connection checks remain intact.

- **⚙️ Backend**
  - **The editor's preview rolls store keeps each roll by value id and takes a directed set.** `EditorPreviewRolls.setRoll(placement, valueId)` rolls one value for one placement and bumps `version`. A World placement moves every chip of its placeholder; a Unique placement moves only itself. The session store and the Test Bench's Opening rolls still key by text.

</details>
