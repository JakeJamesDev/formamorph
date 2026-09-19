# 🗺️ World Editor: Locations

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The places your story happens. The player is always in exactly one, and it decides what the AI is told about the scene — the description, who's present, and where the story might go next.

## Why it exists

Without a fixed place the narrator drifts: the tavern becomes a street becomes a forest, and nothing stays put. A location is an anchor the AI is handed again on every turn.

## Nesting is the AI's map, not the player's

This is the part that surprises people.

> 💡 **The player can travel anywhere, always.** The in-game location list offers **every** location in your world, unfiltered, no matter how you've arranged them. Nesting never gates a player's choice, and no arrangement can strand them.

What nesting decides is where **the story** can take the player. When the AI reads an action as movement, it only considers places connected to where they already are:

| From | The story can move them |
|---|---|
| A **top-level** location | Down into its own sub-locations |
| A **sub-location** | Down into its children, **up** to its parent, and **sideways** to its siblings |

…unless you've drawn a **Connection** between two places, which takes over that pair entirely — see [Connections](#connections) below.

By default the story *offers* the move — a small **Move to _X_?** prompt with **Go** and **Dismiss** — rather than making it for you.

Two consequences worth knowing:

- **A flat list of top-level locations** gives the AI nothing to connect, so it never proposes a move. Travel becomes entirely player-driven — a legitimate design, just a deliberate one.
- **A single-location world** never runs the router at all.

If the AI's answer doesn't match a connected place, it's discarded and nothing is offered — the story can never teleport the player somewhere unconnected.

## What reaches the AI

| Field | Sent? |
|---|---|
| **Name** | Always |
| **AI-Facing Description** | Yes — the main thing the AI knows |
| **AI-Facing Summary** | Only in prompt slots that ask for the short form |
| **Player-Facing Description** | **Never** |
| Background image, Image Tags, ambient sound, starting flag, nesting | Never |

The default prompt gives the **narrator** the current location in full, and its sub-locations and reachable places as summaries.

> ⚠️ **Only the narrator gets the full description.** The other steps — the choice writer, the continuity planner, the location router — are sent the **summary** of the current location too. So anything the AI must act on that lives *only* in the full description (a random-event list, a rule about the place) reaches the narrator and nobody else. Writing a summary is what switches those steps over: leave it blank and they fall back to the full text.

> 💡 **The two descriptions are disjoint.** The player only ever sees the Player-Facing one; the AI only ever sees the AI-Facing one — so the AI-Facing Description is where a secret lives.

The **✨ toolbar** beside AI-Facing Summary can draft it from your AI-Facing Description. Blank is fine — it falls back to the full description.

## Entities

The **Entities** picker lists who's at this location. Membership is stored on each entity, so editing here writes to their **Locations** — the same link, set from whichever end suits you.

## Connections

Nesting hands out travel for free, and it's always mutual. **Connections** are the deliberate version: a link between *any* two locations, wherever they sit in the tree.

The **Connections** section on a location lists every link it's part of, seen from where you're standing:

| Direction | Means |
|---|---|
| **Two-Way** | The story can move the player either way. This is what a new Connection starts as. |
| **Outgoing** | The story can leave here for the other place — and can never bring them back. |
| **Incoming** | The story can arrive here from the other place, but not go the other way. |

Pick a place from the **Connect to…** dropdown and press **Add Connection**. The **Travel Hint** box is optional and goes to the AI — *through the shimmering portal*, *down the rope ladder* — so the story knows *how* the trip is made.

> ⚠️ **A Connection replaces whatever free travel those two places had.** That's what makes a one-way link genuinely one-way, even between two sub-locations of the same place. The story is never offered the trip back — it isn't told not to take it, it simply never sees it.

One Connection is one link, so it appears on **both** locations' panels — flipping it from either end moves the same record, and deleting it from either end deletes it once. Deleting a location deletes its Connections with it.

> 💡 The player's own location list is still unfiltered — Connections steer the *story*, exactly like nesting does.

## Starting location

The checkbox marks a place a new game can begin. It does more than it looks:

| Ticked | Result |
|---|---|
| **None** | The game starts at a **random location — any of them**. Rarely what you want. |
| **One** | Every game starts there. |
| **Several** | The player chooses between them before starting. |

## Getting started

Write the AI-Facing Description first — it's the one doing the work. Reach for nesting when you want the story to move the player on its own, add Connections where you want a link nesting can't express, and tick at least one starting location so new games don't begin somewhere arbitrary.
