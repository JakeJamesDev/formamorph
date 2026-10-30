# 09: Staff Hosted-AI Panel

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: forms and tables over admin routes that already exist; follows the server settings tab's patterns.

**What to build:** an admin runs the hosted tier from the app's server settings tab without a deploy. They edit each tier's window and budget and the global settings, manage the approved model list and pick the active model, create and revoke grants, see and lift a pause, and read the spend-versus-estimate report. Moderators don't see the panel.

- [ ] The panel shows only to admins; a moderator sees nothing and the routes refuse them.
- [ ] Tier windows, budgets, fallback cost per turn and the global settings are editable and saved through the admin settings route.
- [ ] The approved model list supports add, edit and remove; the picker sets the active model; removing the active entry is disabled.
- [ ] Grants can be created with a tier and end date, listed, and revoked.
- [ ] The pause shows its state and can be lifted.
- [ ] The spend report shows recorded and provider spend per day.
- [ ] A dev-route entry opens the panel; frames in both themes: `.scratch/frames/staff-hosted-light.png`, `.scratch/frames/staff-hosted-dark.png`.
- [ ] Component tests cover each action against mocked routes.
