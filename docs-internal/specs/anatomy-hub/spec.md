# Spec: Request Anatomy Hub

Status: ready-for-agent

## Problem Statement

The Request Anatomy — the labeled map showing where a player's own prompt text lands inside a real request — exists only for the Narration prompt, and only as a sub-tab buried behind the System Prompt editor. A player opening Settings → Prompts lands on a wall of template text with no orientation; the map that would explain what they're looking at is two clicks away, exists for one prompt out of thirteen, and is read-only — seeing "Recap Message" highlighted in the anatomy doesn't help you find where to edit it.

## Solution

Make the anatomy the front door of every prompt. Selecting any prompt in the rail lands on its **Anatomy hub**: the full request that prompt is part of, drawn by the real assembly chain on the example playthrough under the player's own settings. Highlighted (authored) runs are clickable and jump straight to the editor that owns that text. The editors remain reachable as sub-rows in the rail; the hub is what a prompt *is*, the sub-rows are how you change it. The same clickability lands in the in-game AI-context viewer: clicking an authored run on a real captured request opens Settings at the right prompt and editor.

## User Stories

1. As a player, I want to see the full request a prompt belongs to when I select it, so that I understand what I'm editing before I edit it.
2. As a player, I want every prompt in the rail to open on its anatomy, so that no prompt greets me with raw template text and no context.
3. As a player, I want the System Prompt editor to no longer be the default landing view, so that the first thing I see explains rather than intimidates.
4. As a player, I want to click a highlighted run in the anatomy and land in the editor that owns that text, so that "see it" and "change it" are one gesture apart.
5. As a player, I want clicking the recap, now-line, recall, or direction run to land on the Messages view scrolled and focused to that exact field, so that I don't have to hunt through the stacked fields myself.
6. As a player, I want clicking the system-template run to open the System Prompt editor, and the user-template run to open the User Message editor, so that every authored surface is reachable from the map.
7. As a player, I want dimmed (context) runs to stay inert, so that I can't accidentally navigate away by clicking text the app assembled and I can't edit anyway.
8. As a player, I want the anatomy for the Choices, Stat Updates, Location, Summary, Diary, Time, Opening Time, Scene Tags, Thinking, Director, Character, and Storyboard prompts, so that every AI call the game makes is explained the same way narration is.
9. As a player, I want each prompt's anatomy drawn under my own generation settings, so that a request my configuration never sends is simply absent rather than shown as a lie.
10. As a player with a location-detection mode that sends both the pre-narration and post-narration location requests, I want both shown stacked in the Location hub, so that the hub matches what my turns actually send.
11. As a player, I want the Character and Diary hubs to show one example cast member's request with a note that one is sent per character present, so that I understand the fan-out without scrolling through repetition.
12. As a player, I want condition toggles (recap condensed, recall hit, bracketed action) only on hubs where those conditions actually exist, so that no toggle promises something the assembly would ignore.
13. As a player reading the in-game AI-context viewer, I want every in-turn pass's captured request labeled with authored vs. assembled runs, so that I can read my real requests the way the Settings preview taught me to.
14. As a player reading the AI-context viewer, I want to click an authored run on a captured request and have Settings open at that prompt and editor, so that noticing a problem in a real request and fixing it is one click.
15. As a player, I want captures taken before this feature (or from unlabeled call sites) to keep rendering as plain text, so that old saves and edge-case calls degrade gracefully instead of breaking.
16. As a player, I want the rail's sub-rows to keep listing System Prompt, User Message, Messages, and Options under the selected prompt, so that direct navigation to an editor still works without going through the hub.
17. As a player, I want clicking the already-selected prompt's row to return me to its hub from any editor, so that the map is always one click away.
18. As a player, I want the hub to stay text-plus-context-bar only, with sampler and endpoint parameters remaining on the Options sub-row, so that the same data doesn't live in two places and drift.
19. As a world author testing prompts, I want the Scene Tags request assembled by the same pipeline machinery as every other pass, so that its anatomy shows the real chain rather than a mirrored approximation.
20. As a developer, I want the dev-router's anatomy surface route to land on the hub, so that automated UI verification keeps one-jump access.

## Implementation Decisions

- **Anatomy stops being a `PromptSurface`.** The hub is the state shown when a prompt is selected with no editor surface active; the surface list under each rail prompt keeps System Prompt / User Message / Messages / Options (where each exists) and drops Anatomy. `promptView` no longer resets to `system` on rail selection — it resets to the hub.
- **Every rail prompt gets a hub.** The preview builder is widened from narration-only to take a prompt id and return the full request(s) for that prompt's pass, built by calling the pass's real `buildRequest` on the canned fixture playthrough under the player's live settings — never re-described text. A prompt whose feature is off never appears in the rail (unchanged), so every hub that renders is for a request the player can send.
- **Location follows the player's detection mode**: the hub shows the pre-narration request, the post-narration request, or both stacked — whichever that mode sends. Character and Diary show one example fixture subject, captioned as one-per-character-present.
- **Condition toggles** (recap / recall / brackets) remain gated by the shared availability predicate and appear only on hubs whose pass reads those conditions — today, narration.
- **Click-to-jump is authored-runs-only.** A new pure jump-mapping function resolves an authored source (plus the capture's pass type) to a navigation target: prompt tab, surface, and — for Messages fields — the specific field to scroll to and focus. The anatomy view component gains an `onJump` callback and makes authored runs interactive; context runs stay inert. Both the Settings hub and the in-game viewer resolve clicks through the same mapping.
- **In-game jumps open Settings** via the existing initial-tab/initial-surface props, landing directly on the target editor (not the hub).
- **Sidecars extend to all in-turn passes.** Each pipeline pass's `buildRequest` labels its pieces so its `TurnPassRequest` carries an anatomy sidecar; the capture path already plumbs the sidecar end-to-end, so no envelope changes. The sidecar remains a parallel structure aligned by index and offset — never a field on a chat message — so nothing new can reach an endpoint.
- **Scene Tags is extracted** from its inline call site into a proper pass record with a pure `buildRequest`, then labeled like the others. Its idle/re-roll siblings are not unified in this slice.
- **Discover Entity gets no sidecar** — its prompt is not an editor surface, so there is nothing authored to label or jump to.
- **Skipped-run degradation is unchanged**: a capture without a sidecar renders unlabeled plain text, exactly as all captures do today.
- **The dev-router's `surface=anatomy` remaps to the hub landing**; the hub is also the target when no surface is named.
- **The footer Reset button hides on the hub** (as it does on Options today), since no single template is on screen.
- No save or world export shape changes: captures live in session state only. The manual AI-context debug JSON export grows additive `anatomy` fields on more request types; it is unversioned and inspection-only.

## Testing Decisions

- **Test external behavior at the seams, not implementation.** A good test here asserts what a request contains and what a click resolves to — never how the builder is structured internally.
- **Pass builders** (existing pass test suite): for each in-turn pass, the built request's sidecar runs tile the messages by construction, authored runs name the right sources, and the extracted Scene Tags pass builds the same request the inline site did (parity assertion before the inline site is deleted). Mutation-prove the labeling: dropping a piece label or reordering pieces must go red.
- **Preview builder** (existing anatomy preview suite): per-prompt hubs contain the player's own text in authored runs; a settings configuration that suppresses a request suppresses it in the hub (location mode variants, fan-out example subject); condition toggles re-run the real chain. Mutation-prove settings fidelity as the narration suite already does.
- **Jump mapping** (new pure suite): every authored source across every pass type resolves to the right prompt tab, surface, and field; sources with no valid target don't resolve.
- **Components** (prior art: existing anatomy panel/view and settings-modal mode suites): authored runs are interactive and fire `onJump` with the right target, context runs are not; selecting a rail prompt lands on its hub; sub-rows list the editors without Anatomy; re-clicking the prompt row returns to the hub; the dev-router lands on the hub.
- **In-game jump**: component-level assertion that a click in the AI-context viewer requests Settings with the mapped tab/surface (prior art: the game-panels harness), not an end-to-end modal dance.

## Out of Scope

- Unifying the idle drainers and re-roll call sites (summary drainer/regen, diary drainer, discover drainer/regen, choices/stats re-rolls) onto the pass builders — their captures keep rendering unlabeled. Named follow-up.
- Sidecar or hub for Discover Entity, milestone selection, or entity regeneration calls.
- Clickable context runs (e.g. jumping from a condensed-band run to Memory settings).
- Showing sampler/endpoint parameters on the hub.
- Any change to what requests actually send — this feature is inspection and navigation only.

## Further Notes

- The hub inherits the existing philosophy locked in by the settings-fidelity work: what the anatomy draws is what a turn would send, produced by the same code path, so a pipeline change shows up in the hub without being mirrored.
- The two "Messages" senses stay distinct in wording: the *Messages view* is the Settings surface stacking the conditional narration fields; the *AI-context viewer* is the in-game capture browser. Spec and UI copy should never use one term for the other.
- Changelog entry belongs in the In-Progress 👤 bucket when implemented.
