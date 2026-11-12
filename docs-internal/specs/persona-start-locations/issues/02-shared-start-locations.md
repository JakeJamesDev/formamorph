# 02: Persona-Only And Custom Persona Share Start Locations

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A Persona-Only entity and the Custom Persona both show one **Start Locations** field on the entity's Presence tab, and both store it in the `locations` list. The role decides the shape: Cast and Playable keep a kind and Starts; Persona-Only and Custom Persona keep the list.

- The routine migration skips an entity with the Persona and Persona-Only marks, as it already skips the Custom Persona. It stays idempotent.
- The Presence tab's Custom Persona branch becomes the persona branch: the location multiselect, labeled Start Locations, with no Player's Starting Location option, for Persona-Only and Custom Persona alike. Placement, Starts, routine rows, Can Also Go and Known In are hidden for both.
- One pure conversion function maps an entity to its new role's shape. List → Starts: one Unique Start per listed location, weight 1, empty Schedule, in list order. Starts → list: the named Start places in Start order, each once, without Player's Starting Location; Generic Starts convert the same way. This ticket owns the function; the Persona control calls it on every switch into or out of Persona-Only and Custom Persona, Cast included.
- A role switch is one undo step that restores the Starts and routine rows.
- Write the label and hint from the Writing Guide. Update the help pages for entity Presence and persona authoring.
- Changelog fragment in `docs-internal/changelog.d/`.
- 📦 Export shape: a Persona-Only entity carries `locations` instead of `kind`/`starts`. It matches v3.6.2; write no compatibility code for the unreleased form.

Spec rulings: Q1, Q4, Q5, Q7.

## Acceptance criteria

- [x] On the World Editor bench, a Persona-Only entity's Presence tab shows the Start Locations field and no Placement, routine rows, Can Also Go or Known In. The same holds for the Custom Persona. (`EntityManager.personaPresence.test.tsx`, `RoutineTab.test.tsx`)
- [x] The Start Locations field offers no Player's Starting Location, and a pick stores the location in `locations`. (`RoutineTab.test.tsx`: option list and stored list)
- [x] Switching a Playable entity with two Starts to Persona-Only stores their places as the list, in Start order, and drops `kind`, `starts` and `traversable`. (`EntityFields.personaStarts.test.tsx`)
- [x] Switching a Persona-Only entity with two listed locations to Playable stores two Unique Starts with empty Schedules, in list order, and no `locations`. (`EntityFields.personaStarts.test.tsx`)
- [x] Switching a Cast entity to Custom Persona and back converts the same way. (`EntityFields.personaStarts.test.tsx`: Generic Cast and back)
- [x] Undo after a role switch restores the stored entity exactly, routine rows included. (`EntityFields.personaStarts.test.tsx`; the History already groups the writes of one tick into one Step, and an explicit batch broke the field pulse after undo, so none wraps them)
- [x] A v3.6.2 world's Persona-Only entity keeps its `locations` through `migrateWorld` and gains no kind; a second pass changes nothing. (`version.test.ts`)

## Landed

**Not verified**
- Nothing is unticked. Every check ran on the panel bench, with no screenshot of a rendered World Editor view.

**For you**
- Open a Persona-Only entity's Presence tab in the World Editor. Only Start Locations shows, with its hint.
- Switch a Playable entity with two Starts to Persona-Only and back, then undo. The Starts and routine rows return.
- A location's Presence tab and the Locations Canvas pick card now treat Persona-Only like the Custom Persona: hint only, no routine. The ticket did not name this.
