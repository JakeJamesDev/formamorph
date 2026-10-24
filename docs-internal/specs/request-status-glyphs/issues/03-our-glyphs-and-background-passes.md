# 03: Our Glyphs And Background Passes

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: three hand-drawn Motion glyphs in an existing format, plus two map edits.

## What to build

Write the three glyphs animate-ui lacks, in its variant format and through the same wrapper (Q9). Use the standalone mock in the main checkout's `.scratch/status-glyphs/` (gitignored, so not in the worktree; preview `scratch-status-glyphs`) as the motion reference:

- **quill** (Lucide `feather`): the quill moves right while an ink line draws under it, then fades. Narration.
- **masks** (Lucide `drama`): the front and back masks rock out of phase. Cast, Motivation, Character.
- **split** (Lucide `split`): a dot travels up the stem and takes the left branch, then the right on the next loop. Choices.

Remap those request types from sparkles to their glyphs. Then map the background pass row (Q10): Summarizing turn, Selecting memories and Writing diary show the book; Describing character shows the masks. Add the three glyphs to the showcase entry.

Spec: Q9, Q10, glyph map; stories 2, 4, 5, 12.

## Acceptance criteria

- [ ] Status-row test: Narration shows the quill, Cast the masks, Choices the split
- [ ] Background row test: each pass kind shows its mapped glyph next to its label
- [ ] The split glyph takes alternate branches on consecutive loops (a test or a frame per branch)
- [ ] With reduced motion on, the three glyphs render static
- [ ] Frames: `.scratch/frames/glyph-quill-light.png`, `glyph-masks-dark.png`, `glyph-split-left.png`, `glyph-split-right.png`
- [ ] Changelog fragment written (fold into ticket 02's entry when it is unreleased)

For you: compare the shipped quill, masks and split with the mock's.
