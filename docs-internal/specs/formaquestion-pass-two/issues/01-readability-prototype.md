# 01: Readability prototype

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A prototype page that lets the user pick how the minimal chat separates from what is behind it.

- Runs on the prototype flow: its own worktree, branch and port.
- One page renders the minimal column three times side by side over the same background: a scrim with an opacity slider behind the column, shadows on the bubbles, and a text halo. A control swaps the background between a light screen, a dark screen and a scene image.
- The user picks from static frames. The pick, its range and its default go into the spec as a ruling.

Spec: Q8; Implementation → Prototype.

Recommended model rationale: a standalone page with three CSS treatments; no app code changes.

## Acceptance criteria

- [x] The page shows the three treatments over the three backgrounds, with the scrim at a slider.
- [x] Frames of each treatment on each background are in the ticket's Answer.
- [x] The ruling (treatment, range, default) is written into the spec before ticket 11 starts.

## Answer

Branch `prototype/readability`, commit `9b2754ea`, worktree `.claude/worktrees/prototype-readability`. Launch entry `proto-readability` (port 5247), page `/readability.html`. The page never lands on main (spec session ruling, 2026-10-04).

The page renders the minimal column three times over one backdrop. The bubbles copy MinimalChat's class strings; nothing is imported from it. Backdrops: a busy light screen, the same screen dark, a painted scene with the column in dark or light theme. The query string drives every control: `?backdrop=light|dark|scene&scrim=0..100&theme=light|dark`.

| Treatment | What it does |
|---|---|
| Scrim | A rounded panel of the app background behind the whole column. Slider 0–100% in steps of 5; frames at 60%. |
| Bubble Shadows | A deeper drop shadow on every bubble, the pill and the ask field. |
| Text Halo | Bubbles at 72% opacity with a glow of the bubble's own color around the text. |

### Frames

Full page, all three treatments, scrim at 60% (`node src/prototype/readability/frames.mjs` on the prototype branch):

- `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen.png`
- `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen.png`
- `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark.png`
- `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light.png`

Scrim column alone, opacity sweep (20, 40, 60, 80, 100):

- Light screen: `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen-scrim-20.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen-scrim-40.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen-scrim-60.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen-scrim-80.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/light-screen-scrim-100.png`
- Dark screen: `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen-scrim-20.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen-scrim-40.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen-scrim-60.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen-scrim-80.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/dark-screen-scrim-100.png`
- Scene, dark column: `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark-scrim-20.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark-scrim-40.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark-scrim-60.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark-scrim-80.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-dark-scrim-100.png`
- Scene, light column: `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light-scrim-20.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light-scrim-40.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light-scrim-60.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light-scrim-80.png` · `.claude/worktrees/prototype-readability/.scratch/readability/frames/scene-light-scrim-100.png`

### Pick

The user picked the **Scrim** (2026-10-04). Setting: opacity 0–100% in steps of 5, default 60%. The panel is the app background at that opacity, rounded, inset 0.75rem beyond the column. Bubble shadows and the text halo are rejected: shadows barely separate a light bubble from a light screen, and the halo lets screen text bleed through the bubbles.

The ruling was sent to the spec session, which folds it into `spec.md` as Q29 (resolves Q8), field `scrimOpacity`.
