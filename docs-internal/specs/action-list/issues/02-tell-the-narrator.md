# 02: Tell the Narrator

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change with probes, plus the turn-input plumbing ticket 03 reuses.

## What to build

When the player sends, the shown entries ride along with the action to the narrator, and the story reacts to them. Hidden entries never reach the AI. The player can send with an empty action box when the list has shown entries. Sending closes the list. The sent page shows the list under the action line in a compact read-only form, with hidden entries marked as visible only to the player.

The block reaches the narration request only (Q8), in the thinking-off lane only (Q10). It is the preset's wrapper line followed by one code-written line per shown entry (Q19). The wrapper is a new preset field in Prompts → Narration → Messages beside Direction, with its own reset. History stores the bare action. This ticket owns the shape that carries the shown entries into the turn, which ticket 03 reuses for the Inventory pass.

Spec rulings: Q3, Q4, Q8, Q10, Q11, Q19, Q22.

## Acceptance criteria

- [x] With shown entries and thinking off, the narration request ends with the wrapper and one line per shown entry. A narrationPrompt test covers it. — `turnPasses.test.ts` "told panel actions"; `GameViewer.tellNarrator.test.tsx` "ends the narration request…".
- [x] Hidden entries never appear in any request. — same GameViewer test, every request body checked.
- [x] Entries made in the Chat layout are never sent (Q31). — read per the rewritten Q31 (a Chat send tells nothing, stored as untold); "tells nothing from the Chat layout…".
- [x] With native thinking on, the block is absent. — "adds nothing … with thinking on" (pass) and "tells nothing with thinking on…" (game).
- [x] No other pass (choices, stats, digest) gets the block. — "reaches no other pass (Q8)" loops every pass record.
- [x] History keeps the bare action; the next turn's request does not repeat the block. — "keeps the bare action in history…".
- [x] The wrapper field shows in Prompts → Narration → Messages with a reset, and the anatomy marks the block as assembled context. — `SettingsModal.prompts.test.tsx` "stacks the Since Last Turn Message…"; anatomy runs `action-list` (wrapper) and `listed-actions` (lines) in `turnPasses.test.ts` and `anatomyPreview.test.ts`. The reset is the shared message-field reset, shown on custom presets.
- [x] Send is enabled with an empty action box when the list has a shown entry, and disabled when it has only hidden ones. — "sends with an empty action box only while…"; also a live cloud turn in the preview.
- [x] Sending closes the list, and the sent page shows its entries, hidden ones marked player-only. — "closes the list on send…"; frames below.
- [ ] Probe numbers (`probe` skill): the narrator reacts to shown entries and does not mention hidden ones, with in-batch controls, cloud and local. — cloud done, local not run (see Not verified).
- [x] Frames: `.scratch/frames/sent-page.png`, light and dark, at 1440 px wide. — 1440×900 viewport; the pane stores frames at 800 px wide.

For you: whether the narration reads naturally after a potion-only turn in a real game.

## Landed

Rulings Q31 (rewritten) and Q32–Q36 came from the spec session for this ticket.

- **Turn-input shape (Q36):** `TurnPlanInput.toldActions: { facts, count }[]`, the shown entries in list order. It carries them on every Pages send, whatever the thinking mode; the narration pass alone decides the lane (Q10). A Chat send and a scripted turn carry none. Ticket 03 reads the same field.
- **Sent list:** `sentActions` in GameplayContext and the save, keyed by turn id, pruned with the history like attachments. Only the newest turn keeps snapshots (Q34). A turn sent from Chat, with thinking on, or as a scripted turn is stored `told: false`, so the sent page marks every row Only You.
- **Wrapper wording:** probed before shipping. The first draft ("These already happened: write this turn with their results in place.") showed the action 42–46% of the time on cloud; the shipped "Open this turn by showing each one on the page, in this order:" showed it 85–92%.
- **Probe** (`testing/baseline/harness/action-list-probe.mjs`, cloud `default`, 12 runs per arm per case, 4 cases, one batch):

  | arm | shown action on the page | hidden item named | typed action on the page |
  |---|---|---|---|
  | control (no block) | 0% | 0% | 44% |
  | shipped wrapper | 85% | 0% | 56% |
  | first draft | 46% | 2% (regex hit on "roll") | 53% |

- **Send with an empty box** is disabled only while the list has entries and none would be told (hidden only, thinking on, or Chat). With no list, an empty Send stays enabled and does nothing, as before; existing layout snapshots and mobile-input tests pin that.
- **Regenerate** sends no block (Q35) through ticket 01's list clear; the regenerated page shows no sent list until ticket 07.

**Not verified**

- Local probe arm (Cydonia): LM Studio (1234) and Ollama (11434) were both down during the build. Run `node testing/baseline/harness/action-list-probe.mjs --endpoint http://127.0.0.1:1234/v1/chat/completions --model cydonia-24b-v4.3@q4_k_m --runs 3` with Cydonia loaded.

**For you**

- Whether the narration reads naturally after a potion-only turn in a real game: `#dev?view=gameViewer&fixture=items&tab=inventory`, play the opening, use the Healing Tonic, clear the box, press Send.
- ⚠️ Save shape: a new optional `sentActions` field (turn id → list) on the save.
- Frames: `.scratch/action-list-02/frames/sent-page.png` and `sent-page-dark.png` (a live cloud turn: the tonic told, the helmet hidden).
