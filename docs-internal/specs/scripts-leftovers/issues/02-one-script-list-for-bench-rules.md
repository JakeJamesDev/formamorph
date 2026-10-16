# 02: One Script List For Bench Rules

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shared seam that three later tickets read, plus Blueprint run semantics to keep.

## What to build

One shared list of every script, stat, trait and world, with its owner, timing and home section. The bench check uses it in place of its private list. The static bench rules read through it: the unknown-stat rules and the Before-reads-delta rule now flag a trait or world script as they flag a stat script. Each item opens its own tab, as the check's items already do.

## Acceptance criteria

- [ ] An unknown stat name in a trait script and in a world script each raise the unknown-stat finding.
- [ ] A trait or world Before the AI script that reads delta raises the Before-reads-delta warning.
- [ ] A Blueprint stat or trait keeps its once-per-group run; a linked stat runs only the scripts its link overrides.
- [ ] The bench check and the static rules read the same list, and the Scripts tab's model agrees with it on which scripts exist.
- [ ] Each new item carries the section of its home: Scripts, Traits, Stats or Entities.
- [ ] Guards fail when a rule goes back to reading stat scripts only.
