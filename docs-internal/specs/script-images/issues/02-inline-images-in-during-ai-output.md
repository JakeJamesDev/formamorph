# 02: Inline Images in During AI Output

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A During AI Output script calls `player.show(name, opts)`. The image appears right after the sentence that just completed, as a block, when the sentence reveal reaches that sentence. The spec covers this in Q1, Q4, Q5 and the Narration render decision.

- **Script surface.** In During AI Output, the `player` stub gains a working `show`. `tell`, `toast`, `confirm`, `ask` and `input` still throw the existing message. The call records the run's `narration.index` as the sentence index.
- **Render.** The narration renders as text segments cut at the anchored sentence boundaries, with each image between its segments, as a React node and never as markdown injected into Streamdown. Several images on one sentence stack in call order. An inline image appears when the reveal releases its anchor sentence. This ticket renders every inline image as a block. Ticket 03 adds floats.
- **Stopped reply.** A stopped reply records none of its During AI Output images.
- **Regenerate.** The new run's images replace the old turn's images.
- **Editor.** Analysis accepts `player.show` in a During AI Output script and still underlines the other `player` calls there.
- **Docs.** Update [Scripts-Reference.md](docs/Scripts-Reference.md): `player` exists in During AI Output with `show` only, and inline placement is described. Write a changelog fragment.

## Acceptance criteria

- [ ] In During AI Output, `player.show` records an image entry with the sentence index, and `player.tell` still throws "can't run in During AI Output".
- [ ] A turn with an image anchored to sentence 2 renders it after sentence 2 and before sentence 3, in Pages and Chat layouts.
- [ ] An inline image is not in the DOM until the reveal has released its anchor sentence.
- [ ] Two images on one sentence render in call order.
- [ ] A stopped reply leaves no During AI Output image entries on the turn.
- [ ] The editor shows no error on `player.show` in a During AI Output script and still shows one on `player.confirm`.
- [ ] Frames of a turn with an inline block image mid-narration, at desktop and mobile widths, in light and dark: `.scratch/frames/inline-block-desktop-light.png`, `.scratch/frames/inline-block-desktop-dark.png`, `.scratch/frames/inline-block-mobile-light.png`, `.scratch/frames/inline-block-mobile-dark.png`.

For you: play a turn with an inline image and judge whether it lands with its sentence during the reveal.
