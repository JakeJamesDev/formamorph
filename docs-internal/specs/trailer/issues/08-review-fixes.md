# 08: Review Fixes

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: two new capture techniques (frame-by-frame animation capture, clock-controlled WebGL) with no precedent in the package, plus a timing pass across both cuts.

Parent: [Trailer spec](../spec.md)

## What to build

The user's first review of the rendered cuts found four things. Each is a ruling in the spec.

- **Reading bar (Q17).** Every line of copy is fully legible for at least 1.5 s and at no more than 12 characters per second. Legible means after the line's enter animation and before its exit and the join overlap. Lengthen the shots that fail (today W09, W14, W15, W16, W17 fail; W01, W06, W08, W13 are borderline). The render check measures every line and prints `FAIL` when one breaks the bar, so the bar holds on every future edit. Update the storyboard's durations and totals in §2 and §4.
- **Transitions (Q18).** Fade 30 frames, wipe 36 frames. Re-check the bar after the change, since a longer join takes readable frames from both shots.
- **Stat animation (Q19).** The stats shot plays the app's real stat-bar animation. The capture script drives a turn in the running app from a canned endpoint reply with stat changes, pauses every CSS animation through the Web Animations API, seeks it one frame at a time, and screenshots each frame. The frames become a short clip committed beside the shots. The scene plays the clip under the existing camera and caption. A re-run produces the same frames.
- **Avatar pose (Q20).** The avatar shot keeps the animate toggle on and freezes the idle animation at a fixed time by controlling the page clock, the way the title card's `t` parameter does. The result is deterministic and never the rest pose.

Both cuts re-render and every check prints `OK`. The tall cut's stacked stats pane plays the same clip.

## Acceptance criteria

- [ ] The render check reports each line's legible seconds and characters per second, and fails any line over 12 characters per second or under 1.5 s.
- [ ] Every line in both cuts passes that check.
- [ ] Fade joins are 30 frames and wipe joins 36 frames.
- [ ] The stats shot plays a captured clip of the real stat-bar animation; a second capture run produces identical frames.
- [ ] The avatar shot shows the idle pose at a fixed time; a second capture run produces an identical frame.
- [ ] Storyboard §2 and §4 durations and totals match the rendered cuts.
- [ ] Both cuts render with every check `OK`; the Steam checks in ticket 07 still pass.
