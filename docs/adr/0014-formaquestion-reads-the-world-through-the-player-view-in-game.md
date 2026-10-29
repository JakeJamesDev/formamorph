# ADR-0014 — Formaquestion reads the open world, and in game only through the Player View

**Status:** Accepted · **Date:** 2026-10-29 · **Supersedes:** the in-game part of "It reads the authored world, with no playthrough" in [ADR-0011](0011-app-internal-functions-may-read-the-open-world.md)

## Context

Formaquestion answers from the docs. A player who asks about the world in front of them gets a general-knowledge guess. ADR-0011 let the code test read the open world's authored data, with no playthrough, in the game and the editor alike. The Formaquestion World Reading spec makes Formaquestion read the world in every request. In the editor the author owns every secret. In game the authored world holds the plot the player has not reached: AI descriptions, hidden stats, unmet characters, the real name behind an alias.

## Decision

- **Formaquestion reads the open world.** What it reads depends on the screen: in the World Editor it reads every authored part as it is on screen; in game it reads the Player View.
- **The Player View is the one in-game filter.** A pure builder takes the world, the current snapshot, the snapshots before it, the history sliced to the current snapshot, the played persona and the session's chip resolution. It returns rows of player text only. The type has no AI field, so no reader can pass one on.
- **Met rules.** Entities: met by id, plus discovered ones the player did not delete; one known only by an alias, in any snapshot of the chain, shows the alias alone. Locations: the current one and each one a turn recorded. Items: held by the player, or visible where the player stood, in any snapshot of the chain. Stats: the visible global stats and the persona's own. Traits: the active global traits and the persona's owned ones. Hidden, disabled and switched-off rows stay out.
- **Text the AI wrote in play counts as player text.** An AI-invented entity uses its generated description; a runtime item uses its description. An authored entity in a discovered record uses its player description, and a follower peeled off an authored entity uses its source's.
- **The view moves with the story.** It reads only the snapshots and turns up to the current one, so an undo or a rewind drops what the later turns showed.
- **In game, every reader takes the Player View.** The help request, Formaquestion Tools and the code test all read it. The game registers a Player View-based Tool Snapshot and world with the open-world registry. The World Editor keeps registering the full authored world.

## Consequences

- A Formaquestion Tool returns less in game than in the editor: a Tool that reads a hidden stat finds nothing there.
- The code test in game checks names against the Player View, so it can report a stat or trait the player has not met as unknown.
- No new save field. "Visited" and "held" come from the snapshots and turns a save already holds.
- No world or save export changes shape.

## Alternatives rejected

**A pruned copy of the world:** the existing readers could take it unchanged, but it keeps the AI fields in the type, and one missed field leaks.

**The current snapshot only:** simpler, but an item the player ate or dropped falls out of the view.
