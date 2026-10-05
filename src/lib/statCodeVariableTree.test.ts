import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, Placeholder, Stat, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { executeStatCode } from './statCodeExecutor';
import { statCodeNamed } from './statCodeNames';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from './statCodePlaceholders';
import {
  CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, DELTA_FIELDS, DELTA_MEMBERS, DICTIONARY_FIELDS, ENTITY_FIELDS, PERSONA_FIELDS,
  PREVIOUS_FIELDS, SANDBOX_GLOBALS, STAT_FIELDS, TRAIT_ENTRY_FIELDS, placeholderEntryFields,
} from './statCodeSurface';
import { entityTraitNames, sandboxTraits, unplayedEntities, worldTraitPlaces } from './statCodeTraits';
import {
  TEMPLATE_NAME, buildVariableTree, variableTreeLeaves, type VariableField, type VariableNode, type VariableTreeNames,
} from './statCodeVariableTree';

const ph = (id: string, name: string, values: readonly string[], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...over });

/** A value that is exactly one chip of `id`: what nests one placeholder under another, or names a stat. */
const chip = (id: string) => `{{ph:${id}:world:p-${id}}}`;

const trait = (id: string, name: string): Trait => ({ id, name, statChanges: [] });

const stat = (id: string, name: string): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0 } as Stat);

/** A world with a name in each list, a spaced name, a chipped name, a nested placeholder, two persona
 *  entities that share a trait and a placeholder name, and a dictionary. */
const world = {
  stats: [stat('s-health', 'Health'), stat('s-mood', `${chip('mood')} Level`)],
  traits: [trait('t-brave', 'Brave'), trait('t-iron', 'Iron Will')],
  placeholders: [
    ph('mood', 'Mood', ['calm', 'tense']),
    ph('gear', 'Gear', ['rope', 'lamp'], { roll: false }),
    ph('hair', 'Hair', [chip('shade'), chip('shade-list')]),
    ph('shade', 'Shade', ['ash'], { ownerId: 'hair' }),
    // Two children of one name: the sandbox keys the later one.
    ph('shade-list', 'Shade', ['ash', 'gold'], { ownerId: 'hair', roll: false }),
  ],
  entities: [
    {
      id: 'mira', name: 'Mira', persona: true, traits: [trait('t-scar', 'Scarred'), trait('t-keen', 'Keen')],
      placeholders: [ph('m-eye', 'Eye Color', ['green'])],
    },
    {
      id: 'rook', name: 'Rook', persona: true, traits: [trait('t-scar2', 'Scarred'), trait('t-grim', 'Grim')],
      placeholders: [ph('r-eye', 'Eye Color', ['gray']), ph('r-scar', 'Scar', ['jaw'])],
    },
    { id: 'tom', name: 'Old Tom', traits: [], placeholders: [] },
  ] as Entity[],
  dictionaries: [{ id: 'lore', name: 'Lore', entries: [], placeholders: [ph('era', 'Era', ['first'])] }] as Dictionary[],
};

/** The names as the stat box hands them to the editor. */
function editorNames(): VariableTreeNames {
  const list = allPlaceholders(world);
  return {
    statNames: statCodeNamed(world.stats, list).map((s) => s.name),
    traits: worldTraitPlaces({ traits: world.traits, traitGroups: [] }, list),
    entities: entityTraitNames({ traits: world.traits, traitGroups: [], entities: world.entities }, list),
    placeholders: { list, owners: placeholderOwners(world), dictionaries: codeDictionaries(world.dictionaries, list) },
  };
}

/** A node's children, with a name list's rows read as levels named by their code names. */
const childrenOf = (node: VariableNode): readonly VariableNode[] => {
  if (node.kind === 'group') return node.children;
  if (node.kind === 'names') return node.rows.map((row) => ({ kind: 'group', label: row.name, children: row.children }));
  return [];
};

const labelOf = (node: VariableNode) => (node.kind === 'empty' ? node.message : node.label);

/** The node a menu walk reaches, by the labels and names an author picks. */
function pick(level: readonly VariableNode[], ...steps: string[]): VariableNode {
  const [step, ...rest] = steps;
  const node = level.find((candidate) => labelOf(candidate) === step);
  if (!node) throw new Error(`No “${step}” among ${level.map(labelOf).join(', ')}`);
  return rest.length ? pick(childrenOf(node), ...rest) : node;
}

const levelAt = (tree: readonly VariableNode[], ...steps: string[]) => childrenOf(pick(tree, ...steps)).map(labelOf);

const leaf = (tree: readonly VariableNode[], ...steps: string[]): VariableField => {
  const node = pick(tree, ...steps);
  if (node.kind !== 'field') throw new Error(`${steps.join(' › ')} is a ${node.kind}`);
  return node;
};

const inserts = (tree: readonly VariableNode[], ...steps: string[]) => leaf(tree, ...steps).insert;

/** The text a leaf leaves selected. */
const selected = (field: VariableField) => (field.selection ? field.insert.slice(field.selection.from, field.selection.to) : null);

const tree = buildVariableTree(editorNames());
const templateTree = buildVariableTree();
const emptyTree = buildVariableTree({});

const NAME_LISTS: Record<string, string> = { traits: 'Traits', placeholders: 'Placeholders' };

/** A surface list as its level reads: each name-keyed map is a name list under its title. */
const asLevel = (entries: readonly { name: string }[]) => entries.map((entry) => NAME_LISTS[entry.name] ?? entry.name);

describe('the top level', () => {
  it('lists the sandbox’s globals in the order an author meets them, without console', () => {
    expect(tree.map(labelOf)).toEqual(['This Stat', 'Stats', 'Traits', 'Entities', 'Persona', 'Placeholders', 'Dictionaries', 'Clock']);
  });

  it('reaches every global but console', () => {
    const roots = new Set(variableTreeLeaves(tree).map((field) => field.insert.match(/^\w+/)![0]));
    expect(SANDBOX_GLOBALS.map((entry) => entry.name).filter((name) => !roots.has(name))).toEqual(['console']);
  });
});

describe('stats', () => {
  it('roots This Stat at self and a stat under Stats at its name', () => {
    expect(inserts(tree, 'This Stat', 'value')).toBe('self.value');
    expect(inserts(tree, 'Stats', 'Health', 'value')).toBe('stats.Health.value');
    expect(levelAt(tree, 'This Stat')).toEqual(STAT_FIELDS.map((entry) => entry.name));
  });

  it('inserts a chipped name as its code name, in bracket form for its space', () => {
    expect(levelAt(tree, 'Stats')).toEqual(['Health', 'Mood Level']);
    expect(inserts(tree, 'Stats', 'Mood Level', 'value')).toBe('stats["Mood Level"].value');
  });

  it('opens previous to its fields, and delta to each source and then its fields', () => {
    expect(levelAt(tree, 'Stats', 'Health', 'previous')).toEqual(PREVIOUS_FIELDS.map((entry) => entry.name));
    expect(levelAt(tree, 'Stats', 'Health', 'delta')).toEqual(DELTA_MEMBERS.map((entry) => entry.name));
    for (const source of DELTA_MEMBERS) {
      expect(levelAt(tree, 'This Stat', 'delta', source.name)).toEqual(DELTA_FIELDS.map((entry) => entry.name));
    }
    expect(inserts(tree, 'Stats', 'Health', 'previous', 'max')).toBe('stats.Health.previous.max');
    expect(inserts(tree, 'This Stat', 'delta', 'ai', 'value')).toBe('self.delta.ai.value');
  });
});

describe('placeholders', () => {
  it('inserts roll and unpin as complete calls', () => {
    expect(inserts(tree, 'Placeholders', 'Mood', 'roll')).toBe('placeholders.Mood.roll()');
    expect(inserts(tree, 'Placeholders', 'Mood', 'unpin')).toBe('placeholders.Mood.unpin()');
  });

  it('inserts pin with its empty text selected, and an Object’s pin with a list', () => {
    const pin = leaf(tree, 'Placeholders', 'Mood', 'pin');
    expect(pin.insert).toBe('placeholders.Mood.pin("")');
    expect(pin.selection).toEqual({ from: pin.insert.indexOf('""') + 1, to: pin.insert.indexOf('""') + 1 });
    const list = leaf(tree, 'Placeholders', 'Gear', 'pin');
    expect(list.insert).toBe('placeholders.Gear.pin([""])');
    expect(list.selection).toEqual({ from: list.insert.indexOf('""') + 1, to: list.insert.indexOf('""') + 1 });
  });

  it('offers each placeholder’s fields for its kind', () => {
    expect(leaf(tree, 'Placeholders', 'Gear', 'value').detail).toBe('string[]');
    expect(leaf(tree, 'Placeholders', 'Mood', 'value').detail).toBe('string');
  });

  it('lists a held placeholder under its holder’s trail, at its whole path', () => {
    const level = pick(tree, 'Placeholders');
    expect(level.kind === 'names' && level.rows.map(({ name, trail }) => ({ name, trail }))).toEqual([
      { name: 'Mood', trail: [] }, { name: 'Gear', trail: [] }, { name: 'Hair', trail: [] }, { name: 'Shade', trail: ['Hair'] },
    ]);
    expect(inserts(tree, 'Placeholders', 'Shade', 'value')).toBe('placeholders.Hair.Shade.value');
  });

  it('reads a held name two children share as the later child, as the sandbox keys it', () => {
    expect(inserts(tree, 'Placeholders', 'Shade', 'pin')).toBe('placeholders.Hair.Shade.pin([""])');
  });
});

describe('entities, the persona and dictionaries', () => {
  it('opens an entity to its fields plus Traits and Placeholders over its own names', () => {
    expect(levelAt(tree, 'Entities')).toEqual(['Mira', 'Rook', 'Old Tom']);
    expect(levelAt(tree, 'Entities', 'Mira')).toEqual(asLevel(ENTITY_FIELDS));
    expect(levelAt(tree, 'Entities', 'Mira', 'Traits')).toEqual(['Scarred', 'Keen']);
    expect(levelAt(tree, 'Entities', 'Mira', 'Placeholders')).toEqual(['Eye Color']);
    expect(inserts(tree, 'Entities', 'Mira', 'Traits', 'Keen', 'enabled')).toBe('entities.Mira.traits.Keen.enabled');
    expect(inserts(tree, 'Entities', 'Mira', 'Placeholders', 'Eye Color', 'value')).toBe('entities.Mira.placeholders["Eye Color"].value');
    expect(inserts(tree, 'Entities', 'Old Tom', 'inScene')).toBe('entities["Old Tom"].inScene');
  });

  it('lists a world trait under its groups, and an ungrouped one under World', () => {
    const traits = worldTraitPlaces({
      traits: [{ ...trait('t-brave', 'Brave'), groupId: 'g-virtues' }, trait('t-iron', 'Iron Will')],
      traitGroups: [{ id: 'g-virtues', name: 'Virtues', parentId: null }],
    }, []);
    const level = pick(buildVariableTree({ ...editorNames(), traits }), 'Traits');
    expect(level.kind === 'names' && level.rows.map(({ name, trail }) => ({ name, trail }))).toEqual([
      { name: 'Brave', trail: ['Virtues'] }, { name: 'Iron Will', trail: ['World'] },
    ]);
  });

  it('inserts a trait with a space in bracket form', () => {
    const traits = worldTraitPlaces({ traits: [trait('t-iron', 'Iron Will')], traitGroups: [] }, []);
    expect(inserts(buildVariableTree({ ...editorNames(), traits }), 'Traits', 'Iron Will', 'enabled')).toBe('traits["Iron Will"].enabled');
  });

  it('unions the persona entities’ traits and placeholders, once per code name, with the owner as the trail', () => {
    const traits = pick(tree, 'Persona', 'Traits');
    expect(traits.kind === 'names' && traits.rows.map(({ name, trail }) => ({ name, trail }))).toEqual([
      { name: 'Scarred', trail: ['Mira'] }, { name: 'Keen', trail: ['Mira'] }, { name: 'Grim', trail: ['Rook'] },
    ]);
    const placeholders = pick(tree, 'Persona', 'Placeholders');
    expect(placeholders.kind === 'names' && placeholders.rows.map(({ name, trail }) => ({ name, trail }))).toEqual([
      { name: 'Eye Color', trail: ['Mira'] }, { name: 'Scar', trail: ['Rook'] },
    ]);
    expect(inserts(tree, 'Persona', 'Traits', 'Grim', 'enabled')).toBe('persona.traits.Grim.enabled');
    expect(inserts(tree, 'Persona', 'Placeholders', 'Scar', 'text')).toBe('persona.placeholders.Scar.text');
    expect(inserts(tree, 'Persona', 'inScene')).toBe('persona.inScene');
  });

  it('opens a dictionary to its fields plus a Placeholders list of its own', () => {
    expect(levelAt(tree, 'Dictionaries', 'Lore')).toEqual(asLevel(DICTIONARY_FIELDS));
    expect(levelAt(tree, 'Persona')).toEqual(asLevel(PERSONA_FIELDS));
    expect(levelAt(tree, 'Dictionaries', 'Lore', 'Placeholders')).toEqual(['Era']);
    expect(inserts(tree, 'Dictionaries', 'Lore', 'Placeholders', 'Era', 'value')).toBe('dictionaries.Lore.placeholders.Era.value');
  });

  it('opens the clock to its members and its previous to the start of the turn', () => {
    expect(levelAt(tree, 'Clock')).toEqual(CLOCK_MEMBERS.map((entry) => entry.name));
    expect(levelAt(tree, 'Clock', 'previous')).toEqual(CLOCK_PREVIOUS_FIELDS.map((entry) => entry.name));
    expect(inserts(tree, 'Clock', 'previous', 'daypart')).toBe('clock.previous.daypart');
  });
});

describe('an empty world', () => {
  it('keeps every group, each empty name list one marker with its message', () => {
    expect(emptyTree.map(labelOf)).toEqual(tree.map(labelOf));
    expect(levelAt(emptyTree, 'Stats')).toEqual(['No stats in this world']);
    expect(levelAt(emptyTree, 'Traits')).toEqual(['No traits in this world']);
    expect(levelAt(emptyTree, 'Entities')).toEqual(['No entities in this world']);
    expect(levelAt(emptyTree, 'Placeholders')).toEqual(['No placeholders in this world']);
    expect(levelAt(emptyTree, 'Dictionaries')).toEqual(['No dictionaries in this world']);
    expect(levelAt(emptyTree, 'Persona', 'Traits')).toEqual(['No traits on a persona entity']);
    expect(levelAt(emptyTree, 'Persona', 'Placeholders')).toEqual(['No placeholders on a persona entity']);
    expect(pick(emptyTree, 'Stats', 'No stats in this world').kind).toBe('empty');
  });

  it('marks an entity with no traits or placeholders of its own', () => {
    expect(levelAt(tree, 'Entities', 'Old Tom', 'Traits')).toEqual(['No traits on this entity']);
    expect(levelAt(tree, 'Entities', 'Old Tom', 'Placeholders')).toEqual(['No placeholders on this entity']);
  });
});

describe('field info', () => {
  it.each([
    [['This Stat'], STAT_FIELDS],
    [['Stats', 'Health', 'previous'], PREVIOUS_FIELDS],
    [['This Stat', 'delta'], DELTA_MEMBERS],
    [['This Stat', 'delta', 'actual'], DELTA_FIELDS],
    [['Clock'], CLOCK_MEMBERS],
    [['Clock', 'previous'], CLOCK_PREVIOUS_FIELDS],
    [['Traits', 'Brave'], TRAIT_ENTRY_FIELDS],
    [['Entities', 'Mira'], ENTITY_FIELDS],
    [['Entities', 'Mira', 'Traits', 'Keen'], TRAIT_ENTRY_FIELDS],
    [['Persona'], PERSONA_FIELDS],
    [['Dictionaries', 'Lore'], DICTIONARY_FIELDS],
    [['Placeholders', 'Mood'], placeholderEntryFields('Wildcard')],
    [['Placeholders', 'Gear'], placeholderEntryFields('Object')],
    [['Entities', 'Mira', 'Placeholders', 'Eye Color'], placeholderEntryFields('Variable')],
  ] as const)('carries its surface entry’s detail and info at %j', (steps, entries) => {
    const level = childrenOf(pick(tree, ...steps));
    for (const entry of entries) {
      const node = level.find((candidate) => labelOf(candidate).toLowerCase() === entry.name.toLowerCase());
      expect(node && node.kind !== 'empty' && { detail: node.kind === 'field' ? node.detail : entry.detail, info: node.info })
        .toEqual({ detail: entry.detail, info: entry.info });
    }
  });
});

describe('template mode', () => {
  it('offers one type-over Name row per name list', () => {
    for (const steps of [['Stats'], ['Traits'], ['Entities'], ['Entities', TEMPLATE_NAME, 'Traits'], ['Entities', TEMPLATE_NAME, 'Placeholders'],
      ['Persona', 'Traits'], ['Persona', 'Placeholders'], ['Placeholders'], ['Dictionaries'], ['Dictionaries', TEMPLATE_NAME, 'Placeholders']]) {
      expect(levelAt(templateTree, ...steps)).toEqual([TEMPLATE_NAME]);
    }
  });

  it('inserts the type-over name in bracket form, selected', () => {
    const value = leaf(templateTree, 'Stats', TEMPLATE_NAME, 'value');
    expect(value.insert).toBe('stats["Name"].value');
    expect(selected(value)).toBe(TEMPLATE_NAME);
  });

  it('selects the first type-over name of a path that has two', () => {
    const enabled = leaf(templateTree, 'Entities', TEMPLATE_NAME, 'Traits', TEMPLATE_NAME, 'enabled');
    expect(enabled.insert).toBe('entities["Name"].traits["Name"].enabled');
    expect(enabled.selection).toEqual({ from: 'entities["'.length, to: 'entities["Name'.length });
  });

  it('keeps the type-over name selected on pin, not the empty text', () => {
    const pin = leaf(templateTree, 'Placeholders', TEMPLATE_NAME, 'pin');
    expect(pin.insert).toBe('placeholders["Name"].pin("")');
    expect(selected(pin)).toBe(TEMPLATE_NAME);
  });

  it('leaves the rest of the tree as it is in a world', () => {
    expect(templateTree.map(labelOf)).toEqual(tree.map(labelOf));
    expect(inserts(templateTree, 'This Stat', 'value')).toBe('self.value');
    expect(inserts(templateTree, 'Clock', 'day')).toBe('clock.day');
  });
});

describe('every leaf against the sandbox', () => {
  const names = editorNames();
  const { list, owners } = names.placeholders!;
  const stats = world.stats.map((s) => ({ ...s, name: names.statNames![world.stats.indexOf(s)] }));
  const placeholders = sandboxPlaceholders({ placeholders: list, owners, rolls: {} });
  const entities = unplayedEntities(names.entities!, placeholders.owners);
  // As Test Code runs it, with Mira played so the persona's own names are real.
  const run = (code: string) => executeStatCode(code, stats, stats[0], {
    placeholders: placeholders.top,
    traits: sandboxTraits({ acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: world.traits, groups: [] } }, list),
    entities,
    persona: entities.find((entity) => entity.id === 'mira'),
    dictionaries: sandboxDictionaries(names.placeholders!.dictionaries ?? [], placeholders.owners),
  });

  // A pin through a path that reaches nothing is dropped, not thrown, so that is checked apart from the run.
  // Only Mira plays, so the persona's union reaches Rook's names as blanks.
  it.each(variableTreeLeaves(tree).map((field) => [field.insert]))('runs %s as inserted', async (insert) => {
    const result = await run(`const read = ${insert}; return 1;`);
    expect(result).toMatchObject({ value: 1, error: null });
    if (!insert.startsWith('persona')) expect([result.unknownPlaceholders, result.unknownOwnerPlaceholders]).toEqual([undefined, undefined]);
  });

  // The row's kind sets its `pin` form, so it must be the kind of the entry the path reaches.
  it.each(variableTreeLeaves(tree).filter((field) => field.label === 'value' && field.detail.startsWith('string')
    && !field.insert.startsWith('persona')).map((field) => [field.insert, field.detail]))(
    'reads %s as a %s', async (insert, detail) => {
      await expect(run(`return Array.isArray(${insert}) === ${detail === 'string[]'} ? 1 : 0;`))
        .resolves.toMatchObject({ value: 1, error: null });
    },
  );

  // An unknown name reads as a blank entry, so a template's type-over path must run too.
  it.each(variableTreeLeaves(templateTree).map((field) => [field.insert]))('runs the template’s %s as inserted', async (insert) => {
    await expect(run(`const read = ${insert}; return 1;`)).resolves.toMatchObject({ value: 1, error: null });
  });

  // A blank entry runs clean too; a real one reads its own key as its name.
  const rowNames = (nodes: readonly VariableNode[]): [string, string][] => nodes.flatMap((node): [string, string][] => {
    if (node.kind === 'group') return node.label === 'Persona' ? [] : rowNames(node.children);
    if (node.kind !== 'names') return [];
    return node.rows.flatMap((row) => {
      const name = row.children.find((child) => child.kind === 'field' && child.label === 'name');
      return [...(name?.kind === 'field' ? [[name.insert, row.name] as [string, string]] : []), ...rowNames(row.children)];
    });
  });
  it.each(rowNames(tree))('reaches a real entry with %s', async (insert, key) => {
    await expect(run(`return ${insert} === ${JSON.stringify(key)} ? 1 : 0;`)).resolves.toMatchObject({ value: 1, error: null });
  });
});
