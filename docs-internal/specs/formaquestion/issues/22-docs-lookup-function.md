# 22: Docs lookup function

Status: in-progress
Base: 15319e49
Blocked by: 20 — Ask a question
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

On an endpoint and model known to support function calls, the AI chooses which docs sections to read. The answer is better on questions where keyword search picks the wrong section, and a follow-up can fetch a new section.

- **Lookup mode.** The request offers one docs lookup function. The prompt carries the contents list (pages and section headings). The model calls the function with section ids, or with search words, and gets the section text back. It can call more than once, within a call limit and the existing round cap.
- **Mode choice.** The session picks lookup mode or retrieval mode before the request, from the endpoint's known capability. It uses the same capability gate as Tools. It never sends a second request because the first failed (ADR-0008).
- **Not a Tool (Q30).** The docs lookup is outside the Tool catalog. It never shows in the Tools tab, no preset enables it, and the Output → Tools switch does not affect it. It runs through the existing tool loop with its own executor.
- **Sources.** The sections the function returned are the answer's sources.
- **Bad calls.** An unknown section id returns a short result that lists valid ids near it. A model that calls nothing still gets an answer path: the prompt carries the section mapped to the question's best search hit.

**Records.** Write a new ADR, on the next free number: the docs lookup is an app-internal function call, capability-gated, outside the Tool catalog. Add three terms to the internal glossary: Formaquestion, Docs Index, Surface.

Report probe numbers for lookup mode against retrieval mode, same questions, same batch. If lookup mode is not better on the default cloud model, say so; the user decides whether it stays.

Recommended model rationale: a function-call loop with model-dependent behavior and an ADR boundary to hold.

## Acceptance criteria

- [ ] On a capable endpoint, the request offers the lookup function and the contents list, and the fetched sections become the sources
- [ ] On an endpoint with no function-call support, the request offers no function and uses retrieval mode
- [ ] In both modes, a failed request is not sent again
- [ ] The lookup function is absent from the Tools tab, and the Output → Tools switch does not change the request; tests assert both
- [ ] An unknown section id gets a helpful result and the answer still completes
- [ ] The call limit and the round cap hold; a test drives a model that calls without end
- [ ] The new ADR exists and the three glossary terms are added
- [ ] Probe numbers for lookup against retrieval, same batch, are in the handover
- [ ] Four gates green
