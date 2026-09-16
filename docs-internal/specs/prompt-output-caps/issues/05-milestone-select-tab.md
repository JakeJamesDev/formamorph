# 05: Milestone Select Tab

Status: ready-for-human
Base: acedfd76
Blocked by: 02 — Max Output Row On The Capped Prompts
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: [Prompt Output Caps](../spec.md)

## What to build

A player sees a Milestone Select tab in the Memory group between Summary and Diary, shown when memory digests are on. The tab has a System Prompt editor, a User Message editor, and the full Options panel including the Max Output row. The Request Anatomy hub draws a milestone request with a between-turns caption. A click on a milestone run in the AI Context viewer jumps to the tab.

The preset gains the milestone system prompt (the incremental one, which is the live one) and a user template. The template exposes two chips: the remembered moments and the new moments. Code numbers both lists continuously, kept first, and appends the reply-format lines after the rendered template: Keep, Forget and Weight, or Keep alone on a first run. The parser contract never enters the template.

Milestone Select gets a pass record with fixture material for the hub (a canned kept list and fresh list) and the Low reasoning tier, the same as Summary. Its cap moves from the view into the pass cap table at 300. The view's between-turns selector keeps its trigger and builds its request through the record. The non-incremental milestone prompt and its unused user-message builder are deleted.

## Acceptance criteria

- [ ] The tab appears between Summary and Diary when memory digests are on and is absent when off.
- [ ] Both editors render with their chips.
- [ ] The preset gains the milestone system prompt and user template keys with shipped defaults; the section-style restyle and the share filter carry them.
- [ ] The pass record builds a labeled request with anatomy. Its user message numbers the kept list then the fresh list continuously, and appends Keep/Forget/Weight lines, or a Keep line alone when the kept list is empty.
- [ ] The view's selector sends the request the record builds, with `maxTokens: 300` from the cap table.
- [ ] The anatomy hub draws the tab; the tab-for-request map resolves `milestoneSelect` to the tab; every drift guard passes; the reasoning tier list places it at Low.
- [ ] The Max Output row shows `Auto · 300 tok`.
- [ ] The dead non-incremental prompt and its builder are gone, and nothing references them.
- [ ] Changelog entry from 02 extended to name the tab.
- [ ] Export-shape reminder present in the closing response: the shared preset gains two text keys.
- [ ] Four gates green; `graphify update .` run.

## Notes

Workload rationale: a new pass record with hub fixtures, a view call re-routed through it, and a new rail tab with every registry and guard. No prompt-text change, so no probe.
