# Turn Pipeline Parity Fixture

`turn-pipeline-parity.json` is a recording of every AI request one real play session dispatched, in
order, captured from the **current** turn code before the Turn Pipeline extraction began. It is the
ground truth later stages replay against: the new pipeline, fed the same inputs, must emit the same
request sequence.

Recorded 2026-08-13 — Sedge Landing, 7 scripted turns, 86 requests, cloud default endpoint.

The recording is taken at `makeAIRequest` in GameViewer, which is the request seam the pipeline will
later be handed as an adapter. It only reads the arguments that call already received — it cannot
change what is sent — and it is inert unless the harness arms it, so no production build carries it.

## Re-recording

```bash
npm run baseline -- --profile parity --model gemma4-e4b-cloud --parity testing/parity/turn-pipeline-parity.json
```

The `parity` profile (see `profiles.example.json`) turns on every settings-gated pass and paces turns
6 s apart so the between-turn drainers run. Any OpenAI-compatible model works — what matters is the
**request sequence**; the answers are recorded only so a replay can hand the same material back.

> ⚠️ Re-recording after the pipeline lands proves nothing. The fixture's value is that it predates the
> extraction; regenerate it only if a *deliberate* behavior change made it stale, and say so in the
> commit.

## Format

Top level:

| Field | Meaning |
| --- | --- |
| `format` / `formatVersion` | `"formamorph-turn-parity"` / `1` — validated on load |
| `recordedAt` | ISO timestamp of the capture |
| `label` / `world` | Provenance: which profile × model, which world file |
| `turns[]` | One entry per player action, in play order |
| `orphans[]` | Requests dispatched before the first turn opened (empty in this recording) |

Each turn carries `index`, `action`, `turnId`, and `requests[]`. Each request:

| Field | Meaning |
| --- | --- |
| `seq` | Global dispatch counter — strictly increasing and gap-free across orphans then turns |
| `type` | `AIRequestType` (`narration`, `director`, `diary`, …) |
| `systemPrompt` | The rendered system prompt, verbatim |
| `messages` | The message array as handed to the request seam |
| `maxTokens` | The cap the caller asked for; `null` = the type's own default applies downstream |
| `silent` | A between-turn drainer (digest, diary, milestone selection) rather than a foreground pass |
| `attachTurnId` | Which turn a silent request summarizes |
| `response` | The raw text the model answered with — replay input, not a comparison target |

## What is and is not compared

**Compared** — per turn, the **foreground** (`silent: false`) requests: which passes ran, in what
order, with which system prompt, messages, and requested cap.

**Replay input, never asserted:** `response`. A parity test feeds each recorded answer back through a
fake adapter so turn N+1's prompts are built from the same material the original run saw.

**Not compared:**

- **Model output quality.** Responses are inputs to the replay, not expectations.
- **Which turn a silent drainer landed in.** Digests, diaries and milestone selection drain between
  turns, so their turn membership tracks wall-clock pacing, not turn logic — this recording has two
  diaries on some turns and one on others, and a re-record shuffles that. Compare a drainer by its
  `attachTurnId` and its payload, never by which turn's `requests[]` it happens to sit in.
- **`turnId` / `attachTurnId` values.** Fresh `crypto.randomUUID()`s every run; compare their
  *structure* (same request attaches to the same turn), never the strings.
- **The wire body.** Sampler resolution, the reasoning budget/effort split, the `/no_think` switch and
  penalty spellings all happen *downstream* of the seam, in shared code the pipeline does not touch.
- **Completion order.** Only dispatch order is recorded. Concurrent passes finish in whatever order the
  server returns them.
- **Wall-clock timing.** Nothing in the fixture is time-based.

## Coverage

Present: `director`, `character`, `storyboard`, `narration`, `choices`, `statUpdates`,
`locationChange`, `summary`, `milestoneSelect`, `diary`, `timePassed`, `openingTime`.

Absent, deliberately:

- **`thinking`** — the precall planner is mutually exclusive with staged planning; one run cannot hold
  both, and staged is the richer path.
- **`sceneTags`** — needs an image server.
- **`discoverEntity`** — fires only when the narration invents an entity; this script's narration
  happened not to.
- **Semantic memory / lore / rehydration** — off by default, and they add an embeddings worker rather
  than requests at this seam.

`src/lib/turnPipeline/parityFixture.test.ts` asserts that coverage list, so losing a pass in a
re-recording fails a test instead of quietly shrinking what parity covers.
