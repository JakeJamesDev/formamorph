# ADR-0008 — Tools are defined in settings, enabled per prompt preset, and go only to endpoints known to support them

**Status:** Accepted · **Date:** 2026-09-25

## Context

The AI can call a Tool during a request to get information it lacks, such as an entity's full entry. Our probes showed tool calling works on some models (MeroMero) and not others. One hosted endpoint rejects any request that carries tools with an HTTP 400.

## Decision

- **A Tool is defined once in settings and enabled per prompt preset.** A world author cannot ship a Tool.
- **Tools are sent only to an endpoint and model known to support them.** Support comes from the server's capability list (LM Studio `tool_use`, Ollama `tools`). Where there is no list, a one-time probe answers it, bundled with the reasoning probe. An LM Studio model without the `tool_use` flag gets no tools.
- **There is no runtime fallback.** A request to an unsupported endpoint carries no tools, and the prompt text is unchanged. A prompt written for tools then sends summaries only. The Tools tab says so.

## Consequences

- World export shape is untouched by Tools.
- A preset that relies on a Tool degrades on an endpoint without tool support. Choosing that preset for that endpoint is the player's call.
- Moving Tools into worlds later would be an export-shape change and needs a version decision.

## Alternatives rejected

**Tools in worlds:** lets an author ship world-specific tools, but lookup tools are generic, and it changes the world export shape.

**Retry without tools on rejection:** keeps every turn working, but costs a failed request per turn and hides the unsupported endpoint from the player.
