# 10: New page, Community Creations

Status: done
Base: cf0a2553
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can read how to find, install, publish and rate content, and how accounts work. One new docs page covers Community Creations and the account dialogs.

- **Browse:** the tabs (worlds, entities, dictionaries, avatars, prompts, contests), filters and the chip bar, listing details, the Listing Changelog, the world prompts viewer.
- **Install** and update. Link to the linked content page.
- **Like:** Likes, Anonymous Likes, Claim, hidden counts during a contest.
- **Comments**, profiles and the follow feed.
- **Publish:** a world, an entity, a dictionary, an avatar (with the Permissive License rule), a prompt preset.
- **Contests:** events, entering, results, the podium, ties.
- **Report** a listing or a comment; what an Outcome is.
- **Account:** sign in, the age gate, the content warning, the privacy policy link, delete account and cancel deletion, the feedback hub for bugs and suggestions.

Use the glossary's words: Like, Anonymous Like, Claim, Install, Listing Changelog, Report, Outcome.

Describe behavior only. Do not describe how abuse is detected.

Add "How to…" sections: install a world, publish a world, update a listing, enter a contest, report a listing, delete an account.

Recommended model rationale: the widest feature area with the most dialogs, spread over the client and the server contract.

## Acceptance criteria

- [ ] The page exists, follows the writing guide and uses exact control names
- [ ] Every Community Creations tab, publish tab, profile tab and account dialog maps to a heading
- [ ] Nothing on the page describes anti-abuse detection
- [ ] The sidebar and the home index list the page
- [ ] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [ ] Four gates green
