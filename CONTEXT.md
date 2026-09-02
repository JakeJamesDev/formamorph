# Formamorph

Browser AI text-RPG: authored worlds played through an AI narrator against any OpenAI-compatible endpoint. Glossary of project-specific terms; keep implementation details out.

## Language

**AI Stream**:
The module that turns one AI request spec into a typed async event stream (delta / reasoning / debug / done) over SSE, absorbing all endpoint protocol quirks.
_Avoid_: fetch helper, completion client

**AI Request Spec**:
The complete, plain-value description of one AI call — prompt, messages, resolved endpoint, sampler, reasoning preferences — built from a settings snapshot; everything the AI Stream needs, nothing live.
_Avoid_: request options, config

**Connection**:
An authored travel link between two locations — one-way or two-way. Where a Connection exists between a pair, it replaces that pair's implicit navigation.
_Avoid_: edge (internal only), path, route

**Auto Arrange**:
The explicit command that computes a fresh layout for a Group's direct children, optimized for Connection readability. The only automatic layout — nothing on the Locations Canvas moves without it or the author.
_Avoid_: auto layout (as a live behavior), nudge

**Entity**:
Any world inhabitant the narrator can reference — person, creature, plant, or object.
_Avoid_: character (too narrow)

**Group**:
The rendered frame of a location that contains child locations on the Locations Canvas. Containment is shown by the frame itself, never by lines.
_Avoid_: box, container

**Implicit Navigation**:
The travel a location gets for free from containment — its parent, children, and siblings — without any authored Connection.
_Avoid_: tree edges, default connections

**Like**:
One account's revocable mark on a listing. The room sees only the count; staff see the Likers behind it and can remove one.
_Avoid_: vote, favorite, star

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
