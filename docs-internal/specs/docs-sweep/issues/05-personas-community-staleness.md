# 05: Personas and Community Staleness

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across personas and the community browser, listings and the account site.

## What to build

Bring these pages in line with the app on `main`: [Personas](../../../../docs/Personas.md), [Persona-Authoring](../../../../docs/Persona-Authoring.md), [Community-Creations](../../../../docs/Community-Creations.md).

List each page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 06 owns the wording.

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [ ] Every control, tab and setting name on the pages matches its on-screen label
- [ ] Every default and limit the pages state matches the source
- [ ] No page describes a removed feature
- [ ] Shipped behavior on each page's subject has at least a short mention
- [ ] A renamed or removed heading updates every anchor table that names it; the docs tests are green
- [ ] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed
- [ ] Landed lists any missing page, stale ADR, or contradicting UI label found on the way
