# 02: Run the Approved Cloud Experiment and Report Findings

Status: ready-for-human
Base: 081634690f217a77e4fdb8ae77dd36b4c65536ed
Blocked by: 01
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: medium
Spec session: 01a0c681-c233-72c1-a86c-b3ad7320df2f
Status note: Cloud execution also requires the user's explicit approval of the rendered request and bounded batch. Ticket approval alone is not run approval.

## Parent

[Cloud Narration Tool-Call Probe](D:/Documents/GitHub/formamorph/docs-internal/specs/narration-tool-call-probe/spec.md)

## What to build

Use the completed standalone probe to answer whether the configured cloud narrator performs native information lookups, accepts their results, and submits faithful narration through `write`. After the user approves the exact request and run, execute only the bounded batch and publish an auditable findings report.

This slice ends with observed evidence, whether the endpoint or model succeeds, fails, or produces an inconclusive result. It is not a production feature rollout.

Model rationale: Sol with medium reasoning suits executing an already-defined procedure and analyzing a small set of transcripts, timings, and facts. This is a recommendation for the agent handling the ticket; requests under test still target cloud model `default`.

## Acceptance criteria

- [ ] Confirm ticket 01 is complete and its offline checks passed. Review its exact rendered requests against the current spec. If the production prompt or fixture changed, regenerate and recheck the preview before execution.
- [ ] Obtain explicit user approval of the rendered request and bounded cloud batch before any cloud call. Reuse a recorded approval only if it covers the actual payload and limits being run. Publishing, claiming, or approving the ticket breakdown is not this approval.
- [ ] Run only the hosted cloud endpoint and model specified in the parent, with both tools, automatic tool choice, non-streaming responses, disabled reasoning, the specified token cap, and unchanged sampler behavior.
- [ ] Attempt two fresh main-case trials followed by two fresh scene-only controls. Preserve the four-request/four-lookup cap per trial and 60-second request timeout, with at most 16 model requests for the batch.
- [ ] Stop the batch on an endpoint-level rejection. Do not silently retry, force tool choice, coach the model, repair responses, change parameters, add warm-up calls, or expand into compatibility testing. State which remaining trials were not attempted and why.
- [ ] Preserve credential-free exact requests, raw responses, correlated tool results, captured narration, and per-request and whole-trial timings. Report total batch wall-clock duration and aggregate recorded usage; mark unavailable usage explicitly.
- [ ] Report endpoint acceptance, actual native function calls, round-trip support, lookup compliance, and terminal-write compliance as separate observations for each attempted trial.
- [ ] Inspect the main-case narration for correct use of facts that were absent initially and returned by the tools, including Bram's arm/sleeve/earring and Odette's scar/bead/counting details. Cite the relevant lookup result and narration excerpt when identifying use or contradiction.
- [ ] Do not require every optional descriptive detail to appear. If no retrieved-only detail appears, report fact use as not demonstrated rather than treating protocol success as proof of uptake.
- [ ] Evaluate the control against the entities actually portrayed. Direct write is valid without entity portrayal; a lookup supporting a newly introduced entity is justified. Record unproductive or unused lookups without inventing a blanket zero-lookup requirement.
- [ ] Preserve and classify malformed calls, plain-text imitations, missing writes, mixed lookup/write responses, repeated lookups, truncation, and cap exhaustion. A write in the same response as a new lookup does not demonstrate access to that lookup's result.
- [ ] Publish a concise findings report with per-trial outcomes, representative transcript excerpts, timing and usage, links to local evidence, and limitations. Distinguish observations from possible explanations.
- [ ] Scope the conclusion to this smoke test. Do not claim production readiness, broad endpoint/model compatibility, repeatability from seed alone, or a measured reliability rate from two trials.
- [ ] Leave application code, authored fixtures, production prompts, export shapes, and version unchanged during the run. If the harness itself needs a fix, preserve the failed evidence, report it, and revalidate the changed harness; do not silently substitute a new experiment for the approved one.

## Completion condition

A fully documented failure or endpoint rejection completes this ticket just as a successful tool conversation does. Completion requires honest evidence for every attempted trial and explicit accounting for trials skipped after early termination. Proposed follow-up experiments remain proposals for the user to choose.

## Comments

September 22, 2026 — The user explicitly approved the exact credential-free preview and bounded four-trial cloud batch. Offline verification passed 27/27 focused tests before execution.

September 22, 2026 — The hosted endpoint rejected the first `main-1` request with HTTP 400 because automatic tool choice and a tool-call parser were not enabled. The runner stopped without retrying; `main-2`, `control-1`, and `control-2` were not attempted. See the [findings report](D:/Documents/GitHub/formamorph/docs-internal/specs/narration-tool-call-probe/findings.md).
