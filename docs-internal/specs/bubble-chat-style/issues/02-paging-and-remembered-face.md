# 02: Paging and the remembered face

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player steps back through earlier answers with the chevrons, and she shows the face she had for each one.

- The strip's chevrons, **Previous Answer** and **Next Answer**, move a page index over the conversation, newest last. They are always present and disabled at the ends.
- The bubble shows the page's answer, with its Sources, Take Me There, and folds. The question pill shows the page's question. The input stays empty on every page.
- A new question and Clear Conversation jump to the newest page. The index is view state and is never stored.
- Her face follows the paged exchange's stored face. The newest page shows the live phase and face as today.
- While an answer streams and the player has paged back, the next chevron carries a mark; it clears on reaching the newest page.

Spec: Q2, Q8, Q12; Implementation → Window (page index, face).

Recommended model rationale: view state over an existing list, with direct prior art in the exchange rendering and the face plumbing; the face per exchange already exists.

## Acceptance criteria

- [ ] Render tests: with three exchanges the newest shows; Previous shows the earlier answer and its question; Next is disabled at the end and Previous at the start; a new question jumps to the newest page; the input is empty after paging.
- [ ] The face shown follows the paged exchange; the newest page shows the live face.
- [ ] A streaming answer with the player paged back marks the next chevron; the mark clears on the newest page.
- [ ] Guard bites: dropping the jump-to-newest turns the paging test red.
- [ ] Changelog folded into the Bubble entry. The four gates are green.
