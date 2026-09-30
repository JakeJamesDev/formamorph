# 04: Show hidden and private counts

Status: done
Status note: client 69513ca5, review fold-in af009b59. The user approved the dash state on 2026-09-30. Needs the server tickets 01-03 deployed before the client ships.
Base: e822d2f5
Blocked by: 01, 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: ../spec.md (Implementation Decisions › Client display, Client ordering)

Model rationale: a new visual state on a shared control, four surfaces, the optimistic like path, and a design-approval stop.

## What to build

A player sees a heart with "—" on a hidden contest entry, on its card, in the details modal, and on profile rows. A tooltip explains that likes show after the winners are announced. The heart still likes and unlikes, and the dash stays after the press. The author and staff see their number with a tooltip saying only they and staff see it until results. Sorting the catalog by likes puts hidden entries with the zero-like listings.

## Acceptance criteria

- [x] One pure helper reads a listing record and returns a number, a private number, or hidden. Every per-listing count uses it: the community card, the details modal, and profile creation rows. The profile total stays a plain number (Q12).
- [x] A hidden count shows a heart with "—" and the results tooltip. The heart stays pressable.
- [x] A private count shows the number and the private tooltip.
- [x] A like press on a hidden entry shows no optimistic number and keeps the hidden state from the reply.
- [x] The client likes sort treats a hidden count as 0.
- [x] A record with no flags behaves as today.
- [x] The dash state is added to the design-system showcase, and the user approves it before merge.
- [x] Tooltip copy passes the copy sweep.
- [x] Tests: the helper, one LikeButton render test for the dash and both tooltips, and the like-press path.
- [x] Changelog line in In Progress.
- [x] Four gates green.
