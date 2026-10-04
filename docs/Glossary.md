# 🔤 Glossary
<!-- keywords: definitions, terminology, vocabulary, jargon, meaning, what does it mean, lexicon -->

The words Formamorph uses, and what each one means. Each term links the page that explains it.

> 💡 To get a world, an entity or another listing from Community Creations, you **download** it. **Install** names something else: see [Install](#-community-creations).

## 🎮 Playing
<!-- keywords: reroll meaning, ooc meaning, llm server address, tts meaning, swipe meaning, context viewer -->

| Term | Meaning |
|---|---|
| [Formaquestion](Formaquestion) | The help window. You can ask it a question, search this guide and read each page. The **Help** tab or F1 opens it. A Tool that you turn on lets it read the world you have open. |
| [Search Source](Formaquestion#general) | One way Formaquestion finds guide sections for your question: **Keyword Search**, **AI Search** or **Semantic Search**. You turn each one on or off in **Formaquestion Settings**. |
| [Turn](How-to-Play) | One action from you and the AI's reply to it |
| [Action](How-to-Play#how-to-take-an-action) | What you write in the action box: what you do next |
| [Choice](How-to-Play#how-to-use-a-choice) | A ready-made action under the story. Select one to put its text in the action box. |
| [Continue the Story](How-to-Play#how-to-continue-the-story) | A choice that asks the story to keep going, with no new act from you |
| [Direction](How-to-Play#how-to-direct-the-story) | Text in `[square brackets]` in your action. The AI reads it as the author's instruction, not as something you do. |
| [Narration](How-to-Play#the-game-screen) | The story text the AI writes each turn |
| [Narration Layout](How-to-Play#narration-layout) | **Pages** shows one turn at a time. **Chat** shows every turn in one list. |
| [Re-generate](How-to-Play#how-to-re-generate-a-turn) | Asks the AI to write the latest turn again from the same action |
| [Rewind](How-to-Play#how-to-rewind-to-an-earlier-turn) | Goes back to an earlier turn and removes every later turn. You can't undo it. |
| [Notes](How-to-Play#notes) | Your standing facts for the AI. It reads them with every action. |
| [AI Context Inspector](How-to-Play#the-ai-context-inspector) | Shows the exact text the game sent to the AI each turn, and what came back |
| [Demo AI](Connect-Your-Own-AI) | The small free model that the browser and Android apps start on |
| [Built-In Engine](Connect-Your-Own-AI#the-desktop-engine) | The AI engine inside the desktop app. It runs a model on your own PC. |
| [Endpoint](Settings#endpoints) | The address of the AI server that writes your story. An endpoint preset saves one. |
| [Thinking Mode](Settings#reasoning) | How the AI plans a turn before it writes it: **Native**, **Inline**, **Planning** or **Staged** |
| [Scene Image](Image-Generation#scene-images) | An image of the turn, made by an image server you connect |
| [Text to Speech](How-to-Play#how-to-read-a-turn-aloud) | Reads a turn aloud with a voice model that runs in your browser |

## 🚪 Starting a Game
<!-- keywords: greeting, first message, spawn, player character, pc vs npc, scenario start -->

| Term | Meaning |
|---|---|
| [Enter World](Starting-a-Game#the-enter-world-dialog) | The dialog where you make every choice before page one |
| [Quick Start](Starting-a-Game#how-to-start-with-the-defaults) | Starts a new game with the world's defaults and no dialog |
| [Persona](Personas) | The entity you play. It gives the AI your name, your pronouns and your description. |
| [Default Persona](Personas#the-default-persona) | The persona that Enter World and Quick Start pick when nothing else decides |
| [Custom Persona](Persona-Authoring#custom-persona) | A world entity that gives traits to a player with no world persona. It takes the place of **None** at Enter World. |
| [Playable, Persona-Only, Cast](Persona-Authoring#playable-entities) | The choices of an entity's **Persona** control. **Playable**: you can play it or meet it. **Persona-Only**: it exists only when you play it. **Cast**: you only meet it. |
| [Starting Location](World-Editor-Locations#starting-location) | A location where a new game can begin. With none marked, every location is one. |
| [Starting Traits](Starting-a-Game#starting-traits) | The traits you pick at Enter World |
| [Library Additions](Starting-a-Game#library-additions) | The entities and dictionaries from your library that you add to one game |
| [Opening](World-Editor-Openings) | One way a game can start. A new game draws one opening by weight. |
| [Opening Action](World-Editor-Openings) | An opening that fills your action box. The AI writes page one from it after you send it. |
| [Opening Narration](World-Editor-Openings) | An opening that is page one itself, shown exactly as written |
| [Others Opening](World-Editor-Openings#self-openings) | The usual opening, in which the story greets you. It never draws while you play its owner. |
| [Self Opening](World-Editor-Openings#self-openings) | An opening written for playing as its owner. While you play that entity, its Self openings replace every other opening. |
| [Default Opening](World-Editor-Openings#the-default-opening) | The opening the game uses when no other opening can draw |
| [Character Customization](Avatars#character-customization) | The step after Enter World where you pick and shape your Avatar |

## 🎭 Entities and Memory
<!-- keywords: npc, character definition, recap, journal, summarization, made up character -->

| Term | Meaning |
|---|---|
| [Entity](World-Editor-Entities) | Anything in a world the narrator can name: a person, a creature, a plant or an object |
| [Story-Invented Entity](Entities#entities-the-story-invents) | An entity the story names during play that no author wrote. It joins the scene for that playthrough. |
| [Memory](Memory) | What the story keeps from older turns. Recent turns go to the AI word for word; older ones go as short memories. |
| [Memory Summaries](Memory#memory-settings) | The setting that condenses older turns into memories |
| [Let Go](Memory#why-memory-exists) | A memory the story judged not worth sending. It stays in the list, struck through. |
| [Pinned Memory](Memory#how-to-pin-or-forget-a-memory) | A memory you made the story keep. **Forget This Memory** does the opposite. |
| [Semantic Memory](Memory#memory-settings) | Sends the memories most related to your action, not only the newest |
| [Scene Recall](Memory#memory-settings) | Sends a past scene word for word when your action goes back to it |
| [Measured Clock](Memory#when-each-memory-happened) | Lets each turn's events set how much story time passes. Without it, each turn is one hour. |
| [Character Diaries](Memory#memory-settings) | First-person diary entries that each entity present writes. They shape its motivation. |

## 📚 Your Library and Saves
<!-- keywords: folder, character card, pfp, profile picture, savefile, synced copy -->

| Term | Meaning |
|---|---|
| [Library](Library) | Your worlds, entities, dictionaries and Avatars on this device, shown as tiles on the main menu |
| [Group](Library#groups) | A tile that holds other tiles of one library tab |
| [Library Item](LinkedContent#words-this-page-uses) | One entity or dictionary in your library |
| [Linked Copy](LinkedContent#linked-copies) | A world's entity or dictionary that follows a library item and takes its changes |
| [Independent Copy](LinkedContent#words-this-page-uses) | A world's entity or dictionary that follows nothing |
| [Local Replacement](LinkedContent#the-three-link-states) | A linked copy of another author's item that you edited. No update overwrites it. |
| [Entity Card](Library#how-to-export-an-entity-or-a-dictionary) | An exported entity: a `.webp` image of its portrait with the entity's data inside |
| [Save](Saves-and-Backup) | One game's progress, with every turn, your notes and your memories |
| [Autosave](Saves-and-Backup#autosave) | The save slot that each world gets, written after every turn |
| [Backup](Saves-and-Backup#the-backup--restore-dialog) | One file with your worlds, saves, library entities and library dictionaries |
| [Avatar](Avatars) | A 3D model of you, the player, from a VRM file |
| [Permissive License](Avatars#the-permissive-license) | A VRM license that allows every use the community needs. An Avatar needs it to publish. |
| [Profile Image](Avatars#avatars-3d-models-and-profile-images) | The image on your Community Creations account. It is not an Avatar. |

## 🌐 Community Creations
<!-- keywords: workshop, upvote, dlc, flag, moderation, competition, guest, dependency -->

| Term | Meaning |
|---|---|
| [Listing](Community-Creations#the-details-window) | One published item on Community Creations: a world, entity, dictionary, Avatar or prompt preset |
| [Download](Community-Creations#what-a-download-does) | Gets a listing into your library or your Settings |
| [Publish](Community-Creations#publishing) | Sends your item to Community Creations as a listing |
| [Publish Size](Test-Bench#issues) | How much of the publish limit an item uses. Each kind of listing has its own limit. |
| [Source](LinkedContent#words-this-page-uses) | The published listing that a copy of an entity or a dictionary follows |
| [Required Content](LinkedContent#publishing-a-world) | A source that downloads with a world. Its author marked it **Include as required**. |
| [Add-on](LinkedContent#words-this-page-uses) | A published entity or dictionary offered for a world. You choose whether to download it with the world. |
| [Like](Community-Creations#likes) | One account's mark on a listing. Select the heart again to take it back. |
| [Anonymous Like](Community-Creations#anonymous-likes-and-claim) | A Like given without an account. It belongs to your Install and counts the same as a Like. |
| [Install](Community-Creations#anonymous-likes-and-claim) | One copy of the app's stored data, such as one browser on one device. Each copy is a separate Install. It is never the word for getting a listing. |
| [Claim](Community-Creations#anonymous-likes-and-claim) | When you log in, your Install's Anonymous Likes move to your account |
| [Listing Changelog](Community-Creations#the-listing-changelog) | The author's update history on a listing. It is not the app's own changelog. |
| [Report](Community-Creations#reports-and-outcomes) | A private message to staff that a listing, a comment or a profile breaks the rules |
| [Outcome](Community-Creations#reports-and-outcomes) | How staff closed a Report: action taken, or dismissed |
| [Contest](Community-Creations#contests) | An event where authors enter worlds and players like them. Staff announce the results. |

## 📜 Prompts and Tools
<!-- keywords: function calling, macro, variable, plugin, instruction set, system message -->

| Term | Meaning |
|---|---|
| [Prompt](Prompts#the-prompts) | The text the app sends to the AI for one request, such as **Narration** or **Choices** |
| [Prompt Preset](Prompts#prompt-presets) | One full set of prompts with their options |
| [Chip](World-Editor-Placeholders) | A box in text that the app fills with a value. In world text, a chip places a placeholder. In a [prompt](Prompts#the-chip-editor), it places game data, such as your stats. |
| [Request Anatomy](Prompts#anatomy) | A labeled map of every message in one request, which marks the text you typed |
| [Custom Prompts](Prompts#world-prompts-and-the-diff-viewer) | A world's own narration, choices or stats prompt, which replaces yours while you play it |
| [Tool](Tools) | A function the AI can call during a request to get information it does not have. A Tool only reads. Formaquestion has its own list of Tools, which you switch on and off on this device. |
| [Tool Handler](Tools#handler) | The part of a Tool that runs when the AI calls it: **Lookup**, **Template** or **Script** |

## 🛠️ Building a World
<!-- keywords: world info, attribute, perk, random table, room, zone, authoring vocabulary, creator terms, script, inheritance -->

| Term | Meaning |
|---|---|
| [World](World-Editor-Overview) | An authored game: its locations, entities, stats, traits, dictionaries and openings |
| [World Editor](WorldEditor) | Where you build and change a world |
| [Simple and Advanced](WorldEditor#editor-modes) | The two modes of the World Editor and of Settings. Simple hides fields; it never removes them. |
| [Authoring Tour](WorldEditor#the-authoring-tour) | A guided run in which you build a new world one field at a time |
| [In Play](WorldEditor#the-authoring-tour) | The Authoring Tour's pane. It shows where a field appears in play and what each prompt reads from it. |
| [AI-Facing, Player-Facing](World-Editor-Entities#descriptions-and-summaries) | The AI reads only the AI-Facing fields. The player reads only the Player-Facing ones. |
| [Location](World-Editor-Locations) | A place in the story. The player is always in one location. |
| [Sub-Location](World-Editor-Locations#nesting-is-the-ais-map-not-the-players) | A location nested inside another. Nesting decides where the story can move the player. |
| [Connection](World-Editor-Locations#connections) | A travel link you make between two locations, one-way or two-way |
| [Travel Hint](World-Editor-Locations#travel-hints) | Text that tells the AI how the player makes one trip of a Connection |
| [Locations Canvas](World-Editor-Locations#list-and-canvas) | The visual view of the **Locations** tab, with boxes for locations and arrows for Connections |
| [Auto Arrange](World-Editor-Locations#list-and-canvas) | The canvas command that lays out boxes for you. Nothing on the canvas moves without it or you. |
| [Map](How-to-Play#the-change-location-dialog) | The read-only canvas the player sees in game, on the **Map** tab |
| [Stat](World-Editor-Stats) | A number that describes the player, between a **Min** and a **Max** |
| [Stat Descriptor](World-Editor-Stats#stat-descriptors) | A word the AI gets for a band of a stat's values |
| [Regen](World-Editor-Stats#the-fields) | The amount a stat changes for each hour of story time |
| [Stat Code](StatCodeGuide) | JavaScript that a stat runs each turn, in its **Before the AI** and **After the AI** boxes |
| [Trait](World-Editor-Traits) | A fact about the player or an entity, such as a class or a fear |
| [Acquired](StatCodeGuide#traits) | A trait the player has. A trait switched off is still acquired. |
| [Trait Modes](World-Editor-Traits#mode) | **Optional**: the player chooses. **Always On**: active while its requirements hold. **Hidden**: Always On, and the player never sees it. |
| [Curse](World-Editor-Traits#curses) | An Always On trait that requires the cursed item |
| [Pick Count](World-Editor-Traits#pick-count) | How many traits the player must and can pick from a group: **Any**, **Exactly One**, **Up to One** or **Custom** |
| [Requirement](World-Editor-Traits#requirements) | A trait, a group or a persona that a trait needs before it is available |
| [Bearer](World-Editor-Traits#whose-trait-counts) | The entity that has a trait. You are the bearer **You**. |
| [Blueprint](World-Editor-Traits#blueprints) | A trait or [placeholder](World-Editor-Placeholders#blueprints) in the **Blueprints** group. It exists to be linked or copied. |
| [Link](World-Editor-Traits#links) | Gives a Blueprint trait to an entity. It reads the Blueprint live until you change a field. |
| [Original](World-Editor-Traits#links) | The Blueprint trait or group that a Link points at |
| [Copy](World-Editor-Placeholders#copies) | An entity's own version of a Blueprint placeholder. It reads the Blueprint live until you change a value. |
| [Override](World-Editor-Traits#overrides) | One field that a Link or a Copy sets for itself. **Reset** returns one; **Reset to Blueprint** returns all. |
| [Detach](World-Editor-Traits#detach) | Turns a Link into the entity's own trait, which no longer follows the Original |
| [Placeholder](World-Editor-Placeholders) | A named value with a list of values, which you place in world text as chips |
| [Wildcard, Object, Variable](World-Editor-Placeholders#kind) | A Wildcard shows one value picked at random. An Object shows all its values. A placeholder with one value is a Variable. |
| [Roll](World-Editor-Placeholders#the-roll-stays-for-the-playthrough) | The value a Wildcard draws when a game starts. The save keeps it. |
| [World or Unique](World-Editor-Placeholders#world-or-unique) | Every World chip of a placeholder shows the same roll. Each Unique chip rolls on its own. |
| [Draw Weight](World-Editor-Placeholders#draw-weight) | How often a value comes up, compared with the others. Weight 0 never draws it. |
| [Pin](World-Editor-Placeholders#pins) | Holds a placeholder at one value while its source is active: a stat band, a location, a trait or a value |
| [Player Name, Character Name](World-Editor-Placeholders#built-in-chips) | The two built-in chips. Type `{{user}}` for your name, or `{{char}}` for the entity that owns the text. |
| [Dictionary](World-Editor-Dictionary) | A world's lorebook. Its entries reach the AI only when a keyword matches. |
| [Book](World-Editor-Dictionary#books) | A group of dictionary entries. A library dictionary is one book. |
| [Entry](World-Editor-Dictionary#the-entry-panel) | One piece of lore: **Trigger Keywords** and the **Value** the AI gets |
| [Scan Depth](World-Editor-Dictionary#matching) | How many earlier messages the game scans for an entry's keywords |
| [Semantic Lore](World-Editor-Dictionary#semantic-lore) | Activates dictionary entries by meaning, as well as by keyword |
| [Test Bench](Test-Bench) | The World Editor's place to check a world without the AI |
| [Bench Popover](Test-Bench#the-bench-popover) | The first view of the Test Bench, with the World Doctor's list only |
| [Instrument](Test-Bench#the-full-panel) | One tab of the Test Bench. Each one answers one question about your world. |
| [World Doctor](Test-Bench#issues) | The Instrument that checks your world's structure and lists the issues |
| [Activation Tester](Test-Bench#triggers) | The Instrument that shows which entities and dictionary entries a text makes fire |
