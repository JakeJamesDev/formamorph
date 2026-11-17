# 06: Check the Swap When the Reading Lands

Status: ready-for-agent
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

- [ ] Playwright per-frame capture of one real turn with dialogue and Character Mentions on, from the end of the choices through the reading's arrival, in the Pages and chat layouts. Frames go to `.scratch/frames/reading-swap-<layout>-<n>.png`, light theme, 1280 px wide.
- [ ] The Landed section states whether any frame differs in visible text, color or position around the swap, beyond the quote colors and mention links the reading adds.

For you:
- Look at the frames and confirm the verdict.
