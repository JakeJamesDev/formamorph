# 09: Patreon Section on the Site Account Page

Status: ready-for-human
Status note: Built and reviewed. The spec-session review folded in: stale-read guard on every status write, one tenure formatter (`supporterTenure`), narrowed caught errors. Visual check of the not-linked state in light is a DOM read only.
Base: 9e8df9af
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
- [ ] **Link Patreon** calls the start route and sends the browser to Patreon. On return with `?patreon=confirm&token=<t>`, the page calls `POST /api/users/me/patreon/confirm` with the token and the signed-in bearer, then shows the returned status. A signed-out visitor signs in first, and the token survives that. `taken`, `denied`, `expired`, `failed`, and a 400 `PATREON_CONFIRM_REFUSED` or 409 `PATREON_TAKEN` from confirm each show a clear message. The query is cleared from the URL after it is read.
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
