# 01: Before and After Images

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author calls `player.show(name, opts)` from an At Game Start, Before the AI or After the AI script. The Media List image shows above or below the turn's narration, in Pages and Chat layouts. The spec covers this in Q1, Q2, Q6, Q7, Q9–Q15.

- **Script surface.** `player.show` joins the `player` object in every timing except During AI Output (ticket 02 adds that one). It never waits. `opts` is `{ size?, wrap? }`, with defaults medium and block. `wrap` is accepted and ignored here. A bad enum value fails with an error that names the value.
- **Name resolution.** Use the image setter's name-to-id map. An unknown name, or a sound's name, fails with the setter's error. The call records the media id.
- **Save shape.** A `scriptTells` entry becomes a union: the text form, or an image form with media id, size, wrap, an optional sentence index, and timing. This ticket owns that type and the placement grouping (above, inline, below) that tickets 02 and 04 extend. Restore accepts image entries and drops malformed ones. Prune by turn is unchanged.
- **Re-roll Stats.** Image entries follow the re-rolled-timings rule for tells.
- **Render.** Start and Before images render above the narration and show at turn start. After images render below, in call order with tells. Size maps to width tokens. A media id that is no longer on the Media List renders nothing. A click opens the existing full-size image viewer.
- **Test Bench.** The bench logs each `show` call with its name and options.
- **Editor.** Analysis, autocomplete and the quick reference know `player.show`.
- **Docs.** Add `player.show` to [Scripts-Reference.md](docs/Scripts-Reference.md) and the [Scripts Guide](docs/ScriptsGuide.md) where `player` calls are listed. Write a changelog fragment.

## Acceptance criteria

- [x] `player.show("Name")` in Before the AI and After the AI records an image entry with the media id, medium and block. An executor test covers each timing. (`statCodeExecutor.show.test.ts`: start, before, after)
- [x] An unknown name, a sound's name and a bad `size` each fail the script with an error that names it. (`statCodeExecutor.show.test.ts`, also inside `try`; bad `wrap` too)
- [x] A Before image renders above the turn's narration, and an After image renders below it, interleaved with tells in call order. This holds in Pages and Chat layouts. (`GamePanels.scriptImages.test.tsx`; `GameViewer.scriptPrompts.test.tsx` in play)
- [x] A save with image entries reloads with the images in place. A malformed image entry is dropped on restore. (`GameplayContext.scriptTells.test.tsx` round trip; `scriptTells.test.ts`)
- [x] Re-roll Stats drops and replays Start, Before and After images, and an abandoned re-roll restores them. (`GameViewer.scriptPrompts.test.tsx`, Stop mid re-roll; `scriptTells.test.ts`)
- [x] An entry whose media id was removed from the Media List renders nothing and does not throw. (`ScriptPromptLine.test.tsx`)
- [x] A click on a shown image opens the full-size viewer. (`ScriptPromptLine.test.tsx`)
- [x] The Test Bench run log lists a `show` call with its name and options. (`editorScriptPrompts.test.ts`: `Show: Harbor (large, left)`)
- [x] Frames of a turn with a Before image and an After image, at desktop and mobile widths, in light and dark: `.scratch/frames/before-after-desktop-light.png`, `.scratch/frames/before-after-desktop-dark.png`, `.scratch/frames/before-after-mobile-light.png`, `.scratch/frames/before-after-mobile-dark.png`.

For you: approve the small, medium and large widths in the frames before the sizes count as a Design System pattern.

## Landed

**Not verified**
- None.

**For you**
- For you: approve the small, medium and large widths in the frames before the sizes count as a Design System pattern. Frames: `.scratch/script-images-01/frames/before-after-desktop-light.png`, `before-after-desktop-dark.png`, `before-after-mobile-light.png`, `before-after-mobile-dark.png`; the `-below` twins show the After images. A Design System showcase entry follows your approval.
- Export shape: a save's `scriptTells` entry can now be an image entry (`image`, `size`, `wrap`, optional `sentence`, `timing`). Additive change to a field that shipped in 3.7.0.
