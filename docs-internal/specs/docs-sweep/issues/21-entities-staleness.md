# 21: Entities in Game Staleness

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: each claim is checked against source across the in-game Entities tab, scene presence and runtime entities.

## What to build

Bring this page in line with the app on `main`: [Entities](../../../../docs/Entities.md) ("Entities in Game").

The close review found this page in no page group, so it got neither pass (Q26).

List the page's checkable claims: control and tab names, steps, limits, defaults, file formats, shortcuts, what a setting does. Check each one in source or in the dev-router preview. Fix what is wrong, remove what is gone, and add a short mention of shipped behavior that belongs on the page and is missing. Leave correct text as it is: ticket 22 owns the wording.

The swept pages settled terms this page must follow: the `{{char}}` chip is **Entity Name** (Q25), and the Glossary rows for Presence, Movement, Known In, Relationship and Stranger Name name the entity fields. Link to the page that owns a feature rather than describe it again (Q14).

Spec: Implementation Decisions, "Truth source", "Staleness pass", "Headings and anchors".

## Acceptance criteria

- [ ] Every control, tab and setting name on the page matches its on-screen label
- [ ] Every default and limit the page states matches the source
- [ ] The page describes no removed feature
- [ ] Shipped behavior on the page's subject has at least a short mention
- [ ] A renamed or removed heading updates every anchor table that names it; the docs tests are green
- [ ] No code change beyond anchor tables; a page/code contradiction where the code looks wrong is named under Landed
- [ ] Landed lists any missing page, stale ADR, or contradicting UI label found on the way
