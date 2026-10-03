# 12: New page, Test Bench, and editor basics

Status: done
Base: 748f020c
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

An author can read how to check a world before playing it, and how the World Editor itself works.

**Test Bench** (new page) covers: what the bench is, the Bench Popover, each Instrument (Issues, Triggers, AI Context, Opening), the World Doctor, the Activation Tester, and the rule that the bench shows computation and never a model's judgment (ADR-0005).

**World Editor index page** (existing, extend) covers: Simple and Advanced mode and what each hides, the find bar with search and replace, the Authoring Tour and how to start it again, discard and save behavior, and the per-tab **?** buttons.

Use the glossary's words: Test Bench, Bench Popover, Instrument, World Doctor, Activation Tester, Authoring Tour.

Add "How to…" sections: check a world for issues, test which dictionary entries trigger, preview the opening, switch editor mode, find and replace text, restart the tour.

Recommended model rationale: one new page and one extension over well-bounded editor surfaces.

## Acceptance criteria

- [x] The Test Bench page exists, follows the writing guide and uses exact control names
- [x] Every bench Instrument and tab maps to a heading
- [x] The World Editor index covers modes, search, the tour and discard
- [x] The sidebar and the home index list the new page
- [x] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [x] Four gates green
