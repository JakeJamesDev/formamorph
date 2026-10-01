# 20: Ask a question

Status: ready-for-agent
Blocked by: 16
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A player types a question in Formaquestion and the connected AI answers from the docs. This is the tracer bullet for the AI path: one question, one answer, on every endpoint. It builds test seam 2 of the spec.

**Help session.** A module with no React and no gameplay coupling. In: the question, the AI settings snapshot, the Docs Index and a cancel signal. Out: a stream of answer events, then the sources. It uses the existing AI Request Spec and AI Stream; it adds no second request path.

**Request kind.** A new editor request kind (Q9): fixed prompt, active endpoint, reasoning off, no Settings tab. Pin its temperature and penalties explicitly.

**Retrieval mode.** The session runs the Docs Index search on the question and puts the top sections in the prompt (Q10). This ticket ships retrieval mode for every endpoint; ticket 22 adds the lookup function for capable ones. One request per question, never a retry.

**Help prompt.** Read the prompt writing guide first. Positive contract: answer from the given sections; give numbered steps; use the exact control names from the sections. No example values a small model can copy.

**In the window:**

- An ask field and Send. The answer streams as formatted markdown through the existing streaming renderer, used directly.
- A stop control ends the stream and keeps the text so far.
- Under the answer, the sections that were sent to the model are listed as sources. A click opens one in the reader (Q8).
- With no AI connected, the ask field runs the docs search and shows the sections (Q7).
- When the request fails, the standard error toast with Error Details shows, and the window shows the docs search results for the question.
- The default cloud endpoint is allowed, under the same limits as gameplay (Q12).

Ask before you choose how many sections go into a request if the Docs Index constant does not settle it.

Report probe numbers for the prompt with an in-batch no-docs control. Ticket 26 sets the bar; this ticket states the numbers only.

Recommended model rationale: a new AI call, a new prompt and the seam every later ticket tests through.

## Acceptance criteria

- [ ] With a fake fetch, a question produces exactly one request whose prompt holds the retrieved sections, and the session yields the streamed answer and the sources
- [ ] The request uses the new editor kind: active endpoint, reasoning off, pinned samplers
- [ ] The request carries no world or save data; a test asserts on the request body
- [ ] Stop ends the stream, keeps the partial answer and leaves no request open
- [ ] No AI connected: the ask field shows docs search results and sends nothing
- [ ] A failed request shows the error toast with details, and the window shows search results
- [ ] Sources open in the reader
- [ ] Unmount during a stream cancels it; the test run exits 0
- [ ] Probe numbers with an in-batch control are in the handover, per the `probe` skill
- [ ] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green
