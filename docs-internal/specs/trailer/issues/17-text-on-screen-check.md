# 17: Text On-Screen Check

Status: ready-for-human
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

## Sweep

The first run of the check, before any fix. Margin: 43 px wide, 77 px tall. Each row is one text element at its worst frame; the check counts every frame the element shows, its entrance and exit included.

| Shot | Text | Past the margin | Worst cut frame | Scene frames out | Cause |
|---|---|---|---|---|---|
| W05 | Typed panel | 14 px, bottom | 687 | 57 to 521 | The panel sits low. |
| W05 | Every turn updates your stats. | 98 px, bottom | 945 | 321 to 527 | The second card lands low, and its pill goes with it. |
| W07 | Chat with anyone in your library. | 121 px, bottom | 1309 | 178 to 404 | The user's finding: the rest of the pill is below the frame. |
| W10 | Give them items to carry, wear and use. | 86 px, bottom | 2495 | 840 to 1083 | The last card lands low. |
| T05 | Typed panel | 54 px, left | 1165 | 52 to 541 | The panel is wide, and its exit drifts left. |
| T05 | Every turn updates your stats. | 69 px, bottom | 945 | 321 to 520 | As W05. |
| T06 | Chat with anyone in your library. | 123 px, bottom | 1309 | 178 to 404 | As W07. |
| T08 | Build your own world. | 18 px, left | 1683 | 162 to 173 | The headline fills the width and grows as it leaves. |
| T09 | Define your world and everyone in it, your way. | 21 px, right | 2225 | 563 to 857 | The pill column's 60 px sides are inside the margin. |
| T09 | Give them items to carry, wear and use. | 97 px, bottom | 2495 | 840 to 1105 | As W10. |
| T11 | Download hundreds of worlds from the community. | 21 px, right | 2894 | 16 to 401 | As T09's sides. |
| T11 | Share your ideas with the community. | 21 px, right | 2914 | 36 to 401 | As T09's sides. |
| T11 | Compete with other creators. | 40 px, bottom | 2912 | 41 to 46 | The pill rises from below the margin. |
| T13 | Play in your browser or offline on your desktop. | 21 px, right | 3391 | 16 to 308 | As T09's sides. |

## Acceptance criteria

- [x] The render check fails a shot whose text leaves the 4% margin on any frame, in either cut, and names the shot and frame. The first sweep exited 1 with 14 FAIL lines, each with shot, edge, scene frame and cut frame.
- [x] The ticket lists every shot the sweep caught before the fixes. See Sweep above.
- [x] "Chat with anyone in your library." is whole and inside the margin for its whole hold, in both cuts. W07 50 px from the edge (43 minimum), T06 77 px (77 minimum), every frame it shows; `fixed-wide.png`, `fixed-tall.png`.
- [x] Every shot passes the on-screen check, the subject check and the reading check; both 6 s loops pass; the Steam checks pass. `npm run render` exit 0: 140 OK, 0 FAIL; wide 82.67 s, 11,950 Kbps; tall 67.07 s.

## Landed

The fixes move text and cards, never a crop or a caption's wording. No timing moved, so the storyboard's tables and totals stand; storyboard §2 gains a Q70 note.

**Not verified:**

- Nothing left unticked. The check computes each box from the motion functions the scenes use. It reads no rendered pixels, so the frames below are its visual cross-check.
- The ticket's text list leaves out the two wordmarks, so the check does not measure them (W03, T03, and the end card's mark). They read inside the frame on the sheets.

**For you:**

- Look at the fixed shots: `.scratch/trailer-17/frames/fixed-wide.png`, `.scratch/trailer-17/frames/fixed-tall.png`. Both cuts are in the same folder.
- In the stacks, the last card of each now lands higher, since a pill needs 60 px below it to rise. Check that the cascade still reads at 10.40 s, 18.85 s and 27.58 s.
- Tall pills now wrap sooner at 82 px sides: "Share your ideas with the community." takes two lines. Check T11 at 47.85 s.
- The tall typed panel is narrower, 790 px, and the tall headline grows less as it leaves. Check T05 at 10.40 s and T08 at 25.17 s.
