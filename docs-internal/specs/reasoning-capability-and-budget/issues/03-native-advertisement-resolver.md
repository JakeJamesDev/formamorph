# 03: Resolver Reads Native Advertisements, Single Probe

Status: ready-for-human
Base: 603b38b5
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Reasoning Capability and Budget](../spec.md)

**What to build:** A player on Ollama, a llama.cpp server, or a gateway that lists supported parameters sees the right Native Reasoning controls without the app sending test completions. One pure resolver replaces today's two detectors. It asks the backend's own capability surface first and, when nothing answers, sends at most one probe.

**Rationale for the model:** four backend shapes, an ordered chain with early exit, and source tracking. Opus at high effort for the chain logic and the mocked-fetch test matrix.

## Acceptance criteria

- [x] One async resolver takes the target, a fetch, and returns the record. The settings context calls it and caches the result; no detection logic remains in React.
- [x] LM Studio's native model list answers reasons and budget as today.
- [x] Ollama's show endpoint answers reasons yes when its capabilities name thinking, no when the array is present without it.
- [x] A llama.cpp server's properties endpoint answers whether effort is honored from its template capabilities; reasons stays unknown when the template says nothing.
- [x] A gateway model list whose entry carries supported parameters answers reasons yes when reasoning or reasoning effort is listed, no when the list is present without them, and fills accepted levels from what is listed.
- [x] Each source is tried only when its endpoint shape answers; a 404 or foreign shape moves to the next. The existing probe memo keeps a known-absent endpoint from being asked again this session.
- [x] When no source answers, the resolver sends one probe of the none literal. A rejection marks reasons no. Acceptance leaves reasons unknown with the safe fallback levels. A test asserts the probe count never exceeds one on any path.
- [x] The seven-literal probe is deleted. Levels beyond the safe set come only from a source that lists them.
- [x] Every answer in the record names its source.
- [x] Tests mock fetch per backend shape, following the existing LM Studio capability tests, and cover each source, each inconclusive path, and the single probe.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the probe-count guard fails when a second probe is added. Update the code graph. Changelog In Progress entry, 👤 bucket, with the ⚙️ note that the seven-request probe is gone.

## Scope notes

No catalog, no observation. Those are 04 and 05.

## Comments

Implemented in 15e110d1. Three rulings from the spec session amended the ticket as written:

1. **Levels come from any source that lists them**, not only the gateway. LM Studio's `capabilities.reasoning.allowed_options` maps `off` to `none` and `low`/`medium`/`high` one to one; `on` names the switch, not a strength, so it maps to nothing. The gateway reads its top-level `reasoning.supported_efforts` first and falls back to `supported_parameters`, which answers reasons alone. A `mandatory` model drops `none`.
2. **Sources are identified by body shape, never by status code.** LM Studio answers `GET /props` with HTTP 200 and an error payload, so a status check would read it as a llama.cpp server.
3. **The probe memo was widened** to record 404, 405, 415 and a 200 carrying an `error` key. A foreign endpoint answers `POST /api/show` with 415, which the old 404-only rule never remembered.

**Player-visible change, confirmed with the spec session before shipping.** LM Studio returns HTTP 200 for every effort literal and ignores the ones it does not support, so the old seven-literal probe reported all seven there. The strength dropdown now lists what `allowed_options` reports, which for a plain on/off reasoning model is Model Default alone. The Reasoning Budget slider from ticket 02 is the graded control on LM Studio. A model that publishes `low`/`medium`/`high` lights the dropdown up on its own.

**Closing review findings folded in** (`/mattpocock-skills:code-review 603b38b5`):

- The chain stopped at the first source that answered anything, so a llama.cpp server exited with the reasons question unanswered and never reached the probe. It now ends only on the reasons question and merges what earlier sources supplied.
- Merge precedence was inverted for native versus probe. An advertisement now outranks the probe, and an earlier source outranks a later one.
- A source could answer `reasons: true` with an empty level list, which `reasoningRuledOut` reads as ruled out and which hid the control for a model just called reasoning. Zero mapped levels now read as unanswered.
- A resolve that answered nothing kept its signature marked resolved, so a server that was down during the debounce stayed unresolved for the session. The signature is now released on failure.

Not taken: renaming `recordProbeStatus` to `recordProbeOutcome`. The rename is fair, but it touches `contextLength.ts` and `useAiReachable.ts`, which tickets 04 and 05 are live in. Worth doing in a later pass.
