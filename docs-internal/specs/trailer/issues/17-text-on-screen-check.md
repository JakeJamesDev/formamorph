# 17: Text On-Screen Check

Status: ready-for-agent
Blocked by: 16
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: one new render check over known layout boxes, then layout fixes for each shot it fails.

Parent: [Trailer spec](../spec.md)

## What to build

The user's eighth review found "Chat with anyone in your library." below the frame: the second card of a play stack lands lower, and its caption pill goes with it. No check catches text that leaves the frame, so the fix is a check first, then the sweep it drives.

- **The check (Q70).** Add an on-screen check to `marketing/trailer/scripts/render.mjs`: on every frame of both cuts, every text element (headline words, caption pill, typed panel, end-card tagline and call to action) stays whole inside the frame, at least 4% of the frame height from every edge. The check fails a shot by name and frame, as the subject check does. It measures the layout boxes the scenes already compute; if a scene does not expose its text box, expose it rather than guess from pixels.
- **The sweep.** Run the check over both cuts and list every offender in the ticket before fixing any.
- **The fixes.** Move the text, not the card crop: in a stack, caption pills of later cards keep the same baseline as the first card's pill, or the stack lands higher so the last pill clears the margin. The subject check (Q38, Q62) must still pass after each fix. If a fix needs a card's crop or a caption's wording to change, ask the spec session.
- Re-render both cuts, update storyboard §2 and §4 if any timing moved, and put the fixed shots on a contact sheet.

## Acceptance criteria

- [ ] The render check fails a shot whose text leaves the 4% margin on any frame, in either cut, and names the shot and frame.
- [ ] The ticket lists every shot the sweep caught before the fixes.
- [ ] "Chat with anyone in your library." is whole and inside the margin for its whole hold, in both cuts.
- [ ] Every shot passes the on-screen check, the subject check and the reading check; both 6 s loops pass; the Steam checks pass.
