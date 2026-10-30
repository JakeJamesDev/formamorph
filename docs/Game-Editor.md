# 📓 Game Editor
<!-- keywords: edit my game, edit this save, change what happened, fix a character, game state, edit during play, not the world -->
<!-- route: gameEditor -->

The **Game Editor** edits the game you are playing: what the story has made of the world in this save. It has the same layout as the [World Editor](WorldEditor), with the tabs on the left and two panels. The World Editor changes the world for every game; the Game Editor changes this one and never touches the world.

## How to Open the Game Editor
<!-- keywords: where is it, find the editor, button, open, menu -->
<!-- route: gameEditor -->

Select the **Game Editor** button at the top right of the game. On a phone, it is in the menu. **Edit World** is in the menu on every screen size.

## Overview
<!-- keywords: summary, current scene, who is here, time, turn number, location, now, nearby, my stats -->
<!-- route: gameEditor.overview -->

The **Overview** tab shows the game as it stands: the world, the turn, the time and the location, and how many entities the game has. **You** shows your stats. **Here Now** lists who the story has at your location, and **Nearby** lists who the AI is told is in the places reachable from it.

## Entities
<!-- keywords: active, list every character, invented characters, edit npc, fix pronouns, move a character, rename -->
<!-- route: gameEditor.entities -->

The **Entities** tab lists you first, then the entities **In the Game**, which the story invented, wherever they are, and the entities **From the World**. Select one to edit it.

Under **Entities** on the left, **Active** shows you and the entities the model can be told about this turn: here, in sub-locations, in reachable places, and known here. **Inactive** shows the rest. A mark beside a name says they are in the scene, as the game's side panel lists them.

| Tab | Holds |
| --- | --- |
| **Profile** | Pictures, **Name**, **Aliases**, **Pronouns** and **Location** |
| **Descriptions** | The **Player-Facing Description**, the **AI-Facing Description** and the **AI-Facing Summary** |
| **Stats** | The entity's stats in this game, or your own |

A new name keeps the old one under **Aliases**, so the story can still use it. **Location** moves the entity: the scene follows. **Remove** takes an invented entity out of the game and stops the story bringing it back.

Your entry shows your persona's text and pictures, read only, with your stats beside them. A world entity's text and pictures belong to the world, so they read only here: change them with **Edit World**. Its stats and its **Location** are this game's own.

## Saving and History
<!-- keywords: save, discard, undo, redo, history, search, find, replace, earlier turn, read only -->
<!-- route: gameEditor -->

Your changes wait for **Save** and **Discard Changes**, like in the World Editor, and **Undo**, **Redo** and **History** go through them. **Search Game** finds and replaces text across the entities.

The bar at the bottom pages through the turns. On an earlier turn the editor shows the game as that turn left it, and reads only.
