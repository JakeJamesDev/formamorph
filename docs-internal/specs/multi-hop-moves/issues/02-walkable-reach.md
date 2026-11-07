# 02: Walkable Reach Up To Three Moves

Status: ready-for-agent
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

- [ ] The path function lists a place 3 moves away and not one 4 moves away, never walks a one-way leg backward, gives far places a route and one-move places none, and resolves a shared name to the nearest place with a tie matching nothing. Each guard is shown to fail with its bug back.
- [ ] In a turn-runner test with fake replies, a router answer naming a 3-move place moves the player there in Auto mode, and choices, stats and inventory read the final place.
- [ ] In a turn-runner test with fake replies, a Narrated Move answer naming a far place moves the player there.
- [ ] Followers arrive at the final place, "stay here" stays, and a Moves Between follower who does not own the final place stays, in turn-runner tests.
- [ ] Suggest mode offers the final place, and accepting the offer moves the player there, in a turn-runner test.
- [ ] Probe numbers on the cloud default model, 10 runs per scene: far at least 90% right, unlisted at most 10% moved (ticket 01 landed at about 50%; this ticket owns the bar), carried and stay no worse than before, router controls unchanged, and first-token and total time per arm. The numbers go in the ticket's `## Landed` section.

For you: in a live Auto-mode run, "walk down the lane to town and step into the store" from a farm building puts you in the store, with its shopkeeper present.
