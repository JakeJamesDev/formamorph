# 🧬 World Editor: Traits

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The choices that make one playthrough different from the next — *Scarred*, *Silver-Tongued*, *Afraid of Water*. The player picks their traits before the story starts, and the ones they take are described to the AI on every turn.

## Why it exists

A trait is a durable fact about the character. Stats move constantly and the story moves with them; a trait stays put, so the narrator is handed the same truth on turn one and turn ninety. A stat says *how much*; a trait says *who you are*.

> 💡 **Only chosen traits reach the AI.** A trait the player didn't take is sent nowhere and does nothing. Everything below applies to the ones they picked.

## What the AI sees

| Field | Sent? |
|---|---|
| **Name** | Always (it's the fallback when the AI description is blank) |
| **AI-Facing Description** | Yes — what the AI is told the trait means |
| **Player-Facing Description** | **Never** |
| **Stat Changes** | **Never** |

A blank **AI-Facing Description** falls back to just the trait's name — often enough for something self-explanatory like *Left-Handed*.

> 💡 **Stat Changes are invisible to the AI.** It's told the player is *Sickly*; it's never told that cost them 20 Vigor. The number does its work through the stat itself, so write the description as a fact the narrator can act on — *"Flinches at open water"*, not *"-20 swimming"*.

## Enabled by Default

Pre-checks the trait on the selection screen. The player can still untick it — it's a default, not a requirement.

## Stat Changes

Each row adjusts one stat when the trait is taken: a stat, a number, and what to change.

> ⚠️ **Every type is an adjustment, not a setting.** `+20` on a stat that starts at 50 gives 70, not 20.

| Type | Effect |
|---|---|
| **Starting Value** | Shifts where the stat begins. |
| **Min** | Raises the floor, pulling the value up with it if it's below. Can be lowered only far enough to undo another trait's raise — **never below the floor the stat was authored with**. |
| **Max** | Moves the ceiling either way. Lowering it below the current value drags the value down too. |
| **Regen** | Adds to what the stat recovers each turn. Negative bleeds. |

Min and Max are deliberately asymmetric: a trait can take the ceiling anywhere, but can never push a stat below the range its author designed.

## Groups

Groups organize the list — and unlike organizational folders elsewhere, a trait group also **speaks to the AI**. Give a group an **AI-Facing Description** and it becomes a header above its chosen traits, letting you frame a whole set at once (*"Origin: where this life began"*). A group with no chosen traits inside it is skipped entirely.

### Exclusive

Tick **Exclusive** when the group is a choice between options rather than a list to tick — a species, an origin, a starting class. It renders as radio buttons and holds the group to at most one trait: picking one drops the one you had. Clicking the trait you already chose clears it, so "none of these" stays reachable. In-game it works the same for switchable traits — turning one on retires its siblings.

> 💡 **Give an exclusive group a default.** Mark one trait *Enabled by Default* so there's always a valid answer; without one, "nothing selected" is a state the AI has to interpret. If you mark two, the first in the list wins.

## Getting started

Name the trait, write one line of AI-Facing Description that reads as character rather than mechanics, and add Stat Changes only when the trait should also move a number. Leave the description blank for anything the name already says.
