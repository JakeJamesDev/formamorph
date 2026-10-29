# 15: Stat Line Scope And Nested Unequip Depth

Status: needs-triage
Blocked by: 09, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

Two small corrections.

- The stat-pass item line (Q141) names items lying at the location and hidden copies too. It should name only present owners' items whose stat effects apply.
- Automatic unequips after nested item-script writes fire one level below the first write, not at their true depth (Q66). They should fire at the depth of the write that caused them.

Spec: Q66, Q141.

## Acceptance criteria

- [ ] The stat line leaves out location and hidden copies; a test covers it
- [ ] An automatic unequip caused by a depth-2 write fires its timing at depth 3; a test covers it, and the depth cap still holds

## Blocked by

- 09
- 11
