# 09: Staff Hosted-AI Panel

Status: ready-for-human
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: forms and tables over admin routes that already exist; follows the server settings tab's patterns.

**What to build:** an admin runs the hosted tier from the app's server settings tab without a deploy. They edit each tier's window and budget and the global settings, manage the approved model list and pick the active model, create and revoke grants, see and lift a pause, and read the spend-versus-estimate report. Moderators don't see the panel.

- [x] The panel shows only to admins; a moderator sees nothing and the routes refuse them. (Server tab is owner-only in `AdminPanelDialog` (existing moderator test); the server tests own the route refusal)
- [x] Tier windows, budgets, fallback cost per turn and the global settings are editable and saved through the admin settings route. (`HostedAiPanel.test.tsx`: saves an edited tier window and a global limit)
- [x] The approved model list supports add, edit and remove; the picker sets the active model; removing the active entry is disabled. (tests: add, edit, remove, Remove disabled on the active entry (mutation proved), picker sets active)
- [x] Grants can be created with a tier and end date, listed, and revoked. (tests: list, create, revoke)
- [x] The pause shows its state and can be lifted. (tests: show and lift)
- [x] The spend report shows recorded and provider spend per day. (test: per-day table with a dash where the provider has none)
- [x] A dev-route entry opens the panel; frames in both themes: `.scratch/frames/staff-hosted-light.png`, `.scratch/frames/staff-hosted-dark.png`. (`#dev?modal=adminPanel&tab=serverSettings&fixture=hostedAi`; both frames stored)
- [x] Component tests cover each action against mocked routes. (`HostedAiPanel.test.tsx`, 21 tests)

## Landed

**Not verified**
- Moderator refusal on the routes: not re-run here; the server tests own it.

**For you**
- Open the Server tab as an admin against a server with `hosted_ai` set. Check the tier fields, the model form and a save. Frames: `.scratch/hosted-ai-09/frames/staff-hosted-dark.png`.
