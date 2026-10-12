# ADR-0012 — The Request Transport has one sink per call

**Status:** Accepted · **Date:** 2026-10-11

## Context

The Turn Pipeline's request adapter (ADR-0001) was a 350-line closure inside the game view. In one function it resolved the endpoint, offered Tools, ran the AI Stream and its tool rounds, stripped reasoning, recorded parity and classified failures. In the same function it reset the narration reveal, fed read-aloud, kept the scene list live, persisted the partial message and drew the live reasoning block.

- Nothing in it had a test, because nothing in it ran without React.
- The runner carried a per-request stream hook and a narration event option that no caller used.
- Concurrent requests (the post-narration batch, the silent passes) each need their own listener. One shared listener would interleave their events.

## Decision

**The Request Transport** (`src/lib/aiRequest/requestTransport.ts`) carries one request from its arguments to its final text, outside React. It owns the text policy: reasoning strip, the length-cap trim (narration only), the reasoning capability note, the parity recording, and failure classification.

**Each call takes its own sink.** The transport reports everything it observes through that sink, as one typed event list:

| Event | When |
|---|---|
| `requestCaptured` | The request is captured for the AI-context viewer |
| `opened` | The endpoint accepted the request and has a body |
| `delta`, `reasoning` | The running reply and the running native reasoning |
| `retract` | A round that streamed text ended in Tool calls |
| `toolCalls`, `roundStarted`, `toolRound` | The Tool loop's progress |
| `canceled` | The request stopped after it opened |
| `responseCaptured` | The raw reply, for the AI-context viewer |
| `failure` | A failure the caller must show |
| `done` | The final text |

The view builds a plain context and attaches the adapters a request type needs: the viewer capture, the failure notice, the lookup counter, and the narration or choices presentation.

**The Turn Pipeline's two seams stand.** The runner's request adapter is a one-line call into the transport. The runner's stream hook and narration event option are removed: what a request streams is the transport's business, never the runner's.

## Consequences

- ✅ Abort, retract, trim and failure classification are tested with a fake AI Stream and a recording sink.
- ✅ Concurrent requests never share a listener.
- ✅ The parity recorder still records at the transport's entry, the seam the fixture was recorded at.
- ✅ The Narration Stream sits on a narration request's sink and owns the sentence cursor. The reveal, read-aloud, the scene list and history listen to it.

## Alternatives rejected

**One shared listener on the view.** Concurrent requests would interleave on it, and every adapter would have to filter by request.

**Keep the runner's stream hook.** No caller used it, and it gave the runner a third seam that ADR-0001 does not name.
