# 04: Help Code Probe

Status: done
Blocked by: 01 — Close the Guide Fence and Check Every Fence; 03 — Code Rider on the Help Preset
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), rulings Q7, Q8, Q13.

## What to build

A help-code probe in the baseline harness. Its case set holds stat-code questions against a fixture stat (a number stat with a range and a few neighbor stats, placeholders and traits) plus prose-only how-to controls. Two arms run the same questions in one batch: `rider` and `control` (no rider). Scoring is a pure function over an answer: fence present, fence closed, slot tag present per fence, and runs. A snippet runs when the stat-code executor evaluates it against the fixture stat without throwing and returns a number or nothing, inside the sandbox's own interrupt timeout.

The probe runs on the cloud default model, 5 to 12 runs per arm, and the ticket records the numbers against the bar: fence present at 90% or more and runs at 80% or more on the rider arm, with tag presence and truncated fences reported. Controls must stay prose. If the bar is not met, the rider text is tuned in this ticket and the batch rerun; the final numbers go in the changelog body and the spec's Further Notes.

Workload: harness design, sandbox fixture, and reading model output honestly. A top model at high effort. Cloud only; no local model.

## Acceptance criteria

- [x] A case file of stat-code questions and prose controls, with a fixture stat
- [x] A CLI with `rider` and `control` arms that share a batch, following the existing help probe's shape
- [x] A pure scorer: fence present, closed, tagged per fence, runs; a throwing snippet scores not run; a scorer test covers each case from fixture answers
- [x] The scorer runs snippets through the real stat-code executor, never a parse
- [x] A results block in this ticket: model `root` name, runs per arm, every metric per arm, and the truncation rate
- [x] Rider arm meets Q7 or the ticket says it does not and why
- [x] Controls stay prose on both arms
- [x] Changelog line under In Progress, Added, ⚙️

## Results

Model `default` on `api.lyonade.net`, root `/home/fiery/gemma_deploy/model`, 2026-10-04. Final batch: 12 cases (8 code, 4 prose) × 2 arms × 8 runs = 192 questions, 0 failed. Requests go through `askHelp` with the default help settings (keyword search and AI picks).

| Set | Arm | n | Fence | Closed | Tagged (per fence) | Runs | Runs (per fence) | Truncated | Token cap |
|---|---|---|---|---|---|---|---|---|---|
| Code | rider | 64 | **100%** | 100% | 71% | **86%** | 86% | 0% | 0% |
| Code | control | 64 | 3% | 3% | 0% | 3% | 100% | 0% | 0% |
| Code, Code tab open | rider | 24 | 100% | 100% | 72% | 79% | 80% | 0% | 0% |
| Code, Code tab open | control | 24 | 0% | 0% | – | 0% | – | – | 0% |
| Prose | rider | 32 | 0% | – | – | – | – | – | 0% |
| Prose | control | 32 | 0% | – | – | – | – | – | 0% |

✅ **Q7 met** on the rider arm: fence 100% (bar 90%), runs 86% (bar 80%). Controls stay prose on both arms. Raw answers: `testing/baseline/runs/help-code-probe-2026-10-05T02-25-05-428Z.json` (gitignored).

### Scoring rules (user rulings, 2026-10-04)

- The bar counts answers. A no-fence answer counts against both bars. A two-fence answer runs only when both fences run.
- A fence that holds only comments or blank lines scores as not run. The sandbox runs it without an error, but it does nothing.
- An open fence still goes to the sandbox as written.

### Tuning

The ticket-03 rider missed the bar. Each row is from one in-batch run over the 8 code cases × 8 runs.

| Rider | Fence | Runs | What failed |
|---|---|---|---|
| Ticket 03 (baseline batch) | 64% | 38% | Copied a guide how-to, or wrote `// Your code here` templates for both boxes |
| v2: write new code, one box, names the sandbox objects | 84% | 78% | An inline "thought" analysis hit the 800-token cap on one case |
| v3: v2 shortened, no sandbox names | 95% | 66% | Invented names: `currentValue`, `MyStat`, bare `Stamina` |
| **v3g: v3 plus the sandbox-object line** | **98%** | **94%** | Copied the guide's `dictionaries.Weather.placeholders.Sky` |

The shipped rider is v3g with "Put the code in the box the task needs" changed to "Write the whole contents of the box the task needs", as the spec's rider contract asks; the review found the clause missing. The Results table is its own batch. Runs fell from 94% to 86% between batches with no other change of note, which matches this endpoint's batch-to-batch drift; each batch's control is its own.

The answer prompt says to take each fact from the guide sections, so the rider must let the model write code the guide does not hold. The sandbox-object line is what makes the code run. The user approved narrowing ticket 03's "carries no example code" test: it still forbids code syntax, and a sandbox name may appear only alone, never with a member.

### Open findings

- 🐞 6 of the 9 rider answers that do not run put the slot word on its own line inside the block (` ```javascript` then `after`). The snippet throws, and Insert would paste the word into the box. Tags reach 71% of fences.
- The control arm fences 3% of code answers, so code from the guide alone is rare without the rider.
