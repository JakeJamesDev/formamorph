# 14: Server Settings tab with the Anonymous Likes switch

Status: in-progress
Base: 3af76e23
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (User Stories › Moderating, stories 51–52)

Model rationale: one new tab in an existing dialog over two existing routes, with the Policies tab beside it as the pattern.

## What to build

The spec gives the operator one server setting that switches Anonymous Likes off without a deploy. Nothing in the app can change it, so today the emergency stop is a hand-written request. An administrator opens the Admin panel, sees whether Anonymous Likes are on, and switches them on or off.

No server change. The staff read and write routes for settings already exist: a GET and a PUT on the setting's key, the PUT body being `{ value }`. The key is `anonymous_likes` and the value is a boolean.

## Acceptance criteria

- [ ] The Admin panel gains a **Server Settings** tab, shown to administrators only, as the Policies tab is.
- [ ] The tab trigger reads "Server", so eight triggers fit the strip and it does not read as the app's own Settings. The heading inside the panel reads "Server Settings". If eight still overflow at the dialog's real width or at mobile width, report the measurement; restyling the strip is outside this ticket.
- [ ] The control is the approved `CheckRow` with a new `disabled` prop, not a new switch primitive. "Switch" below means this control.
- [ ] The tab reads the setting when it opens and shows one switch, **Anonymous Likes**, in its real state. While the read is pending the switch is disabled, never shown as off.
- [ ] A press writes the new value, and the switch follows the server's answer, not the press. A failed write restores the switch and shows the error.
- [ ] Switching off asks for no confirmation: it is the emergency stop. The help line says that stored likes still count and that people can still take a like back.
- [ ] After a successful write, the catalog is read again, so this session's hearts follow the new `anonymousLikes` flag without a reload.
- [ ] The tab is built so a second setting is one more row, but this ticket adds no other setting. `client_minimums` stays out.
- [ ] Copy follows the help-copy pattern; the label is title case.
- [ ] A dev-router entry reaches the tab in one `goto`. The drift guard stays green.
- [ ] Changelog In-Progress entry, 🛠️ bucket.
- [ ] Tests over mocked fetch: the read sets the switch; pending state; a write success; a write failure restores; a moderator does not see the tab.
- [ ] Verified in the preview through the dev router with an administrator session, both themes.
- [ ] Four gates green. State the test run time.

## Named, not in scope

- The server's settings routes allow every staff role, so a moderator can still write the setting by hand. Tightening the route to administrators is a server decision for the user.
- Whether a settings write should reach the audit log.
