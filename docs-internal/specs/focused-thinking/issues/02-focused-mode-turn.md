# 02: Focused Mode Turn

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it adds a turn pass and changes the shared entity roster builder under the turn-plan parity suite.

## What to build

A player picks Focused (Experimental) in the Thinking Mode picker and plays a turn. The turn runs the location passes, then the Focus Classifier, then narration (Q2, Q15). Narration gets each Focus entity's full block, each Background entity's summary render (summary over description, trait names only, no stats), and Offstage entities as one name list (Q4, Q7, Q8). Entities in sublocations follow their tiers the same way (Q6). The narration prompt says nothing about tiers.

- `focused` joins the Thinking Mode values; the picker shows "Focused (Experimental)" (Q1, Q20). Copy follows the Writing Guide.
- The classifier is a new pre-narration pass and its own prompt kind, using the prompt text from ticket 01. It has sampler pins in the per-prompt sampler table, sends native reasoning off, and uses the narration endpoint (Q11, Q16). Its prompt editor tab and endpoint setting come in ticket 03.
- The reply parses into a map from entity id to Focus Tier. A failed call, a missing letter, an unknown tier word or no readable line sends the full roster (Q10). No code-side floors (Q9).
- This ticket owns the tier map type and the roster builder's tier option. With no tier map, every roster renders as today. Only the narration's here and sublocation scopes read it (Q3). Post-narration passes keep their rosters (Q18).
- The turn records the tier map, or that it fell back, where the request inspector can read it later (ticket 04).
- CONTEXT.md gains Focus Classifier, Focus Tier and Focused, each noting that In Scene is a separate idea.
- A changelog fragment for the new experimental mode.

## Acceptance criteria

- [ ] With a scripted classifier reply, the narration request holds the Focus entity's full block, the Background entity's summary without its stats, and the Offstage entity only in the name list.
- [ ] A sublocation entity follows its tier the same way.
- [ ] A garbled reply, a reply missing a letter, and a failed classifier call each send the full roster, and each test fails when its fallback is removed.
- [ ] After a move, the classifier request lists the destination's entities.
- [ ] Native, Inline, Planning and Staged turns make no classifier call, and the turn-plan parity suite passes unchanged.
- [ ] The classifier request sends native reasoning off and the pinned samplers.
- [ ] The glossary has the three new entries.

For you: play a few Focused turns in a world with 3 or more entities in one place and judge whether narration keeps the room alive.
