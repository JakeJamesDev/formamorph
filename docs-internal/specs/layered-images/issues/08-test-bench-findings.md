# 08: Test Bench Findings

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench flags Layered Image traps. The spec covers this in Q15.

- A Variant whose size or aspect differs from the bottom Layer, through ticket 02's shared check.
- A bottom Layer that can resolve empty (every Variant has a rule).
- A Variant rule that names a missing trait or stat.
- A layered entry with no Layers.
- **Docs.** The Test Bench page lists the four findings.

## Acceptance criteria

- [ ] One Test Bench rule test per finding, each proved to bite by reinstating the trap.
- [ ] Each finding names the rig and the Layer.
- [ ] Changelog fragment written.
