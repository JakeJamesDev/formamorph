# 18: Streaming Quote Colors

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q72: with Fade-in Narration on, each quote shows in its speaker's color the first time it appears, instead of turning colored after narration ends.

- **Read each quote early:** once a quote's hold point has arrived, run the loaded model on the passage so far. The hold point is the end of the tag sentence after the quote, the next quote, or the paragraph end, whichever comes first. Then read that quote's speaker with the existing attribution rules. Runs queue one at a time in the coref worker, as today.
- **The smooth pacer:** `useSentenceReveal` gets a gate per quote. It never releases the sentence that opens a quote whose color is not back. To avoid stopping, it slows ahead of that sentence:
  - **Buffer:** the target backlog is `TARGET_BUFFER_WORDS` plus the words one model run covers (run time ÷ ms per word).
  - **Pace floor:** while streaming, no faster than run time ÷ words per quote, both measured during the turn.
  - **Planned pace:** the pace covers every queued quote that has arrived, not only the next one.
  - **Eased changes:** the pace eases toward its new value (about 0.5 s to settle), and catch-up is capped at `DRAIN_CORRECTION_MIN`.
  - **Run time:** an average of this device's runs, kept across turns like the arrival rate.
- **Final reading:** at narration end, the full-turn reading runs as today and is the one saved. A quote it reads differently recolors with the existing 300 ms color fade.
- **Unchanged:**
  - The character crawl (Fade-in Narration off) keeps coloring after narration.
  - So does any turn without a loaded model, or with Character Mentions off.
  - Skipping the reveal shows the text at once. Colors arrive as their runs finish.
- **Reference:** the mock at `.scratch/streaming-quote-colors/index.html` is the behavior the user picked (pane "Quote-aware, smooth"). Its pacer constants come from `narrationRevealConfig.ts`.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] With Fade-in Narration on and a model loaded, every quote is colored before its first word is revealed, on the `steady` and `burst` reveal test scripts. The test is proved by removing the gate. — `streamingQuotes.reveal.test.ts`, both scripts at 60 ms and 1.25 s runs, on the probe passage. With the gate removed, the two "opens on a quote" cases go red; the probe passage alone stays green, because the planned pace covers it.
- [x] With a 1.25 s run at 50 tokens/s on the probe passage, no revealed word takes longer than 150 ms. Report the pace range and the reveal time against today's pacer, as the mock does: smooth 22–120 ms/word, 12.6 s. — The longest word gap is 138 ms. Smooth runs at 21–122 ms/word and takes 8.3 s. Today's pacer runs at 21–59 ms/word and takes 6.9 s (warm second turn, fake timers).
- [x] With a 60 ms run, the reveal takes at most 5% longer than today's pacer. — 7.0 s against 6.9 s (+1.4%), in the same test file.
- [x] A quote that the full-turn reading names differently recolors at narration end. The saved reading is the full-turn one. — `quoteSpeakers.test.ts` covers the recolor map and `MarkdownRenderer.speakers.test.tsx` covers `data-quote-recolor` and `--quote-from`. Early runs never write `mentionReadings`, so the saved reading is still the full-turn one.
- [ ] Fade-in Narration off, Character Mentions off, and no loaded model each reveal and color exactly as today.
- [x] Per-frame Playwright samples of one quote's color through its first reveal, on the real pacer with a fake run time, in light and dark, for the user. — `.scratch/quoteFrames.mjs` runs `/markdown test steady quotes 1250` on the speakerQuotes fixture. In both themes, the first frame that holds the quote has Kessa's color at opacity 0.00. Light: rgb(133, 50, 174). Dark: rgb(213, 157, 241).

## Landed

**Not verified**
- Off states (Fade-in off, Character Mentions off, no model): only at unit level. `turnCardTriggers` gives nothing, and a reader with no `read` holds no quote. The condition `quoteReadRef` in `GameViewer.tsx` was checked by reading the code. No app run covers it.
- A color that lands on text already on screen (after a skip, or after the 5 s hold cap) waits for the next remount: a return from a past page, or the commit. A live block that is already shown does not re-render for it.

**Decisions made while building**
- The pace floor is dropped, by spec-session ruling (Q72 amended on main). Longest word gap and reveal time, fake 1.25 s run, with the floor vs without it:

  | Passage | Tokens/s | With floor | Without floor | Today |
  |---|---|---|---|---|
  | Probe | 25 | 274 ms / 15.4 s | 274 ms / 15.1 s | 274 ms / 13.8 s |
  | Probe | 50 | 138 ms / 9.3 s | 138 ms / 8.3 s | 138 ms / 6.9 s |
  | Probe | 100 | 264 ms / 5.8 s | 264 ms / 5.8 s | 68 ms / 3.5 s |
  | 12-line dialogue | 25 | 176 ms / 10.1 s | 139 ms / 8.9 s | 147 ms / 7.9 s |
  | 12-line dialogue | 50 | 139 ms / 6.2 s | 139 ms / 5.7 s | 74 ms / 4.0 s |
  | 12-line dialogue | 100 | 150 ms / 4.2 s | 150 ms / 4.2 s | 36 ms / 2.0 s |

- Runs coalesce. One run covers every quote whose hold point has arrived, so a slow device falls behind less.
- A hold that reaches 5 s shows the quote uncolored, and the rest of the turn reveals ungated. This keeps a stalled worker from freezing the turn.
- The app had no 300 ms color fade. A quote the full-turn reading colors differently now plays a 300 ms `quote-recolor` keyframe from its streamed color.
- In dev only, `/markdown test <profile> quotes [ms]` replays the speakerQuotes passage with a fake run time.

**For you**
- Watch a turn with Fade-in Narration on and a model loaded. Each quote should appear already in its color, and the reveal should slow a little ahead of quotes. Frames: `.scratch/character-mentions-18/frames/quote-light-appears.png`, `quote-dark-appears.png`, and the samples in `quote-samples.json`.
- On a CPU-only device (small model, about 1.25 s per run), judge whether the slower reveal feels right. It took 8.3 s where today's pacer takes 6.9 s on the probe passage.
