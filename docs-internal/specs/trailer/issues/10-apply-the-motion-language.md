# 10: Apply The Motion Language

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a design pass over every shot in both cuts, judged by eye from rendered frames, not by numbers alone; the prototype sets the look but each shot needs its own composition.

Parent: [Trailer spec](../spec.md)

## What to build

The user chose prototype variant A, "Floating cards", as the trailer's motion language (Q27). Rebuild every shot in both cuts in that language. The prototype is the primary source: branch `prototype/trailer-motion`, commit `4d68295a`, file `marketing/trailer/src/prototype/VariantA.tsx`. Read it first, then rewrite it properly; the prototype code was written without tests or care.

- **Stage.** Slow glowing blobs in the brand palette drift behind every scene, on the dark stage. They never stop and never cut: the stage is one continuous layer under the whole cut, so joins happen on top of it.
- **Frame shots.** Each captured UI shot is a tilted glass card: rounded corners, a hairline border, a deep shadow, perspective tilt. It enters on an overshooting spring from below, floats on a slow bob while it holds, and leaves by fading as it drifts. A second card behind it, dimmed, gives depth; use the next shot or a related one. The stats and Morphie cards still zoom to their subject (Q23); every other card holds its framing. Clips (stats, avatar) play inside their card.
- **Copy.** Headlines rise word by word on springs with a slight tilt, the last word in the wordmark gradient. Captions are glass pills with a colored dot. Enter and exit still meet Q25's 0.5 s, and every line still meets Q17's hold and rate; the render check keeps enforcing both.
- **Typed scene.** The prompt and narration panel becomes a glass card in the same language, over a dimmed card behind.
- **Loop and end card.** The first 6 s still loop (Q9, Q21). The title card and end card use the same stage and the wordmark's spring.
- **Tall cut.** Same language, laid out for 9:16: cards fill the width, stacks become two cards one above the other.
- **Judge by eye.** Render a contact sheet per cut (the prototype's `Sheet` is the pattern) and look at every cell before calling a shot done. Keep the sheet script in the package as `npm run sheet`.

Remove the prototype compositions and script from the package when the real scenes carry the language. They stay on the prototype branch.

## Acceptance criteria

- [ ] Every shot in both cuts uses the Floating cards language: blob stage, glass cards on springs with a bob and a depth card, word-by-word headlines, pill captions.
- [ ] The stage is one continuous layer under each cut; no join cuts the blobs.
- [ ] The render check still passes every line for hold, rate, enter and exit; only W06, W13 and T06's stats pane change zoom.
- [ ] Both 6 s loops still pass, and the Steam checks on the wide cut still pass.
- [ ] `npm run sheet` writes a contact sheet per cut; the ticket's final commit message names what the sheets showed and what changed because of them.
- [ ] The prototype compositions and script are gone from main.
- [ ] Storyboard §2 and §4 durations and totals match the rendered cuts.
