# 02: Schema Clock Request

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Where the endpoint takes a response schema, the clock pass asks for the three-field reply from the spec (schema v2: `lasts_until`, `unit`, `count`, in that order), so the cloud model can no longer answer with a bare unit, "Few minutes" or leaked thinking. The reply parses into ticket 01's reading and resolves through its anchor math.

- The request carries the schema, a schema reply-format block, and ticket 01's text request as the fallback, like the Inventory pass.
- A clock text-pass setting sends the text request alone when the endpoint's reasoning setting rules the schema out, wired like the inventory and entity-location text passes.
- The clock pass's token cap fits the JSON reply; the temperature 0 pin stays.

## Acceptance criteria

- [x] The clock request carries the schema and a text fallback; with the text pass on it carries the text format alone. `turnPasses.test.ts` › the clock pass request (schema, fallback, text-pass cases).
- [x] The schema reply-format block is its own run in the request anatomy. Same block: `formatRun` checks the runs tile and the last run is `reply-format` over the format text, for both requests.
- [x] A schema reply resolves to the same hours as the matching text reply (an anchor, a day carry, a count with `none`, the guard). `computeTurnCommit.test.ts` › schema clock replies, "resolves %s like its text twin" (8 cases, Q12 twins with the same count).
- [x] An endpoint that refuses the schema gets the text request, and the turn's clock still moves by the text answer. Same block: the real request through `withTextFallback` with a refusing send, then the commit.
- [x] The probe sends the app's real schema request, with the shipped request as the in-batch control, on both case files. The cloud main set scored 79–84%, under the 87% bar; Q15 replaces the cloud bar and ships the spec layout. MeroMero 100% on both, run with the user's go-ahead.
- [x] Changelog fragment written. `docs-internal/changelog.d/clock-pass-anchors-02.md`.

For you: with native reasoning on for the clock pass, play a turn that runs until nightfall and check the clock still lands at nightfall.

## Landed

Probe numbers, in range, `time-delta-probe.cli.ts` (control = shipped at 8b9ea6e4e, in batch):

| Batch | Arm | Cloud main | Cloud dialogue |
|---|---|---|---|
| 1 | shipped | 53% | 57% (11% unparseable) |
| 1 | **schema (ships)** | **79%** (anchored 89%) | **88%** |
| 1 | text fallback | 79% | 70% |
| 2 | shipped | 53% | 57% |
| 2 | **schema (ships)** | **84%** (anchored 100%) | **84%** |
| 2 | spike layout (field lines in the system prompt) | 89% | 62% |
| 2 | text fallback | 79% | 70% |

MeroMero v2 31B, 3 runs: schema 100% main and dialogue (shipped 74% / 100%, text 95% / 100%).

Remaining cloud misses for the shipped schema request, 12 of 12 runs each:
- `sleep` (22:00, want 5–12h): `1h`.
- `sleep-implied` (22:00, want 5–12h): `3d`.
- `sleep-onset` (22:00, want under 30m): `1h`.
- `walk-talk-street` (13:00, want 2–21m): `7h`, the "tonight" read as nightfall.

Guards proven by reverting: the parser skipping JSON failed 10 schema tests; a count of 0 read as no count failed the guard twin; an ignored `clockTextPass` failed the text-pass test; a JSON reply falling through to the text parser failed "never reads a schema reply as text".

Neither layout met both cloud sets; the spike-layout arm was removed from the probe after the measurement (Q15). The schema request's cap is 60 tokens; the text request keeps 12.

**Not verified**
- Nothing unticked.

**For you**
- With native reasoning on for the clock pass, play a turn that runs until nightfall and check the clock still lands at nightfall.
- On the cloud model, a night's sleep still costs an hour or three days: watch the clock after a sleep scene.
