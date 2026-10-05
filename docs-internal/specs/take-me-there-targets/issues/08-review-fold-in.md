# 08: Review Fold-In

Status: done
Blocked by: 03, 04, 05, 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q7, Q11, Q12, Q13, Q14, Q15.

## What to build

The two-axis review of tickets 01 to 07 found one set of fixes and three docs rulings. They land as one unit. After it, a Take Me There landing focuses a button row in every host, the help window's Tools tab carries only its own route, the Bench Opening instrument gives the ring its room, the Design System table renders, and the guide follows Q12 to Q14. Four parallel sessions each built their own copy of three small pieces; this ticket leaves one of each.

## Acceptance criteria

- [ ] The Design System production-mapping table for Landing Pulse renders every row on its own line
- [ ] The shared Tools tab takes every target as a prop; the help window's Tools tab carries no `settings.tools` row, and a landing in Settings while the help window is open lands in Settings
- [ ] The shared control selector takes an enabled button as the control to focus, so the export story format and game pager rows focus on landing; the Settings and World Editor button fallbacks are gone
- [ ] The Bench Opening instrument's scroll area gives the ring its 12 px (Q7)
- [ ] One exported row lookup serves Settings, the World Editor and the game screen; the inline query in the World Editor is gone
- [ ] One page-landing predicate; the landing hook's return carries one target field
- [ ] One name for the landing prop across Row, CheckRow, WidgetRow, ListToolbar, PresetHeader, EndpointRouteField and ToolsTab
- [ ] The frame wait and the scroll stub live once in the shared test folder; the five landing test files use them
- [ ] Get Beta Builds targets the version row, as Update the App does (Q14)
- [ ] Choose Who the Player Can Be keeps the bare route; the report entries for it, Save a Game and Make a Custom Persona are named here under Comments (Q11, Q13)
- [ ] The six World Editor "Add …" sections keep the list toolbar target; the sweep check still passes (Q12)
- [ ] Docs checks, the five landing test files and the registry tests stay green; the review's commit body names what the reviewer flagged and what was left

## Comments

The report lists these three sections on purpose. Each keeps its bare route.

| Section | Route | Why no fragment |
|---|---|---|
| Saves-and-Backup#how-to-save-a-game | `gameViewer` | Its steps end in the Save Game dialog, which opens from the game **Menu**. The request cannot open it (Q11). |
| Persona-Authoring#how-to-make-a-custom-persona | `worldEditor.entities` | Its steps end on an open entity's tabs, and Advanced mode on the editor root gates them. A gate on another surface keeps the bare route (Q13). |
| Persona-Authoring#how-to-choose-who-the-player-can-be | `worldEditor.overview` | **Allowed Personas** shows only in Advanced mode, set on the editor root (Q13). |
