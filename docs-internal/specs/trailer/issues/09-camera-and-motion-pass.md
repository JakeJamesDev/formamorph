# 09: Camera And Motion Pass

Status: ready-for-agent
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a motion pass across every shot in both cuts, a clock-driven WebGL clip capture, and a new measured check; judgment on "subtle" needs studio review against the rulings.

Parent: [Trailer spec](../spec.md)

## What to build

The user's second review of the rendered cuts. Each item is a ruling in the spec.

- **Linear camera (Q22).** Every camera leg moves at a constant rate. Remove the cubic in-out easing.
- **Zoom where it earns it (Q23).** Only the stats shot and the Morphie shot zoom during the shot. Every other frame shot appears at its zoom and drifts with one slow linear pan over the whole shot, a few percent of the frame, so a still never sits dead. The zoom does not change during those shots. Framing per shot follows Q23: static crops for entity, profile, contest (callout stays), and endpoint on the model field; full frame for the rest, the typed backdrops and the tall recaptures included.
- **Avatar in motion (Q24).** The avatar shot plays a clip of the idle animation. The capture steps the page clock one frame at a time through the animation and writes the frames as a clip beside the stats clip, so a re-run produces the same file.
- **Calm text (Q25).** A line takes at least 0.5 s to enter and 0.5 s to leave, on a gentle curve. This covers copy blocks, captions, panes, the typed panel and the title card lines. The render check prints enter, hold and exit seconds per line and fails a line that enters or leaves faster. Lengthen shots where the 1.5 s hold would otherwise shrink.

Both cuts re-render with every check `OK`. Update the storyboard's durations and totals.

## Acceptance criteria

- [ ] No camera leg eases; a mid-leg frame sits at the linear position.
- [ ] Only W06 and W13 change zoom during the shot. Every other frame shot holds one zoom and pans linearly by a few percent over its length.
- [ ] The avatar shot plays a captured idle-animation clip; a second capture run produces an identical file.
- [ ] The render check reports enter, hold and exit seconds for every line and fails any enter or exit under 0.5 s; every line in both cuts passes.
- [ ] Every line still holds at least 1.5 s at 12 characters per second or less (Q17).
- [ ] Storyboard §2 and §4 durations and totals match the rendered cuts.
- [ ] Both cuts render with every check `OK`; the Steam checks still pass.
