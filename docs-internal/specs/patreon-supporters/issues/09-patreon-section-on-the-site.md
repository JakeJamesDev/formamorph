# 09: Patreon Section on the Site Account Page

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Rulings Q8, Q14; A1, A2; Implementation Decisions › Account settings)

Model rationale: one section with three states against four server calls. Existing account sections are the pattern.

## What to build

A signed-in member opens the account page on formamorph.ai and links Patreon there. The page shows the status, the flair toggle, and Unlink.

The section is one shared component, so that ticket 10 can put the same section in the app.

| State | The section shows |
|---|---|
| Not linked | **Link Patreon**, and the **Become a Supporter** link |
| Linked, no tier | "No active membership", **Unlink**, and the **Become a Supporter** link |
| Linked, with a tier | The tier, the tenure, the **Show Supporter Flair** toggle, and **Unlink** |

## Acceptance criteria

- [ ] The account page has a Patreon section in its list of sections.
- [ ] **Link Patreon** calls the start route and sends the browser to Patreon. On return, the page reads the result and, for a pending link, calls the confirm route with the one-shot token from the URL and the signed-in bearer. A signed-out visitor signs in first, and the token survives that. A refused link (`taken`, or a bearer that does not match the pending account) shows a clear message.
- [ ] The toggle sets the flair through the server and shows the saved state.
- [ ] **Unlink** asks for confirmation, then returns the section to Not linked.
- [ ] **Become a Supporter** opens the project's Patreon page.
- [ ] The account service has the four calls: start, status, set toggle, unlink.
- [ ] The section stays inside the site bundle boundary. The boundary test passes.
- [ ] Copy follows the writing guide.
- [ ] Tests cover each state, the refused link, a failed toggle, and unlink, against a mocked account service. Every async write checks the mounted ref.
- [ ] `verify-ui` evidence of the three states in both themes.
- [ ] A changelog line in In Progress.
- [ ] Four gates green.
