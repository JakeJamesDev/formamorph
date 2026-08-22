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
