# 03: Client Sends Picks

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Repo: formamorph. The world publish and update payloads only; the world file does not change.

## What to build

A world publish and a world update send `markPicks` (spec, "Picks payload"): for each entity in World Editor order, the Media List image entry of its start picture. A server that does not know the field ignores it, so this ships before or after ticket 02.

- **Start picture.** The first gallery slot whose Visibility rule holds at the entity's starting values, read through the world's gate input, as the World Editor reads it. For a Layered Image, the Variant its base Layer shows under the same reads (Q5). Reuse the entity look reads behind Preview As and the flattened picture (Layered Images Q44), so the pick is the picture the editor and library show.
- **Skip.** An entity whose start picture draws nothing, or a slot that is not a Media List link, sends no entry. A failure to work out picks never blocks a publish.
- **Docs.** None: nothing a player or author sees changes.

## Acceptance criteria

- [x] An entity whose slot 0 rule fails at the start sends its first slot that holds. `publishPayload.markPicks.test.ts` "skips a slot whose rule fails".
- [x] A Layered Image sends its base Layer's start Variant, never an overlay's, and follows a rule on the base Layer's Variants. Same file, "sends a Layered Image's base Layer start Variant" and "base Layer shows nothing".
- [x] Picks follow World Editor entity order; an entity that draws nothing sends none. Same file, "follows World Editor order" (groups, a missing link, embedded image and embedded Layered Image).
- [x] `contentData` is byte-equal with and without this change. Same file, "leaves the content byte-equal"; `jsonFileOps.test.ts` exact body.
- [x] Both the publish and the update payloads carry the field. `WorldStorageService.test.ts` "sends a world's mark picks on both a new listing and an update" (POST and PUT bodies).
- [x] Each assertion fails when its rule is undone (first slot ignoring rules, top Layer instead of base). Mutation run: slot rules ignored, top Layer, array order, embedded slot fall-through, embedded Layered Image fall-through; each turned its test red.

## Landed

**Not verified**
- No live publish against a server; the request body is checked in unit tests only.

**For you**
- Nothing a player can see changes. Server tickets 01 and 02 decide whether the picks get used.
