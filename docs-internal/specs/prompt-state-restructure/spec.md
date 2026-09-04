# Spec: State Chips Move to the Narration User Message

Status: ready-for-human
Status note: built and PARKED as experimental; see findings.md. Implementation lives on branch prototype/prompt-state-restructure.

## Problem Statement

The narration system prompt carries almost all scene state: current location, entities, activated lore, stats, traits, and player notes. Models weight recent tokens most, and the system prompt sits furthest from the generation point, behind the whole chat history. Small models lose track of who is present, where the scene is, and what the player's notes ask for. The grounding failures show up as absent characters speaking, wrong-location details, and ignored notes.

## Solution

The default narration templates move per-turn state into the current user message, directly before the player's action. The user message becomes: a wrapped Current Scene section (traits, stats, location group, foreground lore, entities group, notes, in that order), an Action header, the bare action, then the first-beat rider. The system prompt keeps stable content: rules, world description, and background lore. History stores the bare action, so the state block never accumulates. The chip vocabulary becomes resolvable in user-message templates as an additive capability; system templates keep it. The change ships as a straight default-template cutover, and only after probes show a measured grounding win.

## User Stories

1. As a player, I want the narrator to know who is actually present in the scene, so that absent characters do not speak or act.
2. As a player, I want the narration grounded in my current location, so that scene details match where my character stands.
3. As a player, I want my player notes obeyed, so that standing instructions shape every turn without me repeating them.
4. As a player, I want my current stat readings to shape how actions resolve, so that a critical stat shows in the outcome.
5. As a player, I want my held traits reflected in the prose, so that transformations stay visible in the story.
6. As a player, I want activated lore to inform the current scene, so that world facts appear where they are relevant.
7. As a player, I want the opening scene built from the same state shape, so that turn one is as grounded as every later turn.
8. As a player on the default prompts, I want the new shape applied automatically, so that I get the improvement without touching settings.
9. As a custom-prompt author, I want state chips to resolve in the user-message template, so that I can place state near recency myself.
10. As a custom-prompt author, I want state chips to keep resolving in the system template, so that my existing preset keeps working unchanged.
11. As a custom-prompt author, I want the choice of chip placement per message, so that I can experiment with my own shapes.
12. As a custom-prompt author, I want my customized preset left untouched by the cutover, so that no tool silently edits my authored text.
13. As a custom-prompt author, I want the prompt diff viewer to show my preset against the new default, so that I can adopt the new shape deliberately.
14. As a world author, I want background lore to stay early in the system prompt, so that my chosen background placement keeps its low-attention meaning.
15. As a world author, I want foreground lore near the action, so that my chosen foreground placement gains real recency.
16. As a player, I want past turns stored as bare actions, so that old state blocks do not bloat or confuse the history.
17. As a player, I want the recap Now line kept, so that scene continuity survives history digests.
18. As a player using Thinking mode, I want the staged prompts unchanged in this wave, so that an unprobed shape does not reach that lane.
19. As a developer, I want the composed request asserted at one seam, so that the shape cannot drift silently.
20. As a developer, I want the AI-context popup to group the moved chips correctly, so that debugging a turn stays readable.
21. As a probe operator, I want a grounding-error metric, so that the win condition is objective and repeatable.
22. As a probe operator, I want a three-arm matrix in one campaign, so that the stats-split question is answered alongside the main move.
23. As a maintainer, I want the cutover to be revertable by restoring the default templates, so that a neutral probe result costs nothing.

## Implementation Decisions

- Default narration templates change: the system template drops traits, stats, location group, foreground lore, entities group, and notes; the narration user-message template gains them inside a `## Current Scene` wrapped section with subheads, followed by an `## Action` header, the bare action token, and the existing first-beat rider.
- Block order inside Current Scene is recency-ranked: traits, stats, location group, foreground lore, entities group, notes. Entities and notes sit nearest the action.
- Background lore stays in the system prompt. Its early placement is authorial semantics ("background" = far from recency).
- Chip resolution in user-message templates is an additive capability across the chip vocabulary. System templates lose nothing. Placement is the author's choice per message.
- History stores the bare action only, following the OOC-rider pattern. The state block is composed per turn and never persists.
- Scope is the narration call, thinking-off lane, opening turn included. The staged Thinking-mode prompts and the aux calls are out of this wave; they are single-shot, so the recency case is weak there.
- The Now line stays. It anchors the digest band inside history, which is a different job from the per-turn state block.
- The stats chip moves whole in the primary arm. A probe arm tests the split: static stat meaning in the system prompt, current readings in the state block. The chip axes for this split already exist.
- Rollout is a straight default-template cutover with no setting. Customized presets keep their shape under the template-fidelity contract: no nudge, no migration.
- Ship bar: the grounding-error metric must improve on both probe tiers, and existing metrics (dialogue participation, length, ending contract) must not regress. A neutral result reverts the defaults.
- No export-shape change: world and save JSON are untouched. Prompt presets store template text, and only defaults change.

## Testing Decisions

- Good tests assert external behavior at the narration request-build seam: gameplay state and preset templates in, composed messages out. No test reads renderer internals.
- Assertions at that seam: the system message contains no moved chip output; the user message contains the Current Scene section in the decided order, the Action header, the bare action, and the rider; the stored history entry is the bare action; a custom preset in the old shape still renders the old shape (fidelity); the opening turn composes the same shape around the opening cue.
- A renderer-level unit seam is added only if user-template chip resolution proves unreachable from the request-build seam.
- Prior art: the existing narration-prompt and turn-pass tests, and the parity-fixture style for whole-request shape assertions.
- Prompt-quality evidence comes from the probe harness, not vitest: a new grounding-error probe (absent-entity mentions, wrong-location details, ignored notes) run as a three-arm campaign (old shape / new shape stats-whole / new shape stats-split) on both standard tiers, with regression checks on the existing metrics.

## Out of Scope

- The staged Thinking-mode prompts (director, character, storyboarder).
- All aux calls: choices, stat updates, location change, planner, summary, milestone, diary, entity discovery, time, scene tags.
- Any change to the digest layer or its history-rewrite cadence.
- Retiring or trimming the Now line.
- Preset migration or outdated-preset notices.
- Any caching-motivated work. Measured 2026-08-28: the prefill saving is ~0.3s/turn on GPU hardware and the digest layer is the larger cache-breaker, so caching does not justify this change.

## Further Notes

- The behavioral case must carry the ship decision. The probe campaign is the gate, per the prompt-writing guide's evidence bar.
- Dev-tooling touchpoints to keep green during implementation: chip editor section presets, prompt diff viewer baseline and its chip sentinels, AI-context popup grouping, and the dev sample that strips prompt headers.
- The moved chips appear only in narration templates today; the aux templates keep their own state chips in system position until a follow-up wave.
