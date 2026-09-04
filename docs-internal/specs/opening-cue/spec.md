# Spec: Opening Cue

Status: ready-for-agent

## Problem Statement

When a player presses Start Game, the input box is pre-filled with one shipped, generic opening cue ("Begin the story: write the opening scene now…"). Every world opens the same way unless the player rewrites the cue by hand each playthrough. World authors have no way to author how their world's story opens — the single most tone-setting turn of the game — even though they can already customize the narration, choices, and stats system prompts.

## Solution

A new **Opening Cue** field in the world editor's advanced area. When enabled, its text replaces the shipped default cue as the pre-filled opening action for that world: the player still sees it in the input box and can edit it freely before submitting, but the starting text is the author's. The field supports placeholder chips (Variables/Wildcards), which resolve with the playthrough's pins at the moment the cue is pre-filled, so a world can open differently every playthrough. It is a full replacement — no hidden text is appended — and it is always on for players (no opt-out), since the player already has total control over the text in the input box.

## User Stories

1. As a world author, I want to write a custom opening cue for my world, so that its story opens in the tone and situation I designed instead of a generic scene-setting instruction.
2. As a world author, I want the Opening Cue field to live in the advanced editor area, so that authors who aren't customizing prompts never have to scroll past it.
3. As a world author, I want the field to open pre-filled with the shipped default cue, so that I can see exactly what I'm replacing — including the no-questions guardrail — and edit from it rather than write blind.
4. As a world author, I want my first edit to be what stores the cue on the world, so that merely opening the field never writes anything.
5. As a world author, I want an enable checkbox that keeps my text when switched off, so that a stray click never destroys what I wrote.
6. As a world author, I want a Reset action that drops my stored cue and returns the field to tracking the default, so that I can start over cleanly.
7. As a world author, I want to drop placeholder chips (Variables and Wildcards) into the cue, so that the opening varies per playthrough or reuses named values consistently with the rest of my world text.
8. As a world author, I want a blank or whitespace-only enabled cue to fall back to the default, so that an accidentally emptied field never sends an empty opening action.
9. As a world author, I want the editor find bar to reach my stored cue text, so that search-and-replace covers it like every other authored string.
10. As a world author, I want the Test Bench's Opening lens to build its preview from my cue when it's enabled, so that the bench shows what the game would actually send.
11. As a player, I want the world's cue pre-filled in the input box at Start Game, so that I keep full agency to read, tweak, or rewrite it before submitting.
12. As a player, I want placeholder chips already resolved to plain text by the time the cue reaches my input box, so that I edit readable prose, never raw tokens.
13. As a player, I want re-generating the opening page of a loaded save to fall back to the world's cue (when the world has one), so that the re-rolled opening matches the world's authored intent.
14. As a player of a world with no authored cue, I want everything to behave exactly as today, so that the feature's existence costs me nothing.
15. As a player of an old save whose history holds the legacy "START GAME" sentinel, I want that sentinel to map to the world's cue when one is enabled, so that legacy saves benefit too.
16. As a world author reading the wiki, I want the World Editor guide and the World Format field tables to document the new field, so that I can learn it without reading source.
17. As a world author sharing my world, I want the cue exported inside the world JSON, so that downloaders get my authored opening.

## Implementation Decisions

- **Name**: "Opening Cue" everywhere player- or author-facing. Not "Opening Prompt" — "prompt" in the editor already means system-prompt overrides (Custom Prompts).
- **Storage**: two additive fields on the world overview — the cue text and an enabled flag. Deliberately **not** inside the prompt-overrides object: that object is covered by the player's per-world prompt opt-out, and the Opening Cue is always-on by design (the player can already edit the text directly, so an opt-out is redundant).
- **Flag semantics** mirror the custom-prompts kinds: an explicit boolean decides; with no flag, stored text counts as enabled (forward-compat if the field is ever hand-authored without the flag). Enabled with blank/whitespace text resolves to the default cue.
- **Full replacement**: no guardrail sentence or any other text is appended to the author's cue. The pre-filled-with-default editor UX is what keeps the guardrails present unless deliberately deleted.
- **New pure helper module** (`openingCue`), mirroring the existing `worldPrompt` helper's shape: read the stored text, read the enabled state, resolve the effective cue (world's or default), plus set/clear writers the editor uses. All fallback-site consumers go through this one resolution function.
- **Editor UI**: its own labeled section in the advanced-only area of the World details panel, near Custom Prompts — checkbox + one placeholder-capable multi-line field. Opens pre-filled with the shipped default cue as an unstored template; first edit stores; Reset (with confirm, matching Custom Prompts) drops the stored text back to tracking the default. Toggle-off keeps the text and only clears the flag.
- **Placeholder chips**: the field uses the placeholder-capable editor (chips for Variables/Wildcards). Resolution happens with the playthrough's active pins at the moment the cue is pre-filled into the input box at Start Game — the same boundary as other world text — so the player sees and edits plain resolved text. Downstream (history, regen ref, AI request) only ever sees resolved text.
- **Fallback sites follow the cue**: every place the shipped default currently serves as the opening fallback — the pre-fill at Start Game, the page-1 regenerate fallback for loaded saves, and the legacy "START GAME" sentinel mapping in the narration pass — resolves through the helper, pins applied where a pre-fill is being constructed.
- **Test Bench**: the Opening lens builds its preview action from the effective cue (world's when enabled, default otherwise).
- **Find bar**: one search target for the stored cue text, registered only when text is stored (a field still tracking the default holds no world text to find) — same rule as the custom prompts.
- **No player-facing advertising**: nothing added to the world details popup or entry flow. The pre-filled input box is the disclosure.
- **Export shape**: two additive fields on the exported world JSON. This is an export-shape change — the implementer must flag it in their report per the standing project rule; version bump/migration decisions are the user's.
- **No shipped-prompt text changes**: the default cue constant is untouched, so no probe run is required. The authored cue is author-owned content, not a shipped prompt.
- **Docs**: the World Editor wiki page gains a short Opening Cue subsection in its advanced coverage; the World Format page's overview field table gains the two fields; changelog gets a 👤 In-Progress entry.

## Testing Decisions

Good tests here assert external behavior at the seams below — what text resolves, what the editor stores, what the bench and narration pass send — never internal call structure. Prior art for each seam already exists in the repo.

- **The new `openingCue` helper module** carries the semantic tests: enabled-flag precedence, absent-flag-with-text counts as on, enabled+blank falls back to default, disabled-with-text resolves to default, set/clear writer behavior. Prior art: the `worldPrompt` helper's test file.
- **The editor section** is tested through the existing World details manager component tests: checkbox toggles the flag without destroying text, field opens showing the default when nothing is stored, first edit stores, Reset clears back to tracking. Prior art: the Custom Prompts section tests in the same file.
- **The Test Bench Opening lens** through its existing builder tests: preview uses the world cue when enabled, default otherwise. Prior art: the existing opening-builder tests.
- **The narration pass sentinel mapping** through the existing turn-pass tests: "START GAME" maps to the world cue when enabled, the default when not. Prior art: the existing opening-turn cases there.
- **The find-bar target** through the existing world-search target collection tests, if that suite covers the custom-prompt targets; mirror that coverage.
- **Game-viewer wiring** (pre-fill at Start Game, pin resolution, page-1 regenerate fallback) has no unit seam — the god component isn't unit-tested. Verified live in the preview via the dev-router instead, with static/DOM evidence.

## Out of Scope

- Any player opt-out or per-player override of the world's cue (the editable input box is the override).
- Advertising the cue in the world details popup, entry flow, or community listings.
- Changing the shipped default cue's text.
- Locking the pre-filled cue against player edits, or an author-side "players may edit" knob.
- Adding the cue to the prompt-overrides object or the custom-prompts UI.
- Version bump or save/world migration (user-managed; the fields are additive).
- Per-location or per-trait opening variants — one cue per world.

## Further Notes

- The sibling feature spec at `docs-internal/specs/world-custom-prompts/` is the closest precedent; this feature deliberately copies its editor UX (pre-filled template, first-edit-stores, Reset, toggle-keeps-text) while staying outside its storage object and opt-out.
- The opening action's journey is subtle: the pre-filled text is submitted as the player's action, history stores it (or the legacy sentinel), and the real opening text also lives in a session ref used by page-1 regeneration. The helper must be the single source for "what is this world's opening cue" so those paths can't drift.
- Placeholder resolution at pre-fill time means the *stored* world text keeps its chips; only the input-box copy is resolved. Wildcards therefore re-roll on each fresh Start Game, consistent with placeholder semantics elsewhere.
