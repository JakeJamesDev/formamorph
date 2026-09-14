# 10: Missing-source checks and repairs

Status: ready-for-human
Base: 4ca9e7ce
Status note: Built in this session. Every acceptance criterion passes, verified end to end in the running
app: a seeded world with one removed and one unreachable source shows both rows, Unlink repairs the copy,
and saving lifts the New Game gate. Two notes are open for the author; see Build notes below.
Blocked by: 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a Test Bench rule plus per-row repairs over settled outcomes; the gating of New Game and Publish needs care but the rules are explicit.

## Parent

[spec.md](../spec.md) — Missing sources and offline use, Settled follow-up decisions (Updates and repairs), ADR 0005 test bench shows computation.

## What to build

A world whose linked source cannot be reached tells the author what is known and offers a repair, without stopping play.

A Test Bench issues rule reports each world copy whose source check failed. A definite not-found answer reads as not found, with the author having removed it; any other failure reads as unavailable with **Retry Check**. Checks run only when the user asks. A missing required source blocks New Game and Publish for that world; editing and resuming existing saves continue. A missing optional source blocks nothing and keeps its association.

Each finding row carries its own repair: **Replace From Library** opens the searchable picker, **Unlink and Keep Content**, or **Remove From World**, applied with one **Apply** per row. A republished source has a new identity and never reconnects on its own; Replace From Library is the path. Applying a repair to a required source lifts the New Game and Publish gate. The rule lives in the embedded and docked bench placements and the mobile sheet like every other rule.

## Acceptance criteria

- [x] With a source that answers not found, the issues list shows the not-found finding; with a network failure it shows unavailable with Retry Check.
- [x] A missing required source disables New Game and Publish with the reason; resuming a save and editing work.
- [x] A missing optional source shows a finding and blocks nothing.
- [x] Replace From Library relinks the copy to the chosen library item; Unlink and Keep Content leaves an independent copy; Remove From World removes it; each applied per row.
- [x] Repairing the required source re-enables New Game and Publish.
- [x] Type check, lint, tests, and build pass; the rule test asserts the computed finding, never a judgment.

## Blocked by

- 06 — Download a world with dependencies and add-ons.

## Build notes

**Where each part lives.** `src/lib/sourceChecks.ts` is the pure core: which copies follow a published
source, what the answers mean, and the three repairs. `src/lib/sourceCheckRun.ts` holds one run's
reasoning. `src/lib/sourceCheckStore.ts` keeps the last answer per world in browser storage.
`src/lib/testBench/missingSources.ts` turns answers into Issues rows, and `useSourceChecks.ts` is the
Bench's hook. The main menu gates on the stored record alone, so opening it makes no request.

**Two answers, two meanings.** Only a definite not-found blocks a new game and a publish. Every other
failure reads as unreachable and blocks nothing, per the spec's rule that a network error is not
evidence of a deletion.

**A world with a listing is asked about its own listing first.** A required source may be unlisted,
which answers not found to everyone but its author through a direct request. So when the world's own
listing cannot be read, the run concludes nothing at all and every source reads unreachable. Required
sources are then answered by the world's dependency route, never by a direct ask.

## Open for the author

1. **Severity.** A removed source is an error and an unreachable one a warning, whether or not the world
   requires it. An optional removed source is therefore an error row that blocks nothing. The
   alternative is four rules instead of two; the ticket did not say.
2. **Where the gate's reason reads.** The reason is a line above the action column, and the three gated
   buttons are disabled. A tooltip on each disabled button was the other option; a disabled control
   cannot carry one without a wrapper.
