# 04: Open Guide Full Screen

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player opens the Guide full screen (Q1, Q8, Q9).

- **Open Guide** in the ⋮ menu of both chromes, and an expand button in the Guide tab header.
- The full-screen view holds the rail (search field and contents) and the reader. It uses the existing full-screen morph that the Mascot and Prompts settings tabs use.
- It shares the Guide view state: it opens on the section the small window shows, and closing it returns the small window on the section the full screen shows.
- Escape and a close button exit it. On mobile it fills the screen.

Spec: Implementation Decisions → Open Guide; The ⋮ menu.

Recommended model rationale: a known morph hook and shared view state; the work is wiring and layout.

## Acceptance criteria

- [ ] The ⋮ item and the expand button open the full-screen Guide in both chromes.
- [ ] The open section and open pages carry both ways.
- [ ] Escape closes it, and focus returns to the control that opened it.
- [ ] A dev-route reaches the full-screen Guide; verified at a realistic desktop and mobile viewport.
- [ ] Changelog fragment written; four gates green.
