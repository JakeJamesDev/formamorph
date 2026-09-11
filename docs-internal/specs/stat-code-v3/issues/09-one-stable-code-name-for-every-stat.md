# 09: One Stable Code Name For Every Stat

Status: ready-for-agent
Blocked by: 01, 07, 08
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

One function has to become the only source of a stat's name across the sandbox, the editor's completions, the Test Bench rules, and the play site, and the play site is the god node. The blast radius is what earns Opus at high effort.

## What to build

The name stat code sees for a stat is derived from authoring, never from a roll. A stat's code name is its authored name with each placeholder chip replaced by that placeholder's own name, so `{{Beast}} Power` reads as `Beast Power` in every playthrough. One pure function computes it, and every surface uses that function and no other:

- The sandbox marshals each entry's `name` from it and keys the `stats` map on it. `self.name` reads the code name, and `stats[self.name]` is `self`. The play site stops resolving stat names before the run; the resolved text stays what it is for prompts and the panel.
- Editor completions after `stats.` and inside `stats[` offer code names. The editor's stat-like scanner and its other-stat write check compare against code names.
- The Test Bench's unknown-stat rule and its reads-self check match code names, replacing the design-time description they use today.
- Test Code in the editor runs under code names, so a chip-bearing name resolves the same there as in play.

A stat whose name has no chips has a code name equal to its name, so nothing changes for the common case.

## Acceptance criteria

- [ ] For an authored `{{Beast}} Power`, `self.name` and the map key read `Beast Power` in two saves that rolled different values
- [ ] `stats["Beast Power"]` hits in play, in Test Code, and passes the Test Bench's unknown-stat rule; `stats["Wolf Power"]` is unknown everywhere
- [ ] Completions offer `Beast Power`, not the raw token and not a rolled value
- [ ] A chip-free name is unchanged on every surface
- [ ] The prompt context and the stat panel still show the resolved text
- [ ] One exported function is the only producer of code names; a drift test proves the sandbox, completions, and the bench agree on a chip-bearing fixture
- [ ] The e2e stat-code spec gains a case with a chip-bearing stat name read by code across a roll
- [ ] Guide and help state the rule in one sentence each
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map
- 07 — Test Bench Rules Read The Map Form
- 08 — Saves Read Stat Code From The World
