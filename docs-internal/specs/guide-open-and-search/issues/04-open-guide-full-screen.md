# 04: Open Guide Full Screen

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player opens the Guide full screen (Q1, Q8, Q26).

- **Open Guide** in the ⋮ menu of both chromes, and, in the Full chrome, an icon button in the title bar beside Wide View and ⋮ (Q26).
- The full-screen view holds the rail (search field and contents) and the reader. It uses the existing full-screen morph that the Mascot and Prompts settings tabs use.
- It shares the Guide view state: it opens on the section the small window shows, and closing it returns the small window on the section the full screen shows.
- Escape and a close button exit it. On mobile it fills the screen.

Spec: Implementation Decisions → Open Guide; The ⋮ menu.

Recommended model rationale: a known morph hook and shared view state; the work is wiring and layout.

## Acceptance criteria

- [ ] The ⋮ item in both chromes and the Full chrome title-bar button open the full-screen Guide.
- [ ] The open section and open pages carry both ways.
- [ ] Escape closes it, and focus returns to the control that opened it.
- [ ] A dev-route reaches the full-screen Guide; verified at a realistic desktop and mobile viewport.
- [ ] Changelog fragment written; four gates green.
