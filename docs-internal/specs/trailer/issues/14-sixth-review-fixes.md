# 14: Sixth Review Fixes

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: moving the goo coalesce into the 6 s loop with a blob dissolve is a timing puzzle under a byte-exact loop check; the rest is timing and copy.

Parent: [Trailer spec](../spec.md)

## What to build

The user's sixth review. Each item is a ruling.

- **Typed panel timing (Q54).** In W05 and T05 the panel enters at the clip frame where the first narration word appears. Find that frame from the clip, not by guess, and record it beside the clip in the capture list so a recapture updates it. The player line types from there; the caption line follows.
- **Goo moves to the opening (Q55).** The opening card plays the goo coalesce from ticket 13. After the letters settle, the blobs fade away over time and leave the crisp letterforms alone, as if they had morphed into the text. The whole card, including the wordmark's exit, fits inside frames 0 to 359 with the bare stage at both ends. If the coalesce, dissolve, hold and exit cannot fit, ask the spec session before changing the loop. The end card's wordmark returns to a plain entrance with the tagline and call to action as before.
- **Copy (Q56 to Q58).** Blueprints caption: "Define your world and everyone in it, your way." Contest captions: "Share your ideas with the community." / "Compete with other creators." AI-model card, wide cut only, second line: "Run it fully local, with no extra software to install." The tall cut keeps the one line. If the user sends other lines before you reach them, use those.
- Re-render both cuts, update storyboard §2 and §4, and look at the opening card's contact sheet frame by frame through the dissolve.

## Acceptance criteria

- [ ] The typed panel enters on the clip's first narration word; the frame is recorded in the capture list.
- [ ] The opening card coalesces from goo, the blobs dissolve into the letters, and the card exits inside the loop; both 6 s loops pass with the bare stage at frames 0 and 359.
- [ ] The end card's wordmark has a plain entrance.
- [ ] The three copy changes are in both cuts as ruled, with the AI-model second line in the wide cut only.
- [ ] Every line and card passes the checks; the Steam checks pass; storyboard totals match the renders.
