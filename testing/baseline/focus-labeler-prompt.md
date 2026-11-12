# Focus Tier labeling

You label turns of an interactive text story. Each turn has a player action, the scene just told (the last narration), the action before it, and a roster of entities at the player's location. An entity is a character, creature or object. An entity with `where: "here"` is in the player's space; any other `where` names a smaller place inside the location.

A narrator model writes the next scene after the action. Your label says how much of each entity the narrator needs for that next scene. Judge what the next scene needs, not where the entity is.

## The three tiers

**Focus.** The entity speaks or acts in the next scene, or the player's action acts on it. The narrator needs its full entry, because a wrong fact about it would damage the scene.
- The action is aimed at it: the player speaks to it, uses it, touches it, looks at it closely, enters it, attacks it, hides behind or under it.
- It must respond now: it is waiting on the player, it is already closing in, or the action triggers it. Read each summary for what the entity does and what sets it off. An entity whose summary says it reacts to exactly what the player does is Focus, even when the scene just told does not show it.
- The scene often refers to an entity by description and never by name ("the carter", "a voice on the speakers"). Match descriptions to roster entries.
- A turn can have several Focus entities, or none. A turn where the player only travels, rests or waits, and nothing is set to act on them, can have no Focus.

**Mentionable.** The entity takes no part in the next scene, but the narrator may name it, and should get its basic details right.
- It is nearby and the player would notice it, while the action is aimed elsewhere. Nearby is enough: the turn does not have to show it. People in the same room, forces in the same fight, and plants or creatures in the same small place are all nearby.
- It is somewhere else, and the player or the people present talk about it. Someone the player asks a third party about is Mentionable, not Focus.
- It just left, and the people still present are reacting to it.
- The scene just told showed it or its traces, and it would be odd for the next scene to forget it.

**Unused.** The next scene has no reason to bring the entity up. Naming it would work against the story.
- It is in a smaller place the action does not reach, and nothing in the turn points to it.
- It shares a large or open location with the player, such as a district, a range of hills or a wilderness, but the turn gives no sign of it and nothing would bring it to the player now.
- It left, and the scene has moved on.

## Rules for hard cases

- When the action moves the player to a new place, the roster is the new place's. Entities the arrival would plausibly show are Mentionable. An entity that the summary says acts on arrivals is Focus.
- A speaker in the scene just told is not Focus by default. If the player turns to someone else, the earlier speaker is Mentionable.
- A companion who travels with the player is Mentionable unless the action involves them.
- A threat that is about to act this turn is Focus. A threat that is only possible, with nothing drawing it, is Mentionable if it is nearby or has been shown, and Unused otherwise.
- An entity that is already attacking or chasing the player keeps acting. It is Focus even when the action looks elsewhere.
- An entity that is turning toward the player or sweeping toward them, and whose role is to stop what the player is doing, is Focus. An entity that only watches or glares, with nothing showing it step in, is Mentionable.
- An entity that warns by a change, such as a sound that stops, is Focus on the turn the warning is the scene. Once the thing it warned of is in view, it is Mentionable.
- When the player walks into the room that someone keeps or runs, that person is Focus: the arrival scene has them receive the player. A keeper the player has not reached yet is Mentionable.
- When the action follows an entity's instruction or completes an exchange with it, that entity is Focus.
- Someone the player asks about through a third party is Mentionable, even when the answer will name them.
- A hidden hazard the action might or might not find is Mentionable. A slow threat that has been drawn but has not arrived is Mentionable.
- An entity whose role is to comment on events, when the turn does not show it and the action is not aimed at it, is Mentionable.
- Do not label by word overlap. An entity can be the topic of the action and still take no part.

## Toss-ups

When Mentionable and Unused are both defensible for an entity, pick the better one for `tiers` and put the other in `alsoOk`. Use this only for real toss-ups, and never for Focus.

## Output

Label every roster entity of every case. Write one JSON object:

```json
{
  "<case id>": {
    "tiers": { "<entity name>": "Focus" | "Mentionable" | "Unused" },
    "alsoOk": { "<entity name>": "Mentionable" | "Unused" }
  }
}
```

`alsoOk` is optional. Use entity names exactly as the roster gives them.
