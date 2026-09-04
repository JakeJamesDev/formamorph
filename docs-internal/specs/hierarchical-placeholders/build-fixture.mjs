// Writes the Saltmarsh Reach fixture world: a torture test for hierarchical placeholders — ownership,
// shared rows, per-row draw weights, and a corner of deliberately broken references. Run with
// `node .scratch/hierarchical-placeholders/build-fixture.mjs`; import the JSON it writes through the
// library's Import World button.
//
// What is in here on purpose, and what each thing is for:
//
//   Ownership      Molly is a Wildcard of three variants, each *owned* by her, and each owning its own
//                  Hair. Three placeholders read `Hair` in the tree and `Molly › Northern › Hair` away
//                  from it — the naming the flat list used to force into prose.
//   Sharing        One `Eye Color` pool of ten, held by all three variants. The top-level row says
//                  "Used by 3"; each variant's row carries the link icon.
//   Overrides      Northern never rolls two of those ten and Fen-Born never rolls a third, each set on
//                  its own row, none of it touching the original. Harl drunk never murmurs.
//   Nested         `Lean Build` is a shared Object held by two variants. Its panel shows no weight
//                  column (an Object never draws), and Northern still benches a Height one level under
//                  it — an override on a row inside a shared row.
//   Broken corner  Every Test Bench placeholder rule has something here to find, the three ownership
//                  and sharing rules included. Nothing outside that corner should raise anything.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let seq = 0;
/** A chip pointing at `id`. Placement ids are stable and readable so the JSON stays diffable. */
const chip = (id) => `{{ph:${id}:world:pl-${id}-${++seq}}}`;
/** A chip that rolls per placement rather than sharing the world's one roll. */
const unique = (id) => `{{ph:${id}:unique:uq-${id}-${++seq}}}`;
/** A chip drilled by slot name — routed through whichever value the level rolls. */
const slot = (id, ...names) => `{{ph:${id}:world:pl-${id}-${++seq}:${names.map((n) => `s${n}`).join('>')}}}`;
/** A chip drilled by explicit pick — names one branch by target id and always takes it. */
const pick = (id, ...refs) => `{{ph:${id}:world:pl-${id}-${++seq}:${refs.map((r) => `v${r}`).join('>')}}}`;

/**
 * Value ids read as `<placeholder>-v<n>`, so a weight map or an override key is legible in the diff. The
 * app mints UUIDs; only the separator matters, and an override key joins on `/`, which these never carry.
 */
const values = (id, texts) => texts.map((text, i) => ({ id: `${id}-v${i + 1}`, text }));
/** The id of a placeholder's nth value (1-based) — what a weight map and an override key are written against. */
const v = (id, n) => `${id}-v${n}`;

/** A Wildcard: one value drawn per playthrough. */
const W = (id, name, texts, extra = {}) => ({ id, name, values: values(id, texts), roll: true, ...extra });
/** An Object: the whole placement joins every value with ", ". */
const O = (id, name, texts, extra = {}) => ({ id, name, values: values(id, texts), roll: false, ...extra });
/** Owned by `ownerId` — private to it, hidden from the palette, reached by drilling into its owner. */
const owned = (ownerId) => ({ ownerId });

// The ten shades every character draws from. Nobody copies this list; they share it and bench what does
// not suit them.
const EYES = [
  'pale grey', 'ice blue', 'dark amber', 'near-black', 'moss green',
  'hazel', 'storm blue', 'copper-brown', 'sea green', 'washed-out blue',
];

const placeholders = [
  // ── Molly: one character, four levels deep, built entirely out of owned and shared rows ────────────────
  W('molly', 'Molly', [chip('north'), chip('south'), chip('fen')]),

  // Each variant is Molly's own. The name is just "Northern" now — the tree's indent says whose.
  O('north', 'Northern', [
    chip('hair-north'), chip('eyes'), chip('build-lean'), chip('freckles'),
  ], {
    ...owned('molly'),
    // Northern's own odds on two shared rows. The first benches two of the ten shades; the second reaches
    // one level under a shared Object, so its key names the row's chip value *and* the step below it.
    sharedWeights: {
      [v('north', 2)]: { [v('eyes', 3)]: 0, [v('eyes', 8)]: 0 },
      [`${v('north', 3)}/height-lean`]: { [v('height-lean', 2)]: 0 },
    },
  }),
  O('south', 'Southern', [chip('hair-south'), chip('eyes'), chip('build-broad')], owned('molly')),
  O('fen', 'Fen-Born', [
    chip('hair-fen'), chip('eyes'), chip('build-lean'), 'webbing between her fingers',
  ], {
    ...owned('molly'),
    // A different bench on the same shared pool, to prove two rows of one original hold their own odds.
    sharedWeights: { [v('fen', 2)]: { [v('eyes', 2)]: 0, [v('eyes', 7)]: 0 } },
  }),

  // Three placeholders named `Hair`, one per variant and each owned by it. In the tree they read `Hair`;
  // in a location description or a Bench finding they read `Molly › Northern › Hair`.
  W('hair-north', 'Hair', ['ash-blonde', 'flaxen', 'near-white'], owned('north')),
  W('hair-south', 'Hair', ['jet black', 'raven-dark', 'coal-dark'], owned('south')),
  W('hair-fen', 'Hair', ['peat-brown', 'reed-gold'], owned('fen')),

  // The shared pool itself. Top level, so the list says "Used by 3" and every variant's row links here.
  W('eyes', 'Eye Color', EYES),

  // A shared Object: applies every value and never draws, so its panel shows no weight column and says
  // why. Held by Northern and Fen-Born; Southern has a broad build of her own.
  O('build-lean', 'Build', [chip('height-lean'), chip('frame-lean')]),
  W('height-lean', 'Height', ['tall', 'rangy', 'long-limbed'], owned('build-lean')),
  W('frame-lean', 'Frame', ['lean', 'wiry'], owned('build-lean')),

  O('build-broad', 'Build', [chip('height-short'), chip('frame-broad')], owned('south')),
  W('height-short', 'Height', ['short', 'compact'], owned('build-broad')),
  W('frame-broad', 'Frame', ['broad', 'heavy-shouldered'], owned('build-broad')),

  // Carried by the Northern variant only, so `Molly › Freckles` is a PARTIAL slot: two rolls in three land
  // somewhere with no Freckles and resolve to nothing. The drill picker marks it.
  W('freckles', 'Freckles', ['a scattering of freckles', 'sun-freckled cheeks'], owned('north')),

  // ── A second character, to prove two structured people do not bleed into each other ─────────────────────
  W('harl', 'Harl', [chip('harl-sober'), chip('harl-drunk')]),
  O('harl-sober', 'Sober', [chip('harl-voice'), 'hands that never stop moving'], owned('harl')),
  O('harl-drunk', 'Drunk', [chip('harl-voice'), 'a list to starboard'], {
    ...owned('harl'),
    // Drunk Harl never manages the confiding murmur. Sober Harl still can.
    sharedWeights: { [v('harl-drunk', 1)]: { [v('harl-voice', 3)]: 0 } },
  }),
  // One placeholder shared by both variants: whichever way Harl rolls, his voice is the same draw.
  W('harl-voice', 'Voice', ['a wet rasp', 'a bellow', 'a confiding murmur']),

  // ── World values: names and attributes for places ───────────────────────────────────────────────────────
  // Weighted on the placeholder's own map, not on a row: Sedge Landing comes up about half the time.
  W('town', 'Town Name', ['Sedge Landing', 'Harrow', 'Bellmoor', 'Wick'], {
    weights: { [v('town', 1)]: 4, [v('town', 2)]: 2, [v('town', 3)]: 1, [v('town', 4)]: 1 },
  }),

  // An Object joins its values with ", ", so an Object CANNOT compose "The Drowned Hare". A composed name
  // is one Variable value with chips inside it — worth comparing against the Object below.
  W('tavern', 'Tavern Name', [`The ${chip('tavern-adj')} ${chip('tavern-noun')}`]),
  W('tavern-adj', 'Tavern Adjective', ['Drowned', 'Gilded', 'Salt-Worn', 'Crooked']),
  W('tavern-noun', 'Tavern Noun', ['Hare', 'Anchor', 'Lantern', 'Sparrow']),

  // The Object form, for contrast: attributes read fine joined with ", ", names do not.
  O('market-air', 'Market Air', [chip('market-smell'), chip('market-sound')]),
  W('market-smell', 'Market Smell', ['fish guts and brine', 'wet wool', 'tar and hot rope'], owned('market-air')),
  W('market-sound', 'Market Sound', ['gulls arguing overhead', 'a hawker’s bell', 'cart wheels on wet stone'], owned('market-air')),

  // A paragraph value, so the chip row falls back to Multiline and the collapsed card summarizes.
  W('omen', 'Omen', [
    'The tide came in wrong today.\n\nIt left a line of dead crabs along the quay, all facing inland, and nobody will say what that means.',
    'A gull dropped a ring on the steps of the customs house.\n\nIt is still there. Nobody has touched it.',
  ]),

  // ── Broken on purpose: each of these raises its own Test Bench finding and nothing else ─────────────────
  W('broken-dangling', 'Broken — Dangling', [chip('deleted-on-purpose'), 'this half is fine']),
  O('broken-cycle', 'Broken — Cycle', [chip('broken-cycle-b')]),
  O('broken-cycle-b', 'Broken — Cycle B', [chip('broken-cycle')]),
  O('broken-empty', 'Broken — Empty Object', [chip('broken-void'), chip('broken-void')]),
  W('broken-void', 'Broken — No Values', []),

  // Owner reference naming a placeholder that is not here → `placeholder-owner-orphan`.
  W('broken-orphan', 'Broken — No Owner', ['it reads as top level'], owned('deleted-on-purpose')),
  // Owner is real but holds a plain value instead of a chip of this one → `placeholder-owner-dropped`.
  // The same holder shares Harl's Voice and weights a value that pool never had, which is
  // `placeholder-shared-weight-unknown-value`.
  // Its own pool to share, so the corner never turns up in the middle of Harl's "Used by 2".
  W('broken-pool', 'Broken — Pool', ['still here', 'also still here']),
  O('broken-holder', 'Broken — Holder', [chip('broken-pool'), 'nothing points at Broken — Released'], {
    sharedWeights: { [v('broken-holder', 1)]: { [v('broken-pool', 9)]: 0 } },
  }),
  W('broken-released', 'Broken — Released', ['its owner dropped it'], owned('broken-holder')),
];

const world = {
  id: 'saltmarsh-reach',
  worldOverview: {
    name: 'Saltmarsh Reach (placeholder fixture)',
    description:
      'A hierarchical-placeholder torture test. Two characters built entirely out of owned and shared ' +
      'placeholders, one eye-colour pool the whole cast draws from with its own bench per character, ' +
      'places whose names and attributes are placeholders, and a corner of deliberately broken ones.',
    author: 'fixture',
    thumbnail: null,
    bgm: null,
    systemPrompt: 'Narrate the Reach plainly. Keep to what a person standing there could see and hear.',
    use3DModel: false,
    tags: ['fixture'],
    readme:
      `## Saltmarsh Reach\n\nEverything with a name in this world is a placeholder. ` +
      `Molly is a Wildcard of three variants she **owns**; each of those owns its own Hair and ` +
      `**shares** one Eye Color pool with the other two, benching what does not suit it.\n\n` +
      `What rolled this run: ${chip('town')}, and at the quay, ${chip('tavern')}.`,
  },
  stats: [],
  statUpdates: [],
  dictionaries: [],
  traitGroups: [],

  traits: [
    {
      id: 't-northern',
      name: 'Northern Blood',
      playerDescription: 'You grew up above the frost line.',
      statChanges: [],
      playerToggle: true,
      // Pins the Wildcard to a whole variant — an Object target, picked off the list, so the pin carries
      // the value's id and survives the author re-spelling it.
      placeholderPins: [{ placeholderId: 'molly', value: chip('north'), valueId: v('molly', 1) }],
    },
    {
      id: 't-fen',
      name: 'Fen-Born',
      playerDescription: 'The marsh raised you, and it shows.',
      statChanges: [],
      playerToggle: true,
      placeholderPins: [{ placeholderId: 'molly', value: chip('fen'), valueId: v('molly', 3) }],
    },
    {
      id: 't-redhead',
      name: 'Redhead',
      playerDescription: 'A shade nobody in the Reach rolls.',
      statChanges: [],
      playerToggle: true,
      // Two pins on one trait: free text the list does not carry (deliberate — a trait may force a shade
      // nobody else rolls), and a value picked off the list, which carries its id.
      placeholderPins: [
        { placeholderId: 'hair-north', value: 'copper' },
        { placeholderId: 'eyes', value: 'pale grey', valueId: v('eyes', 1) },
      ],
    },
    {
      id: 't-homely',
      name: 'Homely',
      playerDescription: 'You know exactly one town.',
      statChanges: [],
      playerToggle: true,
      placeholderPins: [{ placeholderId: 'town', value: 'Bellmoor', valueId: v('town', 3) }],
    },
  ],

  locations: [
    {
      id: 'loc-quay',
      name: chip('town'),
      isStarting: true,
      playerDescription: `The quay at ${chip('town')}. The air is ${chip('market-air')}.`,
      aiDescription:
        `A working quay in the town of ${chip('town')}. It smells of ${slot('market-air', 'Market Smell')}. ` +
        `${chip('tavern')} sits at the landward end.`,
    },
    {
      id: 'loc-tavern',
      name: chip('tavern'),
      parentId: 'loc-quay',
      playerDescription: `Low beams, a peat fire, and ${chip('harl')} behind the bar.`,
      aiDescription: `The taproom of ${chip('tavern')}, the only inn in ${chip('town')}.`,
    },
    {
      id: 'loc-market',
      name: 'The Fish Market',
      parentId: 'loc-quay',
      playerDescription: `${chip('market-air')}, all of it at once.`,
      aiDescription: `The market square. ${chip('omen')}`,
    },
  ],

  entities: [
    {
      id: 'e-molly',
      name: 'Molly',
      // No leading article: an articled alias is its own Bench finding, and this world is not about aliases.
      aliases: [`${slot('molly', 'Hair')} Molly`],
      locations: ['loc-quay'],
      // Every reading of Molly in one place: whole, by slot, by explicit pick, and one path deeper than
      // the describe pass walks.
      playerDescription:
        `Molly is ${chip('molly')}.\n\n` +
        `Her hair is ${slot('molly', 'Hair')} and her eyes are ${slot('molly', 'Eye Color')}.\n\n` +
        `She is ${slot('molly', 'Build')} — ${slot('molly', 'Build', 'Height')} and ${slot('molly', 'Build', 'Frame')}.`,
      aiDescription:
        `${chip('molly')}. The northern one specifically would be ${pick('molly', 'north')}, ` +
        `whose hair is ${pick('molly', 'north', 'hair-north')}. ` +
        `Freckles, if she has any: ${slot('molly', 'Freckles')}.`,
    },
    {
      id: 'e-harl',
      name: 'Harl',
      locations: ['loc-tavern'],
      playerDescription: `The keeper of ${chip('tavern')}. Tonight he is ${chip('harl')}.`,
      aiDescription: `Harl speaks with ${slot('harl', 'Voice')}. Two of him: ${unique('harl')} and ${unique('harl')}.`,
    },
    {
      id: 'e-broken',
      name: 'Broken On Purpose',
      locations: ['loc-market'],
      playerDescription:
        `Dangling root: ${chip('deleted-on-purpose')}, inside ${chip('broken-dangling')}\n\n` +
        `Dangling mid-path: ${pick('molly', 'deleted-on-purpose', 'hair-north')}\n\n` +
        `Cycle: ${chip('broken-cycle')}\n\n` +
        `Empty Object: ${chip('broken-empty')}\n\n` +
        `Slot nothing carries: ${slot('molly', 'Tail')}\n\n` +
        `Stale ownership: ${chip('broken-orphan')} and ${chip('broken-released')}, held by ${chip('broken-holder')}.`,
      aiDescription: 'The corner of the world where every Test Bench rule has something to find.',
    },
  ],

  placeholders,
};

const out = join(dirname(fileURLToPath(import.meta.url)), 'saltmarsh-reach.json');
writeFileSync(out, `${JSON.stringify(world, null, 2)}\n`, 'utf8');
console.log(`wrote ${out} — ${placeholders.length} placeholders, ${world.entities.length} entities`);
