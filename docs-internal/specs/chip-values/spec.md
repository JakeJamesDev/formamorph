# Spec: Chip Values

Status: ready-for-agent
Spec session: Spec: Chip Values
Workspace: `main`, no branch. Tickets run one at a time; each claims its files in its `Status:` line.

## Problem Statement

A prompt chip like Entities or Location carries axes: which scope, which content, which format. The registry defines those axes in one place. The code that gives each chip its value does not read them. Six places decode chip tokens by hand: the live game's context builder, the game's scene override for the Choices prompt, the World Editor's preview builder, the Test Bench's AI-context instrument, the stat-request builder, and the scoped-token expander itself. Each one re-types the axis ids it knows about.

So the registry can grow an option and the value builders do not follow. That has now happened three times on one chip. The XML format pair was missed once. The Name content was missed until 2026-09-23, when a Choices prompt placing `<ENTITIES|name>` received the whole location roster past the presence filter. The patch fixed that instance. The pattern that produces the next one is still there.

The same spread costs the editor. The preview builder and the live builder share one shape and drift apart in the details, such as which scope counts as "in scene" and which lore block a chip renders. A value that one of them forgets renders as a raw `<TOKEN>` in a prompt, and nothing but a reader notices.

## Solution

One module, **Chip Values**, turns a **Chip Scene** into a value for every scene-derived chip token the registry defines. It walks the registry's axes, so a token cannot be missed. Three adapters build a Chip Scene: live play builds one from the playthrough, the World Editor builds one from the authored world, and the Settings preview builds one from a sample world authored in code. Every consumer of chip values reads the module's output instead of decoding tokens itself.

The player and author see no new surface. What they get is that every variant of every chip resolves the same way everywhere it can appear: in a real request, in the Request Anatomy, in the editor's Preview tab, in the Opening instrument, and in the Test Bench.

## User Stories

1. As a player, I want every variant of the Entities chip in the Choices prompt to list only who is in the scene, so that an edited prompt cannot leak the whole location roster to the choice writer.
2. As a player, I want a chip variant I pick in the prompt editor to have a value in play, so that no prompt ever reaches the model with a raw `<TOKEN>` in it.
3. As a player, I want the Request Anatomy to show the same chip values a real request sent, so that what I inspect is what the model read.
4. As a player, I want the Preview tab in Settings to show a chip value built the same way play builds it, so that the preview is a true rehearsal of the request.
5. As a player, I want the sample preview, shown when no game runs, to cover every chip the editor offers, so that I can inspect any chip before I place it.
6. As a player, I want a stat-code before box to feed the turn's chips the values it wrote, so that a prompt reads the world as the box left it, not as the last render had it.
7. As an author, I want the World Editor's Preview to render each chip from my world with the same rules play uses, so that what I see while authoring is what the player's model will read.
8. As an author, I want the Opening instrument to build its context from the same module, so that its page-one preview and the real opening agree.
9. As an author, I want the Test Bench's AI-context instrument to read its blocks from the same values, so that the block it labels "Entities Here" is the value the Entities chip carries.
10. As an author, I want a chip's Name content to render as a plain name list in every scope, so that I can place it inside a sentence anywhere.
11. As an author, I want a stat chip's pieces (range, descriptor, description) and format to combine the same way in preview and play, so that I can trust the preview when I choose them.
12. As an author, I want a Persona chip to carry the known-person line for a world persona in every place it renders, so that the model always learns that the persona's name means the player.
13. As an author, I want a Traits chip to group traits under their group headers in preview as in play, so that the preview shows the structure the model reads.
14. As an author, I want lore chips to show Background and Foreground entries split the same way in preview and play, so that the preview reflects the entry positions I set.
15. As an author, I want placeholder chips inside a chip value to resolve before the value reaches a prompt, so that a Wildcard inside a location description shows a drawn value, not its token.
16. As a developer, I want one module to own the token-to-value mapping, so that a new registry option gets a value in every adapter without a hunt through callers.
17. As a developer, I want a drift guard that fails when a scene-derived registry token has no value, so that the next missed variant fails in CI, not in a player's prompt.
18. As a developer, I want the module to take a plain-value scene, so that a test builds one literal and asserts on the output with no React and no providers.
19. As a developer, I want the live, authored and sample adapters to produce the same type, so that a bug reproduced in one can be replayed through the others.
20. As a developer, I want the scoped-token expander to read the content and format axis ids from the registry, so that the expander cannot disagree with the chip pop-out.
21. As a developer, I want the Stats and Traits enumeration copies to collapse into the module, so that the three copies of that block stop drifting.
22. As a developer, I want the Test Bench and the stat-request builder to stop decoding tokens themselves, so that no fourth and fifth decoder survives.
23. As a developer, I want the existing tests of the Opening instrument, the Preview tab, the Test Bench and the preview pool to pass unchanged, so that the swap is proven behavior-preserving.
24. As a developer, I want the tests that mirror the old builder by hand deleted, so that the suite tests the interface and not a copy of the implementation.
25. As a developer, I want the sample world to keep today's sample names and text, so that the preview's look does not change for players in the same release.
26. As a developer, I want per-turn tokens (Player Action, Narration, Character Name, Subject) to stay outside the module, so that the scene type does not carry fields only one adapter fills.
27. As a developer, I want the module to leave settings-derived guidance chips (Length, Markdown, Active Character, Language) where they are, so that the change stays inside scene-derived values.
28. As a developer, I want the module to leave the world's own placeholder-chip values to the caller's merge, so that world prompt chips keep their existing path.
29. As a developer, I want the live adapter to build a scene from a stat-code before box when one is present, so that the `view` parameter threaded through today's builder disappears.
30. As a developer, I want the glossary to define Chip Scene and Chip Values, so that tickets, tests and reviews use one name.
31. As a developer, I want the module's tests to use fixture worlds that name their cast and places plainly, so that a failing assertion reads as a scene, not as ids.
32. As an agent working a ticket, I want the module in one folder with its adapters beside it, so that one directory answers "where does a chip's value come from".

## Implementation Decisions

**The module and its interface.** Chip Values is one exported function that takes a Chip Scene and returns a map from chip token to value. The map covers every token and variant the registry defines for the scene-derived families: World Description, Stats, Traits, Persona, Location, Entities, Notes, Time, and the lore blocks. Any other token is absent from the map, never present with a placeholder. The module lives in its own folder beside the AI request module, with the adapters next to it.

**The Chip Scene is a plain value.** It holds: the world overview text; the stats as player stats with current values; the traits in force with their groups; the persona, or none; the current location, or none; every location and every connection; the entity roster; the ids present at the location; the ids in scene; the lore entries to render, each with its position; the notes text; the time as an absolute value, or none; and a `resolve` function for placeholder chips. A scene never holds React state, callbacks that read live state, or a `view` override. A before box produces a second scene.

**Registry-driven enumeration.** The module walks each family's axes from the registry and builds one value per combination. The scoped-token expander stops re-typing content and format ids and reads them from the registry's axes. Ruling (2026-09-24, ticket 01): the expander translates each option id into what the builders take through one lookup table keyed by option id, and an unknown id throws, so the drift guard fails in CI when the registry grows an option nobody handles. The builders keep their current options; they are not changed to take option ids. The Stats block reads its pieces and format from the decoded variant, once, inside the module. The Traits block renders each format from one call. The scene override for the Choices prompt (the patch from 2026-09-23) becomes a call into the module with the in-scene roster substituted, so the override and the base values cannot enumerate different sets.

**Three adapters, one type.** The live adapter is a hook beside the module. It builds a Chip Scene from the playthrough's contexts, or from a stat-code before box when one is in flight. The authored adapter builds a Chip Scene from an authored world plus the preview options the Opening instrument passes today (active traits, settled stats, a chosen location, a fixed resolve). The sample adapter is a small world literal authored in code from the current sample strings, run through the authored adapter. The static scene samples in the preview pool go; the derived layer (settings guidance) and the sample turn stay.

**Absent Notes and Time in the editor preview.** Ruling (2026-09-24, ticket 01): the module emits the placeholder for absent Notes and Time, and an authored scene has neither. The World Details Manager preview keeps showing the pool's sample notes and time, as today, by dropping those two tokens from the module's output before it composes over the pool. The drop lives in that caller, not in the authored adapter; the Opening instrument already forces both to the placeholder and is unaffected.

**Where the two builders disagree, play wins.** Ruling (2026-09-24, ticket 01): the live builder renders the Traits chip as the placeholder when no trait is in force, and the editor's builder rendered it blank. The module renders the placeholder in every scene. The "no rendered text change" rule protects values from redesign; it does not preserve a preview that already differed from what the model reads, since removing that drift is the point of the module. A world with no default traits previews Traits as N/A instead of blank, and the changelog says so.

**Callers that move.** The live game's context builder and its scene override; the World Editor's preview builder; the persona context values; the Stats block in the stat-request builder; the block decoders in the Test Bench's AI-context instrument, which reads its blocks from the module's output keyed by its own block-to-token table.

**What stays outside.** Per-turn tokens stay with the pass records in play and with the sample turn in preview. Settings-derived guidance chips stay in the narration prompt builder and the preview pool's derived layer. The world's own placeholder-chip values keep their merge in the caller. Request Anatomy is unchanged: it labels runs, it does not build values.

**Naming.** The glossary terms are Chip Scene and Chip Values, added to CONTEXT.md on 2026-09-23. Code names follow them.

**Export shape.** None. No world, save, or settings field changes.

## Testing Decisions

A good test builds one Chip Scene literal, calls the module, and asserts on a value the way a reader would check it: the Name content lists two names and nothing else; a world persona's block ends in the known-person line; a stat chip with only the descriptor piece shows a word and no number. A test never asserts on which builder ran or how many times.

**Tested at the new seam.** Chip Values, through its one function:

- A drift guard: for each scene-derived family, every variant id the registry produces has a value in the map. The expected set comes from the registry's axes, never from the expander.
- Behavior per family: entity scope precedence (here beats sub-location beats reachable), the in-scene roster, Name content in every scope, stat pieces and formats, trait groups per format, the persona's three contents and the known-person line, lore split by position, notes and time placeholders when absent, and placeholder resolution applied to every value.

**Existing seams, kept unchanged.** The Opening instrument tests, the World Details Manager preview tests, the Test Bench AI-context tests, the stat-request tests, and the preview pool tests must pass without edits. They are the proof that the adapters preserve behavior. The scene-override test added with the patch moves to the module's suite and keeps its registry-derived expectation.

**Deleted.** The persona placeholders test that rebuilds the live builder by hand, and the preview pool's every-token-has-a-value check, which the drift guard replaces.

**Unverified by unit test.** The live adapter inside the game view, as today. One live check in the app: enter a world, open the AI-context viewer, confirm the Entities and Location chips carry the same text the Test Bench shows for that location.

**Prior art.** The location context tests build worlds as literals and assert on rendered text. The AI request spec tests take a plain snapshot and assert on the built request. The preview pool test iterates the registry.

## Out of Scope

- Any change to what a chip renders. The text of every value stays as it is today; only where it is built moves.
- Per-turn tokens, settings-derived guidance chips, and the world's own placeholder chips.
- The Request Anatomy, the prompt editor, and the chip pop-out.
- A schema for the Settings store, the Prompt Descriptor table, and the other candidates from the 2026-09-23 architecture review.
- Changing the preview's sample text. The sample world reproduces today's strings.

## Further Notes

The architecture review that produced this spec is at `%TEMP%\architecture-review-20260923.html` on the author's machine. Its first candidate is this spec. Candidates three (every request through a pass record) and five (one Prompt Descriptor row per prompt) build on the same registry and are natural follow-ups.

The patch commit `84fd1f20` closed the live Name-content bug ahead of this work and added the first registry-derived test. This spec generalizes that fix.
