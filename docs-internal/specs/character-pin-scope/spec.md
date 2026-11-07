# Spec: Character Pins Reach All Text

Status: ready-for-agent

Grill: 2026-11-07, Q6–Q21 (rulings below). The first user is the Centaur Breeder world's dynamic text (its fourth-pass ticket 12), which waits on this.

## Problem Statement

A world can't make a character's own stat or trait change the world's text.

- **A character's stat bands never pin.** The editor offers the pin button on every descriptor row, but play collects band pins from global stats only (`useResolvedWorld.ts`, `collectPinLayers`). An author who pins from the breeder's *Standing With The Herd* band sees the pin in the editor and nothing in play.
- **A character's trait pins reach only that character's text,** plus world text while the player plays that character. Shipped in 3.6.0. A farm whose mares react to the breeder's standing stops reacting when the player plays someone else.
- **Blueprint stats can't pin per copy.** Each mare owns a copy of the Pregnancy Blueprint, but no band can pin her own copy of a placeholder.

## Solution

A character's pins work like global ones: they reach every text, for any persona.

- A character's stat band pins a placeholder while her stat sits in that band.
- A character's trait pins reach every text, not only her own.
- A Blueprint stat's band pins the Blueprint placeholder, and each owner's copy follows that owner's own stat.
- Ties inside one source kind have a fixed order, and the Test Bench warns when two characters can pin one placeholder to different values.

## Rulings (grill, 2026-11-07)

| # | Ruling |
|---|---|
| Q6, Q10 | A character's own stat bands pin placeholders. The editor's pin button on those rows starts to work. |
| Q11 | A character's stat band may pin world placeholders and that character's own placeholders. |
| Q13, Q16 | A Blueprint stat's band pins a Blueprint placeholder. Each owner's copy takes the pin from that owner's own stat. A Blueprint stat's band never pins a world placeholder. |
| Q17 | Stats and traits follow one rule: a character's pin reaches all text (world text, every entity's text, the player's), whoever is played. |
| Q18 | Order between kinds is unchanged: Code Pin > stat band > location > trait > value Pin. Inside one kind: a global source wins, then the played persona's, then the character later in the entity list. |
| Q19 | A character's pins hold while she is out of the scene. |
| Q20 | No compat switch. The trait change ships with a changelog note, because the per-owner trait scope shipped in 3.6.0. |
| Q21 | The Test Bench warns when two characters can pin one placeholder to different values, and names the winner. |

## User Stories

1. As an author, I want a band on a character's own stat to pin a placeholder, so that the pin button I set does something.
2. As an author, I want the breeder's standing to change the Pasture's text whoever the player plays, so that the world reacts the same way for every persona.
3. As an author, I want each mare's Pregnancy band to pin her own copy of a Blueprint placeholder, so that each mare's text follows her own term.
4. As an author, I want a character's trait to pin text everywhere, so that traits and stats behave alike.
5. As an author, I want a warning when two characters fight over one placeholder, so that I know which one wins before play.
6. As a player of an existing world, I want my world's trait pins to keep working, so that the change only widens where they show.

## Implementation Decisions

- **One rule, one place.** The pin collection gains the character layer for stats and traits together, so world text and every entity's text read the same set of pins. The per-reader `of(id)` split in `ownedTraitsInPlay.ts` remains only for Blueprint copies.
- **Blueprint copies.** A Blueprint stat's band lays its pin on the owner's copy, the way a trait that pins a Blueprint does today. `pinTargetFilter` lets a Blueprint stat descriptor name a Blueprint placeholder, and refuses world placeholders there.
- **When a pin applies.** As today: a stat that crosses a band in a turn pins from the next prompt build, and a script's same-turn write pins in that turn's later prompts.
- **Editor.** The placeholder's **Pins** tab lists character stat bands, with their owner, in the new order. A descriptor on a Blueprint stat offers only Blueprint placeholders.
- **Test Bench.** A new rule finds two characters (stat bands or traits) that can pin one placeholder to different values, and names the winner by the Q18 order.
- **Docs.** `docs/World-Editor-Placeholders.md` (Pins), `World-Editor-Stats.md` (Pins on a descriptor), `World-Editor-Blueprints.md` (pins by Blueprint) and `World-Editor-Traits.md` (Placeholder Pins) state the new reach. The CONTEXT.md **Pin** entry gains the character layer and the order inside a kind.
- **Changelog.** One entry under Minor → Fixed or Added for the stat bands, with the trait reach change stated in it (Q20).
- **No export-shape change.** Pins already live on descriptors and traits.

## Testing Decisions

- Unit tests over the pin collection: a character stat band pins in world text and in another entity's text for both personas; a character trait does the same; ties follow Q18; a pin holds with its owner out of the scene.
- A Blueprint test: two mares in different Pregnancy bands each read their own copy's value.
- A Test Bench rule test, with a guard proved by reinstating the global-only collection.
- One editor test: a Blueprint stat descriptor's pin menu lists no world placeholder.

## Out of Scope

- A compat switch for the old trait scope.
- Image Visibility rules (they already read stats).
- Any world's content, Centaur Breeder's included.
