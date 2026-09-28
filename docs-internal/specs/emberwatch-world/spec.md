# Emberwatch: an RPG Example World

Status: ready-for-human
Base: 6d7f05c1

## Problem Statement

Formamorph now has trait gates, owned traits, personas, placeholders with pins, and trait links. An author who wants to build an RPG-style character creator has no example of how these fit together. The features are powerful, but they are hard to discover from the editor alone. The wiki can describe each feature, but it cannot show a working world where race, class, spells, pre-authored characters, and a create-your-own character all share one set of traits.

The bundled worlds today use 9–13 flat traits and no links, gates, or persona-only entities.

## Solution

Ship a new bundled world, **Emberwatch**. It is a small high-fantasy frontier story that plays well on its own. It is also a complete example of an RPG character system:

- Races, Classes, and class abilities are authored once, under **Blueprints**.
- **Wanderer** carries the Custom Persona mark: it replaces None and fills in for library personas. **Albus** (Human Paladin) and **Sylvie Thornwhistle** (Elf Rogue) are pre-authored personas.
- Two cast entities, **Mother Hesk** (Dwarf Cleric) and **Corvin Vale** (Human Wizard), carry linked traits too.
- Class Garb and Heritage are placeholder blueprints. Each class pins Class Garb by blueprint and each race pins Heritage, so the pin lands on each bearer's copy. A blueprint chip in each class and race text reads the same copy.
- Albus's Paladin link overrides its stat change, the world's link-override example.
- The readme has a short "How this world is built" section for authors.

## User Stories

### Player

1. As a player, I want Emberwatch in the bundled world list before Open Chat, so that I can play it without importing anything.
2. As a player, I want a clear opening hook at a frontier keep, so that I know what to do on turn one.
3. As a player, I want to choose Wanderer, enter my name and pick a race and class, so that I can make my own character.
4. As a player, I want to play Albus or Sylvie as a ready-made character, so that I can start fast.
5. (Folded into 3: Wanderer takes None's place.)
6. As a player with a library persona, I want to give my persona a race and class in this world, so that my own character fits the setting.
7. As a player, I want class abilities that unlock only for my class, so that my choices matter.
8. As a player, I want locked abilities to show what they require, so that I know how to unlock them.
9. As a player, I want a spell shared by Clerics and Paladins, so that both holy classes can use it.
10. As a player, I want my race's ability to switch on and off with my race choice, so that I never keep an ability from a race I dropped.
11. As a player, I want my class to raise its resource stat, so that a Wizard has more Mana and a Paladin more Faith.
12. As a player, I want my race to give one small stat change, so that race is more than flavor.
13. As a player, I want my class and abilities fixed once the game starts, so that my character stays consistent.
14. As a player, I want the character descriptions to show each character's own garb and heritage, so that Albus looks like a Paladin even when I play a Wizard.
15. (Dropped by Blueprints Q74: world text does not read the played persona's copy.)
16. As a player who picks Albus, I want Wanderer absent from the world, so that I never meet an empty player slot.
17. As a player, I want to be able to take Squire to Albus only while Albus is a Paladin, so that the world reacts to who he is.
18. As a player, I want the narrator to know Mother Hesk is a Cleric and Corvin a Wizard, so that they act their roles.
19. As a player, I want six locations around the keep, so that the world has room to explore.

### Author

20. As an author, I want to see Races, Classes, and abilities under Blueprints, so that I learn how to author a trait once.
21. As an author, I want Albus and Sylvie to link the Races and Classes groups, so that I learn group links.
22. As an author, I want Hesk and Corvin to link single traits, so that I learn trait links.
23. As an author, I want each link to show its own default-on picks, so that I learn how Albus starts as a Paladin.
24. As an author, I want each bearer to own copies of Class Garb and Heritage, with Hesk's and Corvin's reworded, so that I learn pins by blueprint and copy overrides.
25. As an author, I want Wanderer to carry the Custom Persona mark, so that I learn how create-your-own and library personas get races and classes.
26. As an author, I want the Custom Persona mark to keep Wanderer out of the cast, so that I learn it implies persona-only.
26a. As an author, I want Albus's Paladin link to override its stat change, so that I learn link overrides.
26b. As an author, I want blueprint chips in the class and race text, so that I learn one original text that reads each bearer's copy.
27. As an author, I want one named-scope gate (Squire to Albus requires Albus: Paladin), so that I learn cross-bearer gates.
28. As an author, I want a racial ability gated on its race, so that I learn gated defaults and cascades.
29. As an author, I want an any-of gate on the shared holy spell, so that I learn any-of requirements.
30. As an author, I want a readme section that maps each feature to its example, so that I know where to look.
31. As an author, I want the world to run clean on the Test Bench, so that it models good practice.

## Implementation Decisions

- **Registration.** Add Emberwatch to the bundled world registry, before Open Chat. Regenerate the bundled fingerprints. The world carries the `example` tag, as all bundled worlds do. It has no cover image. The user supplies the cover later.
- **Player setting.** The default (Open), so that None, library personas, and world personas all work.
- **Stats (5).** Health, Mana, Faith, Gold, Renown.
- **Blueprints (traits).** It holds three things:
  - **Races** (exclusive): Human, Elf, Dwarf, Halfling. Each race pins Heritage by blueprint and gives one stat change: Human +Renown, Elf +max Mana, Dwarf +max Health, Halfling +Gold.
  - **Racial abilities**: one per race. Each is default-on and requires its race, so a race change cascades it off. The Dwarf's is Darkvision, and the rest are authored to match.
  - **Classes** (exclusive): Paladin, Wizard, Rogue, Cleric. Each class pins Class Garb by blueprint and raises its resource. Paladin and Cleric raise max Faith, Wizard raises max Mana, and Rogue raises starting Gold.
  - **Class abilities**: two per class, each requiring its class. They are picked at creation and are not toggleable in play.
  - **One shared holy spell**, which requires Cleric or Paladin.
  - Classes and abilities are not player-toggleable in play.
- **Blueprints (placeholders).** Class Garb and Heritage. Every bearer of a class or race owns a copy of each.
- **Root traits.** Squire to Albus requires Albus: Paladin (named scope). Other root traits are optional, and none may duplicate a Blueprints original.
- **Wanderer (Custom Persona, Q29).** It carries the Custom Persona mark, so it replaces None at Enter World and fills in under a library persona. It links Races, Classes, and the abilities, with Halfling and Wizard default-on. Its copies are untouched.
- **Personas.**
  - **Albus:** a Human Paladin persona. It links the same groups, with default-on Human and Paladin. Its Paladin link overrides the stat change to +40 max Faith (Q30).
  - **Sylvie Thornwhistle:** an Elf Rogue persona. It uses the same pattern as Albus.
- **Cast.**
  - **Mother Hesk:** Dwarf Cleric of the keep chapel. She links the Dwarf, Cleric and Darkvision traits (single-trait links). Her copies reword the Dwarf and Cleric values.
  - **Corvin Vale:** Human Wizard and a rival adventurer. He links Human and Wizard, with reworded copies.
- **Every race default has a bearer.** Albus keeps Human, Sylvie Elf, Wanderer Halfling, and Hesk's Darkvision link keeps the Dwarf ability. Otherwise `trait-default-gated` fires honestly.
- **Descriptions.** Every persona and cast player description uses its own Class Garb and Heritage copy chips. The AI descriptions leave garb and heritage to the class and race text, which ends with a blueprint chip (Q31). Trait text uses `{{char}}` for the bearer.
- **Openings (2, world-level).** One Opening Narration at the keep gate and one Opening Action answering the posted call. Both use `{{user}}`. Neither carries a garb chip (Blueprints Q74).
- **Locations (6).** The keep, the town square, the tavern, the chapel, the old watchtower, and the barrow beyond the wall.
- **Readme.** The intro readme plays straight for players. The readme adds "How this world is built": Blueprints, group and trait links, per-link defaults, link overrides, blueprint pins, blueprint chips, Custom Persona, the persona-only mark, gates (same-bearer, any-of, named-scope), and racial cascades. Each item names its example in the world.
- **Copy.** Creative text follows the world's voice. Non-creative text (the readme section, trait player descriptions that explain mechanics) follows STE and the Writing Guide.
- **Export shape.** No shape changes. The world uses only fields that trait links and earlier efforts added.
- **Advanced.** The world uses Advanced features, so the editor's inferred-advanced warning icon shows for Simple authors. That is expected.

## Testing Decisions

- A good test loads the shipped JSON through the same seed path the app uses. It asserts what an author or player would see. It never asserts on raw JSON structure.
- **Test Bench clean run (main seam).** The rule pass over Emberwatch returns zero findings. It already checks every bearer as if picked, and gate analysis once per persona choice. Prior art: the Test Bench rules tests and the bundled-world stat-code check.
- **Bearer resolution on Emberwatch.** Wanderer is the Custom Persona entity and is never in the cast. Albus's settled traits include Human and Paladin by default, and his Paladin carries the overridden Faith. Under None, Wanderer holds the player's links. The Cleric text reads Hesk's own garb through its blueprint chip. Squire to Albus is locked when Albus's class changes from Paladin. Each check is proven to fail when the matching world data is broken (test-bar skill).
- **Existing tests.** The registry-matches-disk test and the bundled fingerprint test cover registration.
- **Done-state:** the Test Bench is clean, and typecheck, lint, test, and build are all green.

## Out of Scope

- Cover art. The user supplies it.
- A live enter-world check and a cloud playtest. These are not part of the done-state (Q25).
- Stat code, dictionaries, and time system use. The world may add a dictionary for lore if it helps play, but no feature beyond links, gates, pins, and personas is required.
- Changes to app code, with one ruled exception (Q27): the two Test Bench rules that misread per-bearer links, fixed in their own commit. Any other bug or gap the authoring pass exposes is filed as a finding in Comments, not fixed inside this effort.

## Further Notes

- **Origin:** Emberwatch was the reason for the trait-links effort. It was grilled on 2026-09-28.
- **Rulings:**

  | # | Ruling |
  |---|---|
  | Q1, Q12 | Emberwatch: a high-fantasy frontier keep with one hook. |
  | Q2 | 4 races, 4 classes, 2 abilities per class, and one any-of holy spell. |
  | Q3 | Wanderer, pre-authored personas, and Custom Persona. |
  | Q4, Q7, Q23 | Albus (Human Paladin) and Sylvie Thornwhistle (Elf Rogue). |
  | Q5, Q15 | Health, Mana, Faith, Gold, Renown. A class raises its resource, and a race gives a nudge. |
  | Q6 | Abilities are picked at creation and are not toggleable in play. |
  | Q9, Q17 | Class Garb and Heritage are bearer-relative. Named characters own both. Custom Persona falls back to the world placeholders. Amended by Q26: only the cast owns both. |
  | Q10 | The readme has "How this world is built", and the intro readme is for players. |
  | Q11, Q23 | Cast: Mother Hesk (Dwarf Cleric) and Corvin Vale (Human Wizard), with single-trait links. |
  | Q16 | One gated, default-on racial ability per race. |
  | Q18 | The world sits before Open Chat. |
  | Q19 | Links are kept. Re-classing Albus at creation is allowed. |
  | Q20 | Two world openings. |
  | Q21 | The user supplies the cover. |
  | Q22 | Six locations. |
  | Q24 | One named-scope gate: Squire to Albus. |
  | Q25 | Done: the Test Bench is clean and the gates are green. |
  | Q26 | Personas fall back to the world Class Garb and Heritage; only the cast (Hesk, Corvin) owns both. New evidence: a persona's own placeholder shadows the world's for its pins, so the openings' world chip would keep its roll under Wanderer, Albus or Sylvie. Ruled 2026-09-28. |
  | Q28 | A named-scope requirement never names yourself. The player bearer drops a requirement whose bearer is the played persona; a trait with no other way in is not offered, and a persona switch in play takes it off with its stat changes. The played entity's own tree keeps every requirement. Squire to Albus therefore stays at the root. Ruled 2026-09-28 after the Enter World check showed it offered to Albus. |
  | Q27 | Fix the two Test Bench rules that misread per-bearer links inside this effort, in their own commit: `trait-default-gated` settles defaults per bearer, and `placeholder-pin-conflict` no longer makes two Personas' pins rivals. Amends trait-links Q82. Ruled 2026-09-28. |
  | Q29 | Wanderer becomes the Custom Persona entity; the separate Custom Persona entity goes. It keeps its links, copies and descriptions, drops its Persona, Persona-only, locations and starting location, and starts as a Halfling Wizard. Hesk links Darkvision so the Dwarf default keeps a bearer. Supersedes Q26 after Blueprints. Ruled 2026-09-28. |
  | Q30 | Albus's Paladin link overrides its stat change (+40 max Faith against +30), the world's link-override example. Ruled 2026-09-28. |
  | Q31 | Class and race AI descriptions end with a Class Garb or Heritage blueprint chip; the persona and cast AI descriptions drop their own garb sentence so the AI reads it once. Player descriptions keep their copy chips. Ruled 2026-09-28. |

- **Expect findings.** This world is the first real authoring pass over trait links. Record each gap the authoring pass hits in the Comments section below, for triage.

## Comments

**2026-09-28, implementation.** Gaps the authoring pass hit:

1. **Fixed (Q27).** `trait-default-gated` merged turned-off defaults across bearers by trait id, so a default-on racial ability read as "starts unselected" once any bearer with another race linked the Racial Abilities group. It also read the editor's world owner only, so a default Custom Persona kept under None never counted.
2. **Fixed (Q27).** `placeholder-pin-conflict` listed two Persona-marked entities' link pins on one world placeholder as rivals with a winner. Only one is played at a time and each wins in its own text.
3. **Open.** The pin rules in `rules.ts` build their `PinEditorWorld` without `customPersona`, so Custom Persona's link pin values are outside `placeholder-pin-broken`, `placeholder-pin-unknown-value` and `placeholder-pin-conflict`. `trait-link-pin-no-value` and `trait-bearer-pin-unknown-name` read the bearer resolver and do cover it.
4. **Open, authoring note.** A single-trait link starts with no default-on, so a cast entity that links Cleric alone is not a Cleric until the link's **This Link** default is checked. Hesk and Corvin carry `defaults` on each link. The editor's link flyout could default a single-trait link on.
5. **Authoring, no gap.** Every race's default must be kept by some persona choice or the default-gated rule fires honestly. Albus keeps Human, Sylvie Elf, Wanderer Dwarf and Custom Persona Halfling.
6. **Open.** The Enter World persona picker resolves an unpicked persona-only entity's text with the player's pins, so Wanderer's card reads Custom Persona's default garb (halfling rogue) rather than its own link defaults (dwarf wizard). Albus and Sylvie read right because a cast entity's own pins lay on top in its text. Seen in the preview on 2026-09-28.

**2026-09-28, Blueprints pass (Q29–Q31).** Status of the gaps above:

- **#3 resolved.** `pinEditorWorld` reads every entity, so the pin rules cover the Custom Persona entity.
- **#4 still open.** A single-trait link reads the original's default live, so Hesk's Darkvision starts on with no override, but her Cleric link still needs one.
- **#5 updated.** The race defaults are now kept by Albus, Sylvie, Wanderer and Hesk's Darkvision link.
- **#6 moot for Emberwatch.** Wanderer is the Custom Persona entity, not a persona-only card. UNVERIFIED for other worlds with an unpicked persona-only entity.
