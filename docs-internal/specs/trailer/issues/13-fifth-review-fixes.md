# 13: Fifth Review Fixes

Status: ready-for-agent
Blocked by: 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: porting the app's canvas goo animation into a frame-driven scene is the hard part; the other two are a timing rule and a mock change.

Parent: [Trailer spec](../spec.md)

## What to build

The user's fifth review. Each item is a ruling.

- **Contest hold (Q48).** The contest card holds at least 5 s after it lands. Mark dense cards in the storyboard (more than one element the eye must find inside the subject region) and give each at least 5 s. The render check reads the mark and fails a dense shot that holds less.
- **Goo wordmark (Q49).** On the end card, the wordmark enters as the app's first-run intro does: goo blobs pop in, magnetize into place and merge into the letterforms through a metaball filter, with the real letterforms swelling in through the threshold. Port it from the app's intro component into a Remotion scene driven by the frame, not the clock, so every render matches. Keep its look and pacing. The tagline and call to action enter after the letters settle and still meet Q25.
- **Community authors (Q50).** The community mock gives each listed world its own author from the repo's neutral fixture names. Recapture W14/T11.
- Re-render both cuts, update storyboard totals, and look at the end card and the contest shot on the contact sheets.

## Acceptance criteria

- [ ] The contest shot holds at least 5 s after landing; the storyboard marks dense cards; the render check fails a dense shot under 5 s.
- [ ] The end card's wordmark coalesces from goo blobs; two renders produce identical frames.
- [ ] The tagline and call to action enter after the letters settle and pass the reading checks.
- [ ] Every world in the community shot has a distinct author, none "Formamorph".
- [ ] Every line and card passes the checks; both loops and the Steam checks pass; storyboard totals match the renders.
