# 02: Max Output Row On The Capped Prompts

Status: ready-for-human
Base: 9cfe9b24
Blocked by: 01 — Scene Tags Tab Tunes Its Own Prompt
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: [Prompt Output Caps](../spec.md)

## What to build

A player opens a prompt's Options panel and sees a Max Output row between Endpoint and Native Reasoning. Off, it reads `Auto · N tok` with the shipped cap and a dimmed slider. On, the slider sets the cap in tokens (8 to 2048, step 8) and the readout shows the value. The value persists on the user's prompt preset, locks with the read-only notice under a built-in preset, and travels in a shared preset. A custom cap reaches the endpoint as `max_tokens`, and the Reasoning Budget scales from it.

The row appears on Thinking, Director, Character, Storyboard, Summary, Diary and Scene Tags. The Reasoning Budget readout gains the token result of its percent, read from the row's resolved cap.

Copy the sampler row's shape and the sampler map's storage pattern. Add a 👤 changelog entry under In Progress.

## Acceptance criteria

- [ ] The row renders on the seven tabs and on no other tab.
- [ ] Off: readout `Auto · N tok` where N is the shipped cap; slider dimmed and pinned at N. On: readout `N tok`, slider live. Toggling off and on keeps the custom value.
- [ ] Under a built-in preset the row is locked and the read-only notice shows.
- [ ] The Reasoning Budget readout reads `P% · T tok`, and T follows the row: shipped cap when off, custom when on.
- [ ] The AI Request Spec sends the custom cap as `max_tokens` when on, the pass cap when off, and labels a custom cap's source as `internal`. The reasoning budget is computed from the resolved cap.
- [ ] The preset store persists the map, returns an empty map for a built-in, and its writer is a no-op under a built-in.
- [ ] A shared preset carries the map, omits it when empty, imports an older preset without it as all Auto, and drops a malformed entry while keeping the rest.
- [ ] Changelog: one 👤 entry appended under In Progress.
- [ ] Export-shape reminder present in the closing response: the shared preset format gains `maxOutput`.
- [ ] Four gates green; `graphify update .` run.

## Comments

Ruling from the spec session (2026-09-16): on JetBrains Mono the readout `Auto · 200 tok` wraps to a second line inside the fixed-width readout box. Size the readout to its content: `whitespace-nowrap shrink-0 min-w-28`, no fixed width, so the slider absorbs the difference. Apply the same to the Reasoning Budget readout and the existing sampler readouts so the column stays consistent. Verify in the preview under JetBrains Mono and the system font.

## Notes

Workload rationale: one slice through preset storage, share parsing, request resolution and the Settings panel, with tests at four seams. Needs sustained cross-module reasoning.
