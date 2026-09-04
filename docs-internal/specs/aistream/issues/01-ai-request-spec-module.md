# 01 — AI Request Spec module

**What to build:** A pure AI Request Spec layer: given a per-call settings snapshot plus prompt/messages/request-type, it resolves the endpoint and sampler and builds the complete request body for any engine kind (built-in local engine, external OpenAI-compatible, LM Studio) — including the reasoning split (budget-tokens vs effort), dual penalty spellings, and omit-the-field rules. Built beside the existing code; nothing consumes it yet. See [../spec.md](../spec.md) for the settled interface decisions and CONTEXT.md vocabulary.

**Blocked by:** None — can start immediately.

Status: ready-for-human

- [x] Spec resolution and body construction are pure functions with no React or fetch imports
- [x] Table-driven tests cover engine kind × reasoning mode × sampler pin: field presence/absence, penalty spellings, budget vs effort, stop sequences
- [x] Each table row fails if its quirk-handling is removed (mutation-checked per the test-bar)
- [x] Behavior matches the current in-GameViewer body construction exactly (no behavior change)
- [x] Four gates green
