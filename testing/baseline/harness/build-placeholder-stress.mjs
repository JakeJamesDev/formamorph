// A stress test for placeholders-in-names AND the world-session rolling model.
// Run: node build-placeholder-stress.mjs <outfile>
//
// What it is built to break, in order of how new the code is:
//   1. Scopes: an entity and a book each OWN placeholders. Bare inside the owner's own fields,
//      `Owner.Name` everywhere else — including an owner whose own name holds a chip.
//   2. Folders over the shared list, nested, with loose rows beside them.
//   3. Pins from all four sources — a trait, a location, a stat descriptor band, a placeholder value —
//      and the precedence between them: band > location > trait > value.
//   4. Chips in stat `description` and in every descriptor band's text.
//   5. Structural children (a value that is one chip) so the Roll field paints a span per producer, and
//      a shared row carrying draw weights of its own.
//   6. Rolls opening with the world session, not at game start (every setup screen shows real names).
//   7. Re-entrancy: the picker's name must be the game's name. High-arity wildcards make a stray re-roll
//      obvious rather than a 1-in-2 coin flip you'd miss.
//   8. Unique vs World mode under pins: a pin is per-placeholder, so it must flatten every Unique
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
  // Owned by Beast: Beast's first value is exactly this chip, so it is a structural child (`Beast › Wolf`).
  wolf:    'ph-wolf-0000-0000-0000-000000000009',
  // Holds Metal as a SHARED row and weights it differently there — the row's own map, not the original's.
  collar:  'ph-collar-00-0000-0000-000000000010',
  // Values hold newlines, so its panel opens in the multiline editor.
  omen:    'ph-omen-0000-0000-0000-000000000011',
  // An Object: every value applies at once, so both of its value pins are in force together.
  kit:     'ph-kit-00000-0000-0000-000000000012',
  // Scoped to the Keeper — reads `Keeper Vera.Mood` away from her, bare `Mood` in her own fields.
  mood:    'ph-mood-0000-0000-0000-000000000013',
  eyes:    'ph-eyes-0000-0000-0000-000000000014',
  // Scoped to the Lore book.
  rumor:   'ph-rumor-000-0000-0000-000000000015',
};
// Deliberately not defined below — draws a red "?" pill in the editor, resolves to "" everywhere else.
const GHOST = 'ph-deleted-00-0000-0000-000000000099';

let n = 0;
/** A chip placement. World shares one roll per placeholder; Unique rolls per placement id. */
const chip = (id, mode = 'world') => `{{ph:${id}:${mode}:place-${String(++n).padStart(4, '0')}}}`;
const ghostChip = () => `{{ph:${GHOST}:world:place-ghost-${++n}}}`;

/** Value records with readable ids, so a pin, a weight or a shared-row override can name one by hand. */
const vals = (slug, texts) => texts.map((text) => ({
  id: `v-${slug}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'}`,
  text,
}));
/** One value record with an id you choose — for a value whose text is a chip, or holds newlines. */
const val = (id, text, extra = {}) => ({ id, text, ...extra });
/** A pin, spelled the way every editor writes one: by value id where the list carries it. */
const pinTo = (placeholderId, value, valueId) => ({ placeholderId, value, ...(valueId ? { valueId } : {}) });

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
      + '## Scopes, folders and the other three pin sources\n\n'
      + 'Open the **Placeholders** tab in Advanced mode. It draws one tree over every list the world keeps.\n\n'
      + '### 1. Folders and owners\n\n'
      + '- **The World**, **People** and the nested **People › Body** are folders over the *shared* list. '
      + 'Drag a shared row into one, drag it back out. `Empty`, `Sigil`, `Kit` and `Omen` sit loose beneath them.\n'
      + '- Under the folders sit the **owner nodes** — one for the Keeper, one for the Lore book. Those rows '
      + 'are read off the entity and the book: they cannot be renamed, deleted or dragged.\n'
      + '- `Mood` and `Eyes` belong to the Keeper; `Rumor` belongs to Lore. Inside their owner\'s own fields '
      + 'they read bare. Anywhere else they carry the owner\'s name — and the Keeper\'s name holds a chip '
      + 'itself, so the prefix has to resolve too.\n'
      + '- Drag `Eyes` to the top of the list to share it with the world, then drag it back onto the Keeper. '
      + 'The id is kept both ways, so nothing placed anywhere has to re-aim.\n'
      + '- The Keeper\'s panel and the Lore book\'s panel each carry the same Placeholders section, bound to '
      + 'their own list.\n\n'
      + '### 2. Structural children and a shared row\n\n'
      + '- `Beast`\'s first value is *one chip* of `Wolf`, so Wolf is a **child**: it sits under Beast on the '
      + 'tab, and a chip can address `Beast › Wolf`.\n'
      + '- Press **Roll** on Beast a few times. Each run one of the value\'s own chips produced is tinted in '
      + 'that placeholder\'s colour with its name in the tip; the literal `Bear` and `Boar` stay plain.\n'
      + '- `Collar` holds `Metal` as a **shared row**. Open Collar, then the Metal row beneath it: the name, '
      + 'the kind and the values are locked — they are the original\'s — while the weights are Collar\'s own. '
      + '`Lead` is benched there and nowhere else.\n\n'
      + '### 3. The four pin sources, and who wins\n\n'
      + 'Precedence is **stat band > location > trait > value pin**. Every one of them claims `Metal`:\n\n'
      + '| Source | Where | Pins Metal to |\n'
      + '|---|---|---|\n'
      + '| Stat band | `Temper` under 30 | `Tin` |\n'
      + '| Location | Standing on **Metal Row** | `Silver` |\n'
      + '| Trait | **Ironblood** / **Tarnished** | `Iron` / `Copper` |\n'
      + '| Value | `Season` rolling `Deepwinter` | `Iron` |\n\n'
      + 'Open `Metal` and read its **Placeholder Pins** section: every one of those rows, strongest first, '
      + 'each naming the trait, location, band or value it lives on. Change a value there, re-aim a row at '
      + 'another source of the same kind, or remove it — the write lands on the source, not on Metal.\n\n'
      + '- **Chains.** `Season` rolling `Frostfall` pins `Town` to `Marrow`. Value pins settle to a fixed '
      + 'point, so one roll can move three placeholders.\n'
      + '- **An Object holds every value at once.** `Kit` is an Object, so *both* of its value pins are in '
      + 'force together and the conflict note must not call them rivals that cannot meet.\n'
      + '- **Multiline values pin too.** `Omen`\'s values hold newlines, so its panel opens in the multiline '
      + 'editor. Each card carries the same pin button the chip row has.\n\n'
      + '### 4. Chips in stat text\n\n'
      + '`{Town} Standing` and `{Metal} Temper` hold chips in their **name**, their **description** and every '
      + '**descriptor band**. Move Temper across 30 and the band text and its pin flip together.\n\n'
      + '### 5. What the Test Bench should say\n\n'
      + '- `Sigil`\'s one value pins **its own placeholder** — an error, with a Fix that removes the pin.\n'
      + '- **Faded** pins a HairColor value id that is gone — a warning, with a Fix that re-links by text.\n'
      + '- **Hollow** pins a deleted placeholder — a broken-pin error.\n'
      + '- Metal is pinned by four sources at once — an info row naming them and the winner.\n\n'
      + '### 6. Export and back\n\n'
      + 'Export the Keeper as a character card and import it into a fresh world. Her `Mood` and `Eyes` come '
      + 'back as hers under new ids, `Mood`\'s pin at `Season` re-aims at whatever the new world matched, and '
      + '`Season` rides along in the card even though no chip of hers places it — only the pin reaches it.\n\n'
      + '## The setup screens are the older part\n\n'
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

  // Folders over the SHARED list only. A scoped placeholder sits under its owner and cannot join one.
  placeholderGroups: [
    { id: 'phg-world', name: 'The World', parentId: null, order: 0 },
    { id: 'phg-people', name: 'People', parentId: null, order: 1 },
    // Nested, so the palette heading reads `People › Body`.
    { id: 'phg-body', name: 'Body', parentId: 'phg-people', order: 0 },
  ],

  placeholders: [
    { id: PH.town, name: 'Town', groupId: 'phg-world', values: vals('town', ['Sedge', 'Marrow']) },
    { id: PH.keeper, name: 'Keeper', groupId: 'phg-people', values: vals('keeper', ['Vera']) },
    {
      // Its first value is exactly one chip, so Wolf is a structural child: `Beast › Wolf`, and the Roll
      // field paints that branch in Wolf's own colour while `Bear` stays plain.
      id: PH.beast, name: 'Beast', groupId: 'phg-world',
      values: [val('v-beast-wolf', chip(PH.wolf)), ...vals('beast', ['Bear', 'Boar'])],
      weights: { 'v-beast-wolf': 3, 'v-beast-bear': 1, 'v-beast-boar': 1 },
    },
    // Owned by Beast: private to it, drawn beneath it on the tab, and offered only where Beast is.
    { id: PH.wolf, name: 'Wolf', ownerId: PH.beast, values: vals('wolf', ['grey wolf', 'black wolf']) },
    { id: PH.hair, name: 'HairColor', groupId: 'phg-body', values: vals('hair', ['blonde', 'red', 'black']) },
    { id: PH.empty, name: 'Empty', values: [] },
    // High arity on purpose: a re-roll between two screens has to be visible, not a coin flip. Two of its
    // values pin — the value source, and the only one that chains: Frostfall pins Town, whose own value
    // then pins the Keeper, so one roll settles three placeholders.
    {
      id: PH.season, name: 'Season', groupId: 'phg-world',
      values: [
        ...vals('season', ['Thaw', 'Bloom', 'High Summer', 'Turning']),
        val('v-season-frostfall', 'Frostfall', { pins: [pinTo(PH.town, 'Marrow', 'v-town-marrow')] }),
        val('v-season-deepwinter', 'Deepwinter', { pins: [pinTo(PH.metal, 'Iron', 'v-metal-iron')] }),
        ...vals('season', ['Longnight', 'Firstlight']),
      ],
    },
    { id: PH.metal, name: 'Metal', groupId: 'phg-world', values: vals('metal', ['Iron', 'Copper', 'Silver', 'Tin', 'Brass', 'Lead']) },
    {
      // One value = a Variable. Never rolls; a pin must still beat it. Its own value pins ITSELF, which is
      // the one thing a value pin may not do — the Bench's `placeholder-pin-self` error, with a Fix.
      id: PH.sigil, name: 'Sigil',
      values: [val('v-sigil-hawk', 'Hawk', { pins: [pinTo(PH.sigil, 'Owl')] })],
    },
    {
      // Holds Metal as a SHARED row (no ownerId — Metal stays the world's), and benches Lead there alone.
      // Open the Collar row, click into Metal beneath it: name, kind and values are locked, weights are not.
      id: PH.collar, name: 'Collar', groupId: 'phg-world',
      values: [val('v-collar-metal', chip(PH.metal)), ...vals('collar', ['rope', 'nothing'])],
      sharedWeights: { 'v-collar-metal': { 'v-metal-lead': 0 } },
    },
    {
      // Values hold newlines, so this panel opens in the multiline editor — where each card now carries the
      // same pin button the chip row has.
      id: PH.omen, name: 'Omen',
      values: [
        val('v-omen-birds', 'Birds turn back over the water.\n\nNobody says what that means, but the nets stay in.',
          { pins: [pinTo(PH.beast, 'Boar', 'v-beast-boar')] }),
        val('v-omen-salt', 'Salt crusts the door frames by morning.\n\nThe smiths call it a good week for iron.'),
      ],
    },
    {
      // An Object: every value applies at once, so BOTH value pins hold together and neither excludes the
      // other. The conflict note has to say so rather than calling them rivals that cannot meet.
      id: PH.kit, name: 'Kit', roll: false,
      values: [
        val('v-kit-knife', 'a knife', { pins: [pinTo(PH.metal, 'Steel')] }),
        val('v-kit-rope', 'a coil of rope', { pins: [pinTo(PH.hair, 'black', 'v-hair-black')] }),
      ],
    },
  ],

  stats: [
    {
      // A pinned placeholder in a STAT name: the AI's deltas are matched by resolved name, so a pin
      // flipping mid-game has to move the match and the bar together. Its `description` and every band's
      // text hold chips too — both are chip fields now, and both reach the AI.
      id: 'standing', type: 'number', starting: 50, value: 50, min: 0, max: 100, regen: 0,
      name: `${chip(PH.town)} Standing`,
      description: `How ${chip(PH.town)} sees you. Stat NAME and description both hold chips.`,
      descriptors: [
        { id: 'standing-low', threshold: 30, description: `A stranger in ${chip(PH.town)}.` },
        { id: 'standing-mid', threshold: 70, description: `Known by sight in ${chip(PH.town)}.` },
        { id: 'standing-high', threshold: 100, description: `${chip(PH.town)} counts you its own.` },
      ],
    },
    {
      id: 'temper', type: 'number', starting: 40, value: 40, min: 0, max: 100, regen: 0,
      name: `${chip(PH.metal)} Temper`,
      description: `A second pinned stat name, so two pins can be seen disagreeing independently. Reads as ${chip(PH.metal)}.`,
      descriptors: [
        {
          // The strongest source there is: a band outranks a location, a location a trait, a trait a value
          // pin. Drop Temper under 30 and Metal must read Tin whatever else claims it.
          id: 'temper-low', threshold: 30, description: `Brittle as ${chip(PH.metal)}.`,
          placeholderPins: [pinTo(PH.metal, 'Tin', 'v-metal-tin')],
        },
        { id: 'temper-mid', threshold: 70, description: `Worked, but not yet ${chip(PH.metal)}.` },
        { id: 'temper-high', threshold: 100, description: `Tempered ${chip(PH.metal)}.` },
      ],
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
    {
      // Names a value id HairColor no longer carries — what deleting a value leaves behind. The Bench's
      // `placeholder-pin-unknown-value` warning reports it, and its Fix re-links by text.
      id: 'tr-stale', groupId: 'grp-odd', order: 5, playerToggle: true,
      name: 'Faded',
      playerDescription: `Its pin names a value that is gone, so ${chip(PH.hair)} falls back to the text as written.`,
      aiDescription: 'The player is faded.',
      statChanges: [],
      placeholderPins: [pinTo(PH.hair, 'blonde', 'v-hair-DELETED')],
    },
    { id: 'tr-plain', groupId: null, order: 6, name: 'Unremarkable', playerDescription: 'No chips, no pins — the control.', aiDescription: 'Nothing special.', statChanges: [] },
  ],

  locations: [
    {
      id: 'loc-square', isStarting: true,
      name: `${chip(PH.town)} Square`,
      // Chips at the Keeper's OWN placeholders, read from a field that is not hers: these must show her
      // name as a prefix here and read bare on her own panel.
      playerDescription: `The market square, quiet in ${chip(PH.season)}. Tick a Native trait and this name must change with the other one. The innkeeper crosses it ${chip(PH.mood)}.`,
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
      playerDescription: `Wet boards and rope. The second starting location, so the picker step appears. While you stand here the strays read as ${chip(PH.beast)}.`,
      aiDescription: 'A working dock.',
      aiSummary: 'The docks.',
      connections: [`${chip(PH.town)} Square`],
      entities: ['ent-warden', 'ent-stray-a', 'ent-stray-b'],
      // A LOCATION pin: held while you stand here, released the moment you leave. It outranks every trait.
      placeholderPins: [pinTo(PH.beast, 'Boar', 'v-beast-boar')],
      backgroundImage: null, ambientSound: null,
    },
    {
      // Not a starting location; reachable only by a connection whose name is pinned by a trait.
      id: 'loc-row', isStarting: false,
      name: `${chip(PH.metal)} Row`,
      playerDescription: `Reached by a connection whose name a trait can rename mid-game. It must stay reachable. Standing here pins ${chip(PH.metal)} over any trait.\n\n${chip(PH.omen)}`,
      aiDescription: 'A street of smiths.',
      aiSummary: 'The smiths\' row.',
      connections: [`${chip(PH.town)} Square`],
      entities: [],
      // Competes with Ironblood and Tarnished on Metal — and loses to the Temper band under 30.
      placeholderPins: [pinTo(PH.metal, 'Silver', 'v-metal-silver')],
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
      // Inside her own fields her scoped placeholders read bare — `Mood`, `Eyes`. The palette offers them
      // first, and the `{` menu lists them under her name.
      playerDescription: `She runs the inn on ${chip(PH.town)} Square, and has since ${chip(PH.season)}. Tonight she is ${chip(PH.mood)}, ${chip(PH.eyes)} over the counter.`,
      aiDescription: `A calm innkeeper who knows everyone. Her manner reads ${chip(PH.mood)}.`,
      aiSummary: 'The innkeeper.',
      // A chip among ordinary booru tags; the Danbooru autocomplete runs alongside the placeholder typeahead.
      imageTags: `1girl, solo, ${chip(PH.hair)} hair, ${chip(PH.eyes)}, apron, tavern`,
      image: null,
      // SCOPED: hers, not the world's. Her own name holds a chip, so the `Keeper Vera.Mood` prefix a
      // stranger's field shows is itself resolved — the hardest case the naming rules have.
      placeholders: [
        {
          id: PH.mood, name: 'Mood',
          // A scoped value pinning a SHARED one: her mood decides the weather she is described under.
          values: [
            val('v-mood-warm', 'warm', { pins: [pinTo(PH.season, 'Bloom', 'v-season-bloom')] }),
            ...vals('mood', ['wary', 'brisk']),
          ],
        },
        { id: PH.eyes, name: 'Eyes', values: vals('eyes', ['grey-eyed', 'green-eyed', 'amber-eyed']) },
      ],
    },
    {
      id: 'ent-warden', type: 'character',
      name: `${chip(PH.metal)} Warden of ${chip(PH.town)}`,
      aliases: ['the warden', `${chip(PH.metal)} warden`],
      // The Kit chip is an OBJECT: its whole placement joins every value, and both of its value pins are
      // in force at once because an Object holds them all.
      playerDescription: `Two World chips in one name — both pinnable, independently. He carries ${chip(PH.kit)}.`,
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
      playerDescription: `Unique mode: rolls its own value. Its collar is ${chip(PH.collar)}, the ${chip(PH.metal, 'unique')} kind.`,
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
      id: 'book-lore', name: 'Lore', enabled: true, description: `Entries named and triggered by chips. This week the talk is ${chip(PH.rumor)}.`,
      // A BOOK owns placeholders too. Bare inside its own entries, `Lore.Rumor` anywhere else.
      placeholders: [
        { id: PH.rumor, name: 'Rumor', values: vals('rumor', ['a wreck on the bar', 'a debt called in', 'a stranger asking after the keeper']) },
      ],
      entries: [
        {
          id: 'ent-watch', enabled: true, constant: false, position: 'before',
          name: `${chip(PH.town)} Watch`,
          // Activation matches on RESOLVED keywords, so a trait pin changes what fires.
          key: [`${chip(PH.town)} Watch`, 'watchmen'],
          secondaryKeys: [`${chip(PH.keeper)}`],
          value: `The town watch keeps the peace, and answers to the harbour master. The talk on the quay is ${chip(PH.rumor)}.`,
        },
        {
          id: 'ent-forge', enabled: true, constant: false, position: 'before',
          name: `${chip(PH.metal)} Forge`,
          key: [`${chip(PH.metal)} Row`, `${chip(PH.metal)} Forge`],
          // A chip at another owner's placeholder, read from inside this book: `Keeper Vera.Mood`.
          value: `The forge on the row works the metal the town is known for. The keeper sends apprentices over when she is ${chip(PH.mood)}.`,
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
const scoped = [...world.entities, ...world.dictionaries].flatMap((o) => o.placeholders ?? []);
const count = (list) => list.reduce((a, x) => a + (x.placeholderPins?.length ?? 0), 0);
const valuePins = [...world.placeholders, ...scoped]
  .reduce((a, p) => a + (p.values ?? []).reduce((b, v) => b + (v.pins?.length ?? 0), 0), 0);
console.log(`placeholders: ${world.placeholders.length} shared + ${scoped.length} scoped, folders: ${
  world.placeholderGroups.length}, chips: ${n}, traits: ${world.traits.length}`);
console.log(`pins — trait: ${count(world.traits)}, location: ${count(world.locations)}, descriptor: ${
  world.stats.reduce((a, s) => a + count(s.descriptors ?? []), 0)}, value: ${valuePins}`);
