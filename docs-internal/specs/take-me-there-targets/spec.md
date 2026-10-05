# Spec: Take Me There Targets

Status: done
Status note: Closed 2026-10-04, tickets 01 to 08, last landing 81247ec9. Closed without gates.
Spec session: take-me-there-targets — spec

## Problem Statement

A help answer's **Take Me There** button opens the screen, dialog and tab the answer's guide section names. It stops there. When the answer is about one control on a dense tab, the player lands on the tab and still has to find the control from the written steps. The button promises a place and delivers a room.

## Solution

A guide section can name the control its steps end at. The button then opens the surface as today and, once the tab has mounted, scrolls that control into view, focuses it when it takes focus, and pulses a ring on its row once. A section that ends at a tab keeps today's behavior.

Every how-to section whose last step names a control gets its target in one sweep across the guide.

## Rulings

| # | Ruling |
|---|---|
| Q1 | A section names its target as a fragment on the existing route line: `<!-- route: settings.display#narration-layout -->`. The surface id stays the prefix. One line per section, as today |
| Q2 | Code declares the targets a surface offers in a typed registry keyed by surface id. Controls read their data attribute from the registry. A test fails on a docs fragment the registry lacks. A report-only check lists how-to sections whose surface has registered targets but whose route carries none |
| Q3 | On landing: scroll the target into view, focus it when it is focusable, and pulse a ring on its row once. The pulse is a new visual pattern and gets a Design System entry and the user's approval before adoption |
| Q4 | A registered target absent from the DOM when the tab opens lands on the tab silently, as today. No toast |
| Q5 | One sweep across every how-to section in the guide whose last step names a control. A section that ends at a tab keeps the bare route |
| Q6 | The fragment is chosen over a second comment line because the route line is already required and checked per section; a fragment rides inside an existing check and sits where anyone editing the route looks |
| Q7 | The Landing Pulse pattern is approved (ticket 02, landed). Hosts adopt it through the shared landing-pulse helpers: one runs the pulse on a row and returns a cancel, honoring reduced motion; one picks the visible control to focus and skips the label's ⓘ button. The pulse reaches 12 px past the row, so a host's scroll viewport keeps at least that much inner padding or the fade clips (spec session, 2026-10-04) |
| Q8 | A section whose last-step row shows only after an earlier step (a checkbox, a mode, a switcher value) targets the always-visible gate row instead, so the landing always points somewhere. Authoring rule only; no registry or route shape change. Q4's silent fallback stays for a row hidden at runtime. The Messages-field jump folds into the hook with scroll and focus only; the pulse is Take Me There's alone, per the Design System entry (user, 2026-10-04) |
| Q9 | The pulse is for any jump that lands on one row, Take Me There or a link, not Take Me There's alone. Refines Q8 after the user's pass-two ruling that the Mascot tab's off-state link to General lands on the Mascot row with the pulse and focus (landed on main). So the Messages-field jump gains the pulse too, and ticket 04's shared hook absorbs the General-link landing when it reaches the help window (pass-two spec session, 2026-10-04) |
| Q10 | Ticket 04 scope: the help window's view tabs (Ask, Search, Guide) are in the sweep, since no later ticket covers the Formaquestion page; a view section whose last step names a control gets its fragment and lands through the shared hook after the view shows. A section that ends at opening a dialog or a view keeps the bare route, so AI Context registers no target. Q8's gate row applies only where the last-step row is gated (spec session, 2026-10-04) |
| Q11 | A section is never re-routed to satisfy the report. Targets are registered only for controls present when the surface opens. A section that ends at a context-menu item, or inside a dialog the request cannot open, keeps its route with no fragment, and the report lists it; that is the report's job, not a failure. The sweep tickets' "lists none" line reads as: lists only sections that end at a menu item or an unreachable dialog, and the ticket names them (spec session, 2026-10-04) |
| Q12 | A section whose last control exists only once an item is open (Save at the bottom of an editor) targets the first always-present control of its steps, the list toolbar. Refines Q5: "the control its steps end at" yields to the first present control when the last is item-bound (user, 2026-10-04) |
| Q13 | A section whose last-step row is gated by a row on another surface (Choose Who the Player Can Be: an Advanced-gated select on Overview, gated by Editor Mode on the editor root) keeps the bare route and the ticket names it. A gate on another surface is not this surface's row (user, 2026-10-04) |
| Q14 | Two sections with the same gate get the same call. On Install on Android, Update the App and Get Beta Builds both target the version row (user, 2026-10-04) |
| Q15 | Review fold-in is one unit, ticket 08: the broken Design System table row; the shared Tools tab carrying a hardcoded Settings route; button focus in every host through the shared control selector; landing room on the Bench Opening instrument; one row lookup; one page-landing predicate; one landing prop name; shared landing test scaffolding; Q13 and Q14 applied to the docs; the Save a Game and Make a Custom Persona report entries named in a ticket (user, 2026-10-04) |

## User Stories

1. As a player, I want Take Me There to land on the control the answer is about, so that I stop hunting on a dense tab.
2. As a player, I want the control scrolled into view, so that it is on screen when the dialog opens.
3. As a player, I want the control focused when it takes focus, so that I can act on it at once.
4. As a player, I want a short ring pulse on the row, so that my eye finds it among many rows.
5. As a player, I want the pulse to run once and stop, so that it never distracts after it has pointed.
6. As a player with reduced motion on, I want the ring without the pulse, so that the landing still points without movement.
7. As a player, I want an answer about a tab to land on the tab as today, so that nothing changes where no control is named.
8. As a player, I want a landing on a control that is not on screen (hidden by a mode or a flag) to fall back to the tab, so that the button never errors.
9. As a player on mobile, I want the same landing in the sheet, so that small screens get the same help.
10. As a player who asks twice about the same control, I want the second Take Me There to scroll and pulse again, so that a repeat request still points.
11. As a player, I want the landing to work for the Settings dialog, the help settings, the World Editor panels, the Library tabs, and the in-game dialogs, so that help reaches every screen the guide describes.
12. As a guide author, I want to name a target by adding a fragment to the route line I already write, so that there is one line to keep right.
13. As a guide author, I want a failing test on a fragment no code declares, so that a typo never lands on nothing in silence.
14. As a guide author, I want a report of sections whose surface offers targets but whose route names none, so that gaps show without blocking edits.
15. As a developer, I want a typed registry of targets per surface, so that a control's attribute and the docs share one source.
16. As a developer, I want one landing hook every host uses, so that scroll, focus and pulse behave the same everywhere.
17. As a developer, I want the landing to wait for the tab panel's mount, so that a target inside a tab that mounts a commit late is still found.
18. As a developer, I want the landing to scroll the right scroller, so that a target inside a scroll area viewport is reached.
19. As a developer, I want the AI's behavior unchanged, so that no prompt or probe work rides on this.
20. As a player, I want the Take Me There button copy unchanged, so that the button I know keeps doing more.

## Implementation Decisions

### Docs index

- The route line parser splits an optional `#fragment` from the surface id. The section record carries the surface id as today and the fragment as a separate optional field. The markdown still leaves the line out.
- The existing per-section route check keeps requiring a surface id. It also requires that a fragment, when present, is a registered target of that surface (Q2).
- A report-only check (a test that prints, never fails) lists sections whose surface has registered targets and whose route has no fragment (Q2).

### Surface targets registry

- A typed ledger keyed by surface id lists the target names that surface offers. Target names are kebab-case and stable; they name the control, not its label text.
- A helper returns the data attribute for a target, typed against the ledger, so a control cannot name a target the ledger lacks.
- Surface ids come from the existing surface map; the ledger is partial, since most surfaces offer no targets.

### Surface route resolver

- The resolved steps gain an optional target. The answer's route resolves the fragment the same way it resolves the surface id: a fragment the registry lacks resolves to the bare surface.
- Requests to open a surface carry the target through to the host that lands them.

### Landing hook

- One hook per host that lands a surface. Given the landing key and target, it waits for the target's element after the tab's mount, scrolls it into view inside the nearest scroll viewport, focuses it when it is focusable, and pulses a ring on its row once. The pulse honors reduced motion by drawing the ring without the animation.
- A target not found after the mount settles lands silently (Q4).
- A repeat request with the same target lands again; the landing key changes per request, as the tab landing does today.
- The Settings modal's existing jump to a Messages field is the model and is folded into the same hook, so one mechanism serves both.

### Hosts

- Each host that already opens surfaces (the main menu, the game screen, the help window) passes the target into its dialogs. Dialogs with tabs pass it to the tab hosts.
- Controls on registered surfaces carry the attribute from the registry helper. The attribute goes on the row that scrolls and pulses; focus goes to the first focusable control inside it.

### Design System

- A new pattern entry, **Landing Pulse**: one ring pulse on a settings row or control, its tokens and duration, reduced-motion fallback, and where it is used. The dev-router showcase gets a frame. Adoption waits on the user's approval (Q3).

### Docs sweep

- One pass over every guide page. Each how-to section whose last step names a control gets the fragment; a section that ends at a tab keeps the bare route (Q5). A gated last-step row yields to its always-visible gate row (Q8). The sweep lands page by page in one unit, with the registry entries each page needs.

## Testing Decisions

A good test calls the public seam with real inputs and asserts the observable result. It never reads internal fields or mirrors the formula.

- **Docs index (existing seam).** A route line with a fragment yields the surface id and the fragment; without one, no fragment. The per-section check fails on a fragment the registry lacks. The report-only check lists the right sections against a fixture. Prior art: the docs index and docs coverage tests.
- **Surface route resolver (existing seam).** A route with a registered fragment resolves to steps with that target; an unregistered fragment resolves to the bare surface; a bare route has no target. Prior art: the surface route tests and the Take Me There tests.
- **Registry.** Every registered surface id is a real surface id; every target name is kebab-case. The typed helper rejects an unknown target at compile time (a type test).
- **Landing hook (new seam, through the Settings modal harness).** Opening Settings with a target scrolls the row into view and focuses its control; the pulse class is present once and gone after the animation end event; a missing target leaves the tab open with no error; a repeat request scrolls again. Reduced motion draws the ring without the animation class. Prior art: the Settings modal prompts tests, which mock scrolling into view.
- **Guards bite.** Reinstate once: drop the mount wait and the landing test must go red.

## Out of Scope

- Any prompt, preset, or probe change. The AI never picks the target; the section's route line does.
- A toast or message when a target is absent.
- Targets for list items the request cannot name (a specific entity, a specific world).
- Changes to the Take Me There button, its placement, or its copy.
- Guide sections that end at a tab.

## Further Notes

- Known traps, both recorded in memory: a tab panel mounts one commit after the tab change, and the ScrollArea viewport is the scroller. The landing hook waits a frame after the mount and scrolls the nearest viewport.
- The help window opens some surfaces itself (its own settings and AI Context). Those land through the same hook inside the window.
- The pulse overshoots its row by 12 px (Q7). A host whose rows sit flush against the scroll viewport edge pads the viewport, not the row.
- Ticket 03 built the shared pieces tickets 04 to 07 adopt: the landing hook in the surface library; a landing-room prop on ScrollArea that adds the 12 px the pulse needs; and a dev-only request helper on the dev window object that opens a surface with a target without an AI answer. The Browser pane suspends animation frames, so a live landing check needs Playwright, not the pane.
- Settings targets as landed: quote-color, narration-font, narration-layout on Display; thinking-mode on Output for both Thinking sections; settings-mode on Data for Restore Default Worlds, with the attribute on the Settings mode switch (Q8).
