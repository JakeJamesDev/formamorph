# Request Transport

Status: ready-for-agent

Rulings Q1–Q14 were settled in the grilling session of 2026-10-07 and are folded into the decisions below. Architecture review: candidate 2 (request adapter split) with candidate 1 (background pass queue) folded in by Q8. A code review of the first draft reopened Q6, Q10 and Q11 on new evidence the same day; the rulings below are the revised ones.

## Problem Statement

The game's one path to the model is a 350-line closure inside the game view. It resolves the endpoint, offers Tools, runs the AI Stream and its tool rounds, strips reasoning, records parity and classifies failures. In the same closure it also resets the narration reveal, feeds read-aloud one sentence at a time, keeps the scene list live, persists the partial assistant message, and renders the live reasoning block.

- Nothing in that closure has a test. The four game view test files drive no turn, no regenerate, no silent pass and no abort.
- The Turn Pipeline's request adapter (ADR-0001) is that closure. The seam that was meant to keep turn logic testable without React is implemented as React state.
- The re-roll paths for choices and stats build their requests by hand. The Turn Pipeline's pass records already define both. A change to a pass does not reach the re-roll.
- The digest and diary silent passes also build their requests by hand, while the discover and milestone passes use their pass records.
- Four silent passes and the memory regenerate each retype the rule for what may run at the same time, and the copies disagree. The digest, diary and discover guards and the regenerate omit the milestone flag. After most turns a milestone selection and a diary or discover request run at once, whichever endpoint is in use.
- The silent passes have no explicit order. They start in the order their effects are declared: digest, milestone, diary, discover. A new character's diary therefore runs before its description exists, and the diary request carries only the name.
- No silent pass carries an abort signal. Leaving the game to the menu leaves the request running on the model, and its result is written into an unmounted provider. An in-game load mid-pass lets the old save's discover or milestone result land in the loaded save.
- A narration edit keeps the turn id and clears the turn's digest. A digest already in flight for the old text then lands on the edited turn and is never redone.
- A diary is written for every participant name, including names that will never become an entity (a deleted character, or Describe New Characters off). Nothing reads those diaries; the request is spent for nothing.
- Four consumers (reveal, read-aloud, scene list, history) each split the streamed narration into sentences and keep their own cursor.

## Solution

Three modules replace the closure and the five silent-pass effects.

**Request Transport.** Carries one AI request from spec to final text, outside React. It resolves the endpoint, offers Tools, runs the AI Stream and its tool rounds, strips reasoning, trims a length-capped reply to its last sentence, records parity and classifies failures. It reports everything it sees through one sink: the request it captured, each stream event, the response it captured, the failure it classified. It never touches the screen. The Turn Pipeline's request adapter becomes a one-line call into it.

**Narration Stream.** Sits between the Request Transport and the screen. It turns streamed narration into sentence events: opened, display text, each completed sentence once and in order, retract, finished with the final text, canceled. The reveal, read-aloud, the scene list and history persistence each listen to it as a thin adapter. One module owns the cursors.

**Background Pass Queue.** Runs the silent passes a turn leaves behind: discover, digest, diary, milestone. It runs while no turn and no scene render is running. Two dependencies are always kept: a milestone selection waits until no digest is due, and a new character's diary waits for that character's discover. Everything else is independent. How much runs at once follows the **Concurrent Requests** setting: on, every independent pass starts together; off, one at a time in the order discover, digest, diary, milestone. A pass that fails or answers empty is set aside for the rest of this idle window, so it never blocks the passes behind it. A running pass finishes when a new turn starts; new ones wait. Leaving the game or loading a save cancels running passes, and a canceled pass applies nothing. A diary is written only for a name that is an entity or that a pending discover will make one. Every pass builds its request from its pass record. The embedding batch stays on its own worker loop. Regenerate Memory and the discovered-character regenerate wait behind running passes with a cancelable spinner and hold the queue while they run.

The re-rolls for choices and stats build their requests from the pass records.

**Deliberate changes the player can notice**
- A new character's diary now carries the character's description, because discover runs first.
- Silent passes follow the Concurrent Requests setting. With it off, only one runs at a time; with it on, independent passes run together, as the in-turn batch already does. A backfill (Memory Digests turned on mid-game) sends every past turn's digest at once instead of one at a time; a rate-limited burst is set aside until the next turn.
- A pass that keeps failing no longer stalls the passes behind it.
- A diary is no longer written for a name that will never become an entity. Nothing read those diaries.
- Silent passes wait while a manual scene render runs, as the discovered-character regenerate already does.
- Regenerate Memory and the discovered-character regenerate wait behind running silent passes with a spinner you can cancel, instead of being disabled or racing them.
- Loading a save stops running silent passes, as it already stops a scene render.
- The status bar names a running discover pass ("Describing character…"), under the same Show Silent Requests toggle as the others.
- Re-rolls, digests and diaries show Request Anatomy in the AI-context viewer, because the pass records label their requests.
- Leaving the game stops a running silent pass.

Everything else the player sees stays as it is.

## User Stories

1. As a player, I want a turn's narration to stream, read aloud and update the scene list exactly as it does today, so that the refactor is invisible to me.
2. As a player, I want Stop to drop the turn and keep the narration already on screen, so that an abort never loses text I read.
3. As a player, I want a turn aborted before any narration arrived to leave no lone action in the history, so that my transcript stays in pairs.
4. As a player, I want a model that runs tool calls after streaming text to retract that text from every surface, so that a lookup round never shows as narration.
5. As a player, I want a reply that hit the token cap trimmed to its last complete sentence, so that narration never ends mid-word.
6. As a player, I want the live reasoning block to show the model's thinking until narration starts and then collapse with its think time, so that the reasoning surfaces keep working.
7. As a player, I want read-aloud to receive each sentence once, in order, with the last one flushed at the end, so that audio never repeats or skips a sentence.
8. As a player, I want the scene list to update as each sentence completes, so that a name flips from alias to real name the moment the narration says it.
9. As a player, I want the AI-context viewer to show the exact wire body and the raw reply of every request, so that I can inspect what was sent.
10. As a player, I want a silent request's capture to attach to the turn it summarizes, so that the viewer files digests under the right turn.
11. As a player, I want a failed foreground request to show one failure toast with the connection guide link, so that I know what to fix.
12. As a player, I want a failed silent request to fail quietly and come back after my next turn, so that a background pass never interrupts play.
13. As a player, I want a rejected endpoint override to explain itself even on a silent request, so that a persisted settings change never fails without a word.
14. As a player, I want the re-rolled choices to read the same prompt as a live turn's choices pass, so that a re-roll matches the turn.
15. As a player, I want re-rolled stats to read the same prompt and cap as a live turn's stats pass, so that a re-roll matches the turn.
16. As a player with Concurrent Requests off, I want one silent pass at a time, so that my local endpoint is never hit twice by background work.
17. As a player with Concurrent Requests on, I want independent silent passes to run together, so that the end of a turn is one round trip, not a chain.
18. As a player, I want a new character described before its diary is written, so that the diary knows who it is writing as.
19. As a player, I want digests written before milestones are judged, so that the selector reads every digest.
20. As a player, I want a silent pass already running when I send a turn to finish and apply its result, so that no tokens are wasted.
21. As a player, I want no silent pass to start while my turn or a scene render runs, so that new background work never competes with what I asked for.
22. As a player, I want the status bar to name the silent pass that is running, discover included, so that I know why the model is busy between turns.
23. As a player, I want a silent pass that fails or answers empty set aside for now, so that one bad reply never stalls the rest.
24. As a player, I want leaving the game or loading a save to stop any running silent pass, so that the model is free and no stale result lands in the loaded game.
25. As a player, I want Regenerate Memory and the discovered-character regenerate to wait behind running background passes with a spinner I can cancel, and to hold the queue while they run, so that they never race a silent pass over the same turn.
26. As a player, I want a silent pass result from an earlier save or an edited turn thrown away, so that a stale reply never lands on the wrong text.
27. As a player, I want no diary written for a name that will never become an entity, so that no request is spent on text nothing reads.
28. As a player, I want the embedding batch to keep running independently of the AI passes, so that semantic features stay covered.
29. As a player, I want re-rolls and silent passes to show their Request Anatomy in the AI-context viewer, so that I can see which text is authored and which is assembled.
30. As a developer, I want the Request Transport to run without React, so that I can test abort, retract, trim and failure classification with a fake stream.
31. As a developer, I want the Narration Stream to run without React, so that I can test sentence order, single emission, retract and final flush as plain events.
32. As a developer, I want the Background Pass Queue to run without React, so that I can test due selection, dependencies and the set-aside rule as plain state.
33. As a developer, I want one event vocabulary for everything the transport observes, so that the viewer, parity and the stream are adapters on one seam.
34. As a developer, I want the parity replay to stay byte-equal, so that I can prove the seam did not move.
35. As a developer, I want the Turn Pipeline's dead stream hooks removed, so that the runner has exactly the seams ADR-0001 names.
36. As a developer, I want every silent pass and re-roll to build its request from its pass record, so that a prompt or cap change has one home.
37. As a developer, I want the queue's concurrency rule written once, so that the guards can never disagree again.
38. As a developer, I want the three modules named in the glossary, so that sessions use one word per concept.

## Implementation Decisions

- **Full lift (Q1).** The Request Transport is a module beside the AI Stream, the AI Request Spec and the tool loop. It takes a plain context built by the view: the settings snapshot resolver, the Tool list and enablement, the Tool snapshot executor, the inspection toggle, and the sink. It never imports React.
- **One sink per call (Q2, Q4).** Each request takes its own sink, so concurrent requests never interleave on one listener. The view attaches the Narration Stream to a narration request and the choices adapter to a choices request by request type. The transport reports through that sink with a typed event vocabulary: request captured, stream opened, delta, reasoning, tool calls, round started, tool round, response captured, failure classified, done. The AI-context viewer, the parity recorder and the Narration Stream are adapters on that sink. The parity recorder stays a pure module and keeps recording at the transport's entry, which is the same seam the fixture was recorded at.
- **Dead hooks removed (Q2).** The Turn Pipeline runner's per-request stream hook and its narration event option are removed. The runner's request adapter type stays as ADR-0001 defines it.
- **Narration Stream (Q3).** One module owns the sentence cursors and the partial-persistence rule. It emits opened, display, sentence (index and text), retract, finished (final text) and canceled. Four view adapters listen: the reveal (fade or smooth), read-aloud, the scene list, and history persistence (add once on first text, refresh on sentence boundaries). Live reasoning stays in the view, fed by the transport's reasoning and delta events, because it reads nothing sentence-shaped.
- **Transport owns text policy.** Reasoning strip, inline think extraction and the reasoning capability note happen in the transport for every request type. The length-cap trim to the last complete sentence applies to narration only, as today; a stats or choices reply is never trimmed. Presentation gets the final text through the stream's finished event and the promise result.
- **Retract stays a transport decision.** A tool-call round after streamed text resets the running content and emits retract. The Narration Stream clears its cursors and emits retract to its adapters; the view adapters reset the reveal, restart read-aloud and drop the partial message. A choices adapter owns the live choices list: it parses each delta and clears on retract, so that presentation leaves the transport too.
- **Abort.** The transport resolves to empty text on a user stop or an aborted finish, after emitting canceled if the stream had opened. Error classification is unchanged: a rejected override surfaces its notice even when silent; a silent failure throws without a toast; a foreground failure toasts once.
- **Snapshot at call time.** The transport reads its context once per request. Values that must stay live during a request stay refs the view adapters hold: the scene-list inputs, the current turn id, the read-aloud controller, the live reasoning accessor and the debug-turn index at response time.
- **Re-rolls through pass records (Q5).** The choices and stats re-rolls build their requests with the choices and stat-updates pass records over a standalone pass input and a turn material seeded with the re-roll's context values, scene tokens, action as the effective action, narration and stat snapshot. The re-roll sets `quiet` to false explicitly, because the pass records take it from Concurrent Requests and the re-roll must keep its own status label. The hand-built request builders are deleted after the characterization tests below pass.
- **Background Pass Queue (Q8–Q12, revised).**
  - Members: discover, digest, diary, milestone (Q9). The embedding batch is not a member.
  - Due rules are the queue's own, written from the members' settings (Describe New Characters, Memory Digests, Character Diaries with Staged thinking). They never reuse the pass records' `isDue`, because those include Concurrent Requests and would never drain in serial mode, which is the one mode where the queue is the only path.
  - Due items are (turn, name) pairs for diary and discover and turn ids for digest, so one stuck pair never hides the ones behind it. A turn whose narration is blank is not due for anything. A digest is due while the turn's summary is undefined; an empty string counts as written, which the due test must check explicitly, because today's test treats an empty string as missing.
  - Dependencies, always kept: a milestone is due only when no digest is due and none is set aside this window; a diary for a name is due only when that name is an entity, or when its discover has finished. A name with no entity and no discover coming (suppressed, Describe New Characters off, or its discover set aside) gets no diary this window; with no discover ever coming it gets none at all. Everything else is independent.
  - Concurrency follows Concurrent Requests (Q10, revised). On: every due pass whose dependencies are met starts together, with no cap; the endpoint's own limits apply, and a rate-limited reply is a failure that sets the pass aside. Off: one pass at a time, in the order discover → digest → diary → milestone (Q11). In both modes digest and diary pick the oldest due turn first.
  - Failed pass (new): a pass that throws or answers empty is set aside for the rest of this idle window. The set-aside list clears on any history change the queue did not make and on a session change. An empty digest reply is stored as an empty string, as empty diaries already are, so the turn stops being due. A canceled pass is neither applied nor set aside.
  - Idle gate: nothing starts while a turn or a scene render is running. A running pass finishes and applies its result (Q12). Results apply through a session guard: the view keeps a session counter bumped on load and on new game; the queue stamps each pass with that counter, the turn id it targets, and the narration text it read. A result is dropped when the counter changed or the target turn's narration differs. Digest and diary already drop a result whose turn id is gone; discover and milestone are the guard's real targets, since neither checks anything today.
  - Cancel (new): the queue holds one abort controller. Leaving the game and loading a save abort running passes, as both already cancel a scene render. A new turn does not. Every queue request and both regenerates carry the signal.
  - Regenerate Memory and the discovered-character regenerate (new) enter the queue as a foreground job: the press shows a spinner with a cancel, waits behind running passes, then holds the queue while it runs. Today the discovered-character button is disabled while passes run and Memory Manager's button only during a turn; both change to the waiting spinner. Partial re-rolls stay outside, gated by the turn flag as today.
  - Every pass builds its request from its pass record over the standalone pass input; the digest and diary passes join the discover and milestone passes in doing so. Every request carries an abort signal.
  - Tick (new): the queue re-evaluates when the history, the gate, a member's setting, or the entity list changes, and after every pass completes, succeeds or fails.
  - The queue exposes the set of running pass kinds. The status bar shows one label by fixed precedence digest > milestone > diary > discover, gated on Show Silent Requests as today; discover gains "Describing character…". The discovered-character regenerate's busy check, which today reads three pass flags and the scene render, becomes the queue's own waiting state.
- **ADR-0012 (Q14).** A new decision record: the Request Transport has one sink; the Turn Pipeline's two seams stand. ADR-0001 gets a one-line pointer.
- **Glossary (Q13).** Request Transport, Narration Stream and Background Pass Queue are in the glossary with their avoid lists. Code uses those names.
- **No settings, export shape or prompt text changes.** The queue reads the existing Concurrent Requests setting; it adds none.

## Testing Decisions

- A good test drives a module through its interface and asserts what a caller or the player observes. It never asserts cursors, refs or internal state.
- **Characterization first (Q6, revised).** Before any builder is deleted, a test builds each of the four hand-built requests (digest, diary, choices, stats) and the matching pass-record request from the same inputs and compares them byte for byte: system prompt, messages, type, cap, silent, quiet, attach turn id. Where they differ on purpose (anatomy added, the diary's entity text, the pass record's base context in place of the view's context values, the effective action in place of the raw paired user message), the test states the difference. These tests are deleted with the builders.
- **Request Transport** tests run with a fake AI Stream and a recording sink: abort before any text resolves to empty text and emits no opened event; abort after text emits canceled; a tool-call round after text emits retract and the final text excludes the retracted round; a length-capped narration is trimmed to its last sentence and a length-capped stats reply is not; a silent failure throws without a failure event; a rejected override emits its notice on a silent request; request and response captures carry the wire body and raw reply. Prior art: the tool loop, AI Stream and request spec tests beside it, and the parity recorder tests.
- **Narration Stream** tests feed deltas and assert the emitted event list: each sentence once, in order; the trailing in-progress sentence held back; retract clears and later sentences restart from zero; finished flushes the last sentence without a terminator; canceled emits no further sentences. Prior art: the narration reading tests.
- **Background Pass Queue** tests are pure, with a fake transport: serial mode runs one at a time in the stated order; concurrent mode starts every independent pass together; a rate-limited failure sets that pass aside and the rest proceed; a milestone never starts while a digest is due or set aside; a new name's diary waits for its discover and then carries the description; a suppressed name and a name with Describe New Characters off get no diary; a blank-narration turn is not due; nothing starts during a turn or a scene render; a failed pass is set aside and lower passes proceed; the set-aside list clears on a foreign history change; an empty digest is stored and stops being due; a canceled pass applies nothing and is not set aside; a stale result (session changed, narration changed) is dropped; unmount and load abort every signal; a regenerate waits behind running passes, can be canceled while waiting, and holds the queue while it runs; a completion with no history change still re-ticks. Prior art: the turn runner tests with a fake adapter.
- **Parity** is a regression check, not the bar: the runner parity replay stays byte-equal and the fixture is not re-recorded. It drives the runner with a fake adapter and never reaches the transport, the queue or the re-rolls.
- **Written page.** The runner test that proves a written page one never calls the adapter stays, rewritten without the removed stream hooks.
- **View adapters** get one mounted test each only where the existing game panels harness reaches them: the partial assistant message appears once and refreshes per sentence; the status bar shows the precedence label and the new discover label; a re-roll shows "Generating Choices…".
- **Guards must bite.** Each new test is checked by reinstating the bug it guards: the omitted milestone flag, the missing `quiet: false` on a re-roll, a duplicate sentence emission, a stats reply trimmed by mistake, a failed pass that stays due, a falsy digest test that keeps an empty digest due, an aborted milestone marking candidates seen.
- Done (Q6, revised): the four gates green, the characterization tests green before deletion, transport, stream and queue unit tests green, parity replay unchanged.

## Out of Scope

- Changing which silent passes exist, their prompts or their caps.
- Aborting an in-flight silent pass when a turn starts.
- Gating partial re-rolls on the queue, or making a scene render wait for the queue.
- A retry budget or backoff beyond set-aside-for-this-window.
- Any cap on how many silent passes run at once. The user weighed a per-endpoint Parallel Requests count and ruled it too much plumbing for a burst that is rare (a backfill when Memory Digests is first enabled on a long save).
- Moving the embedding batch into the queue.
- The turn history as a module (architecture review candidate 3).
- Scene image requests and their job state.
- A new setting, export shape changes, prompt text, probe numbers.

## Further Notes

- The parity fixture was recorded at the closure this spec replaces. The recorder moves into the transport's entry so the seam it observes is the same one.
- Q10 was first ruled "keep milestone concurrent", then reopened when review showed two silent requests overlap after most turns today, whichever endpoint. The revised ruling ties concurrency to Concurrent Requests, which already encodes whether the endpoint takes parallel requests.
- Q11 was first described as behavior-preserving. Review showed today's order is digest, milestone, diary, discover, so discover-first changes a new character's diary request. The user accepted it as a deliberate fix.
- A second review found the fixes' own gaps: an empty digest would stay due under the existing falsy test; an abort looks like an empty reply; a shared sink would interleave concurrent requests; no save session exists to stamp; unbounded fan-out; diaries for names that never become entities. The user first ruled a soft cap of three per kind, then a per-endpoint Parallel Requests count, then reverted to uncapped: the burst happens only on a backfill, and a rate-limited reply is already handled by set-aside. The user also ruled skipping orphan diaries, a cancelable wait for the regenerates, and abort on load.
- Q6 was first "parity byte-equal". Review showed the parity replay never reaches the code this spec moves. Characterization tests replaced it.
- No export shape changes. No version change.
