# 13: Help Focus

Status: ready-for-agent
Blocked by: 12 — Fair Known Cases
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new registry beside the help world registry, wired through the editor panels, the help request's surface words, the code test's `stat` default, AI Context, an ADR line and two probe cases.

## What to build

The help request learns which item the player has selected on a tab. A panel that shows one item (a stat, a trait, an entity, a location, a dictionary entry) registers `{ kind, id, name }` in a focus registry while it shows, the way the game and the editor register the open world today, and removes it on close. The surface registry stays ids only.

With a focus registered:

- The surface line names it: "World Editor dialog, Stats tab, Code tab of the stat Courage". The structure still comes from the surface map; only the item's words come from the focus.
- The code test's `stat` input is optional and defaults to the focused stat, so the model stops inventing one.
- AI Context shows the focus beside the surface.
- The Code rider's `self` line can say which stat `self` is.

The spec's out-of-scope line on naming the open stat reopens on this evidence. A world item's name reaches the help request; the ADR from ticket 06 gains a line that says so. Help settings and exports are unchanged.

With the focus known, the two known cases from ticket 12 pass the stat in the surface and require the named stat's path again when the open stat is a different one.

## Acceptance criteria

- [ ] A focus registry exists beside the help world registry; the stat, trait, entity, location and dictionary-entry panels register while shown and clear on close
- [ ] The surface words name the focused item when its kind matches the open tab; without a focus they read as today
- [ ] The code test's `stat` is optional and defaults to the focused stat; an explicit `stat` still wins
- [ ] AI Context shows the focus
- [ ] The ADR records that a focused item's name reaches the help request
- [ ] `brave-at-courage` and `quotes-pin` carry a focused stat in their surface and require the named stat's path again
- [ ] Changelog fragment written
