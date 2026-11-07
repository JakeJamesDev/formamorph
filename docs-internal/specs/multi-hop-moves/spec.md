# Spec: Multi-Hop Moves

Status: ready-for-agent
Spec session: multi-hop-moves — spec

## Problem Statement

A live Auto-mode run in an authored world showed a walk into town that the game never followed.

- **A walk across more than one level never moved the player.** The action was "I leave the farm and walk down the lane to Ashcombe, then step into the general store", from the farm's breeding barn. The store is three moves away: barn → farm yard → Ashcombe (a Connection) → the store (a child of Ashcombe). The location router and the Narrated Move request only see places one move away, so the store was never a choice. The router answered NONE, which was right for its list.
- **The Narrated Move request moved the player to the wrong place.** The narration took the player into the store. The request could answer only the current location or a listed place, so it named a farm place instead. The player then took two more turns to reach Ashcombe and never reached the store. The shopkeeper was never present, and the buy failed.

## Solution

The game follows a walk of up to three moves in one turn, and never moves the player to a place the story did not go.

- **Walkable reach.** The router and the Narrated Move request list every place the player can reach in up to three moves under the navigation rules. One-way Connections stay one-way. A place more than one move away carries its route, so the model can tell near places from far ones.
- **Final place only.** A multi-hop move lands on the final place. The places in between are passed through, and nothing records them.
- **Elsewhere.** When the story takes the player to a place that is not on the list, the Narrated Move request answers Elsewhere, and the player does not move.

## User Stories

1. As a player, I want "walk to town and step into the store" to put me in the store, so that one action covers one walk.
2. As a player, I want the store's shopkeeper present when I arrive, so that I can buy from her on the next action.
3. As a player, I want a narration that carries me two or three places away to move me there, so that the location panel matches the story.
4. As a player, I want the game to leave me where I am when the story takes me somewhere it cannot follow, so that I never land in an unrelated room.
5. As a player, I want followers to arrive with me at the final place, so that a long walk does not leave my companion behind.
6. As a player, I want a "stay here" reply to keep that character behind on a long walk, so that it acts the same as a one-move walk.
7. As a player, I want a Moves Between character to come along only when the final place is one of hers, so that her route stays the one the author set.
8. As a player in Suggest mode, I want the offer to name the final place, so that I can accept the whole walk with one click.
9. As a player, I want a long walk to cost no extra game time on its own, so that the clock still follows what the story tells.
10. As a player, I want a walk past three moves to keep the current behavior, so that very long trips do not move me by guesswork.
11. As an author, I want one-way Connections respected on a long walk, so that a one-way gate stays one-way.
12. As an author, I want a far place shown with its route, so that the model reads how far it is.
13. As an author, I want the nearest place to win when two places share a name, so that a second "Cellar" across the map is never picked by mistake.
14. As an author, I want no move when two places with the same name are equally near, so that the game never guesses.
15. As an author, I want the player's own travel (the location list and the Map) to stay free, so that ADR-0006 still holds.
16. As a developer, I want the walkable reach as a pure function with tests, so that the hop cap, one-way links, routes and the name rule cannot drift.
17. As a developer, I want turn-runner tests with fake replies for multi-hop moves and Elsewhere, so that the move path is covered end to end.
18. As a developer, I want probe numbers for the far and unlisted cases on the cloud model, so that the prompt change ships with evidence.

## Implementation Decisions

Rulings from the grill:

- **Q1. Walkable reach.** The router and the Narrated Move request can pick any place reachable by a chain of legal moves under the effective-navigation rule (ADR-0002: Implicit Navigation for pairs no Connection covers, plus the Connections leaving a place). One-way legs stay one-way. The game computes the path. The reply is matched against this list only.
- **Q2. Elsewhere.** The Narrated Move request gets an Elsewhere answer: the player's body left for a place that is not on the list. Elsewhere moves nobody.
  - **Ticket 01 rulings:**
    - A reply whose first word is Elsewhere, in any case and with any trailing text, is Elsewhere and moves nobody, even when the trailing text names a listed place.
    - An exact match to a listed place name wins over Elsewhere, so a place named "Elsewhere" stays reachable.
    - The router keeps its matcher unchanged.
    - The probe gets an in-batch "before" arm: the narrated prompt text at the ticket's base, frozen in the probe, run beside the new prompt on every set. The stay bar reads: the new stay false-move rate is at most the before arm's rate in the same batches. The reused arm stays.
    - The unlisted set has 5 or 6 new neutral scenes that expect NONE. The probe asserts each far place exists and is not on the one-move list. No move is a hit, and a move to any listed place counts as moved. At least half the scenes use places that stay unlisted after ticket 02: more than 3 moves away, or behind a one-way leg. Ticket 02 moves the rest into the far set.
    - **Probe result and ruling (2026-11-07, user):** no prompt variant met the unlisted bar on the cloud model. The best one-line variant (an Elsewhere line at the end of the destination list, plus "the last place the body stops") moved 50% of unlisted runs, against 67–75% for the base prompt, with carried and stay unchanged. A two-part reply reached 25% but regressed carried and stay. Ruling: land the one-line variant, record the miss in Landed, and judge the unlisted bar again in ticket 02, with route tails on the list.
- **Q3. Followers.** A multi-hop move goes through the same move path as a one-move walk, to the final place. Followers come along, and "stay here" replies stay.
- **Q4. Both requests.** The router and the Narrated Move request read the same widened list, as they do now.
- **Q5. Hop cap.** At most 3 moves. A place past the cap is not listed.
- **Q6. List form.** A place more than one move away keeps its summary and gets a route tail that names the places in between, in the form of the existing Travel Hint tail. A one-move place renders as it does today.
- **Q7 / Q12. Final place only.** Only the final place counts as entered: the follower carry, the Met check, the log line, the ambient sound, presence and the scene pull. Nothing records the places in between. This was reopened on a new fact: a move today fires no enter script and records no visited place.
- **Q8. Shared names.** When several listed places share a name, the one with the fewest moves wins. On a tie, the game does not move the player.
- **Q9. Elsewhere scope.** Elsewhere is a Narrated Move answer only. The router keeps NONE. In Auto mode and in Suggest mode, Elsewhere gives no move and no offer.
- **Q10. Probe bar.** On the cloud default model, the location-narrated probe gains a **far** set (the narration carries the player 2 or 3 moves) and an **unlisted** set (the narration carries the player past the cap, or to a place that is not reachable). Far: at least 90% move to the right place. Unlisted: at most 10% move. The existing carried, stay and router control sets run in the same batches as the in-batch control.
- **Q11. Suggest mode.** The offer names the final place. Accepting it runs the same path move.
- **Q13. Moves Between.** A Moves Between follower who does not own the final place stays behind, even when a place on the path is one of hers.
- **Q14. Time.** A move charges no travel time, as today. The time pass reads the narration.
- The skip rule of the Narrated Moves spec (Q7 there) is unchanged: the Narrated Move request runs only after the router answers NONE. One move per turn.
- Player travel (the location list and the Map) does not change. ADR-0006 still holds.
- No save or world shape change is expected. If one turns out to be needed, it carries the export-shape reminder.
- Prompt changes (the route tail, the Elsewhere answer) follow the prompt-writing guide and ship with the Q10 probe numbers.

## Testing Decisions

A good test calls the real function or runs a real turn with fake model replies, and asserts what the player sees: where the player stands, who came along, and what the offer names. It never mirrors the implementation, and each guard is shown to fail when its bug comes back.

- **Seam 1, walkable reach (pure).** Next to the existing navigation tests:
  - A place 3 moves away is listed. A place 4 moves away is not.
  - A one-way Connection is never walked backward.
  - A far place carries its route. A one-move place does not.
  - When two places share a name, the nearest one wins, and a tie matches nothing.
- **Seam 2, the turn runner (fake replies).** Next to the narrated-moves turn tests:
  - A router answer that names a 3-move place moves the player there in Auto mode.
  - A Narrated Move answer that names a far place moves the player there.
  - Elsewhere moves nobody, in Auto mode and in Suggest mode.
  - Followers arrive at the final place. "Stay here" stays. A Moves Between follower who does not own the final place stays.
  - Suggest mode offers the final place, and accepting it moves the player there.
  - Passes after the move (choices, stats, inventory) read the final place.
- **Seam 3, the cloud probe.** The location-narrated probe gains the far and unlisted sets, 10 runs each, against the Q10 bar.
- All test and probe scenes are neutral and made up. The world that found the gap stays private.

## Out of Scope

- Moves past 3 hops.
- Player travel through the location list or the Map (ADR-0006).
- Recording places passed through, enter scripts, or a visited set.
- Travel time for a move.
- Structured output for the location requests: an A/B on the cloud model found more false moves and twice the total time.

## Further Notes

- The widened list makes the location prompts longer in large worlds. The probe reports first-token and total time beside the accuracy numbers.
- The router's existing threshold cases (a door, a ladder foot) are unchanged by this spec.
