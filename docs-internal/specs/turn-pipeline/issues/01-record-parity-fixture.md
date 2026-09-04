# 01 — Record The Parity Fixture

**What to build:** A recording adapter wrapped around the current turn code so that one baseline Sedge Landing run captures the ordered AI request sequence — request type, system prompt, messages, token caps — per turn, saved as a fixture with a documented format. This fixture is the ground truth every later ticket's parity test replays against, so it must be captured before any extraction changes the code it measures.

**Blocked by:** None — can start immediately. (Interactive: needs the user present with a local model server and a baseline harness profile.)

Status: done

- [x] Recording wraps the existing request path without altering what is sent — `src/lib/turnPipeline/parityRecorder.ts`, observed at the `makeAIRequest` seam
- [x] One full scripted baseline run captured; fixture stored where tests can load it — tracked at `testing/parity/turn-pipeline-parity.json` (user approved), recorded via `npm run baseline -- --profile parity --parity <file>`
- [x] Fixture format documented alongside it — `testing/parity/README.md`
- [x] A self-check test loads the fixture and validates its shape — `src/lib/turnPipeline/parityFixture.test.ts`
- [x] Four gates green
