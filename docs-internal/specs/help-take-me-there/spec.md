# Spec: Help Take Me There

Status: done
Status note: Closed 2026-10-04. Tickets 01–08 done; last landing ac9cba55. Closed without gates.
Spec session: help-take-me-there — spec

## Problem Statement

A Formaquestion answer tells the player where a control lives: "open Settings, then the Endpoint tab". The player then closes or moves the help window and hunts for the screen. Nothing in the answer opens it. The Formaquestion spec named a deep link as a later effort (its Q3). This is that effort.

An AI-driven jump is not an option for most players: the default cloud endpoint refuses every function call, so a navigate function would only ever fire on local models.

## Solution

Every how-to section in the player docs carries a **route**: the id of the screen, dialog or tab it explains. When an answer's top source (its first source other than the open screen's lead, Q37) carries a route, the answer gets a **Take Me There** button beside its Sources expander. A click opens that surface. Leaving a running game, or a World Editor with unsaved edits, asks first. On desktop the help window stays open above the new surface; on mobile the sheet closes.

No AI call is involved. The link is derived from the docs, so it works on the cloud, costs no tokens, and never fires on a question the model misread.

A probe scores the keyed task and here questions offline: does the keyed section's route match the surface the question is about. The first run reports; the user sets the bar after.

## Rulings

Settled with the user on 2026-10-04, numbered with the `formaquestion-pass-two` grill.

| # | Ruling |
|---|---|
| Q7 | The link is appended from the docs, never from an AI call. An AI-driven variant may follow once the link proves itself |
| Q18 | An answer carries the link whenever its top source section has a route. No question-kind filter |
| Q19 | The link may open any surface. Leaving a running game or an editor with unsaved work asks first |
| Q20 | The route probe reports first. The user sets the bar after the first run |
| Q23 | The button sits beside the Sources expander in the answer's footer row, in both chromes |
| Q24 | After navigating, the desktop window stays open. The mobile sheet closes |
| Q25 | Ticket 01's first route data covers the Settings, Prompts and Tools pages. A how-to there gets the surface it describes, even one outside Settings; one with no single surface gets no line and a listed reason. Every other page is ticket 03's (2026-10-04, ticket 01 question) |
| Q26 | A surface bound to an item the request cannot name (an entity panel, a publish dialog, an editor item panel) resolves to its nearest openable ancestor (ticket 02 question) |
| Q27 | A World Editor surface opens the editor on the selected library world. With no world selected it opens the Library screen; a help jump never creates a world (ticket 02 question; spec-session call, flagged to the user) |
| Q28 | The editor's unsaved prompt runs only when a request would close the editor. Settings and the help window stack over it; another editor tab only switches the tab (ticket 02 question) |
| Q29 | A game surface requested while no game runs opens the Load Game dialog (ticket 02 question) |
| Q30 | Formaquestion surfaces resolve as view-any. The help window consumes them itself: it switches its tab or opens its own Settings. Ticket 02 ships the resolver entries; ticket 04 ships the consuming side (ticket 02 question) |
| Q31 | From a running game, a World Editor surface opens the in-game editor on the game's world, with no leave prompt. The leave prompt is only for surfaces the game screen cannot host (ticket 02 question) |
| Q32 | A request for a tab that Simple mode hides switches to Advanced for the session without saving the mode, so the control is on screen (ticket 02 finding, consistent with story 13) |
| Q33 | From a game with a dirty in-game editor, a main-menu request asks Exit to Main Menu first, then the editor's unsaved prompt. Either refusal changes nothing (ticket 02 finding, under Q19 and Q28) |
| Q34 | A keyed question's expected surface may be "none". None scores a hit when the keyed section has no route and a miss when it carries one. The report lists none-expected rows as their own line per kind, so the bar can cover surfaced questions alone or all of them (ticket 05 question) |
| Q35 | A flagged answer (not from the guide) gets no button: its top source is not what it describes (ticket 04 question) |
| Q36 | The button renders only on an answer whose status is answered. A stopped answer, a failed one or the no-AI fallback gets none. "Top source" is the first source of the done event: the looked-up section in lookup mode, else the first prompt section. A route the resolver refuses shows no button (ticket 04 question) |
| Q37 | "Top source" skips the open screen's lead section: the route comes from the first source that is not the lead, as the follow-up topic rule does; the lead counts only when it is the only source. Refines Q36. Found in use 2026-10-04: with Use the Open Screen on, the lead led the sources and the button never showed. Ticket 07 |
| Q38 | A walkthrough section with numbered steps carries a route and names its tab in its first lines, like a how-to. Found in use 2026-10-04: "Example: RPG Classes" was the top hit for a class question, had no route, and never said Traits, so the answer copied the example without the tab. A scan of every stepped non-how-to section found it to be the only walkthrough; the rest describe mechanics. Docs pass on main, with the recall probe |
| Q39 | The route bar is 90% over surfaced task questions. Here questions and none-expected keys are reported, never gated (2026-10-04) |
| Q40 | A reference section the surface map ties to a screen, dialog or tab carries that surface's route, so a "what is this panel" answer gets the button. Reopens Q38's how-to-only rule. A source test keeps the map and the lines in step |
| Q41 | A how-to routes to the deepest surface its steps use, not the parent screen. Four parent routes from ticket 05's miss table move down |
| Q42 | The route stops at the first non-lead source. A fall-through to the first routed sent section is held until the docs fixes rerun the probe |
| Q43 | Judgment calls from tickets 01 and 03 stand unless asked one by one. Q44–Q47 are the ones asked |
| Q44 | "How to Turn On Tools" routes to the Output tab, where its first step is |
| Q45 | "How to Add a Self Opening" routes to the entity's Openings tab; with no entity open it lands on the Entities tab (Q26) |
| Q46 | "How to Enter a Contest" stays on the Publish dialog's World tab |
| Q47 | "How to Publish a Prompt Preset" stays on the preset's Overview |
| Q48 | A route line sits only at the index's section level (`#` and `##`). The index splits no deeper, so a line under a `###` heading would fold into its parent and the first line would win; the index refuses a line that is not directly under its section's heading, and the source test checks surface-map targets at section level only (38 targets are `###` and get no line). A parent that describes one screen or dialog gets its own route on purpose, naming the common ancestor, never a child's route by accident (ticket 08 question; (b), splitting at a routed `###`, was refused because it changes section ids and the pick list) |

## User Stories

1. As a player, I want a Take Me There button on an answer, so that I reach the screen it describes with one click.
2. As a player, I want the button only when the answer knows where to go, so that it never leads nowhere.
3. As a player, I want the button beside Sources, so that it is in the same place on every answer.
4. As a player, I want the button to open a Settings tab directly, so that I do not click through the modal.
5. As a player, I want the button to open a Library screen or an editor dialog, so that every surface is reachable.
6. As a player in a game, I want a question before the link leaves my game, so that a click does not cost me my turn.
7. As a player with unsaved editor work, I want the editor's own unsaved prompt first, so that nothing is lost.
8. As a player on desktop, I want the help window to stay where it is after the jump, so that I can keep reading the steps.
9. As a player on mobile, I want the sheet to close after the jump, so that I see the surface.
10. As a player, I want the button to be a real button with a name, so that a screen reader announces it.
11. As a player on the cloud endpoint, I want the button as often as a local player gets it, so that the feature does not depend on my model.
12. As a player, I want a route that no longer exists to show no button, so that I never land on an error.
13. As a player, I want the jump to open the exact tab, not just the dialog, so that the control is on screen.
14. As a player already on that surface, I want the click to do nothing harmful, so that a repeat click is safe.
15. As a doc author, I want one comment line per section to set its route, so that routes live next to the text.
16. As a doc author, I want a source test to refuse an unknown surface id, so that a typo fails the build.
17. As a doc author, I want a route to inherit to a section's parts when the index splits it, so that long sections keep one tag.
18. As the user, I want a route-accuracy report over the keyed questions, so that I can set a bar from numbers.
19. As the user, I want the probe to run offline without a model, so that it is free and repeatable.
20. As the user, I want the AI Context popup to show the route the answer chose, so that I can see why a button appeared.
21. As a player, I want the button text in the help voice, so that it reads like the rest of the window.
22. As a player, I want the button to survive the answer's reveal animation, so that it appears once the answer is done.

## Implementation Decisions

### Route tags in the docs

- A how-to section carries one HTML comment line, the same shape as the keyword line: `<!-- route: <surface id> -->`. The id is a surface id from the surface map: a screen or dialog name, or `<ledger key>.<tab>`.
- The docs index parses the line as it parses keywords, strips it from the section text, and stores it on the section. A section cut at block boundaries by the size split passes it to every part; a section cut at sub-headings keeps it on the heading that holds the line, as keyword lines do. A section without a line has no route. A second route line in one section, or an empty one, is refused.
- **Ticket 01 landed 2026-10-04 (`99c71351`).** 15 routes: Settings 6, Prompts 6, Tools 3. "How to Turn On Tools" has no line: it spans the Output and Tools tabs. Calls open to a one-line edit: "How to Publish a Prompt Preset" → the preset Overview (the publish dialog is item-bound); "How to Use a Preset for One World" → the Enter World dialog. No recall probe: comment lines change no section text; ticket 03 owns it.
- **Ticket 03 landed 2026-10-04 (`c1ad452b`).** 178 how-to sections: 165 routed, 13 without (cross-screen flows, any-prose-field how-tos, Android install and picker, the WorldFormat JSON edits). Rule used: a route names the surface where the steps happen; steps across sibling tabs take the parent surface; a "See …" cross-reference is not a step. Recall probe, cloud, 5 runs: known 84.5% → 84.3%, blind 88.7% → 89.8%, inside run-to-run drift; the pick request's 506 headings are unchanged. Ten judgment calls are listed in the ticket's Answer for one-line edits.
- A source test over the bundled docs refuses any route that is not a surface id, and refuses a route on an excluded surface (staff and dev surfaces).
- The route is index data, not search data: it never joins the search phrases.

### Navigation request

- One new request in the settings context, beside the settings-open request: open a surface by id. It is the only production path from the help window into the app's navigation. The dev router stays DEV-only and does not change.
- A pure resolver turns a surface id into the steps: the view to show, the dialog to open, the tab to select. It reads the same ledger the surface map reads for the ids, plus two typed tables of its own: which screen hosts each dialog, and what each tab ledger sits in. The ledger does not hold either. A new dialog or ledger needs an entry in both, and the type check refuses one without it; a new tab in an existing ledger needs nothing (ticket 02 finding).
- Surfaces the app raises on its own (update required, error details, exit, the design system) resolve to nothing. Surfaces reached through nested panels or their own state resolve to the panel's ancestor under Q26: Memory Manager → the game's memory tab, Persona → the game screen, the location list and canvas → the editor's Locations tab, the changelog → the main menu.
- A request for a tab that Simple mode hides switches Settings or the World Editor to Advanced for the session, without saving the mode, as the dev route does (Q32).
- A main-menu request from a game with a dirty in-game editor asks Exit to Main Menu first, then the editor's unsaved prompt. A refusal of either changes nothing (Q33).
- The main menu and the game viewer consume the request as they consume the settings-open request. The game viewer, for a surface on another screen, asks before leaving the game; the World Editor's own unsaved-edits prompt runs for an editor surface when the editor holds changes (Q19). A refused prompt clears the request and changes nothing.
- A request for the surface already open re-selects its tab and does nothing else.

### Help session and window

- The help session is unchanged. The `done` event already names the sources; the window reads the top source's route from the guide index.
- The answer footer renders the Take Me There button beside the Sources expander when the top source carries a route (Q18, Q23). Both chromes render it. A click sends the navigation request; on mobile it also closes the sheet (Q24).
- AI Context names the route per answer ("Take Me There: <surface id>", or none). It reads the same route function the button uses; the trace stores no copy.
- **Ticket 04 landed 2026-10-04 (`4774586e`).** The changelog line is ticket 06's.
- **Ticket 07 landed 2026-10-04 (`d9a78491`).** The route skips the lead (Q37).
- **Ticket 06 landed 2026-10-04 (`2e27f3f3`).** The Formaquestion page gains "How to Go to the Screen an Answer Describes" and a Take Me There bullet; Playwright covers the jump to the Settings Display tab and the refused jump from a game, both mutation-checked; the changelog line is in. Recall probe after: known 84.5%, blind 87.2% (interval touches ticket 03's); the walkthrough commit landed between the runs, and a later run after it read 84.7 / 87.7, so the drop is cloud drift.
- The button label is settled copy in the help voice: "Take Me There".

### Probe

- A new offline probe in the baseline harness: for each keyed task and here question, the keyed section's route against the question's expected surface. The expected surface is a new field on the question key, authored once. Output: a table per kind with hit, miss and no-route counts, and the misses by name. No model runs.
- The first run reports; the bar is the user's to set after (Q20).
- **Ticket 05 landed 2026-10-04 (`5ffe1dff`).** `npm run probe:help-route`, no model. 87 keys with an expected surface or none. First run: task 62 of 75 (83%; surfaced 48 of 59, none-expected 14 of 16), here 6 of 12 (50%). Of the 13 task problems, 4 are one level of granularity (the route is the parent of the control's surface), 7 are sections without a route line (5 reference sections, 2 how-tos ticket 03 left out), 2 are no-surface flows that route to their first screen. Six here keys point at reference sections, which carry no route by design.
- **Ticket 08 landed 2026-10-04 (`ac9cba55`).** 90 route lines added, 4 moved, 2 removed; every surface-map section the index cuts carries its surface's route, and the source test fails a missing or different one. Nine parent sections carry a deliberate ancestor route; seven stay routeless because their children sit on different screens. **Bar met (Q39): surfaced task 55 of 59 (93%)**, all task 92%, here 12 of 12. The six remaining problems are four `###` reference sections that are no index section (Q48) and the two no-surface flows, reported only. Recall probe: known 85.8%, blind 86.6%, cloud drift; the pick list is text-identical.

### Shape and settings

- No settings, world, save, preset or card shape changes. The question-key file in the harness gains a field.

## Testing Decisions

A good test calls a module through its public operations and asserts on what a player observes: the parsed section, the surface that opens, the button on the answer. It never asserts on internal layout.

Seams:

- **Docs index (existing, pure).** A section with a route line stores the route and loses the line from its text; a part of a split section inherits it; a section without one has none; the line never enters the search phrases. The source test over the bundled docs refuses an unknown or excluded id. Prior art: the keyword-line tests in the docs index tests.
- **Navigation request (new, one seam).** The resolver: a screen id resolves to the view alone; a dialog id to the view that hosts it plus the dialog; a tab id adds the tab; an unknown id resolves to nothing. The consumers, through the app's providers: a request opens the right view, dialog and tab; from a running game the prompt shows and a refusal changes nothing; a request for the open surface re-selects the tab. Prior art: the settings-open request tests in the main menu and game viewer tests.
- **Window (component).** The button renders only when the top source has a route; it is absent for a routeless top source even when a later source has one; a click sends the request with that id; on mobile the sheet closes. AI Context names the route. Tests that mount Formaquestion keep the one mocked seam to the settings providers. Prior art: the Formaquestion ask and sources tests.
- **Probe (pure).** The scorer over a small fixture: hit, miss, no-route, and the table shape. Prior art: the help probe's rescore path.

Other checks:

- Each guard is proven: reinstate the old behavior and confirm the test fails.
- The dev-router test that keeps the ledger in lockstep with each surface's tab list still holds; the resolver reads that ledger.
- Playwright: one end-to-end jump from an answer to a Settings tab, and one from a game with the prompt shown and refused.

## Out of Scope

- An AI-driven navigation function. A later ticket after the link proves itself (Q7).
- Auto-navigation without a click.
- Routes for sections that are neither how-tos, stepped walkthroughs (Q38), nor surface-map targets (Q40).
- A link per source. Only the top source carries the button (Q18).
- Highlighting the control on the opened surface.
- Routes into the community site or the desktop shell.

## Open Decisions

Settled 2026-10-04 as Q39–Q47; ticket 08 carries them. Still held: the fall-through rule (Q42), to revisit after ticket 08's probe.

## Further Notes

- The surface map and the surface registry already name every player-facing screen, dialog and tab, so routes reuse their ids. The registry reports; it does not navigate. The resolver is the one new piece that does.
- The keyed question set is the shared input the help bar used; this probe reads its sections and never tunes on the blind set.
- The AI Picks list is a shared input for other efforts: a docs edit that only adds route comment lines does not change section text, so picks should not move. The docs ticket runs the recall probe once to confirm.
