# 12: Batched Location Request

Status: done
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change: it ships with probe numbers. Added after ticket 09's probe (Q103).

## What to build

The location request asks about every character in one call, not one call per character. The subjects, the replies, the clock line, the JSON schema with its text fallback and the gate all stay as ticket 09 built them.

Ticket 09's probe is the reason. On the cloud default, an action that names one character out of three moved only that one in 24 of 24 batched runs, and in 16 of 24 per-character runs. "Corvin, come with me" also brought the two others along in every per-character run. One call also cuts the requests per turn from one per character to one.

Two known costs to measure and report:

- A batched call ran about twice as long as one per-character call. Per-character calls run side by side, so the turn's wall-clock time may go up or down.
- "As long as it takes" and "until night falls" picked the end of this daypart, not the next, in both forms (Q8 says the next). Try to fix it here; if the probe does not move, record it.

Read `docs-internal/notes/prompt-writing-guide/notes.md` before writing the prompt.

Spec rulings: Q8, Q103–Q108. The spec's "Entity location request" section and ticket 09's Landed section are the contract and the baseline.

## Acceptance criteria

- [x] One request per turn covers every subject, and each subject gets exactly one reply. A reply that omits a subject, or names one that was not asked, leaves that character where they are. (`turnPasses.test.ts` "asks every subject in one request…", "leaves a subject the reply omits…", "ignores a character the request did not ask about"; `turnRunner.test.ts` one request per stage; `GameViewer.narratedMoves.test.tsx` counts one request for two characters.)
- [x] Turn pipeline tests with recorded replies cover both reply forms, three subjects with mixed replies, an omitted subject and an unknown one. (`computeTurnCommit.test.ts` "reads three subjects with mixed replies in the schema form…", "reads each row of the one reply…", "moves nobody when the one request fails…"; mutations of the omit, namesake, first-row and ready guards each went red.)
- [x] The per-character path is removed, not kept beside the batched one. (Both passes are `fanOut: false`; `planTurn.test.ts` lists the remaining fan-outs.)
- [x] Probe on the cloud default with ticket 09's cases and the per-character form as the in-batch control: the one-named bar, right answers, false moves, wrong waits, and the turn's wall-clock time for both forms. The landing states the numbers. (Three batches below.)
- [x] The batched form lands only if it meets the one-named bar and is not worse than the control on right answers. (Above the control on both in every batch; bar read as the choice between forms, Q118.)
- [x] The prompt reference doc and a changelog fragment cover the change. (`docs/Prompts.md`, `docs/Prompt-Chips.md`, `docs-internal/changelog.d/npc-schedules-12.md`.)

## Landed

**Probe** (`testing/baseline/harness/entity-location-probe.cli.ts --control <module>`, cloud default, 8 runs × 18 cases per batch, Emberwatch at 14:00, every arm in one dispatch per case). The control is ticket 09's per-character `turnPasses.ts` and prompt text from `d38aa2c15`, loaded from `.scratch/control/`; its prompts were checked equal to that commit's defaults. Turn ms is the slowest call an arm sent for a case.

| Batch | Arm | Right | False move | Wrong wait | Named-only (bar) | Turn ms |
|---|---|---|---|---|---|---|
| 1 | Batched, shipped text | 96% | 3 | 12 | 21/24 | 1962 |
| 1 | Per character (control) | 92% | 24 | 11 | 16/24 | 1218 |
| 2 | Batched, shipped text | 95% | 10 | 14 | 22/24 | 1727 |
| 2 | Batched, ticket 09 text | 96% | 5 | 16 | 24/24 | 1729 |
| 2 | Per character (control) | 94% | 22 | 8 | 16/24 | 1033 |
| 3 | Batched, shipped text | 96% | 2 | 9 | 24/24 | 1432 |
| 3 | Batched, ticket 09 text | 95% | 8 | 16 | 24/24 | 1541 |
| 3 | Per character (control) | 90% | 30 | 11 | 16/24 | 989 |

- **One-named bar:** shipped text 67/72 across batches, not clean; control 48/72. Its misses move between cases from batch to batch (Corvin along with Sylvie 3/8 in batch 1, Sylvie with Corvin 2/8 in batch 2), the endpoint's drift. The bar decides between the forms, not a per-batch gate (Q118).
- **Choice of text:** ticket 09's text in the batched form scored 48/48 on the bar, but brought Wenna along on "I ask Wenna about the barrow" in 13 of 16 runs, and reads "one character goes …: each character listed". The shipped text made that false move in 1 of 24.
- **Requests per turn:** 1 at the tavern (4 before) and 1 at the keep.
- **Turn time:** the batched call adds about 0.4–0.7 s per turn over the per-character calls run side by side.
- **Q8 waits, not met:** "as long as it takes" and "until night falls" pick the end of this daypart, not the next, 8/8 in every arm. Two attempts, neither shipped: a reworded wait rule ("the last Wait here line" for an open wait) scored 89% vs 93%; wait lines that also name the daypart they cover ("through the evening") fixed "until night falls" but broke "until nightfall" 4/4.

**Not verified**

- Cydonia was not run: cloud only, by the project default.
- A text reply that shortens a name ("Sylvie: Stay" for Sylvie Thornwhistle) reads as no reply, so that character stays. The schema form, the default, names each key exactly.

**For you**

- For you: with three characters in a room, ask one by name to come along, and check the others stay.
- A turn with followers or free characters present now waits about half a second longer for the one location request.
- Ask a companion to wait "as long as it takes" or "until night falls": they will likely wait only to the end of this part of the day.
