# 02: Walkable Reach Up To Three Moves

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new path function under ADR-0002, a list-form change read by two prompts, and a multi-hop move through the turn runner, the commit and Suggest mode.

## What to build

One action or one narration moves the player up to three moves away (Q1, Q3–Q8, Q11–Q14).

- A pure function lists every place reachable in up to 3 moves under the effective-navigation rule (ADR-0002). One-way legs stay one-way. Each far place carries its route.
- The router and the Narrated Move request both read this list (Q4). A place more than one move away keeps its summary and gets a route tail that names the places in between, in the form of the Travel Hint tail (Q6). A one-move place renders as today.
- When several listed places share a name, the one with the fewest moves wins. A tie moves nobody (Q8).
- A multi-hop move goes through the existing move path to the final place. Followers come along and "stay here" stays (Q3). A Moves Between follower who does not own the final place stays behind (Q13).
- Only the final place counts as entered: the follower carry, the Met check, the log line, the ambient sound, presence and the scene pull (Q7/Q12). A move charges no time (Q14).
- Suggest mode's offer names the final place, and accepting it runs the same move (Q11).
- The location-narrated probe gains a **far** set: narrations that carry the player 2 or 3 moves. The unlisted set from ticket 01 then uses places past the cap or not reachable.
- Player travel through the location list and the Map does not change (ADR-0006).
- Docs that describe location changes and the destination list say how far a move can reach.

## Acceptance criteria

- [x] The path function lists a place 3 moves away and not one 4 moves away, never walks a one-way leg backward, gives far places a route and one-move places none, and resolves a shared name to the nearest place with a tie matching nothing. Each guard is shown to fail with its bug back. `locationGraph.test.ts` "walkableReach" and `locationContext.test.ts` "walkableDestinations / buildDestinationsContext reach"; mutations of the cap, the one-way leg, the route, the nearest rule and the tie each turned the right tests red.
- [x] In a turn-runner test with fake replies, a router answer naming a 3-move place moves the player there in Auto mode, and choices, stats and inventory read the final place. `GameViewer.multiHopMoves.test.tsx` "moves the player 3 moves on a router answer…": the choices prompt reads the store, and the stat and inventory requests name the store's ledger.
- [x] In a turn-runner test with fake replies, a Narrated Move answer naming a far place moves the player there. Same file, "moves the player to a far place a Narrated Move answer names".
- [x] Followers arrive at the final place, "stay here" stays, and a Moves Between follower who does not own the final place stays, in turn-runner tests. Same file, "brings a follower to the final place…"; red with the Moves Between ownership check removed.
- [x] Suggest mode offers the final place, and accepting the offer moves the player there, in a turn-runner test. Same file, "offers the final place, and Go moves the player there with the follower".
- [x] Probe numbers on the cloud default model, 10 runs per scene: far at least 90% right, unlisted at most 10% moved (ticket 01 landed at about 50%; this ticket owns the bar), carried and stay no worse than before, router controls unchanged, and first-token and total time per arm. The numbers go in the ticket's `## Landed` section. Unlisted scored under the 2026-11-07 ruling (see Landed).

## Landed

Probe: `location-narrated-probe.cli.ts`, cloud default model, 10 runs per scene, all arms in the same batches. "before" is the Base narrated prompt over the one-move list; "narrated" is the shipped prompt over the walkable list.

| Set | reused | before | narrated (shipped) |
|---|---|---|---|
| far, right (7 scenes) | 0% | 0% | **100%** |
| unlisted, moved (raw, 5 scenes) | 40% | 20% | **60%** (30/50) |
| · stop inside a listed place, hit (3 scenes) | 66.7% | 66.7% | **100%** (30/30) |
| · the rest, moved (2 one-way scenes) | 50% | 0% | **0%** (0/20) |
| carried, moves found | 10% | 100% | **100%** |
| stay, false moves | 0% | 12.5% | **12.5%** |
| router controls, right | 94.5% | 60.5% | **60.5%** |
| median first token / total (ms) | 127 / 153 | 127 / 178 | 127 / 179 |

- The 3 past-cap unlisted scenes end in a place inside a listed one, and the model names the listed place every time. By the user's ruling (option b), naming that containing place is a hit, and the unlisted bar reads the rest.
- Three prompt variants (a rule sentence, a user-message line, an Elsewhere-line clause) left the raw unlisted rate at 60%. The ruled one-line wording ships.
- The far set has 7 scenes: the seventh walks across a one-way Connection.
- A far place that shares the current location's name is left off the list, so a reply naming where the player stands never moves them.

**Not verified**
- Nothing in the criteria. The Test Bench's one-line copy change was not checked in the preview.

**For you**
- In a live Auto-mode run, "walk down the lane to town and step into the store" from a farm building puts you in the store, with its shopkeeper present.
- Test Bench → AI Context: a far place in **Destinations** shows "via" and the places on the way.
