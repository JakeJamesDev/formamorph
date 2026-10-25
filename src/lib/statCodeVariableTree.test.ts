import { describe, it, expect } from 'vitest';
import type { Dictionary, Entity, Placeholder, ScriptTiming, Stat, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { executeStatCode } from './statCodeExecutor';
import { statCodeNamed } from './statCodeNames';
import { codeDictionaries, sandboxDictionaries, sandboxPlaceholders } from './statCodePlaceholders';
import {
  CLOCK_MEMBERS, CLOCK_PREVIOUS_FIELDS, TURN_MEMBERS, LOCATION_ENTRY_FIELDS, LOCATION_EXIT_FIELDS, LOCATION_MEMBERS, MEMORY_ENTRY_FIELDS, MEMORY_MEMBERS, DELTA_FIELDS, DELTA_MEMBERS, DICTIONARY_FIELDS, ENTITY_FIELDS, PERSONA_FIELDS,
  NARRATION_FIELDS, PLAYER_CALL_ENTRIES, PREVIOUS_FIELDS, SANDBOX_GLOBALS, STAT_CODE_SURFACE, STAT_FIELDS, TRAIT_ENTRY_FIELDS,
  placeholderEntryFields, scriptSurface,
} from './statCodeSurface';
import { codeDiagnostics } from './statCodeAnalysis';
import { codeCard } from './codeCards';
import { entityTraitNames, sandboxTraits, unplayedEntities, worldTraitPlaces } from './statCodeTraits';
import {
  TEMPLATE_NAME, buildVariableTree, isVerbLeaf, readOnlyTree, timingGlobalsOf, variableTreeLeaves, type VariableField, type VariableNode, type VariableTreeNames,
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
  dictionaries: [{
    id: 'lore', name: 'Lore', placeholders: [ph('era', 'Era', ['first'])], entries: [
      { id: 'crown', name: 'Iron Crown', key: ['crown'], value: 'A crown.' },
      { id: 'sealed', name: 'Sealed', key: ['vault'], value: 'Hidden.', enabled: false },
    ],
  }] as Dictionary[],
};

/** The names as the stat box hands them to the editor. */
function editorNames(): VariableTreeNames {
  const list = allPlaceholders(world);
  return {
    statNames: statCodeNamed(world.stats, list).map((s) => s.name),
    traits: worldTraitPlaces({ traits: world.traits, traitGroups: [] }, list),
    entities: entityTraitNames({ traits: world.traits, traitGroups: [], entities: world.entities }, list),
    placeholders: { list, owners: placeholderOwners(world), dictionaries: codeDictionaries(world.dictionaries, list) },
    locations: ['Dock', 'Old Mill'],
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

const NAME_LISTS: Record<string, string> = { traits: 'Traits', placeholders: 'Placeholders', stats: 'Stats', entries: 'Entries' };

/** A surface list as its level reads: each name-keyed map is a name list under its title. */
const asLevel = (entries: readonly { name: string }[]) => entries.map((entry) => NAME_LISTS[entry.name] ?? entry.name);

describe('the top level', () => {
  it('lists the sandbox’s globals in the order an author meets them, without console', () => {
    expect(tree.map(labelOf)).toEqual(['This Stat', 'Stats', 'Traits', 'Entities', 'Persona', 'Placeholders', 'Dictionaries', 'Clock', 'Turn', 'Locations', 'Location', 'discover', 'Memories', 'notes']);
  });

  it('inserts discover directly, with no group around the one call', () => {
    expect(leaf(tree, 'discover')).toMatchObject({ insert: 'discover("Name")' });
    expect(selected(leaf(tree, 'discover'))).toBe('"Name"');
  });

  // A group's one child would be a menu step that picks nothing.
  const oneChildGroups = (nodes: readonly VariableNode[], at: string[] = []): string[] => nodes.flatMap((node) => {
    if (node.kind === 'empty' || node.kind === 'field') return [];
    const here = [...at, node.label];
    const own = node.kind === 'group' && node.children.length === 1 && node.children[0].kind === 'field' ? [here.join(' › ')] : [];
    return [...own, ...oneChildGroups(childrenOf(node), here)];
  });
  it.each([['the world', tree], ['a template', templateTree], ['an empty world', emptyTree]])('draws no group of one field in %s', (_case, nodes) => {
    expect(oneChildGroups(nodes)).toEqual([]);
  });

  // `owner` is empty in a world stat's code, so only an owned or Blueprint stat's menu reaches it.
  it('reaches every global but console, an owned stat’s menu included', () => {
    const owned = buildVariableTree(editorNames(), { kind: 'entity', entity: null });
    const roots = new Set(variableTreeLeaves(owned).map((field) => field.insert.match(/^\w+/)![0]));
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

  it('lists a held placeholder under its parent’s trail, at its whole path', () => {
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

  it('opens an entity’s Stats over its own stat names, and the persona’s over every persona entity’s', () => {
    const entities = world.entities.map((entity) => (entity.id === 'mira' ? { ...entity, stats: [stat('m-trust', 'Trust')] }
      : entity.id === 'tom' ? { ...entity, stats: [stat('t-stock', 'Eel Stock')] } : entity));
    const withStats = buildVariableTree({
      ...editorNames(), entities: entityTraitNames({ traits: world.traits, traitGroups: [], entities }, allPlaceholders(world)),
    });
    expect(levelAt(withStats, 'Entities', 'Mira', 'Stats')).toEqual(['Trust']);
    expect(inserts(withStats, 'Entities', 'Old Tom', 'Stats', 'Eel Stock', 'delta', 'regen', 'value'))
      .toBe('entities["Old Tom"].stats["Eel Stock"].delta.regen.value');
    expect(levelAt(withStats, 'Entities', 'Rook', 'Stats')).toEqual(['No stats on this entity']);
    expect(inserts(withStats, 'Persona', 'Stats', 'Trust', 'value')).toBe('persona.stats.Trust.value');
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

  it('lists a dictionary’s enabled entries under it, each with its four fields', () => {
    expect(levelAt(tree, 'Dictionaries', 'Lore', 'Entries')).toEqual(['Iron Crown']);
    expect(levelAt(tree, 'Dictionaries', 'Lore', 'Entries', 'Iron Crown')).toEqual(['id', 'name', 'keys', 'value']);
    expect(inserts(tree, 'Dictionaries', 'Lore', 'Entries', 'Iron Crown', 'keys')).toBe('dictionaries.Lore.entries["Iron Crown"].keys');
  });

  it('opens the clock to its members and its previous to the start of the turn', () => {
    expect(levelAt(tree, 'Clock')).toEqual(CLOCK_MEMBERS.map((entry) => entry.name));
    expect(levelAt(tree, 'Clock', 'previous')).toEqual(CLOCK_PREVIOUS_FIELDS.map((entry) => entry.name));
    expect(inserts(tree, 'Clock', 'previous', 'daypart')).toBe('clock.previous.daypart');
  });

  it('opens turn to its action and number, each read-only', () => {
    expect(levelAt(tree, 'Turn')).toEqual(['action', 'number']);
    expect(inserts(tree, 'Turn', 'number')).toBe('turn.number');
    expect(childrenOf(pick(tree, 'Turn')).map((node) => node.kind === 'field' && node.access)).toEqual(['readOnly', 'readOnly']);
  });
});

/** Mira holding two stats, as the stat box hands her to the editor. */
const miraNames = () => {
  const entities = world.entities.map((entity) => (entity.id === 'mira'
    ? { ...entity, stats: [stat('m-trust', 'Trust'), stat('m-streak', 'Cold Streak')] } : entity));
  return entityTraitNames({ traits: world.traits, traitGroups: [], entities }, allPlaceholders(world)).find((entity) => entity.id === 'mira')!;
};

describe('verbs last in a group (R7)', () => {
  /** Every group, at any depth, with a verb before a non-verb among its children. */
  const misordered = (nodes: readonly VariableNode[], at: string[] = []): string[] => nodes.flatMap((node) => {
    if (node.kind === 'empty' || node.kind === 'field') return [];
    const here = [...at, node.label];
    const level = childrenOf(node);
    const firstVerb = level.findIndex(isVerbLeaf);
    const bad = node.kind === 'group' && firstVerb >= 0 && level.slice(firstVerb).some((child) => !isVerbLeaf(child)) ? [here.join(' › ')] : [];
    return [...bad, ...misordered(level, here)];
  });

  const owner = { kind: 'entity', entity: null } as const;
  const timing = { narration: true, player: true, trait: true };
  const worldTree = buildVariableTree(editorNames(), owner, 'stat', timing);
  const toolTree = readOnlyTree(buildVariableTree(editorNames(), null, 'empty', timing));

  it.each([['a world script', worldTree], ['a template', buildVariableTree(undefined, owner, 'stat', timing)]])(
    'puts no verb before a field in %s',
    (_case, nodes) => {
      expect(variableTreeLeaves(nodes).filter(isVerbLeaf).length).toBeGreaterThan(0);
      expect(misordered(nodes)).toEqual([]);
    },
  );

  // Q24: a Tool script's menu drops every verb, so its order is the fields' alone.
  it('keeps a user Tool script’s read-only menu in order, with no verb left in it', () => {
    expect(variableTreeLeaves(toolTree).some(isVerbLeaf)).toBe(false);
    expect(misordered(toolTree)).toEqual([]);
  });

  it('reads an entity’s fields, then move, follow, unfollow, diary', () => {
    expect(levelAt(tree, 'Entities', 'Mira').slice(-4)).toEqual(['move', 'follow', 'unfollow', 'diary']);
  });

  it('reads the memory entry’s eleven fields, then pin, forget, edit, remove', () => {
    const level = levelAt(tree, 'Memories', 'memories[0]');
    const verbs = ['pin', 'forget', 'edit', 'remove'];
    const names = MEMORY_ENTRY_FIELDS.map((entry) => entry.name);
    expect(level).toEqual([...names.filter((name) => !verbs.includes(name)), ...verbs]);
    expect(level.length - verbs.length).toBe(11);
  });

});

describe('the owner’s group', () => {
  const entityOwner = buildVariableTree(editorNames(), { kind: 'entity', entity: miraNames() });
  const blueprintOwner = buildVariableTree(editorNames(), { kind: 'blueprint', statNames: ['Grit', 'Gold Lust'] });

  it('adds an Owner group after This Stat in an owned box only', () => {
    expect(entityOwner.map(labelOf)).toEqual(['This Stat', 'Owner', ...tree.map(labelOf).slice(1)]);
    expect(blueprintOwner.map(labelOf)).toEqual(entityOwner.map(labelOf));
    expect(tree.map(labelOf)).not.toContain('Owner');
  });

  it('opens an owned box’s Owner to an entity entry’s fields, as Entities does', () => {
    expect(levelAt(entityOwner, 'Owner')).toEqual(asLevel(ENTITY_FIELDS));
    expect(inserts(entityOwner, 'Owner', 'inScene')).toBe('owner.inScene');
  });

  it('lists the owner’s stats, traits and placeholders under owner', () => {
    expect(levelAt(entityOwner, 'Owner', 'Stats')).toEqual(['Trust', 'Cold Streak']);
    expect(inserts(entityOwner, 'Owner', 'Stats', 'Trust', 'value')).toBe('owner.stats.Trust.value');
    expect(inserts(entityOwner, 'Owner', 'Stats', 'Cold Streak', 'delta', 'regen', 'value'))
      .toBe('owner.stats["Cold Streak"].delta.regen.value');
    expect(levelAt(entityOwner, 'Owner', 'Traits')).toEqual(['Scarred', 'Keen']);
    expect(inserts(entityOwner, 'Owner', 'Traits', 'Keen', 'enabled')).toBe('owner.traits.Keen.enabled');
    expect(levelAt(entityOwner, 'Owner', 'Placeholders')).toEqual(['Eye Color']);
    expect(inserts(entityOwner, 'Owner', 'Placeholders', 'Eye Color', 'value')).toBe('owner.placeholders["Eye Color"].value');
  });

  it('lists the world stats under Stats in every box, never the owner’s', () => {
    for (const built of [tree, entityOwner, blueprintOwner]) {
      expect(levelAt(built, 'Stats')).toEqual(['Health', 'Mood Level']);
      expect(inserts(built, 'Stats', 'Health', 'value')).toBe('stats.Health.value');
    }
  });

  it('lists a Blueprint group’s stats under Owner, with no traits or placeholders of its own', () => {
    expect(levelAt(blueprintOwner, 'Owner', 'Stats')).toEqual(['Grit', 'Gold Lust']);
    expect(inserts(blueprintOwner, 'Owner', 'Stats', 'Gold Lust', 'value')).toBe('owner.stats["Gold Lust"].value');
    expect(levelAt(blueprintOwner, 'Owner', 'Traits')).toEqual(['No traits in this Blueprint group']);
    expect(levelAt(blueprintOwner, 'Owner', 'Placeholders')).toEqual(['No placeholders in this Blueprint group']);
  });

  it('marks an owner with no stats', () => {
    const bare = buildVariableTree(editorNames(), { kind: 'entity', entity: { ...miraNames(), stats: [] } });
    expect(levelAt(bare, 'Owner', 'Stats')).toEqual(['No stats on this entity']);
  });

  it('types over each Owner list in template mode, and adds nothing to a world box’s', () => {
    const typed = buildVariableTree(undefined, { kind: 'entity', entity: null });
    for (const steps of [['Owner', 'Stats'], ['Owner', 'Traits'], ['Owner', 'Placeholders']]) {
      expect(levelAt(typed, ...steps)).toEqual([TEMPLATE_NAME]);
    }
    const value = leaf(typed, 'Owner', 'Stats', TEMPLATE_NAME, 'value');
    expect(value.insert).toBe('owner.stats["Name"].value');
    expect(selected(value)).toBe(TEMPLATE_NAME);
    expect(levelAt(buildVariableTree(undefined, { kind: 'blueprint', statNames: null }), 'Owner', 'Stats')).toEqual([TEMPLATE_NAME]);
    expect(buildVariableTree(undefined, null).map(labelOf)).toEqual(templateTree.map(labelOf));
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
    [['Turn'], TURN_MEMBERS],
    [['Location'], LOCATION_MEMBERS],
    [['Locations', 'Old Mill'], LOCATION_ENTRY_FIELDS],
    [['Memories'], MEMORY_MEMBERS],
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

describe('array elements', () => {
  // The fields only: the persona has no verbs and stands first where the player is.
  const presentFields = [
    'id', 'name', 'type', 'pronouns', 'inScene', 'location', 'following', 'description', 'summary', 'aliases', 'traits', 'placeholders', 'stats',
  ];

  it('lists the memory element’s group, then the memories calls, with the verbs last', () => {
    expect(levelAt(tree, 'Memories')).toEqual(['memories[0]', 'add', 'pin']);
    expect(levelAt(tree, 'Memories', 'memories[0]')).toEqual(MEMORY_ENTRY_FIELDS.map((entry) => entry.name));
  });

  it('lists the present list first, then an entity entry’s fields, under the location and each locations row', () => {
    for (const steps of [['Location', 'present'], ['Locations', 'Old Mill', 'present'], ['Locations', 'Dock', 'present']]) {
      expect(levelAt(tree, ...steps)).toEqual(['present', ...presentFields]);
    }
    expect(inserts(tree, 'Location', 'present', 'present')).toBe('location.present');
  });

  it('lists the exits list first, then an exit’s fields, under the location and each locations row', () => {
    for (const steps of [['Location', 'exits'], ['Locations', 'Old Mill', 'exits'], ['Locations', 'Dock', 'exits']]) {
      expect(levelAt(tree, ...steps)).toEqual(['exits', 'name', 'hint']);
    }
    expect(inserts(tree, 'Location', 'exits', 'hint')).toBe('location.exits[0]?.hint');
    expect(inserts(tree, 'Locations', 'Old Mill', 'parent')).toBe('locations["Old Mill"].parent');
    expect(inserts(tree, 'Location', 'children')).toBe('location.children');
  });

  it.each([
    [['Memories', 'memories[0]', 'text'], 'memories[0]?.text', '0'],
    [['Location', 'present', 'following'], 'location.present[0]?.following', '0'],
    [['Locations', 'Old Mill', 'present', 'name'], 'locations["Old Mill"].present[0]?.name', '0'],
  ])('inserts %j with the index to type over', (steps, insert, selection) => {
    expect(inserts(tree, ...steps)).toBe(insert);
    expect(selected(leaf(tree, ...steps))).toBe(selection);
  });

  it.each([['pin', 'memories[0]?.pin()'], ['forget', 'memories[0]?.forget()'], ['edit', 'memories[0]?.edit("Text")'], ['remove', 'memories[0]?.remove()']])(
    'calls a memory’s %s complete, the index to type over', (verb, insert) => {
      const call = leaf(tree, 'Memories', 'memories[0]', verb);
      expect(call.insert).toBe(insert);
      expect(selected(call)).toBe('0');
    },
  );

  it('keeps a template’s type-over name selected over the index', () => {
    const name = leaf(templateTree, 'Locations', TEMPLATE_NAME, 'present', 'name');
    expect(name.insert).toBe('locations["Name"].present[0]?.name');
    expect(selected(name)).toBe(TEMPLATE_NAME);
  });

  // The menu and the cards read one element shape, so every element leaf has the card of the field it names.
  const elementLeaves = variableTreeLeaves(tree).filter((field) => field.insert.includes('[0]'));
  it('has element leaves to check', () => { expect(elementLeaves.length).toBe(MEMORY_ENTRY_FIELDS.length + (presentFields.length + LOCATION_EXIT_FIELDS.length) * 3); });
  it.each(elementLeaves.map((field) => [field.insert, field]))('gives %s the card of its field', (insert, field) => {
    const card = codeCard(insert, insert.lastIndexOf(`.${field.label}`) + 2, { surface: STAT_CODE_SURFACE });
    expect(card).toMatchObject({ description: field.info, signature: { type: field.detail } });
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
    // Test Code stands at the world's starting location.
    places: { locations: [{ id: 'dock', name: 'Dock' }, { id: 'mill', name: 'Old Mill' }], location: { id: 'dock', name: 'Dock' } },
  });

  // `diary` writes for a real entity and never the persona, so it has its own cases below.
  const isDiary = (field: VariableField) => field.label === 'diary';

  // A pin through a path that reaches nothing is dropped, not thrown, so that is checked apart from the run.
  // Only Mira plays, so the persona's union reaches Rook's names as blanks.
  it.each(variableTreeLeaves(tree).filter((field) => !isDiary(field)).map((field) => [field.insert]))('runs %s as inserted', async (insert) => {
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
  it.each(variableTreeLeaves(templateTree).filter((field) => !isDiary(field)).map((field) => [field.insert]))('runs the template’s %s as inserted', async (insert) => {
    await expect(run(`const read = ${insert}; return 1;`)).resolves.toMatchObject({ value: 1, error: null });
  });

  it('lists diary on each entity’s entry and nowhere at the top level or on the persona', () => {
    expect(variableTreeLeaves(tree).filter(isDiary).map((field) => field.insert)).toEqual(['entities.Mira.diary("Line")', 'entities.Rook.diary("Line")', 'entities["Old Tom"].diary("Line")']);
  });

  it('writes the diary of an entity the player doesn’t play as inserted, the line left to type over', async () => {
    const diary = leaf(tree, 'Entities', 'Rook', 'diary');
    expect(selected(diary)).toBe('"Line"');
    expect(await run(`${diary.insert}; return 1;`)).toMatchObject({ value: 1, error: null, worldWrites: { diary: [{ entity: 'rook', line: 'Line' }] } });
    expect((await run(`${leaf(tree, 'Entities', 'Mira', 'diary').insert}; return 1;`)).error).toMatch(/no entity named "Mira"/);
  });

  it('leaves the template’s entity name to type over, since no entity is called Name', async () => {
    const [diary] = variableTreeLeaves(templateTree).filter(isDiary);
    expect(diary.insert).toBe('entities["Name"].diary("Line")');
    expect(selected(diary)).toBe('Name');
    expect((await run(`${diary.insert}; return 1;`)).error).toMatch(/no entity named "Name"/);
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

  // Mira's own Trust runs the code, so `owner` is a real entry and `stats` still holds the world's.
  const trust = stat('m-trust', 'Trust');
  const mira = { ...entities.find((entity) => entity.id === 'mira')!, stats: { stats: [trust, stat('m-streak', 'Cold Streak')] } };
  const asTrust = (code: string) => executeStatCode(code, stats, trust, {
    placeholders: placeholders.top, entities: entities.map((entity) => (entity.id === 'mira' ? mira : entity)), owner: mira,
  });
  const ownerTree = buildVariableTree(names, { kind: 'entity', entity: miraNames() });
  const ownerLeaves = variableTreeLeaves(ownerTree).filter((field) => field.insert.startsWith('owner'));
  it('has owner leaves to run', () => { expect(ownerLeaves.length).toBeGreaterThan(20); });
  it.each(ownerLeaves.map((field) => [field.insert]))('runs the owner’s %s as inserted', async (insert) => {
    await expect(asTrust(`const read = ${insert}; return 1;`)).resolves.toMatchObject({ value: 1, error: null });
  });
  it('reads a real stat through the owner’s and the world’s routes', async () => {
    await expect(asTrust('return owner.stats["Cold Streak"].name === "Cold Streak" && stats.Health.name === "Health" ? 1 : 0;'))
      .resolves.toMatchObject({ value: 1, error: null });
  });
});

describe('the names a script’s timing adds', () => {
  const treeAt = (timing: ScriptTiming) => {
    const surface = scriptSurface(STAT_CODE_SURFACE, timing);
    return { surface, built: buildVariableTree(editorNames(), null, 'stat', timingGlobalsOf(surface)) };
  };

  it('lists Narration in During AI Output only, Player in every other timing, and Switched Trait on a switch only', () => {
    expect(treeAt('output').built.map(labelOf).slice(-1)).toEqual(['Narration']);
    expect(treeAt('before').built.map(labelOf).slice(-1)).toEqual(['Player']);
    expect(treeAt('switch').built.map(labelOf).slice(-2)).toEqual(['Player', 'Switched Trait']);
    for (const timing of ['before', 'after', 'output', 'start'] as const) {
      expect(treeAt(timing).built.map(labelOf)).not.toContain('Switched Trait');
    }
    expect(tree.map(labelOf)).not.toContain('Narration');
    expect(tree.map(labelOf)).not.toContain('Player');
  });

  it('opens Narration to its fields and Player to its calls, each inserted whole', () => {
    expect(levelAt(treeAt('output').built, 'Narration')).toEqual(NARRATION_FIELDS.map((field) => field.name));
    expect(inserts(treeAt('output').built, 'Narration', 'sentence')).toBe('narration.sentence');
    expect(levelAt(treeAt('after').built, 'Player')).toEqual(PLAYER_CALL_ENTRIES.map((call) => call.name));
    const confirm = leaf(treeAt('after').built, 'Player', 'confirm');
    expect(confirm.insert).toBe('player.confirm("")');
    expect(confirm.selection).toEqual({ from: 'player.confirm("'.length, to: 'player.confirm("'.length });
    expect(inserts(treeAt('after').built, 'Player', 'ask')).toBe('player.ask("", [])');
    expect(inserts(treeAt('switch').built, 'Switched Trait', 'enabled')).toBe('trait.enabled');
  });

  const insertsOf = (timing: ScriptTiming) => {
    const { surface, built } = treeAt(timing);
    const added = built.filter((node) => ['Narration', 'Player', 'Switched Trait'].includes(labelOf(node)));
    return variableTreeLeaves(added).map((field) => [timing, field.insert, surface] as const);
  };
  it.each((['before', 'after', 'output', 'start', 'switch'] as const).flatMap(insertsOf))(
    'inserts a path the %s script reads clean: %s',
    (_timing, insert, surface) => {
      const errors = codeDiagnostics(`const read = ${insert};`, { surface, statNames: ['Health'] }).filter((d) => d.severity === 'error');
      expect(errors.map((d) => d.message)).toEqual([]);
    },
  );
});
