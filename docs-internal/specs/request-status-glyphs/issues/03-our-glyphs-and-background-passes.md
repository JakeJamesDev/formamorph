# 03: Our Glyphs And Background Passes

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: four hand-drawn Motion glyphs in an existing format, two map edits, and one shared header label.

## What to build

Write the glyphs animate-ui lacks, in its variant format and through the same wrapper (Q9). Use the standalone mock in the main checkout's `.scratch/status-glyphs/` (gitignored, so not in the worktree; preview `scratch-status-glyphs`) as the motion and shape reference:

- **quill** (Lucide `feather`): the quill moves right while an ink line draws under it, then fades. Narration.
- **masks** (Lucide `drama`): the front and back masks rock out of phase. Cast, Motivation, Character.
- **split** (Lucide `split`): a dot travels up the stem and takes the left branch, then the right on the next loop. Choices.
- **rising thought cloud** (the mock's "rising, dot tail" row): a cloud with three inner dots and two solid tail dots at the lower left. The parts light in turn and stay lit, then all fade together (Q16).

Remap Narration, Cast, Motivation, Character and Choices from sparkles to their glyphs. Map the background pass row (Q10): Summarizing turn, Selecting memories and Writing diary show the book; Describing character shows the masks.

The shared Thinking label shows the thought cloud in place of its pulsing dot while active (Q16, Q17). That label serves both the game's reasoning block and Formaquestion's answer header. The status strip does not change during reasoning (Q18). Add the four glyphs to the showcase entry.

Spec: Q9, Q10, Q16–Q18, glyph map; stories 2, 4, 5, 12.

## Acceptance criteria

- [x] Status-row test: Narration shows the quill, Cast the masks, Choices the split. `RequestStatusRow.test.tsx` "shows %s with its glyph beside it"; the full map in `glyphMap.test.ts`.
- [x] Background row test: each pass kind shows its mapped glyph next to its label. `RequestStatusRow.test.tsx` "shows the %s pass as %s with its glyph beside it".
- [x] The split glyph takes alternate branches on consecutive loops (a test or a frame per branch). `ourGlyphs.motion.test.tsx` reads the dot's route over three loops; frames `glyph-split-left` and `glyph-split-right`.
- [x] Thinking label test: active shows the thought cloud and no pulsing dot; finished shows "Thought for Ns" with no glyph; the same holds with a speaker name (the Formaquestion form). `ReasoningBlock.test.tsx` "ThinkingLabel", both forms.
- [x] With reduced motion on, the four glyphs render static. `ourGlyphs.motion.test.tsx`; the cloud shows fully lit (spec session ruling); the guard was proven by reinstating the dim frame.
- [x] Frames: `.scratch/frames/glyph-quill-light.png`, `glyph-masks-dark.png`, `glyph-split-left.png`, `glyph-split-right.png`, `thinking-game-dark.png`, `thinking-formaquestion-light.png`. Playwright on the worktree server: showcase glyphs mid-loop, and the live game and Formaquestion headers held in their reasoning phase by a local stream.
- [x] Changelog fragment written (fold into ticket 02's entry when it is unreleased). Fragments cannot edit an entry, so it lands as a new entry in 02's **Request Status Strip** group.

For you: compare the shipped quill, masks, split and thought cloud with the mock's.

## Landed

**Not verified**

- Nothing in the list. The glyph frames come from the showcase list, not from a live strip.

**For you**

- For you: compare the shipped quill, masks, split and thought cloud with the mock's. Frames: `.scratch/request-status-glyphs-03/frames/glyph-quill-light.png`, `glyph-masks-dark.png`, `glyph-split-left.png`, `glyph-split-right.png`.
- At 16px the split's dot is only a little wider than the stroke it rides, so it reads as a bump. The mock has the same size (r 1.7). Look in the showcase's glyph list.
- The thought cloud in the Thinking header is 14px, the mock's header size, next to 12px text. Frames: `.scratch/request-status-glyphs-03/frames/thinking-game-dark.png`, `thinking-formaquestion-light.png`.
