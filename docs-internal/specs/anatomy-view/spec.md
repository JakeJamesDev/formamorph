# Request Anatomy

Status: ready-for-agent

*Rewritten after the UI prototype (four rounds, winner E3). The original spec labeled every structural
piece of the request with equal weight; the prototype proved the real question is "where does MY authored
text land?", which reshaped the data model and both surfaces.*

## Problem Statement

A player (or world author) editing the narration prompt's pieces — the System Prompt, the User Message,
and the four Narration Messages (Recap, Now, Recall, Direction) — cannot see where their text actually
lands in a real request. The AI Context viewer shows every sent message as unlabeled walls of role text:
their authored prompt text is visually indistinguishable from assembled context (summaries, history,
chip-injected world data). And with no game running, there is no way to see the assembly at all. Labeling
every structural piece equally (tried in prototype rounds 1–2) buries the answer: what players need is
their own text made visible against everything the app assembled around it.

## Solution

Split every assembled narration-request message into two kinds of run — **authored prompt text** (owned by
one of the six editor surfaces) and **assembled context** — and render that split in two places:

1. **AI Context** — each block shows its real content with authored runs highlighted and labeled by the
   editor that owns them; context runs are muted. A run's absence on a turn *is* its sent-when condition,
   demonstrated live.
2. **Settings → Prompts → Narration → Anatomy** — a Request Anatomy view rendering the same labeled
   shape from a bundled example playthrough, in the prototype's winning E3 form: context runs collapse to
   an `<explanation>` plus a one-line dimmed excerpt, so the anatomy reads at a glance. Condition toggles
   (Memory Summaries condensed, Scene Recall hit, bracketed action) let a player watch runs appear and
   disappear.

Both surfaces share one shell, settled by the prototype: a hard **System Prompt vs Messages** split as two
headed regions ("one block, sent first, sets the rules" / "the conversation the AI continues"), with
user/assistant blocks chat-staggered inside Messages.

The labels are a sidecar — data that rides alongside the messages through the existing pure assembly, is
captured into the per-turn AI Context record, and is stripped before anything reaches the network. Sent
bytes are unchanged.

## User Stories

1. As a player, I want my authored prompt text highlighted inside a real request, so that I can see my edits landing without decoding the assembly by eye.
2. As a player, I want the System Prompt and the Messages visually separated as two regions, so that the most fundamental split in every request is the first thing I see.
3. As a player, I want assembled context muted beneath my highlighted text, so that the request reads as "my words against the app's scaffolding" rather than a wall of equals.
4. As a player, I want each context run described in plain words ("older turns, condensed by Memory Summaries"), so that nothing in the request is mysterious even when it isn't mine.
5. As a player, I want the action/narration history pair described asymmetrically ("your action on a recent turn" / "the narration that answered it, word-for-word"), so that repeated identical labels don't read as a bug.
6. As a player, I want the Now Message visibly marked inside the recap's reply, so that I can see my edit to it in place.
7. As a player, I want the Direction rider marked inside my action's message on bracket turns, so that I can confirm a bracketed action actually carried it.
8. As a player, I want a turn without a recap to simply show no recap runs, so that the sent-when conditions from Settings are demonstrated rather than asserted.
9. As a player, I want a Request Anatomy view in Settings, so that I can understand the narration request's shape before ever starting a game.
10. As a player, I want the anatomy view's context collapsed to explanations with short excerpts, so that the whole request fits in one scan (the prototype's E3 verdict).
11. As a player, I want the anatomy view's conditional runs toggleable, so that I can watch what Memory Summaries, Scene Recall, and a bracketed action each add or remove.
12. As a player, I want the anatomy view rendered from the real assembly on an example playthrough, so that what I see is true and cannot drift from the code.
13. As a world author, I want the system prompt's template text distinguished from the world data my chips inject, so that I can see which words are mine and which are the world's.
14. As a player, I want dictionary highlighting to keep working alongside the run styling in AI Context, so that the two inspection aids compose.
15. As a player, I want turns captured before this feature to render as they do today, so that an old session's AI Context doesn't break.
16. As a player, I want the AI to receive exactly the same bytes as before, so that inspection never changes behavior.
17. As a developer, I want the run sidecar built where the messages are built, so that a new assembly step cannot ship unlabeled without failing a test.
18. As a developer, I want every run's offsets verified against the rendered content they index, so that a label can never point at the wrong text.
19. As a developer, I want the Settings anatomy view driven by a pure preview builder, so that its output is unit-testable without rendering the app.
20. As an agent working in this codebase, I want the anatomy vocabulary in the glossary, so that the sidecar, the viewer, and the Settings view stay navigable by one set of names.
21. As a player on mobile, I want the regions and staggered blocks readable at mobile width, so that the anatomy is not a desktop-only aid.

## Implementation Decisions

- **The run model** (from the prototype; the real sidecar is offset-based per message rather than
  text-carrying):

  ```ts
  type Source = 'system-template' | 'user-template' | 'recap' | 'now' | 'recall' | 'direction';
  // Per message: ordered runs covering the content; source set = authored, else context.
  interface Run { start: number; end: number; source?: Source; contextLabel?: ContextLabel }
  ```

  Six sources — one per editor surface a player can own text in. Everything else is context.
- **Context label vocabulary** (settled by the prototype's label sweep; player-voice, each naming the
  feature that produced it, no twin labels on adjacent runs):
  - world data injected by your chips — description, stats, location, entities, lore
  - older turns, condensed by Memory Summaries
  - the turn Scene Recall brought back, word-for-word
  - your action on a recent turn / the narration that answered it, word-for-word
  - your action, as you typed it
- **The sidecar, not tags on messages.** Chat messages are never widened; the anatomy is a parallel
  structure aligned by message index and content offsets. Nothing new can leak to an endpoint.
- **Built at the existing assembly points, one refinement.** The history banding function returns run
  sidecars alongside its messages; the narration pass record's request builder carries them through and
  appends the final user turn's runs (user-template, typed action, direction rider, mode directives as
  context). New since the first spec draft: the system prompt's template-vs-chip split requires the prompt
  template renderer to emit run boundaries (template text vs chip-injected values) — a run-emitting
  variant of the existing pure render, same module, no new seam. ADR-0001's two pipeline seams stand.
- **Capture and strip.** The request envelope gains an optional anatomy field; the AI-call layer strips it
  before the network; the AI Context capture stores it on the per-turn record like the endpoint info
  field. Old captures without anatomy render unlabeled, as today.
- **Shared shell, two context treatments.** Both surfaces render the System Prompt / Messages regions with
  chat-staggered blocks and highlighted authored runs. AI Context shows context runs in **full** (players
  are inspecting real turns; the bytes are the point), muted, with the context label available. The
  Settings view uses **E3**: context runs render as their `<label>` plus a one-line dimmed excerpt.
- **The Settings view** is a new Anatomy surface on the Narration prompt (sibling of System / User /
  Messages / Options), fed by a pure preview builder that runs the real chain — system prompt assembly,
  history banding, the narration pass's request build — on a bundled fixture playthrough with
  deterministic placeholder resolution. Condition toggles re-run the builder with the condition flipped.
  The fixture derives from the Turn Pipeline's existing parity/test inputs and must exercise every
  condition: a condensed band, a recallable old scene, a bracketed action.
- **Highlight styling**: each source gets a stable accent; authored runs render as marked ranges with a
  small leading label chip naming the editor surface. Context muting must survive both themes.
- **New Settings surface gets a dev-router entry**, per the standing convention.
- **No export-shape change.** Anatomy lives in session state and the AI Context debug download (a
  diagnostic file, not a world or save export). Persisting it in the save envelope is out of scope and
  would need the mandatory export-shape reminder.
- **Glossary**: add "Request Anatomy" (the labeled map of one request's assembled runs) and "Authored Run"
  vs "Context Run" to the project glossary.

## Testing Decisions

- Test external behavior at the highest existing seams: feed the template renderer, the banding function,
  and the narration pass builder real inputs and assert on the (messages, runs) pairs they emit — never on
  internals.
- **Offset truth**: every run assertion slices the actual content by the run's offsets and compares to the
  rendered piece (the Now Message template rendered against the fixture, the Direction rider text, the
  template prose around a chip), so offsets cannot silently rot.
- **Coverage invariant**: each message's runs tile its content exactly — no gaps, no overlaps — asserted
  generically across fixtures.
- **Byte parity**: the messages the chain emits are identical with the sidecar present, and the existing
  Turn Pipeline parity tests keep passing untouched.
- **Sent-when conditions as tests**: each conditional source gets an on/off pair — condition on, its runs
  exist; off, no trace. Mutation-prove the key guards per the standard test bar (drop the now line from
  the reply and its run must vanish, not dangle).
- **Preview builder**: unit-test its output for the fixture and each toggle combination; this doubles as
  the drift guard for the Settings view.
- **Viewer rendering**: component tests through the existing panel-harness pattern for region headers, run
  highlighting, context muting, coexistence with dictionary chips, and the unlabeled fallback for old
  captures.
- Prior art: the banding tests, the turn-pass harness's last-message assertions, the template-render
  tests, the pure enter-flow builder's tests, and the dev-route drift-guard test.

## Out of Scope

- Anatomy for non-narration passes (choices, trackers, memory passes).
- Click-to-navigate from a labeled run into its Settings editor (labels carry the pointer as text only).
- An E3-style collapse mode inside AI Context (full content only there, this pass).
- Any change to what is sent to the AI, including fixing pieces the anatomy makes newly visible (the
  parked OOC acknowledgment leak stays parked).
- Editing prompts from within either anatomy surface.
- Persisting anatomy in the save envelope.
- Localizing labels.

## Further Notes

- **Prototype verdict trail**: round 1 — split rail (C) beat transcript and envelope layouts; round 2 —
  all decramp attempts still cramped, and the piece-equality framing was diagnosed as the real problem;
  round 3 — the authored-vs-context reframe, with the winning traits split across variants (D1 regions +
  chat stagger, D2 muting, D3 angle-bracket explanations); round 4 — the combo shell with E3 (previews)
  beating full context and pure placeholders; then the context-label sweep that produced the vocabulary
  above. The prototype lives in the working tree as a DEV-only Anatomy (Prototype) surface until the real
  implementation replaces it; capture it per the prototype skill (throwaway branch) at implementation
  start — branch creation is the user's call.
- The whole assembly chain is already pure (Turn Pipeline work), which is what makes the Settings view
  drift-proof: it executes real output. No refactor rides this feature beyond the run-emitting render.
- Suggested sequencing: run-emitting template render → banding + pass sidecars + capture → AI Context
  rendering → Settings view. Gates green each stage; each stage independently useful.
- Both changelog entries are user-facing (👤): the labeled AI Context, and the Request Anatomy view.
