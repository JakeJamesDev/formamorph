# 04: Detect Tool Support per Endpoint and Model

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

The app knows whether an endpoint and model support tools before it sends any. The existing reasoning capability resolver answers a new question, **tools supported**, in the same record, with its source recorded.

Sources in order: LM Studio's model list (`tool_use` capability), Ollama's show endpoint (`tools` capability), then a probe. When the reasoning probe fires, it also carries one Tool: a 200 answers both questions, a 400 splits into two single-question probes to attribute the failure. When reasoning is already known from another source and tools support is not, one tools-only probe is sent. Every probe answer, including a 400, is memoized per endpoint and model. An LM Studio model without `tool_use` is recorded as unsupported. Unknown means no Tools.

Model rationale: Opus at high effort for a resolver with five existing sources, an ordered fallback chain and a probe memo whose miscount costs a request per turn.

## Acceptance criteria

- [ ] The capability record carries `tools: boolean | null` with a source; readers treat `null` and `false` as no Tools.
- [ ] LM Studio's list and Ollama's show endpoint answer without a probe; a model missing `tool_use` is unsupported.
- [ ] When the reasoning probe fires it carries a Tool; a 200 answers both; a 400 splits and attributes correctly.
- [ ] When reasoning is known and tools is not, exactly one tools-only probe is sent and memoized.
- [ ] A memoized 400 is never re-sent in the same session for the same endpoint and model.
- [ ] Resolver tests at the fetch stub cover each source, the bundled probe, the tools-only probe, the split, the untrained LM Studio model and unknown; probe counts are asserted.
- [ ] Four gates green; each guard proven by reinstating its bug.
