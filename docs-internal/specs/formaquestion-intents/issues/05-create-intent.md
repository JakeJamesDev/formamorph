# 05: Create Intent

Status: ready-for-human
Blocked by: 02, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new prompt kind with world context and a voiced refusal path.

## What to build

A question with the Create Intent gets its own request, and the Mascot drafts entities in her voice.

- A new Create prompt kind with its own sampler pins, pinned explicitly; ticket 07 tunes them. Its endpoint defaults to the Answer Endpoint (Q57).
- **In a World Editor, with the Creation switch on:** the request carries the Create prompt, the Mascot Voice, the history, the world's name and description, the names of every entity, two sample entities with their AI descriptions (the first two, in editor order, that have one), and ticket 04's entity rider (Q28, Q35). No guide, no world block, no roll. The reply streams like any answer, and its blocks render as ticket 04's cards. The classifier drops the guide pick for Create.
- **On any other screen:** the question gets the Chat plan with a refusal rider, so the Mascot says in her voice that creating works in the World Editor (Q30, Q45, Q46).
- **With the Creation switch off:** Create gets the full request.
- The help preset gains the Create prompt. A preset file without it loads with the built-in default (Q58).

Spec: Q28, Q30, Q35, Q42, Q45, Q46, Q57, Q58; stories 16–25, 32.

## Acceptance criteria

- [x] In a World Editor, Create sends exactly the Q28 context and the entity rider, on the Create prompt kind: `askHelp` test: `helpSession.create.test.ts`, whole-body equality on the Creating prompt and its pins
- [x] The two samples are the first two entities with an AI description, in editor order: `helpSession.create.test.ts`, a folder ahead of root entities and a first entity with no AI description
- [x] On a screen with no World Editor, Create sends the Chat plan with the refusal rider: `helpSession.create.test.ts`, game world and no world
- [x] With the Creation switch off, Create sends the full request: `helpSession.create.test.ts`, body equal to the switch-off body, in the editor and in game
- [x] A help preset file without the Create prompt loads with the default; one with it round-trips: `helpPresetFile.test.ts`, and the stored store in `helpPresets.test.ts`
- [x] The Create endpoint setting defaults to the Answer Endpoint: `helpRoutes.test.ts`, `FormaquestionEndpointTab.test.tsx`, and the request URL in `helpSession.create.test.ts`

## Landed

**Not verified:**

- The Creating prompt, the sample format and the refusal rider are unprobed. Ticket 07 measures them; **Creation** and **Sort Questions** stay off by default until their probes pass.
- The **Creating Endpoint** field and the **Creating** prompt were checked by component tests only, not in a preview.

**For you:**

- For you: in the World Editor, ask for a single entity, then for two at once, then "make him older", and judge the replies and drafts.
- The labels: **Creating Endpoint** (Formaquestion Settings → **Endpoint**), the **Creating** prompt and its options (→ **Prompts**), and **Request N: Creating** in AI Context.

**For ticket 07:** the Mascot Voice chip on the Creating prompt still says to write control names as the guide writes them; that frame is shared by every help prompt.
