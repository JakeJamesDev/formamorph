# 03: Extract the Settings Display and Output sections into production components

Status: ready-for-human
Status note: built; the browser check at desktop and 375px is still open
Base: ca83824a
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The Display and Output tab bodies move out of the Settings dialog into two production section components. Each section reads a settings source with the same member names as the Settings context value, and the dialog passes the live context. Every effect that leaves the page goes through that source: theme persistence, embedding-model load and dispose, and any other effect the sections trigger. The sections take the Simple/Advanced mode as input.

The dialog keeps its tabs, mode state, and every behavior. This is a pure move: no row, hint, order, or control changes, including the two rows that depart from the Aligned Settings Stack rule, which move unchanged. No reference work happens in this ticket.

Check for parallel sessions on the Settings dialog before starting. It is about 3,300 lines and the most likely collision point.

Recommended model rationale: the largest extraction in the effort, across a very large file with many effects; needs strong reasoning to keep the move pure.

## Acceptance criteria

- [x] The Settings dialog renders the Display and Output tabs through the two section components
- [x] Every existing Settings dialog test passes unchanged
- [x] Theme persistence and embedding-model load and dispose reach the page only through the settings source
- [x] The section components accept the mode as input and render the same rows in Simple and Advanced as before
- [ ] No visible change in the Settings dialog at desktop and 375px, both themes
- [x] Four gates green

## Comments

**Implementation notes (b624cf0b):**

- Sections: `DisplaySettingsSection`, `OutputSettingsSection`. The source types are in `settingsSource.ts`. The download hook is `useEmbeddingDownload`.
- The Output section takes `nativeReasoningRuledOut` as a prop. The dialog computes it from the selected prompt tab's routed endpoint, and not from the active endpoint. This keeps the move pure. It is probably a latent bug, and a separate decision.
- **For ticket 04:** Theme Preview and the quote color field read token values from the live page (`getComputedStyle`). A Theme change in the reference will not recolor the preview. Nothing is written.
- **No visible change:** a throwaway jsdom test compared the old and new tab panel HTML: Display and Output, in Simple and Advanced, with defaults and with every conditional row open. All eight were byte-identical. A one-class mutation made the diff fail. The browser check at desktop and 375px in both themes did not run, because the Browser pane was hidden.
