# 01: Settings Tab in the User Profile Dialog

Status: ready-for-human
Status note: Built in 3f579b0b and 4eda8f40. The `verify-ui` criterion is open: the dev preview needs a real session and an age-gate acceptance, so only the jsdom tests ran. Check the Settings tab at a realistic viewport in both themes.
Base: 9203eff3
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Rulings Q11, Q16; Implementation Decisions › Account settings)

Model rationale: a dialog restructure with existing controls and one new email control. Known patterns, moderate surface.

## What to build

A signed-in player opens the User Profile dialog in the app and sees a **Settings** tab. The tab holds the email control, Change Password, and Delete Account. The dialog header shows only **Log Out**.

The email control is new in the app. It does what the account site's email section does: add an email, change it, and show the verification state.

This is a prefactor. The Patreon section lands in this tab in ticket 10.

## Acceptance criteria

- [ ] The User Profile dialog has a Settings tab beside its existing content. The tab control follows the design system's rule for tabs.
- [ ] Change Password and Delete Account work from the tab as they do today from the header.
- [ ] The player can add or change the account email from the tab, with the same server calls and the same states as the account site.
- [ ] The header shows only Log Out.
- [ ] The dev-router has an entry that opens the dialog on the Settings tab.
- [ ] Copy follows the writing guide. Labels use AP title case.
- [ ] Tests cover each control in the tab against a mocked account service. Every async write checks the mounted ref.
- [ ] `verify-ui` evidence at a realistic viewport, in both themes.
- [ ] A changelog line in In Progress.
- [ ] Four gates green.
