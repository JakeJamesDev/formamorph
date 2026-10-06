// Writes a large fake world with real, decodable PNG images for World Editor profiling.
// Usage: node testing/editor-speed/genLargeWorld.mjs [--entities 400] [--locations 300] [--hub 150]
//        [--image 256] [--bg-every 4] [--traits 120] [--entries 600] [--pins 1] [--source-pins 200] [--out <path>]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []),
);
const num = (key, fallback) => (args[key] === undefined ? fallback : Number(args[key]));
const cfg = {
  entities: num('entities', 400),
  locations: num('locations', 300),
  hub: num('hub', 150), // children under one parent: the canvas's sibling-pair worst case
  image: num('image', 256), // noise PNG side; 256 ≈ 260 KB of base64, like the authored worlds' JPEGs
  bgEvery: num('bg-every', 4), // every Nth location gets a background image
  traits: num('traits', 120),
  entries: num('entries', 600),
  pins: num('pins', 0) > 0, // adds the pin load: one placeholder pinned from everywhere, sources pinning many
  sourcePins: num('source-pins', 200), // pins on each heavy source
};
const out = args.out ?? join(here, '.out', `large-world-${cfg.entities}e-${cfg.locations}l${cfg.pins ? '-pins' : ''}.json`);
const { version } = JSON.parse(readFileSync(join(here, '../../package.json'), 'utf8'));

// Seeded so two runs with the same flags write the same file.
let seed = 0x2f6e2b1;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (list) => list[Math.floor(rand() * list.length)];
const id = (prefix, n) => `${prefix}-${String(n).padStart(5, '0')}`;

const WORDS = 'amber harbor lantern quiet market ember stone river hollow vigil copper fen gate tide orchard bell ash meadow keep salt mist forge reed signal'.split(' ');
const sentence = (n) => Array.from({ length: n }, () => pick(WORDS)).join(' ');
const paragraph = (sentences) => Array.from({ length: sentences }, () => `${sentence(8 + Math.floor(rand() * 10))}.`).join(' ');

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

// Noise does not compress, so the byte size tracks the side length the way a photo's would.
function noisePng(side) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(side, 0);
  ihdr.writeUInt32BE(side, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((side * 3 + 1) * side);
  for (let i = 0; i < raw.length; i++) raw[i] = i % (side * 3 + 1) === 0 ? 0 : (rand() * 256) | 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

// Hub children first, then the rest nested a few levels deep under earlier locations.
const locations = [{ id: id('loc', 0), name: 'The Hub', isStarting: true, parentId: null, playerDescription: paragraph(2), aiDescription: paragraph(4) }];
for (let i = 1; i < cfg.locations; i++) {
  const parentId = i <= cfg.hub ? locations[0].id : locations[1 + Math.floor(rand() * Math.min(i - 1, 40))]?.id ?? null;
  locations.push({
    id: id('loc', i),
    name: `${pick(WORDS)} ${pick(WORDS)} ${i}`,
    parentId,
    playerDescription: paragraph(2),
    aiDescription: paragraph(4),
    ...(i % cfg.bgEvery === 0 ? { backgroundImage: noisePng(cfg.image) } : {}),
  });
}

const connections = Array.from({ length: Math.floor(cfg.locations / 3) }, (_, i) => ({
  id: id('conn', i),
  a: pick(locations).id,
  b: pick(locations).id,
  aToB: {},
  bToA: {},
})).filter((c) => c.a !== c.b);

const entityGroups = Array.from({ length: 12 }, (_, i) => ({ id: id('egrp', i), name: `Group ${i}`, parentId: i < 4 ? null : id('egrp', i % 4), order: i }));
const entities = Array.from({ length: cfg.entities }, (_, i) => ({
  id: id('ent', i),
  name: `${pick(WORDS)} ${pick(WORDS)} ${i}`,
  type: 'Character',
  playerDescription: paragraph(2),
  aiDescription: paragraph(6),
  images: [noisePng(cfg.image)],
  locations: [pick(locations).id],
  groupId: rand() < 0.7 ? pick(entityGroups).id : null,
  order: i,
}));

const traitGroups = Array.from({ length: 8 }, (_, i) => ({ id: id('tgrp', i), name: `Path ${i}`, playerDescription: '', aiDescription: '', parentId: null, order: i }));
const traits = Array.from({ length: cfg.traits }, (_, i) => ({
  id: id('trait', i),
  name: `${pick(WORDS)} ${i}`,
  statChanges: [],
  playerDescription: paragraph(1),
  aiDescription: paragraph(2),
  groupId: pick(traitGroups).id,
  order: i,
}));

const dictionaries = [0, 1, 2].map((b) => ({
  id: id('dict', b),
  name: `Book ${b}`,
  enabled: true,
  entries: Array.from({ length: Math.ceil(cfg.entries / 3) }, (_, i) => ({
    id: id(`entry${b}`, i),
    name: `${pick(WORDS)} ${i}`,
    key: [pick(WORDS), `${pick(WORDS)} ${i}`],
    value: paragraph(3),
  })),
}));

const world = {
  formamorphKind: 'world',
  version,
  worldOverview: {
    name: `Large Bench World (${cfg.entities}e ${cfg.locations}l)`,
    description: 'Generated for World Editor profiling.',
    author: 'genLargeWorld',
    thumbnail: noisePng(cfg.image * 2),
    bgm: null,
    systemPrompt: paragraph(6),
    use3DModel: false,
    tags: ['Bench'],
    readme: paragraph(3),
  },
  stats: Array.from({ length: 10 }, (_, i) => ({ id: id('stat', i), name: `Stat ${i}`, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] })),
  locations,
  connections,
  entities,
  entityGroups,
  traits,
  traitGroups,
  statUpdates: [],
  dictionaries,
  placeholders: [],
};

// Pins use no `rand`, so the rest of the world is byte-identical with and without them.
if (cfg.pins) {
  const valuesOf = (key, n) => Array.from({ length: n }, (_, v) => ({ id: `${key}-v${v}`, text: `${key} value ${v}` }));
  const pin = (placeholder, v) => ({ placeholderId: placeholder.id, value: placeholder.values[v].text, valueId: placeholder.values[v].id });

  // Inbound: "Mood" is pinned by every trait, every other location, every stat band and 60 placeholders' values.
  const mood = { id: 'ph-mood', name: 'Mood', values: valuesOf('mood', 12), roll: true };
  for (const [i, t] of traits.entries()) t.placeholderPins = [pin(mood, i % 12)];
  for (const [i, l] of locations.entries()) if (i % 2 === 1) l.placeholderPins = [pin(mood, i % 12)];
  for (const s of world.stats) {
    s.descriptors = [0, 25, 50, 75].map((threshold, b) => ({ id: `${s.id}-band${b}`, threshold, description: `band ${b}`, placeholderPins: [pin(mood, b)] }));
  }
  const pinners = Array.from({ length: 60 }, (_, i) => {
    const key = `pinner${i}`;
    return { id: `ph-${key}`, name: `Pinner ${i}`, roll: true, values: valuesOf(key, 4).map((v, j) => ({ ...v, pins: [pin(mood, (i + j) % 12)] })) };
  });

  // Outbound: one trait, one location and one placeholder value each pin `sourcePins` placeholders.
  const targets = Array.from({ length: cfg.sourcePins }, (_, i) => ({ id: `ph-target${i}`, name: `Target ${i}`, roll: true, values: valuesOf(`target${i}`, 5) }));
  const heavyPins = targets.map((t, i) => pin(t, i % 5));
  traits.push({ id: 'trait-pin-heavy', name: 'Pin Heavy Trait', statChanges: [], playerDescription: '', aiDescription: '', groupId: traitGroups[0].id, order: traits.length, placeholderPins: heavyPins });
  locations[0].placeholderPins = [pin(mood, 0), ...heavyPins];
  const heavy = { id: 'ph-pin-heavy', name: 'Pin Heavy', roll: true, values: [{ id: 'heavy-v0', text: 'heavy value', pins: heavyPins }, { id: 'heavy-v1', text: 'light value' }] };

  world.placeholders = [mood, heavy, ...pinners, ...targets];
}

mkdirSync(dirname(out), { recursive: true });
const json = JSON.stringify(world);
writeFileSync(out, json);
const images = entities.length + locations.filter((l) => l.backgroundImage).length + 1;
console.log(`${out}\n${(json.length / 1e6).toFixed(1)} MB · ${entities.length} entities · ${locations.length} locations (${cfg.hub} under one parent) · ${images} images · ${traits.length} traits · ${cfg.entries} dictionary entries`);
