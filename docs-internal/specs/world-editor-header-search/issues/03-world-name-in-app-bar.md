# 03: World Name In The App Bar

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a small header change plus a Design System rule and reference update; few moving parts.

## What to build

The desktop app bar's start reads: back, **World Editor**, a 12px muted chevron (the icon the find bar's match location uses), then the world's name in the body role, muted. The name is the overview's name, trimmed. A blank name shows the title alone, with no chevron. A long name truncates with "…" before the center column, and a cut-off name shows its full text in the shared tooltip on hover.

The "Saved" and "Unsaved changes" text is removed. Save's enabled state is the only save-state signal.

Design System, Surface App Bar pattern: the status rule and the World Editor composition line drop the save state; the rule "never the open item's name" is rewritten (the world is the surface's subject); the isolated reference drops its Never Stored, Saved and Unsaved Changes choice; the state reference and writing review follow. The World Editor help page's two save-state lines change.

Changelog fragment: the World Editor's header names the world being edited.

From the prototype branch `prototype/editor-header-search` (commits `526083ab` through `0251aaf2`).

## Acceptance criteria

- [ ] The header shows the world's name after the chevron, at body size and muted; the title stays at its size.
- [ ] A blank name shows no chevron and no name.
- [ ] At 1024px with the longest default world name, the name truncates before the center column and the tooltip shows it in full.
- [ ] No save-state text renders anywhere in the header; the app bar test's save-state cases are removed, since the behavior is removed.
- [ ] The Design System section, its reference and the help page match.
- [ ] Four gates green; verified at desktop width in both themes.
