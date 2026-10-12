# 05: Background Pass Queue With Digest And Milestone

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: a new pure scheduling module with dependency, concurrency, set-aside, session-guard and abort rules, replacing two of four drainer effects in the god node; the rules interact and the tests must prove each one bites.

## What to build

The Background Pass Queue module, React-free, with digest and milestone as its first two members:

- **Due rules of its own.** A digest is due for a turn whose summary is undefined (an empty string counts as written; the existing falsy test must not be reused). A milestone is due only when no digest is due and none is set aside this window. A turn with blank narration is never due. Digests pick the oldest due turn first.
- **Concurrency follows Concurrent Requests.** On: every due pass whose dependencies are met starts together, no cap. Off: one at a time, in priority order.
- **Set-aside.** A pass that throws or answers empty is set aside for the rest of the idle window; lower passes proceed. The list clears on any history change the queue did not make and on a session change. An empty digest reply is stored as an empty string. A canceled pass is neither applied nor set aside.
- **Gate.** Nothing starts while a turn or a scene render runs. A running pass finishes when a turn starts.
- **Session guard.** A view counter bumped on load and new game; each pass is stamped with it, its target turn id and the narration it read. A result is dropped when the counter changed or the narration differs. Milestone's selection write is guarded this way; digest also keeps its turn-id check.
- **Abort.** One controller; leaving the game and loading a save abort running passes. Every request carries the signal.
- **Tick.** Re-evaluates on history, gate, member setting and entity-list changes, and after every pass completes.
- **Requests.** Digest builds from the summary pass over the standalone pass input; milestone keeps its pass record. The digest characterization test from 01 is deleted with the hand-built builder.
- **Status.** The queue exposes the set of running kinds. The status bar shows one label by precedence digest > milestone > diary > discover, gated on Show Silent Requests. The old per-pass flags for digest and milestone go.

The digest and milestone drainer effects leave the view. Diary and discover stay as they are until ticket 06, gated against the queue's running set so nothing overlaps that did not before.

Help copy: the Concurrent Requests ⓘ and its Settings page line say that background passes between turns follow the setting too.

Changelog fragment, Minor → Fixed → ⚙️: background passes between turns follow Concurrent Requests, a failing pass no longer stalls the ones behind it, and leaving the game or loading a save stops a running pass.

## Acceptance criteria

- [ ] Queue unit tests with a fake transport: serial mode runs one at a time in order; concurrent mode starts every independent pass together; a milestone never starts while a digest is due or set aside; a blank-narration turn is not due; nothing starts during a turn or a scene render; a failed pass is set aside and lower passes proceed; the set-aside list clears on a foreign history change; an empty digest is stored and stops being due; a canceled pass applies nothing and is not set aside; a stale result (session changed, narration changed) is dropped; unmount and load abort every signal; a completion with no history change still re-ticks.
- [ ] A mounted test shows the precedence label.
- [ ] Reinstating the falsy digest test, an aborted milestone marking candidates seen, or a failed pass that stays due turns a test red.
- [ ] Digests and milestones backfill and apply as before in the running app, in both Concurrent Requests modes.
- [ ] Settings help copy updated; copy sweep done.
- [ ] Four gates green.
