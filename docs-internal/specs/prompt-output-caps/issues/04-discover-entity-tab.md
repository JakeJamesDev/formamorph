# 04: Discover Entity Tab

Status: ready-for-human
Base: acedfd76
Blocked by: 02 — Max Output Row On The Capped Prompts
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: [Prompt Output Caps](../spec.md)

## What to build

A player sees a Discover Entity tab in the Story group after Character, shown when describe-characters is on. The tab has a System Prompt editor, a User Message editor, and the full Options panel including the Max Output row. The Request Anatomy hub draws a discover request with the fan-out caption. A click on a discover run in the AI Context viewer jumps to the tab.

The discover system prompt and the player-triggered rewrite prompt merge into one text that names later material as optional and says it outranks the first impression. The rewrite constant goes. The user template exposes three chips: the character's name, the passage they first appeared in, and the later material. The later-material chip carries its own section label in its prefix and vanishes when empty, so a first note and a rewrite share one template.

The discover pass record moves to the labeled request form, tiled from the preset's system prompt and user template, so it carries anatomy. The view's serial drainer, the concurrent fan-out, and the rewrite all build their request through it.

The merged prompt is a text change to a probed prompt. Ship it with an A/B probe on both reference tiers against the current discover prompt, per the prompt-writing guide's bar, and record the numbers under Comments.

## Acceptance criteria

- [ ] The tab appears after Character when describe-characters is on and is absent when off.
- [ ] Both editors render with their chips. The later-material chip renders nothing when empty.
- [ ] The preset gains the discover system prompt and user template keys with shipped defaults; the section-style restyle and the share filter carry them.
- [ ] The discover pass record builds a labeled request with anatomy from the preset texts. The serial path, the fan-out path and the rewrite send the same system prompt.
- [ ] The rewrite with no later appearances sends the same user message as a first note.
- [ ] The anatomy hub draws the tab with the fan-out caption; the tab-for-request map resolves `discoverEntity` to the tab; every drift guard (label, description, availability, hub, tab-to-request) passes.
- [ ] The Max Output row shows `Auto · 200 tok`.
- [ ] Probe results for the merged prompt recorded under Comments, both tiers, before and after.
- [ ] Changelog entry from 02 extended to name the tab.
- [ ] Export-shape reminder present in the closing response: the shared preset gains two text keys.
- [ ] Four gates green; `graphify update .` run.

## Notes

Workload rationale: a prompt merge under probe discipline, a pass-record rewrite that three callers share, and a new rail tab with every registry and guard. The widest slice in the set.

## Comments

**Probe:** `testing/baseline/harness/discover-note-probe.mjs`, 2026-09-16. Arm A = the request at `acedfd76` (old discover prompt + first-note message, old regen prompt + regen message). Arm B = what the shipped pass builds. Six first-note cases, four rewrite cases whose later material revises the first impression. Cloud = `api.lyonade.net` `default`; Cydonia = `cydonia-24b-v4.3@q4_k_m`, seeded.

**Iterations (rewrite "stale" = the note still names the superseded trait; crude, a "cheerful facade" counts):**

| Arm | Change | Result |
|---|---|---|
| B1 | first merge ("writing", "shows or clearly implies", new later label) | stale up on both: Cydonia 20→33/48, cloud 40→67/96 |
| B2 | old regen text, "writing", old later label | Cydonia first notes over 3 sentences 0→9/36, words 70→83 |
| B3 | + "drawn only from what the material shows" | overrun 5/36 |
| B4 | + length restated in the closing line | overrun 5/72; cloud stale 41→61/96 |
| B5 | opening names the later material as rewrite-only | no better (4/72); dropped |
| **B6 (shipped)** | B4 + opening says "writing … or rewriting it once the story has shown more of them" | below |

**B6 vs A:**

| Target | Scope | Metric | A | B6 |
|---|---|---|---|---|
| Cloud, 12 runs | first notes | empty / you / over range / no name / echo / cut | 0 / 0 / 0 / 0 / 0 / 0 of 72 | 0 / 0 / 0 / 0 / 0 / 0 of 72 |
| Cloud, 12 runs | first notes | words | 47.2 | 45.8 |
| Cloud, 24 runs | rewrites | follows later / stale | 88 / 37 of 96 | 92 / 45 of 96 (inside noise; A alone ranged 13–21/48 across batches) |
| Cydonia, seeds 7 + 200, 6 runs each | first notes | over range / you | 0 / 3 of 72 | 4 / 1 of 72 |
| Cydonia, seeds 7 + 200 | first notes | words | ~70.5 | ~68.8 |
| Cydonia, seed 100, 12 runs | rewrites | follows / stale / no name | 46 / 23 / 0 of 48 | 44 / 18 / 4 of 48 |
| Cydonia, seed 100 | rewrites | words | 74.8 | 64.4 |

**Open for the user:** B6 is at parity on cloud. On Cydonia it leaves two small gaps: 4/72 first notes run to a fourth sentence, and 4/48 rewrites open with "A baker…" instead of the name.
