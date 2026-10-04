# Formamorph

Browser AI text-RPG: authored worlds played through an AI narrator against any OpenAI-compatible endpoint. Glossary of project-specific terms; keep implementation details out.

## Language

**AI Stream**:
The module that turns one AI request spec into a typed async event stream (delta / reasoning / debug / done) over SSE, absorbing all endpoint protocol quirks.
_Avoid_: fetch helper, completion client

**AI Request Spec**:
The complete, plain-value description of one AI call — prompt, messages, resolved endpoint, sampler, reasoning preferences — built from a settings snapshot; everything the AI Stream needs, nothing live.
_Avoid_: request options, config

**Tool**:
A function the AI may call during a request to get information it does not have, such as an entity's full entry. Defined once in settings, enabled per prompt preset, and offered only to the prompts it names, and only on endpoints known to support tools. Read-only: a Tool never changes the world or the playthrough. A Formaquestion Tool is the same shape in a second list, switched per device for the help request.
_Avoid_: function (wire-format word), instrument (a Test Bench part)

**Formaquestion Tool**:
A Tool of the player's own that the help answer request offers. A separate list from the gameplay Tools, with a switch per device and no prompt preset; the gameplay Tool store never holds one, and a gameplay Tool never shows in Formaquestion. It reads the open world in the game or the editor, and an empty Tool Snapshot on every other screen. Imports and exports with the Tool pack file. Cannot take a fixed function's name, such as the guide lookup's.
_Avoid_: help Tool, custom Tool, assistant Tool

**Tool Handler**:
The part of a Tool that runs when the AI calls it: a Lookup (searches world data), a Template (returns chip text), or a Script (sandboxed code that reads the world and the current scene).
_Avoid_: resolver, source

**Formaquestion**:
The help window that a player can open on every screen. It holds the player docs, a search over them, and a field to ask a question that the connected AI answers from the docs. It only answers: it never navigates and never edits a world, a save or a setting. A request carries the docs and the current Surface, and nothing from a world or a save, unless the player turns on a Formaquestion Tool, which reads the open world.
_Avoid_: help chat, assistant, help bot, wiki (the web copy of the docs)

**Mascot**:
The optional character beside the Formaquestion chat. It is a rig: a base image and an ordered list of layers, each an expression (one at a time, picked by the AI through the face call) or a state (any number stacked), each drawing its overlay images in order. The app sets its look at three moments through the Initial Look, Idle Look and Thinking Look rows, each a pick of one expression and one state. A Mask, dragged on the Preview, sets the head view. A transition (None, Dissolve or Jelly) moves it on each change of look. On by default, and it implies the minimal chrome. Exports as a mascot card.
_Avoid_: avatar, assistant character, sprite

**Voice**:
The Mascot's prompt text, the **Voice** row of the Mascot tab: the line the Mascot Voice help chip sends while the mascot is on, so the answers sound like the character. Travels in the mascot card.
_Avoid_: persona (the player-slot entity), personality, tone setting

**Docs Index**:
The player docs bundled into the app, split into sections at their headings, with three operations: list the contents, search by keyword, and get sections by id. It needs no network and no model. Help topics are not in it.
_Avoid_: knowledge base, embeddings, docs database

**Search Source**:
One way a help question finds its docs sections, with its own on/off switch in the help session: Keyword (the Docs Index search), AI Search (one request in which the model chooses sections from the guide's headings), or Semantic (sections ranked by meaning, with the embedding model on the device). The rankings of the sources that are on merge into one. The Search tab uses Keyword alone.
_Avoid_: retriever, provider, search mode, lookup (the docs lookup function of lookup mode)

**Surface**:
A screen, a dialog or a tab that a player can have open, named by one id. The surface registry holds the ids that are open now, and the surface map ties each player-facing id to the docs section that explains it.
_Avoid_: view, page, route (dev-router words), screen (one kind of Surface)

**Connection**:
An authored travel link between two locations — one-way or two-way. A Connection has one leg per direction of travel, and each leg carries its own optional Travel Hint. The narrator gets the hint of the leg the player travels. Where a Connection exists between a pair, it replaces that pair's implicit navigation.
_Avoid_: edge (internal only), path, route

**Auto Arrange**:
The explicit command that computes a fresh layout for a Group's direct children, optimized for Connection readability. The only automatic layout — nothing on the Locations Canvas moves without it or the author.
_Avoid_: auto layout (as a live behavior), nudge

**Entity**:
Any world inhabitant the narrator can reference — person, creature, plant, or object.
_Avoid_: character (too narrow)

**Persona**:
The entity that fills the player slot for a playthrough. It comes from the player's library or from the world's entities that carry the Persona mark. A save names one, or an explicit None.
_Avoid_: player character, user, the Mascot's Voice

**Opening**:
One authored way to start a playthrough, with a draw weight. A world holds an ordered list of them, and a new game draws one by weight. With nothing to draw, the shipped default opening applies. Each Opening is an Opening Action or an Opening Narration, and an Others Opening or a Self Opening.
_Avoid_: cue, opening cue, greeting, first message (the SillyTavern term)

**Opening Action**:
An Opening that fills the player's input box at Start Game. The player can edit it before they send it, and the AI writes page one from it.
_Avoid_: player action (unqualified), prompt

**Others Opening**:
The usual Opening: one of the world's own, or one in which an entity greets the player. An entity's Others Openings never draw while the player plays that entity. Every Opening is one unless it is marked Self.

**Self Opening**:
An Opening written for playing as its owner, an entity with the Persona mark. While the player plays that entity, its Self Openings replace every other Opening in the draw. An entity without the Persona mark keeps its Self Openings, but they never draw.
_Avoid_: persona opening, own opening

**Opening Narration**:
An Opening that is page one itself. Its text shows as written, and no narration request goes out for it.
_Avoid_: scripted opening, greeting

**Starting Location**:
A location where a new game can begin, flagged by its author. When no location is flagged, every location is one. An entity's openings count only when the entity is at the player's Starting Location.
_Avoid_: start location, spawn point

**Avatar**:
A VRM 3D model — in the local Model Library, chosen for a world, or published as a listing. The kind id in code is `model`; "avatar" in code means Profile Image.
_Avoid_: model (in copy), VRM (the file format, not the thing)

**Profile Image**:
The image on an account, shown beside a username. Code calls it an avatar; copy never does.
_Avoid_: avatar (in copy), profile picture, user image

**Supporter**:
An account linked to a Patreon membership at the $5 tier. The server reads the tier from Patreon and keeps it current.
_Avoid_: patron, subscriber, donor, backer

**Supporter+**:
The $10 tier. It has its own badge style, its own name color, and the top section of the Supporters wall.
_Avoid_: premium, pro, supporter plus (in copy)

**Supporter Flair**:
What a Supporter shows to other people: a badge, a tier name color, a Profile Image ring, and a place on the Supporters wall. One toggle, **Show Supporter Flair**, hides all of it. No feature depends on it, and a staff account shows only its staff badge.
_Avoid_: perks, rewards, supporter status

**Supporters wall**:
The page on formamorph.ai that lists linked accounts with a tier, Supporter+ first and longer tenure first. It never lists a Patreon member who did not link.
_Avoid_: hall of fame, donor list, credits

**Patreon link**:
The tie between one Formamorph account and one Patreon user, made in the account settings after the member approves it on Patreon. Unlink removes it at once.
_Avoid_: Patreon login, connection (the AI endpoint word), integration

**Permissive License**:
The verdict that a VRM's embedded 1.0 metadata grants every right the community catalog needs — everyone may use it, it may be redistributed, modified copies may be redistributed, and commercial use is allowed. Read from the file, never declared. A gate on publishing, not a badge.
_Avoid_: license check (the act), open license, free

**Group**:
The rendered frame of a location that contains child locations on the Locations Canvas. Containment is shown by the frame itself, never by lines.
_Avoid_: box, container

**Implicit Navigation**:
The travel a location gets for free from containment — its parent, children, and siblings — without any authored Connection.
_Avoid_: tree edges, default connections

**Like**:
One account's revocable mark on a listing. The public count is the sum of Likes and Anonymous Likes. The room sees only that number; staff see the Likers behind it and can remove one.
_Avoid_: vote, favorite, star

**Install**:
One copy of the app's local storage, named by a random id. Made on first need, never shown, never put in a URL. It names a copy of the app, not a person and not a device.
_Avoid_: device, client id, install id (the id is the Install)

**Anonymous Like**:
One Install's revocable mark on a listing, given without an account. It counts toward the public number exactly as a Like does. Code names the actor rather than the mark: a "guest like" is a press, an Anonymous Like is what it stores.
_Avoid_: anonymous vote, guest vote

**Claim**:
Moving an Install's Anonymous Likes to an account, and linking the two. It runs when somebody signs in, and the link is what stops signing out from giving a second like.
_Avoid_: merge, migrate, transfer

**Liker**:
The account behind one Like, as the staff list shows it — with how old the account was at the moment it liked.
_Avoid_: fan, voter

**Listing Changelog**:
The author-maintained update history on a published listing (any kind) — a date-sorted list of Changelog Entries, newest first. Listing metadata, not world content: it never travels with downloads or exports, and editing it never marks the listing as updated.
_Avoid_: changelog (unqualified — that's the app's own changelog), version history

**Changelog Entry**:
One item in a Listing Changelog: an author-chosen title, a markdown body, and an author-set date. Fully editable and deletable by the author after the fact.
_Avoid_: release note, version

**Locations Canvas**:
The visual node-graph surface for authoring locations — containment as nested Groups, travel as arrows. The list view's spatial twin inside the same Locations panel.
_Avoid_: node graph, map view

**Map**:
The player-facing readonly twin of the Locations Canvas, shown during play — same layout and arrows, no editing. Clicking a location travels there.
_Avoid_: canvas (authoring term), world map

**List Editor**:
The one editor shell every authoring list runs on: a search box with the **+** control, the tree (or a flat list of matches while a search is typed), and the selected item's detail. Each list plugs in what it shows and how it adds. A panel or modal shows the detail beside the list or pushed over it.
_Avoid_: list-detail (that is only the layout), master-detail, list manager

**Report**:
A signed-in user's one-shot ticket flagging a Report Target to staff — a category plus optional details. Never public, never a conversation; it ends in exactly one Outcome.
_Avoid_: flag, feedback (that's bug/suggestion)

**Report Target**:
The thing a Report points at — a listing (any kind), a comment, or a user profile — captured by snapshot at report time so the ticket outlives the content's deletion.
_Avoid_: subject, reported item

**Outcome**:
The recorded resolution of a Report: action taken, or dismissed. Delivered to the reporter as an inbox message with an optional staff note; never names the specific moderation action.
_Avoid_: verdict, resolution status

**Test Bench**:
The World Editor's testing surface hosting every authoring instrument, available in both editor modes. Reached through the Bench Popover for quick triage, or as a full panel that is either embedded in the editor's list panel or docked beside it (mobile: Sheet). Shows what the harness computes from the authored world, never what the AI will do with it.
_Avoid_: World Lab, dock (that's one chrome, not the feature)

**Bench Popover**:
The Test Bench's quick-triage chrome — the flask button's first stop, hosting only the World Doctor's findings list so an author with a few issues resolves them without opening the full panel.
_Avoid_: mini bench, quick view

**Instrument**:
One tool inside the Test Bench — the World Doctor, the Activation Tester, an inspector. Each answers one author question.
_Avoid_: tool (overloaded), panel

**World Doctor**:
The Test Bench instrument that lints the authored world's structure — findings grouped by severity, some one-click fixable, surfaced by a count badge. Never judges prose.
_Avoid_: linter (internal only), validator

**Activation Tester**:
The Test Bench instrument where an author pastes prose and sees what would fire — entity presence and dictionary activation — including non-activations with their near-miss reason.
_Avoid_: matcher preview, dry run

**Authoring Tour**:
A guided run through the World Editor's Simple tabs in which a new author builds a new world one field at a time, seeing each field's effect in the In Play pane.
_Avoid_: tutorial world, walkthrough, world-building tutorial

**In Play**:
The Authoring Tour's pane for one field: the player surface it appears on and the text each AI prompt reads from it, with the author's own text marked. Shows computation only, never model output.
_Avoid_: effect preview, preview pane

**Turn Pipeline**:
The module that runs one full turn — plan, AI requests, commit computation — behind one seam; React state stays outside it.
_Avoid_: turn handler, game loop

**Turn Plan**:
The pure, plain-value output of planning a turn: which passes run, with what prompts and token caps.
_Avoid_: turn config

**Turn Commit**:
The computed state delta a finished turn applies — history, clock, stats, discoveries.
_Avoid_: turn state, commit object

**Request Anatomy**:
The labeled map of one assembled request — every message split into runs and marked as either the player's own prompt text or context the app assembled. Rendered in the AI Context viewer for real turns, and in Settings → Prompts → Narration → Anatomy for an example one built under the player's live generation settings. A sidecar alongside the messages, never part of them, so it never reaches an endpoint.
_Avoid_: request breakdown, prompt map

**Authored Run**:
A stretch of a message that came from one of the six prompt-editor surfaces a player can type in — System Prompt, User Message, Recap, Now, Recall, Direction. Highlighted and named by the field that owns it.
_Avoid_: user text, prompt segment

**Context Run**:
A stretch of a message the app assembled rather than the player writing — injected world data, condensed memories, a recalled scene, an earlier turn, the typed action. Muted beneath the Authored Runs, each explained in the player's own words.
_Avoid_: filler, scaffolding

**Chip Scene**:
The plain-value snapshot of one moment that chip values are built from: the world overview, the stats and traits in force, the persona, the location with its neighbors and connections, the roster with who is present and who is in scene, the lore entries, the notes, the time, and the placeholder resolution. Play supplies a live one, the editor an authored one, the Settings preview a sample one.
_Avoid_: context, view, snapshot (unqualified)

**Chip Values**:
The module that turns a Chip Scene into a value for every chip token the registry defines, walking the registry's axes so no token can be missed. Per-turn tokens (Player Action, Narration, Character Name, Subject, activated lore) are not scene-derived and come from the pass records or the sample turn instead.
_Avoid_: context values, value map

### Placeholders

**Placeholder**:
An author-defined named value with a list of values, placed into world text as Chips. Its kind is a Wildcard (one value drawn per playthrough) or an Object (every value shown); a single value makes it a Variable either way.
_Avoid_: variable (unqualified), template, macro

**Chip**:
One placement of a Placeholder inside authored text, carrying its own mode (World or Unique) and, optionally, a path into the Placeholder's Parts.
_Avoid_: token (internal only), tag, insert

**Roll**:
The value a playthrough draws for a Wildcard, made once at Enter World and kept for that playthrough. World Chips share one Roll per Placeholder; each Unique Chip draws its own.
_Avoid_: random value, draw (the act only), selection

**Pin**:
A source holding a Placeholder at one fixed value while the source is active: a trait that is on, the current location, the stat band a stat sits in, or a Placeholder value that is the effective value of its Placeholder. A Pin masks the Roll underneath and never replaces it, so the Roll returns when the source goes off. A stat band outranks a location, a location a trait, a trait a value Pin.
_Avoid_: override, lock, fixed value

**Placeholder Set**:
The read side of a list of Placeholders, bound once to whichever list a text is read against: a world's, or the list an off-world entity or dictionary carries. It answers what a text describes at design time and, given a playthrough's Rolls, what it resolves to.
_Avoid_: placeholder list, defs, vocabulary (that is the editor's chip menu)

**Placeholder Store**:
The write side of the same list: the editing operations the placeholder widgets need, bound to whichever list is being edited.
_Avoid_: placeholder context, editor state

**Acquired**:
A trait the player has — chosen at creation or picked up in play. A trait the player switched off is still Acquired.
_Avoid_: held

**Link**:
A node in an entity's trait tree that points at an Original and reads it live until edited. The Original is always a Blueprints item; a top-level item dropped on an entity moves in instead. Its Overrides are its own: default-on, requirements, pins, Player Can Toggle and stat changes, per Original trait. A Link is not a trait.
_Avoid_: shared trait, reference, copy; linked copy (that is a library item's world copy)

**Blueprint**:
A world trait or placeholder that exists to be linked or copied. A Link or a Copy reads its Blueprint live until edited. An Original is a Blueprint trait.
_Avoid_: template, master, source

**Copy**:
An entity-owned placeholder that reads a Blueprint placeholder live, under the Blueprint's value ids. Its Overrides reword, reweight or remove one value at a time; its own values sit beside. Always named after its Blueprint; one per Blueprint per owner.
_Avoid_: instance, clone, bearer placeholder

**Override**:
One field a Link or a Copy sets for itself, stored with the Blueprint's value it was made against. A field with no Override reads the Blueprint live. **Reset** returns one field; **Reset to Blueprint** returns them all. An Override is stale when the Blueprint changed that field since.
_Avoid_: local value, patch, delta

**Bearer**:
An entity whose trait tree holds a trait, directly or through a Link. The played persona is the Bearer "You"; so is the entity with the **Custom Persona** mark under None and a library persona. Requirements and pins resolve per Bearer.
_Avoid_: owner (an owner holds its own traits only), holder

**Original**:
The world trait or group a Link points at, at the root or under Blueprints. An Original is a Blueprint trait. An entity's own trait is never an Original.
_Avoid_: source (a listing's term), template, parent

**Always On**:
A trait Mode. The trait is active exactly when its gate holds, and no one can switch it: not the player, not Stat code. With no requirements it is always active. A curse is an Always On trait that requires the cursed item. Always On traits count toward their group's Pick Count.
_Avoid_: forced, mandatory, locked (a Locked trait is one whose gate fails), permanent

**Hidden (trait)**:
A trait Mode that is Always On and never shown to the player. The AI reads it like any active trait. Only dev tools, the Prompt viewer and Test Bench show its name. Its Stat changes apply.
_Avoid_: secret, invisible, silent

**Pick Count**:
A trait group's minimum and maximum number of picks, counting only traits placed directly in the group. The presets are Any, Exactly One, Up to One and Custom. Up to One is a maximum of 1 and renders radio buttons.
_Avoid_: exclusive (the old flag), limit, quota, selection count
