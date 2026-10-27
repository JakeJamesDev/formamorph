# Spec: Username Character Rule

Status: needs-triage
Status note: placeholder; grill before any spec is written.

## Problem Statement

The server limits a username to 3–20 characters and sets no character rule. Feedback mentions (feedback-links spec, Q32) parse `@` + `[A-Za-z0-9_-]{3,20}`, so:

- A name with a space or any other character cannot be mentioned or suggested.
- A name with a dot links only the part before the dot. `@a.b` mentions an account named `a` if one exists.

## Open Questions

- Do new usernames get a character rule, and which set?
- What happens to existing accounts whose names break the rule: keep them, ask for a rename, or rename them?
- Does the rule reach the site's register page, the app's account flow and the profile URL form?
- Is the mention grammar then widened or kept?
