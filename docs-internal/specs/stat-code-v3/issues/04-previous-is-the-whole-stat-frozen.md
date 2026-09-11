# 04: Previous Is The Whole Stat, Frozen

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Widening one marshalled field and freezing it, with the per-turn seam already receiving the data. Narrow and well-bounded, so Sonnet at medium effort.

## What to build

`self.previous`, and `previous` on every entry in `stats`, is the whole stat as it stood at the start of the turn: `id`, `name`, `type`, `description`, `min`, `max`, `value`, `regen`. `min`, `max`, and `regen` are the effective numbers at turn start, traits and code bounds included. It carries no `previous` or turn inputs of its own. The object is frozen in the VM, so a write does nothing, and the editor flags a write to any `previous` field the way it flags a write to a read-only `self` field. Completions after `previous.` list the stat's fields. Where the turn has no pre-turn entry for a stat, `previous` is a copy of the current entry. The per-turn seam takes the full pre-turn stats, as GameViewer already hands them, instead of a value-and-max fragment.

## Acceptance criteria

- [ ] `self.previous.min`, `.name`, and `.regen` read the turn-start values; `stats["Other"].previous` too
- [ ] `previous` has no `previous` and no turn-input fields
- [ ] A write to `previous.value` changes nothing after the run; the editor underlines it
- [ ] Completions after `previous.` list the stat fields
- [ ] First turn, clock-only run, and Test Code read `previous` as a copy of the current entry
- [ ] The per-turn seam accepts full pre-turn stats; the e2e regen case still passes
- [ ] Surface list and drift guard updated; guide and help describe the full shape
- [ ] Four gates green; graph updated

## Blocked by

- None (can start immediately)
