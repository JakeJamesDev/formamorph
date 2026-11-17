# 06: Check the Swap When the Reading Lands

Status: wontfix
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Opened at the spec close as a gap against Q3 ("the narration never remounts"). Ticket 04's live probe recorded one remount per turn: after the choices finish, the full-turn mention reading replaces the live reading, the renderer's plugins change (`links` and `speakers`), and the renderer remounts.

Triage (2026-11-16, user): check first. The probe shows the reveal already ended at that moment (`animate` false), so the text may swap in place with nothing visible. Capture the frames around the swap.

- Nothing visible: set this ticket to `wontfix` and report to the spec session, which amends Q3 to "never remounts while the narration reveals".
- A visible flash or replay: report it with the frames to the spec session. A fix reopens the renderer's plugin keying, which is a new ruling.

No production code changes in this ticket.

## Acceptance criteria

- [x] Playwright per-frame capture of one real turn with dialogue and Character Mentions on, from the end of the choices through the reading's arrival, in the Pages and chat layouts. Frames go to `.scratch/frames/reading-swap-<layout>-<n>.png`, light theme, 1280 px wide. 32 screenshots per layout (0 to 31), plus a per-animation-frame DOM log (`reading-swap-<layout>.json`); the small coref model read the turn for real, and the AI endpoint was mocked.
- [x] The Landed section states whether any frame differs in visible text, color or position around the swap, beyond the quote colors and mention links the reading adds. See Landed.

For you:
- Look at the frames and confirm the verdict.

## Landed

**Verdict: wontfix.** The swap shows nothing.

Setup: `entityStats` fixture (Bram), Character Mentions on with the small model, a mocked turn with two Bram quotes, choices on, light theme, 1280 px. The capture script stays in `.scratch/pw`, uncommitted. Each layout has a per-frame sampler (node identity, text, quote colors, height, top, reveal word count) and Playwright screenshots through the swap.

| Layout | Frames | Frame before the reading | Frame with the reading | Text, quote color, height, top |
|---|---|---|---|---|
| Pages | 32 | `reading-swap-pages-25.png` | `reading-swap-pages-26.png` | same |
| Chat | 32 | `reading-swap-chat-25.png` | `reading-swap-chat-26.png` | same |

- The sampler shows the renderer remounts when the reading lands (its child node changes, mentions go from 0 to 5). Text length (187), height (72 px), top, quote color (`rgb(22, 105, 57)`) and the reveal word count (0, so no replay) are equal before and after, in both layouts.
- Between those two frames, 355 pixels differ in Pages and 398 in Chat, on glyph edges only (up to 94 per channel). At 6x zoom the glyphs are the same; the difference is sub-pixel text fringing from the new layer. No glyph moved.
- A second swap comes earlier, in both layouts: the narration root node changes once as the reveal ends (reveal word count 40 to 0), before the reading. Text, color, height and top are equal across it, and no frame in the capture shows a replay. It is not part of this ticket's question; the spec session may want it in the Q3 wording ("never remounts while the narration reveals" holds, but a node swap does happen at the end of the reveal).

**Not verified**

- Dark theme and the 375 px mobile width, because the ticket asked for light at 1280 px.
- A turn with a slow model: the mock answers at once, so the reveal ended well before the reading. A reading that lands mid-reveal (reveal still animating) did not occur here. Ticket 04's live probe also saw it land after the reveal.

**For you**

- Look at `.scratch/steady-narration-06/frames/reading-swap-pages-25.png` and `-26.png`, and the chat pair, and confirm nothing visibly changes.
- Verdict for the spec session: amend Q3 to "never remounts while the narration reveals".
