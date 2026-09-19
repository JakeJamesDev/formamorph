# 03: Opening Narration

Status: ready-for-human
Status note: built in de8d7591, 1711b391 and the review fold; one acceptance line is met by a browser spec, see Comments
Base: 452ac588
Blocked by: 02
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

**Parent:** [Openings](../spec.md)

**What to build:** Each opening row gains an **Opens As** toggle with the values **Player Action** and **Narration**. When the draw at Start Game is an Opening Narration, page one appears at once with the authored text, exactly as written. No narration request goes out. The input box is empty and ready. Choices, stat updates, scene tags, the opening hour, read-aloud, the scene image, and every other post-narration step run as they do on any page. Page-one regenerate draws a different opening and does not repeat one the player saw this session.

**Rationale for the model:** the ticket changes how a turn starts inside the Turn Pipeline and the game view, the two highest-risk areas in the codebase. The strongest model at high effort.

## Acceptance criteria

- [x] The Opens As toggle sets the kind of a row. It is a two-value toggle, not tabs.
- [x] A Narration draw starts the game with no submit. The turn runs through the Turn Pipeline with the authored text supplied as material, and the narration pass makes no request.
- [x] Every post-narration pass runs on that turn, and the result lands through the normal Turn Commit. No second commit path exists.
- [x] History keeps the hidden start message before the written page one, so no request begins on an assistant message. A test reads the next turn's request and proves it.
- [x] Chips in the text resolve before page one shows. Page one appears through the normal page rendering and does not imitate streaming.
- [x] Page-one regenerate draws by weight from the openings not yet shown this session. When all have been shown, the set starts over.
- [x] A regenerate that draws an Opening Action returns the game to the not-started state with the box filled. A regenerate in a pool of one Opening Narration leaves page one as it is.
- [x] The no-repeat memory is session state. A loaded save starts with an empty set. No save shape change.
- [x] Quick Start draws with no extra step. Loading a save draws nothing and changes no history.
- [x] A pipeline test with a fake request adapter proves that no narration request goes out and that the post-narration requests do. The guard is proven by reinstating the narration request.
- [x] Draw tests use a seeded random source and cover no-repeat, the reset, and the pool of one.
- [x] A live start on an Opening Narration is checked in the preview through the dev-router, with static DOM evidence of page one and the empty input box.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

The kind field already exists from ticket 02, so this ticket adds no export-shape change of its own. ADR-0001 holds: the pipeline keeps its two seams.

## Comments

**2026-09-18, implementation.**

- The pipeline takes the authored text as `writtenNarration` on the plan input. The plan keeps only the post-narration passes, and the runner reports the text through a `written` event on the existing derivation callback. ADR-0001 holds: no third seam.
- "A test reads the next turn's request" is met by `e2e/opening-narration.spec.ts`, not by a Vitest test. The hidden start message is stored by the game view, which no Vitest harness mounts. The spec runs with `npm run test:e2e`, outside the four gates.
- The pool-of-one rule compares the drawn opening's resolved text with the stored page one. It therefore holds on a loaded save too, with no save shape change.
- Review finding, fixed: with Concurrent Turn Requests off, a request that failed after a written page one left the game marked not started with page one on screen. The turn is now kept, as Stop keeps a narration that came through. A model-written opening still has the older behavior; that is outside this ticket.
- Not covered by a test: read-aloud and the scene image on a written page one. Both run through the same code as any page; the read-aloud call was checked by reading only.

