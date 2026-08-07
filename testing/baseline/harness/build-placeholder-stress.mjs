// A stress test for placeholders-in-names AND the world-session rolling model.
// Run: node build-demo-world.mjs <outfile>
//
// What it is built to break, in order of how new the code is:
//   1. Rolls opening with the world session, not at game start (every setup screen shows real names).
//   2. Trait pins masking a roll live, as boxes are ticked — including pins that rename OTHER traits,
//      locations, stats, and dictionary triggers, and competing pins where the later trait must win.
//   3. Re-entrancy: the picker's name must be the game's name. High-arity wildcards make a stray re-roll
//      obvious rather than a 1-in-2 coin flip you'd miss.
//   4. Unique vs World mode under pins: a pin is per-placeholder, so it must flatten every Unique
//      placement of that placeholder too.
import { writeFileSync } from 'node:fs';

const PH = {
  town:    'ph-town-0000-0000-0000-000000000001',
  keeper:  'ph-keep-0000-0000-0000-000000000002',
  beast:   'ph-beast-000-0000-0000-000000000003',
  hair:    'ph-hair-0000-0000-0000-000000000004',
  empty:   'ph-empty-000-0000-0000-000000000005',
  // 8 values: a stray re-roll between two screens is then obvious, not a coin flip.
  season:  'ph-seas-0000-0000-0000-000000000006',
  metal:   'ph-metal-000-0000-0000-000000000007',
  // Single value = a Variable. Never rolls, but a pin must still beat it.
  sigil:   'ph-sigil-000-0000-0000-000000000008',
};
// Deliberately not defined below — draws a red "?" pill in the editor, resolves to "" everywhere else.
const GHOST = 'ph-deleted-00-0000-0000-000000000099';

let n = 0;
/** A chip placement. World shares one roll per placeholder; Unique rolls per placement id. */
const chip = (id, mode = 'world') => `{{ph:${id}:${mode}:place-${String(++n).padStart(4, '0')}}}`;
const ghostChip = () => `{{ph:${GHOST}:world:place-ghost-${++n}}}`;

const world = {
  version: '2.9.2',
  id: 'placeholder-names-demo',
  worldOverview: {
    name: 'Placeholder Names — Stress Test',
    author: 'Formamorph',
    description:
      'Every surface that can hold a placeholder in a name, plus the trait-pin interactions the world '
      + 'session introduced. Walk the setup screens first — that is the part that changed.',
    thumbnail: null,
    bgm: null,
    use3DModel: false,
    tags: ['test'],
    customPlayerVRM: null,
    systemPrompt:
      `You are narrating a short scene in ${chip(PH.town)} during ${chip(PH.season)}. Two sentences, no more.`,
    readme:
      '# Stress test\n\n'
      + '## The setup screens are the new part\n\n'
      // No literal chip syntax in this prose: it defeats a Ctrl-F for unresolved chips.
      + 'Rolls now happen when you press **Enter World**, not when the story starts. So every screen below '
      + 'should read real names — never a braced list of options, never raw token text.\n\n'
      + '### 1. Pins that rename other things — tick these and watch\n\n'
      + '| Trait | Pins | Watch it change |\n'
      + '|---|---|---|\n'
      + '| **Redhead** | HairColor → `red` | its own description, and the Keeper\'s image tags |\n'
      + '| **Sedge Native** | Town → `Sedge` | the trait *below* it, both location names, the **stat name**, and a dictionary trigger |\n'
      + '| **Marrow Native** | Town → `Marrow` | same targets, opposite value — they are an exclusive pair, so only one can hold |\n'
      + '| **Winter Child** | Season → `Winter` | the trait-group heading and the system prompt preview |\n'
      + '| **Ironblood** | Metal → `Iron` | the Warden\'s name, and the *Unique* chips on the two strays — a pin is per-placeholder, so it must flatten both |\n\n'
      + 'Untick any of them and the **rolled** value must come back. A pin masks; it never overwrites.\n\n'
      + '### 2. Competing pins — later trait wins\n\n'
      + '**Sedge Native** and **Marrow Native** are an exclusive group, so they cannot both hold. '
      + '**Tarnished** and **Ironblood** are *not* exclusive and both pin Metal — tick both and the one '
      + 'later in authored order must win, consistently, on every surface at once.\n\n'
      + '### 3. Pin edge cases\n\n'
      + '- **Sigil Bearer** pins a **Variable** (one value). The pin must still beat it.\n'
      + '- **Offworlder** pins Town to `Ashfall` — a value **not in the placeholder\'s list**. Authoring lets you; it should just apply.\n'
      + '- **Nihilist** pins the empty-valued placeholder to `something`, so a name that resolved to nothing now resolves to something.\n'
      + '- **Hollow** pins a **deleted** placeholder. Should be inert, not a crash.\n'
      + '- **Bonded** is on by default and pins HairColor — so the very first render of the picker must '
      + 'already show the pinned value, never a rolled one that flips a frame later.\n\n'
      + '### 4. Re-roll / stickiness\n\n'
      + 'Season has 8 values and Metal has 6. Note them on the trait screen, then:\n\n'
      + '- **Back** through the steps — values must not move.\n'
      + '- **Abort** out and re-enter — they *should* re-roll (that is the design).\n'
      + '- Reach the game — the stat panel and story text must show the **same** values the pickers did.\n'
      + '- Save, exit, load — the save\'s values must come back, not fresh ones.\n\n'
      + '### 5. In play\n\n'
      + 'The four **player-toggleable** traits (Redhead, Ironblood, Tarnished, Winter Child) can be switched '
      + 'in the Traits tab mid-game. Every pinned name should follow live — stat bars included, since stat '
      + 'deltas are matched by resolved name.\n\n'
      + '### 6. Editor\n\n'
      + 'Names hold chips as coloured pills showing values; inside a field being edited the chip shows the '
      + 'placeholder **name**. `Ghost Alias` and the `Hollow` trait point at a deleted placeholder — red `?`. '
      + 'Drag from the strip at the top of the panel, or type `{`.',
  },

  placeholders: [
    { id: PH.town, name: 'Town', values: ['Sedge', 'Marrow'] },
    { id: PH.keeper, name: 'Keeper', values: ['Vera'] },
    { id: PH.beast, name: 'Beast', values: ['Wolf', 'Bear', 'Boar'], weights: { Wolf: 3, Bear: 1, Boar: 1 } },
    { id: PH.hair, name: 'HairColor', values: ['blonde', 'red', 'black'] },
    { id: PH.empty, name: 'Empty', values: [] },
    // High arity on purpose: a re-roll between two screens has to be visible, not a coin flip.
    { id: PH.season, name: 'Season', values: ['Thaw', 'Bloom', 'High Summer', 'Turning', 'Frostfall', 'Deepwinter', 'Longnight', 'Firstlight'] },
    { id: PH.metal, name: 'Metal', values: ['Iron', 'Copper', 'Silver', 'Tin', 'Brass', 'Lead'] },
    // One value = a Variable. Never rolls; a pin must still beat it.
    { id: PH.sigil, name: 'Sigil', values: ['Hawk'] },
  ],

  stats: [
    {
      // A pinned placeholder in a STAT name: the AI's deltas are matched by resolved name, so a pin
      // flipping mid-game has to move the match and the bar together.
      id: 'standing', type: 'number', starting: 50, value: 50, min: 0, max: 100, regen: 0, descriptors: [],
      name: `${chip(PH.town)} Standing`,
      description: 'Stat NAME holds a chip. Tick a Native trait and this bar must rename itself.',
    },
    {
      id: 'temper', type: 'number', starting: 40, value: 40, min: 0, max: 100, regen: 0, descriptors: [],
      name: `${chip(PH.metal)} Temper`,
      description: 'A second pinned stat name, so two pins can be seen disagreeing independently.',
    },
    { id: 'health', type: 'number', starting: 100, value: 100, min: 0, max: 100, regen: 1, descriptors: [], name: 'Health', description: 'A plain stat, for contrast.' },
  ],

  traitGroups: [
    { id: 'grp-origin', parentId: null, order: 0, exclusive: true,
      name: `${chip(PH.town)} Origins`,
      playerDescription: 'Exclusive: at most one. Both members pin Town, to opposite values.',
      aiDescription: '' },
    { id: 'grp-body', parentId: null, order: 1,
      name: `Marks of ${chip(PH.season)}`,
      playerDescription: 'A GROUP name holding a chip — pinning Season must rename this heading.',
      aiDescription: '' },
    // Nested, so a chip in a deep group heading is covered too.
    { id: 'grp-blood', parentId: 'grp-body', order: 0,
      name: `${chip(PH.metal)} Blood`,
      playerDescription: 'A nested group whose name holds a chip. Two members both pin Metal, non-exclusively.',
      aiDescription: '' },
    { id: 'grp-odd', parentId: null, order: 2,
      name: 'Edge Cases',
      playerDescription: 'Pins that are legal but strange. None of these should crash anything.',
      aiDescription: '' },
  ],

  traits: [
    // --- exclusive pair: same placeholder, opposite values ------------------------------------------
    {
      id: 'tr-sedge', groupId: 'grp-origin', order: 0,
      name: `Native of ${chip(PH.town)}`,
      playerDescription: `You grew up in ${chip(PH.town)}. Ticking this must rename the trait below, both locations, and a stat.`,
      aiDescription: 'The player is a native of Sedge.',
      statChanges: [{ statId: 'standing', value: 20, type: 'starting' }],
      placeholderPins: [{ placeholderId: PH.town, value: 'Sedge' }],
    },
    {
      // Its own name holds the placeholder the trait ABOVE pins — so picking that one renames this card.
      id: 'tr-marrow', groupId: 'grp-origin', order: 1,
      name: `Sworn to ${chip(PH.town)}`,
      playerDescription: `Your oath binds you to ${chip(PH.town)}.`,
      aiDescription: 'The player is sworn to Marrow.',
      statChanges: [{ statId: 'standing', value: 10, type: 'starting' }],
      placeholderPins: [{ placeholderId: PH.town, value: 'Marrow' }],
    },

    // --- body: pins visible in descriptions, image tags, and a group heading ------------------------
    {
      id: 'tr-redhead', groupId: 'grp-body', order: 0, playerToggle: true,
      name: 'Redhead',
      playerDescription: `Your hair is ${chip(PH.hair)}.`,
      aiDescription: 'The player has red hair.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.hair, value: 'red' }],
    },
    {
      // Default-on AND pinning: the picker's first render must already show 'brown', never a rolled
      // value that flips a frame later.
      id: 'tr-bonded', groupId: 'grp-body', order: 1, isDefault: true,
      name: 'Bonded',
      playerDescription: `A default-on pin. Hair reads ${chip(PH.hair)} before you touch anything.`,
      aiDescription: 'The player is bonded.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.hair, value: 'brown' }],
    },
    {
      id: 'tr-winter', groupId: 'grp-body', order: 2, playerToggle: true,
      name: `Child of ${chip(PH.season)}`,
      playerDescription: `Born in ${chip(PH.season)}. Pins the season that names this trait AND its group heading.`,
      aiDescription: 'The player was born in winter.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.season, value: 'Deepwinter' }],
    },

    // --- nested group: two NON-exclusive pins on the same placeholder, later must win ---------------
    {
      id: 'tr-tarnish', groupId: 'grp-blood', order: 0, playerToggle: true,
      name: `${chip(PH.metal)} Tarnished`,
      playerDescription: `Pins Metal to Copper. Tick this AND Ironblood — the later one must win everywhere at once.`,
      aiDescription: 'The player is tarnished.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.metal, value: 'Copper' }],
    },
    {
      id: 'tr-iron', groupId: 'grp-blood', order: 1, playerToggle: true,
      name: 'Ironblood',
      playerDescription: `Pins Metal to Iron. Also flattens the two strays' **Unique** chips, since a pin is per-placeholder.`,
      aiDescription: 'The player has iron in the blood.',
      statChanges: [{ statId: 'temper', value: 15, type: 'starting' }],
      placeholderPins: [{ placeholderId: PH.metal, value: 'Iron' }],
    },

    // --- edge cases --------------------------------------------------------------------------------
    {
      id: 'tr-sigil', groupId: 'grp-odd', order: 0,
      name: `Bearer of the ${chip(PH.sigil)}`,
      playerDescription: `Pins a Variable (one value). ${chip(PH.sigil)} must read Owl, not Hawk.`,
      aiDescription: 'The player bears the owl sigil.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.sigil, value: 'Owl' }],
    },
    {
      id: 'tr-offworld', groupId: 'grp-odd', order: 1,
      name: 'Offworlder',
      playerDescription: `Pins Town to a value that is not in its list. ${chip(PH.town)} should read Ashfall anyway.`,
      aiDescription: 'The player is from elsewhere.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.town, value: 'Ashfall' }],
    },
    {
      id: 'tr-nihilist', groupId: 'grp-odd', order: 2,
      name: `The ${chip(PH.empty)} Truth`,
      playerDescription: `Pins the empty placeholder, so a name that resolved to nothing now resolves to "Void".`,
      aiDescription: 'The player believes in nothing.',
      statChanges: [],
      placeholderPins: [{ placeholderId: PH.empty, value: 'Void' }],
    },
    {
      id: 'tr-hollow', groupId: 'grp-odd', order: 3,
      name: `Hollow ${ghostChip()}`,
      playerDescription: 'Pins a placeholder that no longer exists, and its own name holds one. Inert, not fatal.',
      aiDescription: 'The player is hollow.',
      statChanges: [],
      placeholderPins: [{ placeholderId: GHOST, value: 'nothing' }],
    },
    {
      // Half-filled pin rows: activePlaceholderPins skips empties, so neither may blank a placeholder.
      id: 'tr-halfpin', groupId: 'grp-odd', order: 4,
      name: 'Half-Written',
      playerDescription: `Carries two incomplete pin rows. ${chip(PH.town)} must still read its rolled value.`,
      aiDescription: 'The player is incomplete.',
      statChanges: [],
      placeholderPins: [
        { placeholderId: PH.town, value: '' },
        { placeholderId: '', value: 'Nowhere' },
      ],
    },
    { id: 'tr-plain', groupId: null, order: 5, name: 'Unremarkable', playerDescription: 'No chips, no pins — the control.', aiDescription: 'Nothing special.', statChanges: [] },
  ],

  locations: [
    {
      id: 'loc-square', isStarting: true,
      name: `${chip(PH.town)} Square`,
      playerDescription: `The market square, quiet in ${chip(PH.season)}. Tick a Native trait and this name must change with the other one.`,
      aiDescription: 'A busy market square at the centre of town.',
      aiSummary: 'The market square.',
      // Connections are names: a resolved connection must still name a location that exists — under a
      // roll AND under a pin that changes both ends at once.
      connections: [`${chip(PH.town)} Docks`, `${chip(PH.metal)} Row`],
      entities: ['ent-keeper'],
      imageTags: `outdoors, market, ${chip(PH.season)}`,
      backgroundImage: null, ambientSound: null,
    },
    {
      id: 'loc-docks', isStarting: true,
      name: `${chip(PH.town)} Docks`,
      playerDescription: 'Wet boards and rope. The second starting location, so the picker step appears.',
      aiDescription: 'A working dock.',
      aiSummary: 'The docks.',
      connections: [`${chip(PH.town)} Square`],
      entities: ['ent-warden', 'ent-stray-a', 'ent-stray-b'],
      backgroundImage: null, ambientSound: null,
    },
    {
      // Not a starting location; reachable only by a connection whose name is pinned by a trait.
      id: 'loc-row', isStarting: false,
      name: `${chip(PH.metal)} Row`,
      playerDescription: 'Reached by a connection whose name a trait can rename mid-game. It must stay reachable.',
      aiDescription: 'A street of smiths.',
      aiSummary: 'The smiths\' row.',
      connections: [`${chip(PH.town)} Square`],
      entities: [],
      backgroundImage: null, ambientSound: null,
    },
  ],

  entities: [
    {
      id: 'ent-keeper', type: 'character',
      name: `Keeper ${chip(PH.keeper)}`,
      aliases: [
        'barkeep',
        `the ${chip(PH.town)} keeper`,           // mixed text + chip, renamed by a pin
        `${chip(PH.season)} widow`,              // a second placeholder in an alias
        `friend of ${ghostChip()}`,              // deleted def -> red "?" in the editor, "" at runtime
      ],
      playerDescription: `She runs the inn on ${chip(PH.town)} Square, and has since ${chip(PH.season)}.`,
      aiDescription: 'A calm innkeeper who knows everyone.',
      aiSummary: 'The innkeeper.',
      // A chip among ordinary booru tags; the Danbooru autocomplete runs alongside the placeholder typeahead.
      imageTags: `1girl, solo, ${chip(PH.hair)} hair, apron, tavern`,
      image: null,
    },
    {
      id: 'ent-warden', type: 'character',
      name: `${chip(PH.metal)} Warden of ${chip(PH.town)}`,
      aliases: ['the warden', `${chip(PH.metal)} warden`],
      playerDescription: 'Two World chips in one name — both pinnable, independently.',
      aiDescription: 'The dock warden.',
      aiSummary: 'The warden.',
      imageTags: `1boy, armor, ${chip(PH.metal)}`,
      image: null,
    },
    {
      // Two entities, the SAME wildcard, both in Unique mode: they roll independently of each other and
      // of the World chips. A pin on Beast/Metal must still flatten every one of them.
      id: 'ent-stray-a', type: 'creature',
      name: `Stray ${chip(PH.beast, 'unique')}`,
      aliases: [`the ${chip(PH.beast, 'unique')}`],
      playerDescription: `Unique mode: rolls its own value. Its collar is ${chip(PH.metal, 'unique')}.`,
      aiDescription: 'A wary animal near the docks.',
      aiSummary: 'A stray animal.',
      image: null,
    },
    {
      id: 'ent-stray-b', type: 'creature',
      name: `Second ${chip(PH.beast, 'unique')}`,
      aliases: [`the other ${chip(PH.beast, 'unique')}`],
      playerDescription: `A different Unique roll of the same wildcard. Its collar is ${chip(PH.metal, 'unique')} — pin Metal and BOTH collars must flatten.`,
      aiDescription: 'A second wary animal.',
      aiSummary: 'Another stray.',
      image: null,
    },
    {
      // Name resolves to "" unless the Nihilist trait pins it. A nameless entity is the linter case the
      // names memo deferred — it should degrade, not crash.
      id: 'ent-nameless', type: 'object',
      name: chip(PH.empty),
      aliases: [],
      playerDescription: 'Its name resolves to nothing until the Nihilist trait pins the empty placeholder.',
      aiDescription: 'An unnamed thing.',
      aiSummary: 'A thing.',
      image: null,
    },
  ],

  dictionaries: [
    {
      id: 'book-lore', name: 'Lore', enabled: true, description: 'Entries named and triggered by chips.',
      entries: [
        {
          id: 'ent-watch', enabled: true, constant: false, position: 'before',
          name: `${chip(PH.town)} Watch`,
          // Activation matches on RESOLVED keywords, so a trait pin changes what fires.
          key: [`${chip(PH.town)} Watch`, 'watchmen'],
          secondaryKeys: [`${chip(PH.keeper)}`],
          value: 'The town watch keeps the peace, and answers to the harbour master.',
        },
        {
          id: 'ent-forge', enabled: true, constant: false, position: 'before',
          name: `${chip(PH.metal)} Forge`,
          key: [`${chip(PH.metal)} Row`, `${chip(PH.metal)} Forge`],
          value: 'The forge on the row works the metal the town is known for.',
        },
        {
          id: 'ent-empty', enabled: true, constant: false, position: 'before',
          name: `Nothing: ${chip(PH.empty)}`,
          key: ['nothing'],
          value: 'A placeholder with no values resolves to an empty string.',
        },
        {
          // Regex entries opt out of chips by design — braces are quantifiers. Kept literal on purpose.
          id: 'ent-regex', enabled: true, constant: false, position: 'before',
          name: 'Regex Control',
          key: ['/wolf|bear|boar/i'],
          value: 'A regex trigger, which deliberately does not take chips.',
        },
      ],
    },
  ],

  statUpdates: [],
};

const out = process.argv[2];
writeFileSync(out, JSON.stringify(world, null, 2), 'utf8');
console.log(`wrote ${out}`);
console.log(`placeholders: ${world.placeholders.length}, chips: ${n}, traits: ${world.traits.length}, pins: ${
  world.traits.reduce((a, t) => a + (t.placeholderPins?.length ?? 0), 0)}`);
