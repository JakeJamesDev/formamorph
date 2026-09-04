# Anatomy Chips

Status: ready-for-agent

## Problem Statement

The Request Anatomy speaks a different language than the prompt editor it sits next to. Where the editor shows a chip like `LENGTH GUIDANCE`, the anatomy shows an invented italic pseudo-tag plus resolved text: `<world data from your chips>` / `Write at most 6 short paragraphs.` These lines feel out of place, and the label is often wrong — every chip expansion in the narration system prompt is labeled "world data from your chips," including guidance chips that are not world data. On top of that, the hub truncates Context Runs to a 110-character excerpt, so the player can read neither the structure nor the real bytes cleanly.

## Solution

Give the Anatomy hub the same flip gesture as the prompt editors, with chips as the shared vocabulary:

- A **Chips | Preview** toggle on the hub. Chips mode collapses every Context Run to a chip, so the request reads exactly like the player's template with the blanks marked. Preview mode shows the complete resolved request — real bytes, no pseudo-tags, no excerpts.
- Runs produced by a template chip render **the editor's own chip visual** and click through to that chip in its editor, revealed by a scroll and a brief highlight ring.
- Runs the app assembled (recap, past turns, turn plan, mode directive) render as a visually distinct **assembly chip** with a short label and an explanatory tooltip. Assembly chips whose content another prompt wrote click through to that prompt's anatomy, making the hub a browsable map of the Turn Pipeline.
- The in-game AI Context viewer keeps its single resolved render but also loses the pseudo-tag lines.

## User Stories

1. As a player, I want the anatomy to show the same chips I placed in the prompt editor, so that the request reads as my own template with the blanks filled.
2. As a player, I want a Chips | Preview toggle on the Anatomy hub, so that I can flip between structure and resolved bytes the same way I flip the editor between Edit and Preview.
3. As a player, I want the hub to open in Chips mode, so that the whole request fits in one scan before I drill into resolved text.
4. As a player, I want each injected value identified by its actual chip, so that the length guidance is never labeled as world data.
5. As a player, I want to click a chip in the anatomy and land on that exact chip in its editor, so that I can change the thing I am looking at without hunting for it.
6. As a player, I want app-assembled blocks shown as visibly different chips from my template chips, so that I never hunt the editor for a chip that does not exist there.
7. As a player, I want to click an assembly chip that another prompt produced and jump to that prompt's anatomy, so that I can follow the pipeline from output to producer.
8. As a player, I want short, title-case labels on assembly chips with the plain-words explanation in a tooltip, so that chips stay pill-sized and still explain themselves.
9. As a player, I want Preview mode to show the complete resolved request with nothing truncated, so that what I read is exactly what the model receives.
10. As a player, I want the italic explanation lines gone from resolved text everywhere, including the in-game AI Context viewer, so that resolved text is just my text and the app's text, told apart by highlight and dimming.
11. As a player, I want Authored Runs to keep their tint, source label, and click-through in both modes, so that jumping to an editor stays discoverable wherever I am.
12. As a player, I want template chips in the anatomy to show their variant the way the editor does, so that a Stats chip set to Values reads the same in both places.
13. As a player, I want hover and tooltip cues on every clickable chip and run, so that I know where a click will take me before I commit.
14. As a keyboard user, I want chips reachable and activatable with the keyboard, so that the anatomy's navigation works without a pointer.
15. As a player, I want the toggle to keep my choice while the Settings modal stays open, so that switching prompts does not reset my view.
16. As a player, I want chips whose content nobody owns (my typed action, past turns, notes) to stay inert labels, so that clicks only exist where they go somewhere real.
17. As a player reading a real turn in the AI Context viewer, I want run boundaries still visible through highlight and dimming after the pseudo-tags are gone, so that I can still tell my text from assembled context.

## Implementation Decisions

- **Chip identity on runs.** The anatomy piece and run shapes gain an optional chip token, recorded at template render time where the renderer already knows it. Runs from chips carry their token; assembly runs keep only their context label. The sidecar remains session-only and never reaches an endpoint; the AI-context debug export gains the field additively. No world or save export shape changes.
- **The `world-data` catch-all dies as a chip label.** Chip-produced runs are identified by token. Context labels survive only for assembly runs, reworded as short title-case chip labels with the current full sentences demoted to tooltips.
- **Read-only chip pill.** The token-chip visual (shared chip primitive, vocabulary color, "Name (Variant)" label composition) is extracted from the Lexical decorator into a presentational component both the editor and the anatomy render, so the two surfaces cannot drift apart.
- **View modes.** The anatomy view's preview/full mode split is replaced by chips/resolved. The excerpt heuristic and the pseudo-tag explanation lines are deleted outright. The in-game viewer renders resolved mode only; the hub gets the toggle.
- **Chips mode rendering.** Context Runs fully collapse to their chip — token-backed runs to the editor pill, assembly runs to a muted assembly pill. Authored Runs render verbatim with their existing tint, source label, and jump behavior.
- **Real-chip click.** Jumps to the owning editor and reveals the chip: the jump target gains chip identity, and the reveal scrolls to the chip's DOM node and rings it briefly without stealing focus, following the existing editor-reveal pattern. No Lexical selection is involved.
- **Assembly-chip click.** A context-label-to-prompt-tab map, kept beside the existing authored-run jump map: Turn Plan → Thinking, Narration → Narration, Character Brief and Intents → Character, Diary Brief → Diary, Memory Recap → Summary, Scene Cast → Scene Tags. Clicking switches the hub to that prompt's anatomy. Labels with no owner (Your Action, Past Action, Past Narration, Recalled Turn, Notes, Mode Directive) are inert.
- **Toggle.** A two-value segmented control labeled Chips | Preview, hub only, defaulting to Chips, held as session-only component state. No new persisted setting.
- **Dictionary and hydration highlighting** continues to apply to resolved renders only; chips mode has no text to highlight.

## Testing Decisions

- Tests assert external behavior: what labels and pills render, what a click does, what text survives — never internal run bookkeeping, except at the pure builder seams where the runs are the module's contract and generic tiling assertions already exist.
- Four existing seams, no new ones:
  1. **Pure builders** — chip tokens recorded and tiling preserved, in the existing run-tiling and narration-prompt test suites. Includes a regression guard: the length-guidance chip run is identified by its token, never labeled as world data.
  2. **Jump resolution** — the assembly-chip map and chip-identity targets, beside the existing authored-run jump tests.
  3. **Anatomy view component** — chips-mode collapse, the two chip species, click targets, inert chips, full-text resolved mode, pseudo-tag removal. Prior art: the existing anatomy view component suite.
  4. **Settings wiring** — toggle state across prompt switches, cross-jump tab switching, chip reveal invocation. Prior art: the existing Settings prompts suite and its Radix-in-jsdom patterns.

## Out of Scope

- A Chips/Preview toggle on the in-game AI Context viewer — it keeps a single resolved render (minus pseudo-tags).
- Persisting the toggle across sessions.
- Editing from the anatomy: chips there are read-only, with no variant popover, rename, drag, or remove.
- Jump targets for ownerless Context Runs.
- Any world or save export shape change — none occurs.

## Further Notes

- Riskiest piece: the chip reveal. No Lexical traversal for locating a node exists; the reveal targets the chip's rendered DOM by token, so it must tolerate editor remounts the way the existing reveal helper does.
- Clicking a chip means "open variant popover" in the editor and "jump" in the anatomy. The panes are distinct surfaces, so the divergence is accepted; the anatomy chip's tooltip states its destination.
- Changelog entry belongs in the player-facing (👤) bucket when built.
