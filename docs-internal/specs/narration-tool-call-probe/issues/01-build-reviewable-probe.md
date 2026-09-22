# 01: Build the Reviewable Standalone Probe

Status: ready-for-human
Base: 8fa9aa40a82f2e4497d7644c246d4e223f08e813
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high
Spec session: 01a0c681-c233-72c1-a86c-b3ad7320df2f

## Parent

[Cloud Narration Tool-Call Probe](D:/Documents/GitHub/formamorph/docs-internal/specs/narration-tool-call-probe/spec.md)

## What to build

A complete standalone baseline probe that prepares the real narration request, runs the native information-lookup conversation, captures the terminal narration, and records evidence. Demonstrate the entire flow offline with a scripted transport and deliver the exact rendered cloud request for review. Cloud transport must be available for the next ticket, but this ticket sends no cloud requests.

Use the confirmed complete-trial test boundary and production prompt-rendering helpers. Keep the experiment outside gameplay and the offline Test Bench. No production refactor is planned.

Model rationale: Sol with high reasoning suits the integration of current prompt rendering, native tool-message sequencing, evidence capture, and failure guards within one bounded harness change. This recommends an implementation model; the experiment's cloud model remains `default`.

## Acceptance criteria

- [ ] Offline preparation renders both approved cases from the current default narration system and user templates, using Sedge Landing with Wren at the landing, no prior narration, planning off, English, plain prose, and single-paragraph guidance.
- [ ] Entity blocks use authored summaries; the probe applies only the prompt changes in the parent spec, including delivery through `write`. Remaining world, location, Persona, stat, trait, notes, and dictionary context follows production rendering.
- [ ] The complete initial messages are checked for unresolved tokens, summary-to-full-description fallback, and leakage of the selected withheld facts. A failed check prevents transport invocation.
- [ ] The request includes exactly the two native function tools specified by the parent: `request_info` with a string term and `write` with a string narration. Both remain available with automatic tool choice; no forced calls or strict mode are introduced.
- [ ] The local lookup handler uses the exact-name and alias rules in the spec, returns verbatim full entity descriptions with identifiers and names, returns all ambiguous matches, and returns an empty matches collection for unknown input. It makes no AI requests.
- [ ] One complete trial supports batched and sequential lookups, retains the original assistant call message, appends correctly correlated tool results, and resends the accumulated conversation before accepting a subsequent terminal write.
- [ ] A single valid, nonempty `write` captures the narration and ends the trial without an acknowledgement request. A control trial may write directly when no entity portrayal requires retrieval.
- [ ] Malformed or unexpected arguments, unknown functions, duplicate call identifiers, multiple writes, empty narration, and mixed lookup/write responses terminate with a recorded failure. Function-looking prose does not count as a native call, and ordinary narration without `write` fails the output contract.
- [ ] Unknown lookups may receive empty results and continue. Repeated lookups count toward the budget. Failures are not silently repaired, retried, or followed by coaching or a forced write.
- [ ] The probe supports the specified non-streaming cloud request with model `default`, 1,024 generated tokens per response, disabled reasoning, and omitted temperature and repetition penalty. No warm-up or token-count request occurs during preparation.
- [ ] The batch runner implements two main trials followed by two control trials, each fresh, with four model requests and four lookups maximum per trial, a 60-second request timeout, and batch termination on endpoint-level rejection. Cancellation stops further work; completed timers are cleaned up.
- [ ] Offline mode demonstrably makes zero network requests. Cloud execution is an explicit separate operation and is not triggered by preparation, automated tests, or completing this ticket.
- [ ] Evidence records exact rendered requests, source revision, raw responses, tool results, narration, counters, measured request/trial durations, and available usage in the existing ignored baseline evidence area. Credentials are excluded; missing usage remains unavailable.
- [ ] Offline tests drive the actual complete-trial runner, renderer, and lookup handler through the scripted transport. They cover batched/sequential success, direct write, unknown/ambiguous lookup results, invalid calls, identifier errors, mixed responses, cancellation, timeout, exhausted budgets, and endpoint rejection.
- [ ] Tests verify that failures remain visible in evidence and do not cause further unauthorized requests. Relevant coverage is measured, new guards are shown to fail when broken, and every test run is timed. No test merely duplicates the implementation.
- [ ] The final handoff includes the exact initial request for each case, the offline verification results, and an explicit statement that cloud behavior remains untested. This is the review artifact required before ticket 02 can execute its cloud batch.
- [ ] Complete the normal code-change gates, tooling changelog entry, graph update, and review. Preserve production prompts, authored fixtures, application defaults, exported world/save shapes, and application version.

## Boundaries

This ticket is independently verifiable through offline request previews and complete scripted conversations. It implements evidence collection, not a claim that the cloud endpoint supports tools. It does not run the experiment or add tools to gameplay.

The approved main and control actions, withheld facts, tool descriptions, and failure classifications are defined by the parent spec and supporting plan. Do not weaken them to make a test pass.
