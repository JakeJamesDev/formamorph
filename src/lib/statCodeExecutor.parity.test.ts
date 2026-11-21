/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engines loading through their filesystem paths.)
 */
// Lazy World Entries parity pins (Q5), proven on the eager builder: never update them with `-u`; a changed pin is an intent question.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Currency, Dictionary, Entity, Item, Placeholder, PlayerStat, Stat, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from './statCodePlaceholders';
import {
  executeStatCode, type SandboxEntity, type SandboxItem, type SandboxItemInstance, type SandboxTrait, type StatCodeRunOptions,
} from './statCodeExecutor';
import type { ScriptPromptHost } from './scriptPrompts';
import { scriptMoney } from './scriptMoney';

const stat = (id: string, name: string, value: number): Stat =>
  ({ id, name, type: 'number', description: `${name} text`, min: 0, max: 100, value, regen: 1, descriptors: [] });
const ph = (id: string, name: string, values: readonly string[], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...over });
const authoredTrait = (id: string, name: string): Trait => ({ id, name, statChanges: [] });
const sandboxTrait = (id: string, name: string, enabled: boolean, over: Partial<SandboxTrait> = {}): SandboxTrait =>
  ({ id, name, enabled, acquired: enabled, ...over });
const instance = (id: string, where: SandboxItemInstance['where'], over: Partial<SandboxItemInstance> = {}): SandboxItemInstance =>
  ({ id, where, quantity: 1, equipped: false, slot: '', occupies: [], allowed: [], hidden: false, ...over });

const health = stat('s-health', 'Health', 40);
const gold = stat('s-gold', 'Gold', 7);
const rage = stat('s-rage', 'Rage', 10);
const stock = stat('s-stock', 'Stock', 12);

/** The authored side, which the real placeholder and dictionary builders read. */
const world = {
  placeholders: [
    ph('mood', 'Mood', ['calm', 'tense']),
    // A value that is one chip of Shade nests Shade under Hair.
    ph('hair', 'Hair', ['{{ph:shade:world:p-shade}}']),
    ph('shade', 'Shade', ['ash', 'gold'], { ownerId: 'hair' }),
  ],
  entities: [
    { id: 'mira', name: 'Mira', persona: true, traits: [], placeholders: [ph('m-eye', 'Eye Color', ['green'])] },
    { id: 'rook', name: 'Rook', traits: [], placeholders: [ph('r-eye', 'Eye Color', ['gray']), ph('r-scar', 'Scar', ['jaw'])] },
    { id: 'tom', name: 'Old Tom', traits: [], placeholders: [] },
  ] as Entity[],
  dictionaries: [
    {
      id: 'lore', name: 'Lore', placeholders: [ph('era', 'Era', ['first'])], entries: [
        { id: 'crown', name: 'Iron Crown', key: ['crown', 'circlet'], value: 'A crown of iron.' },
        { id: 'sealed', name: 'Sealed', key: ['vault'], value: 'Hidden.', enabled: false, constant: true },
      ],
    },
    { id: 'beasts', name: 'Bestiary', enabled: false, entries: [{ id: 'wolf', name: 'Wolf', key: ['wolf'], value: 'Gray.' }] },
  ] as Dictionary[],
  items: [
    { id: 'lamp', name: 'Brass Lamp', placeholders: [ph('l-glow', 'Glow', ['dim'])], statEffects: [], traitEffects: [], equipRequires: [] },
    { id: 'wand', name: 'Wand', statEffects: [], traitEffects: [], equipRequires: [] },
  ] as Item[],
  traits: [authoredTrait('t-brave', 'Brave'), authoredTrait('t-iron', 'Iron Will')],
};

const list = allPlaceholders(world);
const phTree = sandboxPlaceholders({ placeholders: list, owners: placeholderOwners(world), rolls: {}, pick: (values) => values[0]?.text ?? '' });

const mira: SandboxEntity = {
  id: 'mira', name: 'Mira', type: 'Human', pronouns: 'she/her', inScene: true, met: true, description: 'A sailor.', summary: 'Sailor.',
  aliases: ['M'], locationId: 'dock', kind: 'unique', knownIn: 'nearby',
  traits: [sandboxTrait('t-keen', 'Keen', true), sandboxTrait('t-scar', 'Scarred', false)],
  placeholders: phTree.owners.get('mira'), body: { id: null, locked: false },
};
const rook: SandboxEntity = {
  id: 'rook', name: 'Rook', type: 'Dwarf', pronouns: 'he/him', inScene: true, met: false, description: 'A smith.', summary: 'Smith.',
  aliases: ['The Smith'], locationId: 'dock', kind: 'unique', action: 'patrol', knownIn: 'picked', knownInPlaces: ['Old Mill'],
  traits: [sandboxTrait('t-grim', 'Grim', false, { mode: 'hidden', group: 'Mood' }), sandboxTrait('t-loyal', 'Loyal', true, { playerToggle: true })],
  placeholders: phTree.owners.get('rook'), stats: { stats: [rage, stock], enabled: { 's-stock': true } },
  body: { id: 'b-hum', locked: false },
};
const tom: SandboxEntity = {
  id: 'tom', name: 'Old Tom', type: 'Human', locationIds: ['mill'], kind: 'generic', following: false, waiting: true,
  traits: [], placeholders: phTree.owners.get('tom'),
};

const lamp: SandboxItem = {
  id: 'lamp', name: 'Brass Lamp', placeholders: phTree.owners.get('lamp'), instances: [
    instance('c-lamp-you', { kind: 'you' }),
    instance('c-lamp-dock', { kind: 'location', id: 'dock' }, { quantity: 2, hidden: true }),
  ],
};
const wand: SandboxItem = {
  id: 'wand', name: 'Wand', unidentifiedName: 'Stick', unidentifiedDescription: 'A plain stick.', instances: [
    instance('c-wand', { kind: 'entity', id: 'rook' }, {
      equipped: true, slot: 'Hand', occupies: ['Hand'], allowed: [{ id: 'hand', name: 'Hand' }], uses: 2, state: 'charged', unidentified: true,
    }),
  ],
};

const BASE: StatCodeRunOptions = {
  randomSeed: [1, 2, 3, 4],
  placeholders: phTree.top,
  traits: [sandboxTrait('t-brave', 'Brave', true), sandboxTrait('t-iron', 'Iron Will', false)],
  entities: [mira, rook, tom],
  persona: mira,
  dictionaries: sandboxDictionaries(codeDictionaries(world.dictionaries, list), phTree.owners),
  items: [lamp, wand],
  places: {
    locations: [
      { id: 'dock', name: 'Dock', description: 'Wet planks.', summary: 'Planks.', starting: true,
        links: () => ({ parent: '', children: ['Old Mill'], exits: [{ name: 'Old Mill', hint: 'Uphill.', distance: 'nearby', oneWay: false }] }) },
      { id: 'mill', name: 'Old Mill', description: 'A wheel.', links: () => ({ parent: 'Dock', children: [], exits: [] }) },
    ],
    location: { id: 'dock', name: 'Dock' },
  },
  currencies: [{ id: 'coin', name: 'Coin', kind: 'name' }, { id: 'credits', name: 'Credits', kind: 'stat' }],
  bodies: [{ id: 'b-hum', name: 'Humanoid', slots: [{ name: 'Hand', capacity: 2 }] }],
};

const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'name' } };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const funds = (value: number): PlayerStat =>
  ({ id: 'funds', name: 'Funds', type: 'number', description: '', min: 0, max: 1000, value, regen: 0, descriptors: [] });
/** One run's money: Mira and Rook hold Credits as a Funds stat. */
const money = () => scriptMoney({
  currencies: [COIN, CREDITS], items: world.items, itemNames: world.items, slots: [], placements: [], instances: [],
  stats: { globalStats: [], entityStats: { mira: [funds(50)], rook: [funds(5)] } }, playedIds: ['mira'], statsOn: (_id, stats) => stats,
});

/** The run's error with its stack cut: stack lines number the program text, which is no Script-visible behavior. */
const pinned = <T extends { error: string | null }>(result: T): T => ({ ...result, error: result.error?.split('\nStack:')[0] ?? null });

/** A world script's run over the parity world; `args` makes the return value the reply. */
const run = async (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  pinned(await executeStatCode(code, [health, gold], null, { ...BASE, args: {}, ...over }));
/** Rook's Rage, so `owner` is Rook and `self` his stat. */
const asRage = async (code: string, over: Partial<StatCodeRunOptions> = {}) =>
  pinned(await executeStatCode(code, [health, gold], rage, { ...BASE, owner: rook, ...over }));
/** The reply parsed, for a case whose reply is one JSON value. */
const replyOf = (result: { reply?: string | null }) => JSON.parse(result.reply ?? 'null') as unknown;

describe('Lazy World Entries parity (eager-code pins)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  describe('reads', () => {
    it('reads one entity entry whole', async () => {
      const result = await run('return entities.Rook;');
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "action": "patrol",
            "aliases": [
              "The Smith",
            ],
            "body": {
              "name": "Humanoid",
              "slots": [
                {
                  "capacity": 2,
                  "items": [
                    {
                      "equipped": true,
                      "hidden": false,
                      "id": "c-wand",
                      "image": null,
                      "item": "Wand",
                      "layers": {},
                      "location": "",
                      "owner": "Rook",
                      "quantity": 1,
                      "slot": "Hand",
                      "state": "charged",
                      "unidentified": true,
                      "uses": 2,
                    },
                  ],
                  "name": "Hand",
                },
              ],
            },
            "description": "A smith.",
            "following": false,
            "held": false,
            "id": "rook",
            "image": null,
            "inScene": true,
            "instances": [],
            "items": [
              {
                "equipped": true,
                "hidden": false,
                "id": "c-wand",
                "image": null,
                "item": "Wand",
                "layers": {},
                "location": "",
                "owner": "Rook",
                "quantity": 1,
                "slot": "Hand",
                "state": "charged",
                "unidentified": true,
                "uses": 2,
              },
            ],
            "kind": "unique",
            "knownIn": "picked",
            "knownInPlaces": [
              "Old Mill",
            ],
            "layers": {},
            "location": "Dock",
            "met": false,
            "name": "Rook",
            "placeholders": {
              "Eye Color": {
                "id": "r-eye",
                "name": "Eye Color",
                "text": "gray",
                "value": "gray",
                "values": [
                  "gray",
                ],
              },
              "Scar": {
                "id": "r-scar",
                "name": "Scar",
                "text": "jaw",
                "value": "jaw",
                "values": [
                  "jaw",
                ],
              },
            },
            "pronouns": "he/him",
            "sound": null,
            "stats": {
              "Rage": {
                "delta": {
                  "actual": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "ai": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "regen": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "total": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                },
                "description": "Rage text",
                "descriptor": "",
                "enabled": true,
                "hidden": false,
                "id": "s-rage",
                "max": 100,
                "min": 0,
                "name": "Rage",
                "previous": {
                  "description": "Rage text",
                  "descriptor": "",
                  "hidden": false,
                  "id": "s-rage",
                  "max": 100,
                  "min": 0,
                  "name": "Rage",
                  "regen": 1,
                  "type": "number",
                  "value": 10,
                },
                "regen": 1,
                "type": "number",
                "value": 10,
              },
              "Stock": {
                "delta": {
                  "actual": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "ai": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "regen": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                  "total": {
                    "max": 0,
                    "min": 0,
                    "regen": 0,
                    "value": 0,
                  },
                },
                "description": "Stock text",
                "descriptor": "",
                "enabled": true,
                "hidden": false,
                "id": "s-stock",
                "max": 100,
                "min": 0,
                "name": "Stock",
                "previous": {
                  "description": "Stock text",
                  "descriptor": "",
                  "hidden": false,
                  "id": "s-stock",
                  "max": 100,
                  "min": 0,
                  "name": "Stock",
                  "regen": 1,
                  "type": "number",
                  "value": 12,
                },
                "regen": 1,
                "type": "number",
                "value": 12,
              },
            },
            "summary": "Smith.",
            "traits": {
              "Grim": {
                "acquired": false,
                "available": true,
                "enabled": false,
                "group": "Mood",
                "id": "t-grim",
                "mode": "hidden",
                "name": "Grim",
                "playerToggle": false,
              },
              "Loyal": {
                "acquired": true,
                "available": true,
                "enabled": true,
                "group": "",
                "id": "t-loyal",
                "mode": "optional",
                "name": "Loyal",
                "playerToggle": true,
              },
            },
            "type": "Dwarf",
            "waiting": false,
          },
          "value": null,
        }
      `);
    });

    it('reads persona and owner whole', async () => {
      const reply = await run('return { persona, owner };', { owner: rook });
      expect({ ...reply, reply: replyOf(reply) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "owner": {
              "action": "patrol",
              "aliases": [
                "The Smith",
              ],
              "body": {
                "name": "Humanoid",
                "slots": [
                  {
                    "capacity": 2,
                    "items": [
                      {
                        "equipped": true,
                        "hidden": false,
                        "id": "c-wand",
                        "image": null,
                        "item": "Wand",
                        "layers": {},
                        "location": "",
                        "owner": "Rook",
                        "quantity": 1,
                        "slot": "Hand",
                        "state": "charged",
                        "unidentified": true,
                        "uses": 2,
                      },
                    ],
                    "name": "Hand",
                  },
                ],
              },
              "description": "A smith.",
              "following": false,
              "held": false,
              "id": "rook",
              "image": null,
              "inScene": true,
              "instances": [],
              "items": [
                {
                  "equipped": true,
                  "hidden": false,
                  "id": "c-wand",
                  "image": null,
                  "item": "Wand",
                  "layers": {},
                  "location": "",
                  "owner": "Rook",
                  "quantity": 1,
                  "slot": "Hand",
                  "state": "charged",
                  "unidentified": true,
                  "uses": 2,
                },
              ],
              "kind": "unique",
              "knownIn": "picked",
              "knownInPlaces": [
                "Old Mill",
              ],
              "layers": {},
              "location": "Dock",
              "met": false,
              "name": "Rook",
              "placeholders": {
                "Eye Color": {
                  "id": "r-eye",
                  "name": "Eye Color",
                  "text": "gray",
                  "value": "gray",
                  "values": [
                    "gray",
                  ],
                },
                "Scar": {
                  "id": "r-scar",
                  "name": "Scar",
                  "text": "jaw",
                  "value": "jaw",
                  "values": [
                    "jaw",
                  ],
                },
              },
              "pronouns": "he/him",
              "sound": null,
              "stats": {
                "Rage": {
                  "delta": {
                    "actual": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "ai": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "regen": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "total": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                  },
                  "description": "Rage text",
                  "descriptor": "",
                  "enabled": true,
                  "hidden": false,
                  "id": "s-rage",
                  "max": 100,
                  "min": 0,
                  "name": "Rage",
                  "previous": {
                    "description": "Rage text",
                    "descriptor": "",
                    "hidden": false,
                    "id": "s-rage",
                    "max": 100,
                    "min": 0,
                    "name": "Rage",
                    "regen": 1,
                    "type": "number",
                    "value": 10,
                  },
                  "regen": 1,
                  "type": "number",
                  "value": 10,
                },
                "Stock": {
                  "delta": {
                    "actual": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "ai": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "regen": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                    "total": {
                      "max": 0,
                      "min": 0,
                      "regen": 0,
                      "value": 0,
                    },
                  },
                  "description": "Stock text",
                  "descriptor": "",
                  "enabled": true,
                  "hidden": false,
                  "id": "s-stock",
                  "max": 100,
                  "min": 0,
                  "name": "Stock",
                  "previous": {
                    "description": "Stock text",
                    "descriptor": "",
                    "hidden": false,
                    "id": "s-stock",
                    "max": 100,
                    "min": 0,
                    "name": "Stock",
                    "regen": 1,
                    "type": "number",
                    "value": 12,
                  },
                  "regen": 1,
                  "type": "number",
                  "value": 12,
                },
              },
              "summary": "Smith.",
              "traits": {
                "Grim": {
                  "acquired": false,
                  "available": true,
                  "enabled": false,
                  "group": "Mood",
                  "id": "t-grim",
                  "mode": "hidden",
                  "name": "Grim",
                  "playerToggle": false,
                },
                "Loyal": {
                  "acquired": true,
                  "available": true,
                  "enabled": true,
                  "group": "",
                  "id": "t-loyal",
                  "mode": "optional",
                  "name": "Loyal",
                  "playerToggle": true,
                },
              },
              "type": "Dwarf",
              "waiting": false,
            },
            "persona": {
              "action": "",
              "aliases": [
                "M",
              ],
              "body": null,
              "description": "A sailor.",
              "following": false,
              "held": false,
              "id": "mira",
              "image": null,
              "inScene": true,
              "instances": [],
              "items": [
                {
                  "equipped": false,
                  "hidden": false,
                  "id": "c-lamp-you",
                  "image": null,
                  "item": "Brass Lamp",
                  "layers": {},
                  "location": "",
                  "owner": "Mira",
                  "quantity": 1,
                  "slot": "",
                  "state": null,
                  "unidentified": false,
                  "uses": null,
                },
              ],
              "kind": "",
              "knownIn": "",
              "knownInPlaces": [],
              "layers": {},
              "location": "Dock",
              "met": true,
              "name": "Mira",
              "placeholders": {
                "Eye Color": {
                  "id": "m-eye",
                  "name": "Eye Color",
                  "text": "green",
                  "value": "green",
                  "values": [
                    "green",
                  ],
                },
              },
              "pronouns": "she/her",
              "sound": null,
              "stats": {},
              "summary": "Sailor.",
              "traits": {
                "Keen": {
                  "acquired": true,
                  "available": true,
                  "enabled": true,
                  "group": "",
                  "id": "t-keen",
                  "mode": "optional",
                  "name": "Keen",
                  "playerToggle": false,
                },
                "Scarred": {
                  "acquired": false,
                  "available": true,
                  "enabled": false,
                  "group": "",
                  "id": "t-scar",
                  "mode": "optional",
                  "name": "Scarred",
                  "playerToggle": false,
                },
              },
              "type": "Human",
              "waiting": false,
            },
          },
          "value": null,
        }
      `);
    });

    it('reads the placeholder map and an owned path', async () => {
      const result = await run(`return {
        all: placeholders, shade: placeholders.Hair.Shade,
        rook: entities.Rook.placeholders, scar: entities.Rook.placeholders.Scar.value,
        mine: persona.placeholders["Eye Color"].text, glow: items["Brass Lamp"].placeholders.Glow.values,
        era: dictionaries.Lore.placeholders.Era.value,
      };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "all": {
              "Hair": {
                "Shade": {
                  "id": "shade",
                  "name": "Shade",
                  "text": "ash",
                  "value": "ash",
                  "values": [
                    "ash",
                    "gold",
                  ],
                },
                "id": "hair",
                "name": "Hair",
                "text": "ash",
                "value": "ash",
                "values": [
                  "ash",
                ],
              },
              "Mood": {
                "id": "mood",
                "name": "Mood",
                "text": "calm",
                "value": "calm",
                "values": [
                  "calm",
                  "tense",
                ],
              },
            },
            "era": "first",
            "glow": [
              "dim",
            ],
            "mine": "green",
            "rook": {
              "Eye Color": {
                "id": "r-eye",
                "name": "Eye Color",
                "text": "gray",
                "value": "gray",
                "values": [
                  "gray",
                ],
              },
              "Scar": {
                "id": "r-scar",
                "name": "Scar",
                "text": "jaw",
                "value": "jaw",
                "values": [
                  "jaw",
                ],
              },
            },
            "scar": "jaw",
            "shade": {
              "id": "shade",
              "name": "Shade",
              "text": "ash",
              "value": "ash",
              "values": [
                "ash",
                "gold",
              ],
            },
          },
          "value": null,
        }
      `);
    });

    it('reads an item, its instances and its unidentified face', async () => {
      const result = await run('return { lamp: items["Brass Lamp"], wand: items.Wand };');
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "lamp": {
              "id": "lamp",
              "instances": [
                {
                  "equipped": false,
                  "hidden": false,
                  "id": "c-lamp-you",
                  "image": null,
                  "item": "Brass Lamp",
                  "layers": {},
                  "location": "",
                  "owner": "Mira",
                  "quantity": 1,
                  "slot": "",
                  "state": null,
                  "unidentified": false,
                  "uses": null,
                },
                {
                  "equipped": false,
                  "hidden": true,
                  "id": "c-lamp-dock",
                  "image": null,
                  "item": "Brass Lamp",
                  "layers": {},
                  "location": "Dock",
                  "owner": "",
                  "quantity": 2,
                  "slot": "",
                  "state": null,
                  "unidentified": false,
                  "uses": null,
                },
              ],
              "name": "Brass Lamp",
              "placeholders": {
                "Glow": {
                  "id": "l-glow",
                  "name": "Glow",
                  "text": "dim",
                  "value": "dim",
                  "values": [
                    "dim",
                  ],
                },
              },
              "unidentifiedDescription": "",
              "unidentifiedName": "",
            },
            "wand": {
              "id": "wand",
              "instances": [
                {
                  "equipped": true,
                  "hidden": false,
                  "id": "c-wand",
                  "image": null,
                  "item": "Wand",
                  "layers": {},
                  "location": "",
                  "owner": "Rook",
                  "quantity": 1,
                  "slot": "Hand",
                  "state": "charged",
                  "unidentified": true,
                  "uses": 2,
                },
              ],
              "name": "Wand",
              "placeholders": {},
              "unidentifiedDescription": "A plain stick.",
              "unidentifiedName": "Stick",
            },
          },
          "value": null,
        }
      `);
    });

    it('reads locations, their links, cast and items, and where the turn stands', async () => {
      const result = await run(`return {
        dock: locations.Dock, mill: locations["Old Mill"], here: location,
        dockItems: locations.Dock.items.map((c) => c.id), millItems: locations["Old Mill"].items.length,
      };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "dock": {
              "ambience": null,
              "children": [
                "Old Mill",
              ],
              "description": "Wet planks.",
              "exits": [
                {
                  "distance": "nearby",
                  "hint": "Uphill.",
                  "name": "Old Mill",
                  "oneWay": false,
                },
              ],
              "id": "dock",
              "image": null,
              "items": [
                {
                  "equipped": false,
                  "hidden": true,
                  "id": "c-lamp-dock",
                  "image": null,
                  "item": "Brass Lamp",
                  "layers": {},
                  "location": "Dock",
                  "owner": "",
                  "quantity": 2,
                  "slot": "",
                  "state": null,
                  "unidentified": false,
                  "uses": null,
                },
              ],
              "layers": {},
              "name": "Dock",
              "parent": "",
              "present": [
                {
                  "action": "",
                  "aliases": [
                    "M",
                  ],
                  "body": null,
                  "description": "A sailor.",
                  "following": false,
                  "held": false,
                  "id": "mira",
                  "image": null,
                  "inScene": true,
                  "instances": [],
                  "items": [
                    {
                      "equipped": false,
                      "hidden": false,
                      "id": "c-lamp-you",
                      "image": null,
                      "item": "Brass Lamp",
                      "layers": {},
                      "location": "",
                      "owner": "Mira",
                      "quantity": 1,
                      "slot": "",
                      "state": null,
                      "unidentified": false,
                      "uses": null,
                    },
                  ],
                  "kind": "",
                  "knownIn": "",
                  "knownInPlaces": [],
                  "layers": {},
                  "location": "Dock",
                  "met": true,
                  "name": "Mira",
                  "placeholders": {
                    "Eye Color": {
                      "id": "m-eye",
                      "name": "Eye Color",
                      "text": "green",
                      "value": "green",
                      "values": [
                        "green",
                      ],
                    },
                  },
                  "pronouns": "she/her",
                  "sound": null,
                  "stats": {},
                  "summary": "Sailor.",
                  "traits": {
                    "Keen": {
                      "acquired": true,
                      "available": true,
                      "enabled": true,
                      "group": "",
                      "id": "t-keen",
                      "mode": "optional",
                      "name": "Keen",
                      "playerToggle": false,
                    },
                    "Scarred": {
                      "acquired": false,
                      "available": true,
                      "enabled": false,
                      "group": "",
                      "id": "t-scar",
                      "mode": "optional",
                      "name": "Scarred",
                      "playerToggle": false,
                    },
                  },
                  "type": "Human",
                  "waiting": false,
                },
                {
                  "action": "patrol",
                  "aliases": [
                    "The Smith",
                  ],
                  "body": {
                    "name": "Humanoid",
                    "slots": [
                      {
                        "capacity": 2,
                        "items": [
                          {
                            "equipped": true,
                            "hidden": false,
                            "id": "c-wand",
                            "image": null,
                            "item": "Wand",
                            "layers": {},
                            "location": "",
                            "owner": "Rook",
                            "quantity": 1,
                            "slot": "Hand",
                            "state": "charged",
                            "unidentified": true,
                            "uses": 2,
                          },
                        ],
                        "name": "Hand",
                      },
                    ],
                  },
                  "description": "A smith.",
                  "following": false,
                  "held": false,
                  "id": "rook",
                  "image": null,
                  "inScene": true,
                  "instances": [],
                  "items": [
                    {
                      "equipped": true,
                      "hidden": false,
                      "id": "c-wand",
                      "image": null,
                      "item": "Wand",
                      "layers": {},
                      "location": "",
                      "owner": "Rook",
                      "quantity": 1,
                      "slot": "Hand",
                      "state": "charged",
                      "unidentified": true,
                      "uses": 2,
                    },
                  ],
                  "kind": "unique",
                  "knownIn": "picked",
                  "knownInPlaces": [
                    "Old Mill",
                  ],
                  "layers": {},
                  "location": "Dock",
                  "met": false,
                  "name": "Rook",
                  "placeholders": {
                    "Eye Color": {
                      "id": "r-eye",
                      "name": "Eye Color",
                      "text": "gray",
                      "value": "gray",
                      "values": [
                        "gray",
                      ],
                    },
                    "Scar": {
                      "id": "r-scar",
                      "name": "Scar",
                      "text": "jaw",
                      "value": "jaw",
                      "values": [
                        "jaw",
                      ],
                    },
                  },
                  "pronouns": "he/him",
                  "sound": null,
                  "stats": {
                    "Rage": {
                      "delta": {
                        "actual": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "ai": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "regen": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "total": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                      },
                      "description": "Rage text",
                      "descriptor": "",
                      "enabled": true,
                      "hidden": false,
                      "id": "s-rage",
                      "max": 100,
                      "min": 0,
                      "name": "Rage",
                      "previous": {
                        "description": "Rage text",
                        "descriptor": "",
                        "hidden": false,
                        "id": "s-rage",
                        "max": 100,
                        "min": 0,
                        "name": "Rage",
                        "regen": 1,
                        "type": "number",
                        "value": 10,
                      },
                      "regen": 1,
                      "type": "number",
                      "value": 10,
                    },
                    "Stock": {
                      "delta": {
                        "actual": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "ai": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "regen": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "total": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                      },
                      "description": "Stock text",
                      "descriptor": "",
                      "enabled": true,
                      "hidden": false,
                      "id": "s-stock",
                      "max": 100,
                      "min": 0,
                      "name": "Stock",
                      "previous": {
                        "description": "Stock text",
                        "descriptor": "",
                        "hidden": false,
                        "id": "s-stock",
                        "max": 100,
                        "min": 0,
                        "name": "Stock",
                        "regen": 1,
                        "type": "number",
                        "value": 12,
                      },
                      "regen": 1,
                      "type": "number",
                      "value": 12,
                    },
                  },
                  "summary": "Smith.",
                  "traits": {
                    "Grim": {
                      "acquired": false,
                      "available": true,
                      "enabled": false,
                      "group": "Mood",
                      "id": "t-grim",
                      "mode": "hidden",
                      "name": "Grim",
                      "playerToggle": false,
                    },
                    "Loyal": {
                      "acquired": true,
                      "available": true,
                      "enabled": true,
                      "group": "",
                      "id": "t-loyal",
                      "mode": "optional",
                      "name": "Loyal",
                      "playerToggle": true,
                    },
                  },
                  "type": "Dwarf",
                  "waiting": false,
                },
              ],
              "starting": true,
              "summary": "Planks.",
            },
            "dockItems": [
              "c-lamp-dock",
            ],
            "here": {
              "ambience": null,
              "children": [
                "Old Mill",
              ],
              "description": "Wet planks.",
              "exits": [
                {
                  "distance": "nearby",
                  "hint": "Uphill.",
                  "name": "Old Mill",
                  "oneWay": false,
                },
              ],
              "id": "dock",
              "image": null,
              "items": [
                {
                  "equipped": false,
                  "hidden": true,
                  "id": "c-lamp-dock",
                  "image": null,
                  "item": "Brass Lamp",
                  "layers": {},
                  "location": "Dock",
                  "owner": "",
                  "quantity": 2,
                  "slot": "",
                  "state": null,
                  "unidentified": false,
                  "uses": null,
                },
              ],
              "layers": {},
              "name": "Dock",
              "parent": "",
              "present": [
                {
                  "action": "",
                  "aliases": [
                    "M",
                  ],
                  "body": null,
                  "description": "A sailor.",
                  "following": false,
                  "held": false,
                  "id": "mira",
                  "image": null,
                  "inScene": true,
                  "instances": [],
                  "items": [
                    {
                      "equipped": false,
                      "hidden": false,
                      "id": "c-lamp-you",
                      "image": null,
                      "item": "Brass Lamp",
                      "layers": {},
                      "location": "",
                      "owner": "Mira",
                      "quantity": 1,
                      "slot": "",
                      "state": null,
                      "unidentified": false,
                      "uses": null,
                    },
                  ],
                  "kind": "",
                  "knownIn": "",
                  "knownInPlaces": [],
                  "layers": {},
                  "location": "Dock",
                  "met": true,
                  "name": "Mira",
                  "placeholders": {
                    "Eye Color": {
                      "id": "m-eye",
                      "name": "Eye Color",
                      "text": "green",
                      "value": "green",
                      "values": [
                        "green",
                      ],
                    },
                  },
                  "pronouns": "she/her",
                  "sound": null,
                  "stats": {},
                  "summary": "Sailor.",
                  "traits": {
                    "Keen": {
                      "acquired": true,
                      "available": true,
                      "enabled": true,
                      "group": "",
                      "id": "t-keen",
                      "mode": "optional",
                      "name": "Keen",
                      "playerToggle": false,
                    },
                    "Scarred": {
                      "acquired": false,
                      "available": true,
                      "enabled": false,
                      "group": "",
                      "id": "t-scar",
                      "mode": "optional",
                      "name": "Scarred",
                      "playerToggle": false,
                    },
                  },
                  "type": "Human",
                  "waiting": false,
                },
                {
                  "action": "patrol",
                  "aliases": [
                    "The Smith",
                  ],
                  "body": {
                    "name": "Humanoid",
                    "slots": [
                      {
                        "capacity": 2,
                        "items": [
                          {
                            "equipped": true,
                            "hidden": false,
                            "id": "c-wand",
                            "image": null,
                            "item": "Wand",
                            "layers": {},
                            "location": "",
                            "owner": "Rook",
                            "quantity": 1,
                            "slot": "Hand",
                            "state": "charged",
                            "unidentified": true,
                            "uses": 2,
                          },
                        ],
                        "name": "Hand",
                      },
                    ],
                  },
                  "description": "A smith.",
                  "following": false,
                  "held": false,
                  "id": "rook",
                  "image": null,
                  "inScene": true,
                  "instances": [],
                  "items": [
                    {
                      "equipped": true,
                      "hidden": false,
                      "id": "c-wand",
                      "image": null,
                      "item": "Wand",
                      "layers": {},
                      "location": "",
                      "owner": "Rook",
                      "quantity": 1,
                      "slot": "Hand",
                      "state": "charged",
                      "unidentified": true,
                      "uses": 2,
                    },
                  ],
                  "kind": "unique",
                  "knownIn": "picked",
                  "knownInPlaces": [
                    "Old Mill",
                  ],
                  "layers": {},
                  "location": "Dock",
                  "met": false,
                  "name": "Rook",
                  "placeholders": {
                    "Eye Color": {
                      "id": "r-eye",
                      "name": "Eye Color",
                      "text": "gray",
                      "value": "gray",
                      "values": [
                        "gray",
                      ],
                    },
                    "Scar": {
                      "id": "r-scar",
                      "name": "Scar",
                      "text": "jaw",
                      "value": "jaw",
                      "values": [
                        "jaw",
                      ],
                    },
                  },
                  "pronouns": "he/him",
                  "sound": null,
                  "stats": {
                    "Rage": {
                      "delta": {
                        "actual": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "ai": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "regen": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "total": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                      },
                      "description": "Rage text",
                      "descriptor": "",
                      "enabled": true,
                      "hidden": false,
                      "id": "s-rage",
                      "max": 100,
                      "min": 0,
                      "name": "Rage",
                      "previous": {
                        "description": "Rage text",
                        "descriptor": "",
                        "hidden": false,
                        "id": "s-rage",
                        "max": 100,
                        "min": 0,
                        "name": "Rage",
                        "regen": 1,
                        "type": "number",
                        "value": 10,
                      },
                      "regen": 1,
                      "type": "number",
                      "value": 10,
                    },
                    "Stock": {
                      "delta": {
                        "actual": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "ai": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "regen": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                        "total": {
                          "max": 0,
                          "min": 0,
                          "regen": 0,
                          "value": 0,
                        },
                      },
                      "description": "Stock text",
                      "descriptor": "",
                      "enabled": true,
                      "hidden": false,
                      "id": "s-stock",
                      "max": 100,
                      "min": 0,
                      "name": "Stock",
                      "previous": {
                        "description": "Stock text",
                        "descriptor": "",
                        "hidden": false,
                        "id": "s-stock",
                        "max": 100,
                        "min": 0,
                        "name": "Stock",
                        "regen": 1,
                        "type": "number",
                        "value": 12,
                      },
                      "regen": 1,
                      "type": "number",
                      "value": 12,
                    },
                  },
                  "summary": "Smith.",
                  "traits": {
                    "Grim": {
                      "acquired": false,
                      "available": true,
                      "enabled": false,
                      "group": "Mood",
                      "id": "t-grim",
                      "mode": "hidden",
                      "name": "Grim",
                      "playerToggle": false,
                    },
                    "Loyal": {
                      "acquired": true,
                      "available": true,
                      "enabled": true,
                      "group": "",
                      "id": "t-loyal",
                      "mode": "optional",
                      "name": "Loyal",
                      "playerToggle": true,
                    },
                  },
                  "type": "Dwarf",
                  "waiting": false,
                },
              ],
              "starting": true,
              "summary": "Planks.",
            },
            "mill": {
              "ambience": null,
              "children": [],
              "description": "A wheel.",
              "exits": [],
              "id": "mill",
              "image": null,
              "items": [],
              "layers": {},
              "name": "Old Mill",
              "parent": "Dock",
              "present": [
                {
                  "action": "",
                  "aliases": [],
                  "body": null,
                  "description": "",
                  "following": false,
                  "held": false,
                  "id": "tom",
                  "image": null,
                  "inScene": false,
                  "instances": [],
                  "items": [],
                  "kind": "generic",
                  "knownIn": "nearby",
                  "knownInPlaces": [],
                  "layers": {},
                  "location": "",
                  "met": false,
                  "name": "Old Tom",
                  "placeholders": {},
                  "pronouns": "",
                  "sound": null,
                  "stats": {},
                  "summary": "",
                  "traits": {},
                  "type": "Human",
                  "waiting": true,
                },
              ],
              "starting": false,
              "summary": "",
            },
            "millItems": 0,
          },
          "value": null,
        }
      `);
    });

    it('reads dictionaries, their entries and a disabled book', async () => {
      const result = await run('return { lore: dictionaries.Lore, crown: dictionaries.Lore.entries["Iron Crown"].value, beasts: dictionaries.Bestiary };');
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "beasts": {
              "enabled": false,
              "entries": {
                "Wolf": {
                  "constant": false,
                  "enabled": true,
                  "id": "wolf",
                  "keys": [
                    "wolf",
                  ],
                  "name": "Wolf",
                  "value": "Gray.",
                },
              },
              "id": "beasts",
              "name": "Bestiary",
              "placeholders": {},
            },
            "crown": "A crown of iron.",
            "lore": {
              "enabled": true,
              "entries": {
                "Iron Crown": {
                  "constant": false,
                  "enabled": true,
                  "id": "crown",
                  "keys": [
                    "crown",
                    "circlet",
                  ],
                  "name": "Iron Crown",
                  "value": "A crown of iron.",
                },
                "Sealed": {
                  "constant": true,
                  "enabled": false,
                  "id": "sealed",
                  "keys": [
                    "vault",
                  ],
                  "name": "Sealed",
                  "value": "Hidden.",
                },
              },
              "id": "lore",
              "name": "Lore",
              "placeholders": {
                "Era": {
                  "id": "era",
                  "name": "Era",
                  "text": "first",
                  "value": "first",
                  "values": [
                    "first",
                  ],
                },
              },
            },
          },
          "value": null,
        }
      `);
    });

    it('reads currencies and a balance through an entity', async () => {
      const result = await run(`return {
        coin: currencies.Coin, credits: currencies.Credits,
        rook: currencies.Credits.balance(entities.Rook), mine: currencies.Credits.balance(persona), tom: currencies.Credits.balance(entities["Old Tom"]),
      };`, { money: money() });
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "coin": {
              "id": "coin",
              "kind": "name",
              "name": "Coin",
            },
            "credits": {
              "id": "credits",
              "kind": "stat",
              "name": "Credits",
            },
            "mine": 50,
            "rook": 5,
            "tom": null,
          },
          "value": null,
        }
      `);
    });

    it('reads stats, world traits and an entity’s stats beside the world maps', async () => {
      const result = await asRage('return self.value + stats.Gold.value + owner.stats.Stock.value + entities.Rook.stats.Rage.value + (traits.Brave.enabled ? 1000 : 0);');
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "value": 1039,
        }
      `);
    });
  });

  describe('cross-map reads', () => {
    it('reads an entity’s items, body, stats, traits and placeholders', async () => {
      const result = await run(`const r = entities.Rook; return {
        items: r.items.map((c) => [c.id, c.owner, c.slot]), body: r.body, mineItems: persona.items.map((c) => c.id),
        stats: Object.keys(r.stats), rage: r.stats.Rage.value, traits: Object.keys(r.traits), loyal: r.traits.Loyal,
        placeholders: Object.keys(r.placeholders), tomItems: entities["Old Tom"].items.length, tomBody: entities["Old Tom"].body,
      };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "body": {
              "name": "Humanoid",
              "slots": [
                {
                  "capacity": 2,
                  "items": [
                    {
                      "equipped": true,
                      "hidden": false,
                      "id": "c-wand",
                      "image": null,
                      "item": "Wand",
                      "layers": {},
                      "location": "",
                      "owner": "Rook",
                      "quantity": 1,
                      "slot": "Hand",
                      "state": "charged",
                      "unidentified": true,
                      "uses": 2,
                    },
                  ],
                  "name": "Hand",
                },
              ],
            },
            "items": [
              [
                "c-wand",
                "Rook",
                "Hand",
              ],
            ],
            "loyal": {
              "acquired": true,
              "available": true,
              "enabled": true,
              "group": "",
              "id": "t-loyal",
              "mode": "optional",
              "name": "Loyal",
              "playerToggle": true,
            },
            "mineItems": [
              "c-lamp-you",
            ],
            "placeholders": [
              "Eye Color",
              "Scar",
            ],
            "rage": 10,
            "stats": [
              "Rage",
              "Stock",
            ],
            "tomBody": null,
            "tomItems": 0,
            "traits": [
              "Grim",
              "Loyal",
            ],
          },
          "value": null,
        }
      `);
    });

    it('reads an item instance’s owner and location, and a location’s cast', async () => {
      const result = await run(`return {
        wandOwner: items.Wand.instances[0].owner, lampWhere: items["Brass Lamp"].instances.map((c) => [c.owner, c.location]),
        dockCast: location.present.map((e) => e.name), millCast: locations["Old Mill"].present.map((e) => e.name),
      };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "dockCast": [
              "Mira",
              "Rook",
            ],
            "lampWhere": [
              [
                "Mira",
                "",
              ],
              [
                "",
                "Dock",
              ],
            ],
            "millCast": [
              "Old Tom",
            ],
            "wandOwner": "Rook",
          },
          "value": null,
        }
      `);
    });
  });

  describe('listings, presence and identity', () => {
    it('lists every map’s names in order', async () => {
      const result = await run(`return [entities, placeholders, items, locations, dictionaries, currencies].map((map) => Object.keys(map));`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": [
            [
              "Mira",
              "Rook",
              "Old Tom",
            ],
            [
              "Mood",
              "Hair",
            ],
            [
              "Brass Lamp",
              "Wand",
            ],
            [
              "Dock",
              "Old Mill",
            ],
            [
              "Lore",
              "Bestiary",
            ],
            [
              "Coin",
              "Credits",
            ],
          ],
          "value": null,
        }
      `);
    });

    it('lists through for…in, values, entries and spread alike', async () => {
      const result = await run(`
        const forIn = []; for (const name in entities) forIn.push(name);
        return {
          forIn, values: Object.values(items).map((item) => item.name), entries: Object.entries(locations).map(([name, place]) => name + '=' + place.id),
          spread: Object.keys({ ...dictionaries }), currencies: Object.values(currencies).map((c) => c.kind),
          placeholderEntries: Object.entries(placeholders).map(([name, node]) => name + '=' + node.text),
        };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "currencies": [
              "name",
              "stat",
            ],
            "entries": [
              "Dock=dock",
              "Old Mill=mill",
            ],
            "forIn": [
              "Mira",
              "Rook",
              "Old Tom",
            ],
            "placeholderEntries": [
              "Mood=calm",
              "Hair=ash",
            ],
            "spread": [
              "Lore",
              "Bestiary",
            ],
            "values": [
              "Brass Lamp",
              "Wand",
            ],
          },
          "value": null,
        }
      `);
    });

    it('answers in and typeof for known and unknown names', async () => {
      const result = await run(`return [
        'Rook' in entities, 'Nobody' in entities, 'Wand' in items, 'Nope' in items, 'Dock' in locations, 'Nowhere' in locations,
        'Lore' in dictionaries, 'None' in dictionaries, 'Coin' in currencies, 'Nada' in currencies, 'Hair' in placeholders, 'Nope' in placeholders,
        typeof entities.Rook, typeof entities.Nobody, typeof items.Nope, typeof locations.Nowhere, typeof dictionaries.None, typeof currencies.Nada,
      ];`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": [
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            true,
            false,
            "object",
            "object",
            "object",
            "object",
            "object",
            "object",
          ],
          "value": null,
        }
      `);
    });

    it('keeps one entry per name across reads and between owner, persona and entities', async () => {
      const result = await asRage(`const same = [
        entities.Rook === entities.Rook, owner === entities[owner.name], persona === entities[persona.name], persona === entities.Mira,
        items.Wand === items.Wand, locations.Dock === locations.Dock, dictionaries.Lore === dictionaries.Lore, currencies.Coin === currencies.Coin,
        persona.items[0] === items["Brass Lamp"].instances[0], owner.items[0] === items.Wand.instances[0],
        entities.Rook.placeholders.Scar === entities.Rook.placeholders.Scar,
      ]; if (same.some((held) => !held)) throw new Error(same.join()); return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "value": 1,
        }
      `);
    });
  });

  describe('unknown names', () => {
    it('reads an unknown entity as the blank entry', async () => {
      const result = await run('return entities.Nobody;');
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "action": "",
            "aliases": [],
            "body": null,
            "description": "",
            "following": false,
            "held": false,
            "id": "",
            "image": null,
            "inScene": false,
            "instances": [],
            "items": [],
            "kind": "",
            "knownIn": "",
            "knownInPlaces": [],
            "layers": {},
            "location": "",
            "met": false,
            "name": "",
            "placeholders": {},
            "pronouns": "",
            "sound": null,
            "stats": {},
            "summary": "",
            "traits": {},
            "type": "",
            "waiting": false,
          },
          "value": null,
        }
      `);
    });

    it('reads unknown items, locations, dictionaries and placeholders', async () => {
      const result = await run('return { item: items.Nope, place: locations.Nowhere, book: dictionaries.None, entry: dictionaries.Lore.entries.Nope, ph: placeholders.Nope };');
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "book": {
              "enabled": false,
              "entries": {},
              "id": "",
              "name": "",
              "placeholders": {},
            },
            "entry": {
              "constant": false,
              "enabled": false,
              "id": "",
              "keys": [],
              "name": "",
              "value": "",
            },
            "item": {
              "id": "",
              "instances": [],
              "name": "",
              "placeholders": {},
              "unidentifiedDescription": "",
              "unidentifiedName": "",
            },
            "ph": {
              "id": "",
              "name": "",
              "text": "",
              "value": "",
              "values": [],
            },
            "place": {
              "ambience": null,
              "children": [],
              "description": "",
              "exits": [],
              "id": "",
              "image": null,
              "items": [],
              "layers": {},
              "name": "",
              "parent": "",
              "present": [],
              "starting": false,
              "summary": "",
            },
          },
          "value": null,
        }
      `);
    });

    it('stops on a call through an unknown currency', async () => {
      expect(await run('return currencies.Nada.balance(persona);')).toMatchInlineSnapshot(`
        {
          "error": "Error: The world has no Currency named "Nada"",
          "kind": "throw",
          "value": null,
        }
      `);
    });

    it('drops writes through unknown names and reports them', async () => {
      const result = await run(`
        entities.Nobody.traits.Brave.enabled = true; entities.Rook.traits.Nope.enabled = true; traits.Nope.enabled = true;
        stats.Nope.value = 1; entities.Rook.stats.Nope.value = 2; placeholders.Nope.pin('x'); entities.Nobody.placeholders.Hair.pin('y');
        dictionaries.Lore.entries.Nope.enabled = false;
        return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "entities": [
            {
              "entity": "Rook",
              "unknownTraits": [
                "Nope",
              ],
            },
          ],
          "error": null,
          "reply": "1",
          "unknownEntities": [
            "Nobody",
          ],
          "unknownLore": [
            "dictionaries.Lore.entries.Nope.enabled",
          ],
          "unknownOwnerPlaceholders": [
            "Nobody › Hair",
          ],
          "unknownPlaceholders": [
            "Nope",
          ],
          "unknownStatWrites": [
            "stats.Nope.value",
            "entities.Rook.stats.Nope.value",
          ],
          "unknownTraits": [
            "Nope",
          ],
          "value": null,
        }
      `);
    });
  });

  describe('writes', () => {
    it('switches traits through entities, persona and owner', async () => {
      const result = await asRage(`
        entities.Rook.traits.Grim.enabled = true; persona.traits.Keen.enabled = false; owner.traits.Loyal.enabled = false;
        entities.Mira.traits.Scarred.enabled = true; traits["Iron Will"].enabled = true;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "entities": [
            {
              "entity": "Mira",
              "traits": [
                {
                  "enabled": false,
                  "name": "Keen",
                },
                {
                  "enabled": true,
                  "name": "Scarred",
                },
              ],
            },
            {
              "entity": "Rook",
              "traits": [
                {
                  "enabled": true,
                  "name": "Grim",
                },
                {
                  "enabled": false,
                  "name": "Loyal",
                },
              ],
            },
          ],
          "error": null,
          "traits": [
            {
              "enabled": true,
              "name": "Iron Will",
            },
          ],
          "value": null,
        }
      `);
    });

    it('writes stats through self, stats, owner and entities', async () => {
      const result = await asRage(`
        self.value = 30; self.max = 90; stats.Gold.value = 2; owner.stats.Stock.min = 1; entities.Rook.stats.Stock.value = 5;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "bounds": {
            "max": 90,
          },
          "error": null,
          "ownerStatWrites": [
            {
              "ownerId": "rook",
              "writes": [
                {
                  "id": "s-stock",
                  "min": 1,
                  "name": "Stock",
                  "value": 5,
                },
              ],
            },
          ],
          "statWrites": [
            {
              "id": "s-gold",
              "name": "Gold",
              "value": 2,
            },
          ],
          "value": 30,
        }
      `);
    });

    it('pins and unpins placeholders through every owner', async () => {
      const result = await run(`
        placeholders.Mood.pin('tense'); placeholders.Hair.Shade.pin('gold'); entities.Rook.placeholders.Scar.pin('cheek');
        persona.placeholders["Eye Color"].pin('blue'); items["Brass Lamp"].placeholders.Glow.pin('bright');
        dictionaries.Lore.placeholders.Era.unpin(); return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "placeholders": [
            {
              "id": "mood",
              "path": [
                "Mood",
              ],
              "value": "tense",
            },
            {
              "id": "shade",
              "path": [
                "Hair",
                "Shade",
              ],
              "value": "gold",
            },
            {
              "id": "m-eye",
              "path": [
                "Mira",
                "Eye Color",
              ],
              "value": "blue",
            },
            {
              "id": "r-scar",
              "path": [
                "Rook",
                "Scar",
              ],
              "value": "cheek",
            },
            {
              "id": "era",
              "path": [
                "Lore",
                "Era",
              ],
              "unpin": true,
            },
            {
              "id": "l-glow",
              "path": [
                "Brass Lamp",
                "Glow",
              ],
              "value": "bright",
            },
          ],
          "reply": "1",
          "value": null,
        }
      `);
    });

    it('switches a book and its entries', async () => {
      const result = await run(`
        dictionaries.Lore.entries["Iron Crown"].enabled = false; dictionaries.Lore.entries.Sealed.constant = false;
        dictionaries.Bestiary.enabled = true; return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "lore": [
            {
              "book": "lore",
              "entry": "crown",
              "field": "enabled",
              "path": "dictionaries.Lore.entries["Iron Crown"].enabled",
              "value": false,
            },
            {
              "book": "lore",
              "entry": "sealed",
              "field": "constant",
              "path": "dictionaries.Lore.entries.Sealed.constant",
              "value": false,
            },
            {
              "book": "beasts",
              "field": "enabled",
              "path": "dictionaries.Bestiary.enabled",
              "value": true,
            },
          ],
          "reply": "1",
          "value": null,
        }
      `);
    });

    it('moves and follows entities, moves the turn, and changes a body', async () => {
      const result = await run(`
        entities.Rook.move("Old Mill"); entities["Old Tom"].follow(); entities["Old Tom"].unfollow(); entities.Rook.meet(); location.move("Old Mill");
        entities.Rook.body = "Humanoid"; return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": "1",
          "value": null,
          "worldWrites": {
            "bodies": [
              {
                "owner": "rook",
                "pick": {
                  "id": "b-hum",
                  "kind": "body",
                },
              },
            ],
            "entities": [
              {
                "entity": "rook",
                "kind": "move",
                "location": "mill",
              },
              {
                "entity": "tom",
                "kind": "follow",
              },
              {
                "entity": "tom",
                "kind": "unfollow",
              },
              {
                "entity": "rook",
                "kind": "meet",
              },
            ],
            "location": "mill",
          },
        }
      `);
    });

    it('records item verbs and a payment between entities', async () => {
      const result = await run(`
        items.Wand.give(entities["Old Tom"]); items["Brass Lamp"].instances[1].moveTo(persona, 1); items.Wand.instances[0].unequip();
        currencies.Credits.pay(persona, entities.Rook, 2); return 1;`, { money: money() });
      expect(result).toMatchInlineSnapshot(`
        {
          "error": null,
          "ownerStatWrites": [
            {
              "ownerId": "mira",
              "writes": [
                {
                  "id": "funds",
                  "name": "Funds",
                  "value": 48,
                },
              ],
            },
            {
              "ownerId": "rook",
              "writes": [
                {
                  "id": "funds",
                  "name": "Funds",
                  "value": 7,
                },
              ],
            },
          ],
          "payments": [
            {
              "amount": 2,
              "currencyId": "credits",
              "paid": true,
              "payee": {
                "id": "rook",
                "kind": "entity",
              },
              "payer": {
                "kind": "you",
              },
              "reason": "",
            },
          ],
          "reply": "1",
          "value": null,
          "worldWrites": {
            "inventory": [
              {
                "itemId": "wand",
                "kind": "gain",
                "quantity": 1,
                "to": {
                  "id": "tom",
                  "kind": "entity",
                },
              },
              {
                "instanceId": "c-lamp-dock",
                "kind": "transfer",
                "quantity": 1,
                "to": {
                  "kind": "you",
                },
              },
              {
                "instanceId": "c-wand",
                "kind": "unequip",
              },
            ],
          },
        }
      `);
    });

    it('writes through entries another map reaches', async () => {
      const result = await asRage(`
        owner.placeholders.Scar.pin('brow'); owner.items[0].unequip(); persona.items[0].moveTo(entities.Rook, 1);
        location.present[1].traits.Grim.enabled = true; location.present[0].placeholders["Eye Color"].unpin();
        locations["Old Mill"].present[0].follow(); items.Wand.instances[0].setState('spent');`);
      expect(result).toMatchInlineSnapshot(`
        {
          "entities": [
            {
              "entity": "Rook",
              "traits": [
                {
                  "enabled": true,
                  "name": "Grim",
                },
              ],
            },
          ],
          "error": null,
          "placeholders": [
            {
              "id": "m-eye",
              "path": [
                "Mira",
                "Eye Color",
              ],
              "unpin": true,
            },
            {
              "id": "r-scar",
              "path": [
                "Rook",
                "Scar",
              ],
              "value": "brow",
            },
          ],
          "value": null,
          "worldWrites": {
            "entities": [
              {
                "entity": "tom",
                "kind": "follow",
              },
            ],
            "inventory": [
              {
                "instanceId": "c-wand",
                "kind": "unequip",
              },
              {
                "instanceId": "c-lamp-you",
                "kind": "transfer",
                "quantity": 1,
                "to": {
                  "id": "rook",
                  "kind": "entity",
                },
              },
              {
                "instanceId": "c-wand",
                "kind": "change",
                "state": "spent",
              },
            ],
          },
        }
      `);
    });

    it('writes through an item event’s self and instance', async () => {
      const result = await executeStatCode('instance.use(); instance.setUses(1); self.give(owner); return 1;', [health], null, {
        ...BASE, owner: rook, args: {}, itemEvent: { itemId: 'wand', timing: 'used', instanceId: 'c-wand', args: { quantity: 1 } },
      });
      expect(pinned(result)).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": "1",
          "value": null,
          "worldWrites": {
            "inventory": [
              {
                "instanceId": "c-wand",
                "kind": "use",
              },
              {
                "instanceId": "c-wand",
                "kind": "setUses",
                "uses": 1,
              },
              {
                "itemId": "wand",
                "kind": "gain",
                "quantity": 1,
                "to": {
                  "id": "rook",
                  "kind": "entity",
                },
              },
            ],
          },
        }
      `);
    });

    it('reports writes to read-only fields of every map', async () => {
      const result = await run(`
        entities.Rook.name = 'x'; entities.Rook.description = 'y'; persona.type = 'z'; traits.Brave.acquired = true; traits.Brave.mode = 'hidden';
        entities.Rook.traits.Loyal.acquired = true; items.Wand.name = 'w'; items.Wand.instances[0].quantity = 9; locations.Dock.description = 'd';
        location.name = 'n'; dictionaries.Lore.name = 'l'; dictionaries.Lore.entries["Iron Crown"].value = 'v'; placeholders.Mood.value = 'm';
        currencies.Coin.name = 'c'; return 1;`);
      expect(result).toMatchInlineSnapshot(`
        {
          "acquiredWrites": [
            "Brave",
          ],
          "entities": [
            {
              "acquiredWrites": [
                "Loyal",
              ],
              "entity": "Rook",
            },
          ],
          "error": null,
          "placeholders": [
            {
              "id": "mood",
              "path": [
                "Mood",
              ],
              "value": "m",
            },
          ],
          "readOnlyWrites": [
            "items.Wand.name",
            "items.Wand.instances[0].quantity",
            "locations.Dock.description",
            "location.name",
            "currencies.Coin.name",
            "traits.Brave.mode",
            "entities.Mira.type",
            "entities.Rook.name",
            "entities.Rook.description",
            "dictionaries.Lore.name",
            "dictionaries.Lore.entries["Iron Crown"].value",
          ],
          "reply": "1",
          "value": null,
        }
      `);
    });

    it('fails the run and drops every write on a throw after writes', async () => {
      expect(await run('entities.Rook.traits.Grim.enabled = true; placeholders.Mood.pin("tense"); throw new Error("late");')).toMatchInlineSnapshot(`
        {
          "error": "Error: late",
          "kind": "throw",
          "value": null,
        }
      `);
    });
  });

  describe('special runs', () => {
    it('loads entries the same after a Script replaces built-ins (Q19)', async () => {
      // Each replaced built-in throws; the Script puts them back before it returns, so only its reads meet them.
      const result = await run(`
        const poisoned = [[Object, 'defineProperty'], [Object, 'freeze'], [Object, 'create'], [Object, 'keys'], [JSON, 'parse'],
          [JSON, 'stringify'], [Array.prototype, 'map'], [Array.prototype, 'push'], [Array.prototype, Symbol.iterator], [globalThis, 'Proxy']];
        const saved = poisoned.map(([holder, key]) => holder[key]);
        for (let i = 0; i < poisoned.length; i += 1) {
          const holder = poisoned[i][0], key = poisoned[i][1];
          holder[key] = () => { throw new Error(String(key) + ' was called'); };
        }
        let read;
        try {
          const rook = entities.Rook, lamp = items['Brass Lamp'], mill = locations['Old Mill'];
          read = {
            rook: [rook.type, rook.description, rook.traits.Grim.enabled, rook.stats.Rage.value, rook.items.length, rook.placeholders.Scar.value],
            eye: persona.placeholders['Eye Color'].value, hair: placeholders.Hair.Shade.value,
            lamp: [lamp.id, lamp.instances.length, lamp.instances[1].quantity, lamp.placeholders.Glow.value],
            mill: [mill.name, mill.description, mill.present.length, mill.present[0] === entities['Old Tom']],
            coin: currencies.Coin.kind,
            names: [Reflect.ownKeys(entities), Reflect.ownKeys(items), Reflect.ownKeys(locations), Reflect.ownKeys(dictionaries), Reflect.ownKeys(currencies)],
            lore: dictionaries.Lore.enabled, wand: entities.Rook.items[0] === items.Wand.instances[0],
          };
        } catch (error) {
          read = { error: error.message };
        }
        for (let i = 0; i < poisoned.length; i += 1) poisoned[i][0][poisoned[i][1]] = saved[i];
        return read;`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "coin": "name",
            "eye": "green",
            "hair": "ash",
            "lamp": [
              "lamp",
              2,
              2,
              "dim",
            ],
            "lore": true,
            "mill": [
              "Old Mill",
              "A wheel.",
              1,
              true,
            ],
            "names": [
              [
                "Mira",
                "Rook",
                "Old Tom",
              ],
              [
                "Brass Lamp",
                "Wand",
              ],
              [
                "Dock",
                "Old Mill",
              ],
              [
                "Lore",
                "Bestiary",
              ],
              [
                "Coin",
                "Credits",
              ],
            ],
            "rook": [
              "Dwarf",
              "A smith.",
              false,
              10,
              1,
              "jaw",
            ],
            "wand": true,
          },
          "value": null,
        }
      `);
    });

    it('answers a look at each map itself as a built map does', async () => {
      const result = await run(`
        const look = (map, name) => {
          const extensible = Object.isExtensible(map), frozen = Object.isFrozen(map);
          const found = Object.getOwnPropertyDescriptor(map, name);
          const set = Reflect.set(map, name, 1), added = Reflect.set(map, 'Brand New', 1);
          return [frozen, extensible, Object.getPrototypeOf(map) === null, found.value === map[name],
            found.writable, found.enumerable, found.configurable, set, added, Reflect.deleteProperty(map, name),
            Reflect.defineProperty(map, 'Other', { value: 1 }), Reflect.setPrototypeOf(map, {}), 'Brand New' in map, map[name].name];
        };
        return { entities: look(entities, 'Rook'), items: look(items, 'Wand'), locations: look(locations, 'Dock'),
          dictionaries: look(dictionaries, 'Lore'), currencies: look(currencies, 'Coin') };`);
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "currencies": [
              true,
              false,
              true,
              true,
              false,
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              "Coin",
            ],
            "dictionaries": [
              true,
              false,
              true,
              true,
              false,
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              "Lore",
            ],
            "entities": [
              true,
              false,
              true,
              true,
              false,
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              "Rook",
            ],
            "items": [
              true,
              false,
              true,
              true,
              false,
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              "Wand",
            ],
            "locations": [
              true,
              false,
              true,
              true,
              false,
              true,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              "Dock",
            ],
          },
          "value": null,
        }
      `);
    });

    it('runs an item event over self, instance and args', async () => {
      const result = pinned(await executeStatCode(`return {
        self: self.name, instance: instance.id, owner: instance.owner, args, wandBy: items.Wand.instances.length, rookItems: owner.items.length,
      };`, [health], null, {
        ...BASE, owner: rook, args: {}, itemEvent: { itemId: 'wand', timing: 'equipped', instanceId: 'c-wand', args: { quantity: 1 } },
      }));
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "reply": {
            "args": {
              "quantity": 1,
            },
            "instance": "c-wand",
            "owner": "Rook",
            "rookItems": 1,
            "self": "Wand",
            "wandBy": 1,
          },
          "value": null,
        }
      `);
    });

    it('runs a read-only Tool over the whole world and drops its writes', async () => {
      const result = await run(`
        entities.Rook.traits.Grim.enabled = true; items.Wand.name = 'x'; dictionaries.Lore.enabled = false;
        return { names: Object.keys(entities), rook: entities.Rook.summary, give: typeof items.Wand.give, owner: typeof owner,
          scar: entities.Rook.placeholders.Scar.value, dock: location.name, lore: dictionaries.Lore.enabled };`, { readOnly: true });
      expect({ ...result, reply: replyOf(result) }).toMatchInlineSnapshot(`
        {
          "error": null,
          "readOnlyWrites": [
            "entities.Rook.traits.Grim.enabled",
            "items.Wand.name",
            "dictionaries.Lore.enabled",
          ],
          "reply": {
            "dock": "Dock",
            "give": "undefined",
            "lore": true,
            "names": [
              "Mira",
              "Rook",
              "Old Tom",
            ],
            "owner": "undefined",
            "rook": "Smith.",
            "scar": "jaw",
          },
          "value": null,
        }
      `);
    });

    it('reads entries around a player.ask on the async engine', async () => {
      const asked: string[][] = [];
      const prompts: ScriptPromptHost = {
        prompt: (request) => {
          asked.push('options' in request ? [...request.options] : []);
          // Index 1 of the options; the executor marshals whatever answer shape comes back.
          return Promise.resolve(1 as never);
        },
      };
      const result = await asRage(`
        const pick = player.ask('Who?', Object.keys(entities));
        entities[pick].traits.Grim.enabled = true;
        entities.Rook.placeholders.Scar.pin(entities[pick].summary);
        return owner.stats.Stock.value + (pick === 'Rook' ? 100 : 0);`, { prompts });
      expect(asked).toEqual([['Mira', 'Rook', 'Old Tom']]);
      expect(result).toMatchInlineSnapshot(`
        {
          "entities": [
            {
              "entity": "Rook",
              "traits": [
                {
                  "enabled": true,
                  "name": "Grim",
                },
              ],
            },
          ],
          "error": null,
          "placeholders": [
            {
              "id": "r-scar",
              "path": [
                "Rook",
                "Scar",
              ],
              "value": "Smith.",
            },
          ],
          "value": 112,
        }
      `);
    });
  });
});
