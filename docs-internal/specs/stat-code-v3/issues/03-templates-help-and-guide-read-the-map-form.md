# 03: Templates, Help, And Guide Read The Map Form

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A mechanical move of every taught sample to the map form, with the template sandbox tests as the check. Sonnet at medium effort.

## What to build

Every place the app teaches a stat lookup shows the map form and only the map form. The eleven built-in template lookups become `stats[{{slot:stat}}]`, since the stat slot already expands to a quoted name; the `id` lookups become `self`. Both help samples and every guide sample move likewise. The guide shows `Object.values(stats)` once, for the average-of-all formula, and no longer mentions `find`. Template descriptions and the guide's "handle missing stats" advice are reworded for a blank entry that reads zero instead of `undefined`.

## Acceptance criteria

- [ ] No built-in template, help sample, or guide sample contains `stats.find`
- [ ] Every built-in template runs in the sandbox under the map and returns what it did before
- [ ] The guide shows the map form, bracket syntax for a spaced name, and `Object.values(stats)` for iteration
- [ ] The guide's missing-stat advice describes the blank entry
- [ ] Help copy follows the two-layer settings-copy rule
- [ ] Four gates green; graph updated

## Blocked by

- 01 — Stats Becomes A Name-Keyed Map
