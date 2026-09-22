# Cloud Narration Tool-Call Probe Findings

## Outcome

The hosted endpoint rejected the first approved request before the model produced a response. The batch then stopped as designed. This smoke test therefore establishes that the endpoint did not accept the reviewed automatic-tool request on September 22, 2026; it does not establish whether the underlying model can call tools, consume tool results, or submit narration through `write`.

> **Observed error:** HTTP 400 — `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`

## Approved batch

The user explicitly approved the [credential-free request preview](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/preparation-2026-09-22T09-09-40-395Z.json) before execution. The request targeted `https://api.lyonade.net/v1/chat/completions` with model `default`, both native tools, automatic tool choice, non-streaming responses, `reasoning_effort: "none"`, and a 1,024-token response cap. Temperature and repetition penalty were omitted.

The authorized order was two fresh main trials followed by two fresh scene-only controls. Each trial allowed at most four model requests, four lookups, and 60 seconds per request, with no more than 16 model requests across the batch.

## Trial outcomes

| Trial | Attempted | Endpoint accepted | Native calls | Round trip | Lookup compliance | Terminal `write` | Retrieved-fact use | Result |
|---|---:|---:|---|---|---:|---|---|---|
| `main-1` | Yes | No | Not observed | Not reached | Not reached (0 calls) | Not reached | Not demonstrated | HTTP 400 endpoint rejection |
| `main-2` | No | — | — | — | — | — | — | Skipped after endpoint rejection |
| `control-1` | No | — | — | — | — | — | — | Skipped after endpoint rejection |
| `control-2` | No | — | — | — | — | — | — | Skipped after endpoint rejection |

The attempted main action was: “I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.” The endpoint returned no assistant message, native function call, tool result, or narration. Bram's arm, sleeve, and earring details and Odette's scar, bead, and counting details therefore remained untested; their use cannot be inferred from protocol setup alone.

## Timing and usage

| Measurement | Recorded value |
|---|---:|
| Attempted model requests | 1 |
| Completed lookups | 0 |
| Rejected request | 796.58 ms |
| Whole `main-1` trial | 802.09 ms |
| Whole batch runner | 802.26 ms |
| Full CLI process | 15.675 s |
| Token usage | Unavailable |

The CLI time includes harness startup and evidence serialization. The runner duration covers the approved batch itself. The rejection response contained no usage object, so aggregate token usage is unavailable rather than estimated.

## Evidence

- [Exact preparation artifact](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/preparation-2026-09-22T09-09-40-395Z.json)
- [Raw cloud batch evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/cloud-batch-2026-09-22T09-12-03-906Z.json)
- Source revision: `081634690f217a77e4fdb8ae77dd36b4c65536ed`
- Cloud evidence SHA-256: `1D2EF8DD3B40C0EECA127471A70711429455352D1B8024F8F66A660CC6D1D2F9`

The saved artifacts contain exact request bodies, the raw rejection body, and timings. They contain no authorization header or credential.

## Observation and possible explanation

The observation is limited to the endpoint's HTTP 400 response to this request. The server's own message indicates that its automatic-tool-choice and tool-call-parser options were not enabled. That configuration is a possible explanation for the rejection; this experiment did not inspect the server or test alternate parameters.

No retry, forced tool choice, compatibility test, warm-up request, local-model request, prompt change, or production-code change was made. This single rejection is not evidence about production readiness, other endpoints or models, or how reliably the model would use retrieved facts if the endpoint accepted the protocol.
