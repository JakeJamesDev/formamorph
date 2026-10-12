# 08: Fold In The Spec Review Of Tickets 01–06

Status: done
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a cleanup pass over landed code with every item named and located by the review; no design, two small tests, comment and changelog edits.

## What to build

The two-axis review of the six landed tickets (2026-10-11) found no blocking defect. This ticket folds in what it did find. Ticket 07 lands first so the regenerate paths are in their final shape.

**Standards**
- The memory regenerate awaits its request and then writes memory edits with no mounted check. Add the check, as every async write in a component has. Ticket 07 rewires this function; confirm the check survived.
- Delete the stale comment in the view that says silent requests use the digest status indicator; the Background Pass Status covers every pass.
- Replace "drainer" in the comments the commits edited around (the pass records' standalone-input note and the idle-pass note, the runner's stage notes) with the glossary words: Background Pass Queue, pass.
- One role, one name in the view: the transport takes a sink; the Narration Stream has listeners. Rename the reveal, history, scene-list and read-aloud "adapters" and the "presentation" wrapper to listeners, and keep "sink" for what the transport is handed.
- One fan-out helper for the three copies of "call every sink with the event" (two in the view, one in the Narration Stream's emit).
- The transport test re-implements SSE frame, prose and response fixtures with a cast; use the shared fixtures in the test helpers, as the re-roll test does.
- The `WORLD` fixture copied between the two GameViewer tests moves into the shared GameViewer test helper.
- The digest and diary apply bodies in the queue share one shape; the three target types all carry a turn id and narration. Extract the shared apply and a shared target base.
- `quiet` is documented on the transport's request type as "the transport never reads it". Move it to the view-side request wrapper, or drop the field from the transport's type.

**Spec**
- Changelog: three new fragments, each named after its feature per the changelog.d README (ruled 2026-10-11; a worktree writes fragments only, and prepare lands each as its own entry). One: digests and diaries show their Request Anatomy in the AI-context viewer; the existing re-roll line stays as it is. Two: silent passes wait while a manual scene render runs. Three: backfills run oldest turn first (Q21).
- Test the Show Silent Requests gate on the status label with a mounted render, and the view's variant-name lookup in the diary request (a diary for "Aldric" carries "Sergeant Aldric"'s text).

**Rulings from the review (2026-10-11)**
- Q21: backfill order stays oldest-first for digest and discover. The oldest turn is closest to leaving the context window, and the discover prompt asks about the passage the character first appeared in. Listed under deliberate changes: in serial mode a newly invented character can wait behind older unknown names.
- Q22: "character" stays in the discover status label and the diary changelog lead. A runtime-invented person is a character, as the Describe New Characters setting and the glossary already say; an authored one is an entity. The copy rule's exception is recorded in the spec.

No world or save shape change. The changelog edit is a fragment in `docs-internal/changelog.d/`, folded by prepare.

## Acceptance criteria

- [ ] The memory regenerate's post-await write checks the mounted ref; a test unmounts mid-request and asserts no write.
- [ ] No "drainer" remains in the comments the six commits touched; no stale indicator comment remains.
- [ ] One fan-out helper; the three copies are gone.
- [ ] Transport and GameViewer tests use the shared fixtures; the duplicated `WORLD` fixture is gone.
- [ ] The queue's digest and diary apply share one function; the target types share a base.
- [ ] `quiet` is no longer a documented no-op on the transport's type.
- [ ] Two new tests: the Show Silent Requests gate, and the variant-name diary lookup through the view.
- [ ] Three changelog fragments: Request Anatomy for digests and diaries, the scene-render wait, the oldest-first backfill.
- [ ] Four gates green.
