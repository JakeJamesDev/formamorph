# 18: Streaming Quote Colors

Status: ready-for-agent
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

- [ ] With Fade-in Narration on and a model loaded, every quote is colored before its first word is revealed, on the `steady` and `burst` reveal test scripts. The test is proved by removing the gate.
- [ ] With a 1.25 s run at 50 tokens/s on the probe passage, no revealed word takes longer than 150 ms. Report the pace range and the reveal time against today's pacer, as the mock does: smooth 22–120 ms/word, 12.6 s.
- [ ] With a 60 ms run, the reveal takes at most 5% longer than today's pacer.
- [ ] A quote that the full-turn reading names differently recolors at narration end. The saved reading is the full-turn one.
- [ ] Fade-in Narration off, Character Mentions off, and no loaded model each reveal and color exactly as today.
- [ ] Per-frame Playwright samples of one quote's color through its first reveal, on the real pacer with a fake run time, in light and dark, for the user.
