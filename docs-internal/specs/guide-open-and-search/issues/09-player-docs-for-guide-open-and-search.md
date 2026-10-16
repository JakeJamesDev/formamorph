# 09: Player Docs for Guide Open and Search

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player docs describe what this effort shipped (Q40). The Formaquestion docs page covers fuzzy and semantic search today, but not the rest.

- **Open Guide:** the full-screen Guide, the ⋮ item, the Full chrome title-bar button (Q26), and what it shares with the small window (Q28).
- **Open Wiki:** the ⋮ item, the full-screen header button, the confirm with Don't Ask Again, and the **Confirm Before Opening the Wiki** setting in the General settings table.
- **The ⋮ menu row** lists Open Guide and Open Wiki.
- **The offer card:** when it shows, Turn On, No Thanks, the failed-download Retry and Dismiss. Mention it beside the Semantic Search setting and in "How to Turn On Semantic Search".
- **Back and Forward:** where the buttons show, Alt+Left / Alt+Right, and the mouse side buttons.

Follow `docs/Writing-Guide.md` and the page's existing tables. Add route lines and keywords where the page's other how-to sections have them, so help retrieval and Take Me There find the new sections. Docs text must not quote typo examples literally (ticket 06 note).

Spec: Q40.

Recommended model rationale: docs writing on an existing page with its conventions and the docs coverage tests.

## Acceptance criteria

- [ ] Each item above is in the docs, with the title-bar and General settings tables updated.
- [ ] Docs coverage, route and anchor tests pass.
- [ ] Section vectors are rebuilt (`npm run build:help-vectors`), so the new sections join Semantic Search.
- [ ] Copy-sweep pass on the new text.
- [ ] Changelog fragment written if the docs change is player-visible; four gates green.
