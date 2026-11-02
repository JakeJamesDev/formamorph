# 04: Entity Cards

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the first write path from Formaquestion into the world, plus a new ADR.

## What to build

A fenced `entity` block in any Formaquestion answer renders as a card that adds the entity to the open world. This works without the Intent Classifier.

- **Parser:** one pure function turns a block's text into a name and an AI description, or a list of problems. Valid: a non-empty Name, an AI Description of 1–4 sentences, no other labels. Labels match case-insensitively; the AI Description runs to the fence end (Q38, Q61). The card and ticket 07's probe both call it.
- **Card:** every `entity` fence in any reply renders through the existing snippet seam as a read-only card with the name, the AI description, **Copy** and **Add** (Q10, Q36, Q39, Q51). While the fence streams, the card shows what has arrived. An invalid block renders as a plain code block.
- **Add:** needs an open World Editor, the in-game World Editor included (Q41). Elsewhere it is disabled, with a tip that says why. It writes to the open world (Q52), builds the entity from the blank-entity default with the block's name and AI description, places it at the root (Q56), and adds it through the editor's normal path, so undo records it. It then opens the Entities panel if needed and selects the entity (Q11, Q53).
- **Write handle:** the World Editor registers the add action beside its read source in the help world registry. The game registers none.
- **Duplicate:** a name that matches an existing entity keeps Add enabled, with a warning tip (Q37).
- **Note:** after Add, the next help request carries one line that names the entity added (Q7).
- **Rider:** in a World Editor, with the **Creation** switch on, the full request carries the entity rider that names the block format (Q64). This ticket owns the rider text; ticket 05 reuses it.
- **Switch:** a **Creation** switch in Formaquestion's settings, default off until ticket 07 passes (Q16, Q43).
- **Docs:** a new ADR records that Formaquestion may add to the open world in a World Editor through an action the player clicks, covering Code Insert and Take Me There too (Q40). Amend the Formaquestion entry in CONTEXT.md. The player docs describe cards and the switch.

Spec: Q5, Q7, Q10, Q11, Q16, Q36–Q41, Q43, Q50–Q53, Q55, Q56, Q61, Q64; stories 16–36.

## Acceptance criteria

- [x] The parser accepts and rejects each Q61 case, multi-line descriptions and label case included: parser tests: `entityBlock.test.ts`
- [x] An entity fence renders as a card; an invalid one renders as code: `Formaquestion.entityCards.test.tsx`, through the real renderer, streaming included
- [x] Add puts the entity at the root of the open world with the block's name and AI description, opens the Entities panel and selects it, and undo removes it: World Editor bench test: `WorldEditor.entityAdd.test.tsx`
- [x] Add works in the in-game World Editor: same bench with `inGame`
- [x] Add is disabled, with its tip, on a screen with no World Editor: `Formaquestion.entityCards.test.tsx`, no world and game world
- [x] A clashing name shows the warning tip and still adds: `Formaquestion.entityCards.test.tsx`, including a name the card's own Add just put in the world
- [x] The next help request carries the Add note: `Formaquestion.entityCards.test.tsx` (and kept when that question fails) and `helpSession.entityBlocks.test.ts`
- [x] The full request carries the entity rider in a World Editor with the switch on, and not otherwise: `helpSession.entityBlocks.test.ts`
- [x] The game registers no add action: a test that reads the registry in game: `GameViewer.helpWorld.test.tsx`
- [x] The ADR, the CONTEXT.md amendment and the player docs exist: ADR-0015, the Formaquestion glossary entry, `docs/Formaquestion.md` "How to Add an Entity From an Answer" and the **Creation** settings row
- [x] Frames: `.scratch/frames/entity-card-light.png` and `.scratch/frames/entity-card-dark.png`, at the Formaquestion window's default width: from `#dev?modal=formaquestion&fixture=entityCards` at 1280×800

## Landed

**Not verified:**
- The entity rider is unprobed. Ticket 07 measures it; **Creation** stays off by default until then.

**For you:**
- For you: paste an entity block into a Formaquestion reply through the dev-router, then judge the card's look and how Add feels in the World Editor. `#dev?modal=formaquestion&fixture=entityCards` opens the window on a canned answer with two cards and one invalid block; open a World Editor first for a live Add.
- The card is a new visual pattern (bordered muted box, Entity label, Copy and an outlined Add): approve it or ask for changes. Frames: `.scratch/formaquestion-intents-04/frames/entity-card-light.png`, `.scratch/formaquestion-intents-04/frames/entity-card-dark.png`.
- A duplicate name shows a warning icon beside the name, and the same warning as Add's tip.
