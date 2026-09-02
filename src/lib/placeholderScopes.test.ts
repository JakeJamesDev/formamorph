import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, Entity, Placeholder } from '@/types';
import {
  applyScopedPlaceholderDrop, ownerIdOfNode, ownerNodeId, placeholderDropAllowed, placeholderTreeNodes,
  type PlaceholderTreeNode,
} from './placeholderScopes';

// Through the real codec, never a hand-written token.
const chip = (id: string, at = '1') => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}-${at}` });

const P = (id: string, name: string, values: string[] = [], ownerId?: string): Placeholder => ({
  id, name, values: phValues(values), ...(ownerId ? { ownerId } : {}),
});

const TOWN = P('town', 'Town', ['Sedge Landing', 'Milbrook']);
const EYES = P('eyes', 'Eyes', ['amber', 'gray']);
const LORE = P('lore', 'Lore', ['the Fen']);

const molly = (placeholders: Placeholder[] = [EYES], extra: Partial<Entity> = {}): Entity =>
  ({ id: 'molly', name: 'Molly', ...(placeholders.length ? { placeholders } : {}), ...extra });
const tam = (placeholders: Placeholder[] = [], extra: Partial<Entity> = {}): Entity =>
  ({ id: 'tam', name: 'Tam', ...(placeholders.length ? { placeholders } : {}), ...extra });
const book = (placeholders: Placeholder[] = [LORE]): Dictionary =>
  ({ id: 'book', name: 'Fen', entries: [], ...(placeholders.length ? { placeholders } : {}) });

/** Rows as `depth:name`, an owner node in brackets, so a failure reads as the shape an author would see. */
const shape = (nodes: PlaceholderTreeNode[]) => nodes.map((n) => {
  const pad = '  '.repeat(n.depth);
  if (n.kind === 'group') return `${pad}<${n.group.name}>`;
  return n.kind === 'owner' ? `${pad}[${n.owner.name}]` : `${pad}${n.placeholder.name}${n.shared ? ' *' : ''}`;
});

const INDENT = 24;
const world = () => ({ placeholders: [TOWN], entities: [molly(), tam()], entityGroups: [], dictionaries: [book()] });

/**
 * The Placeholders tab over a whole world: the shared rows, then one derived owner node per entity or book
 * that owns any, its own rows beneath. A drop across those sections moves the record between lists with
 * its id kept, so nothing placed anywhere has to re-aim.
 */
describe('placeholderTreeNodes', () => {
  it('draws shared rows first, then an owner node per entity and book that owns any, its rows beneath', () => {
    const nodes = placeholderTreeNodes(world());
    expect(shape(nodes)).toEqual(['Town', '[Molly]', '  Eyes', '[Fen]', '  Lore']);
    const owner = nodes[1];
    expect(owner.kind).toBe('owner');
    expect(owner.id).toBe(ownerNodeId('molly'));
    expect(owner.home).toEqual({ kind: 'entity', ownerId: 'molly' });
    // A scoped row hangs off its owner node and says which list it lives in.
    const eyes = nodes[2];
    expect(eyes.kind === 'placeholder' && eyes.parentId).toBe(owner.id);
    expect(eyes.home).toEqual({ kind: 'entity', ownerId: 'molly' });
    expect(nodes[0].home).toEqual({ kind: 'world' });
  });

  it('draws nothing for an entity or book that owns nothing', () => {
    expect(shape(placeholderTreeNodes({ placeholders: [TOWN], entities: [tam()], dictionaries: [book([])] }))).toEqual(['Town']);
  });

  it('orders owner nodes as the entity tree does, then books', () => {
    const w = { placeholders: [], entities: [tam([P('hair', 'Hair', ['red'])], { order: 1 }), molly([EYES], { order: 0 })], entityGroups: [], dictionaries: [book()] };
    expect(shape(placeholderTreeNodes(w))).toEqual(['[Molly]', '  Eyes', '[Tam]', '  Hair', '[Fen]', '  Lore']);
  });

  it('draws a shared placeholder a scoped one holds as a shared row beneath it', () => {
    const w = { ...world(), entities: [molly([P('eyes', 'Eyes', [chip('town')])])] };
    expect(shape(placeholderTreeNodes(w))).toEqual(['Town', '[Molly]', '  Eyes', '    Town *', '[Fen]', '  Lore']);
  });

  it('reads an owner id back out of its node id', () => {
    expect(ownerIdOfNode(ownerNodeId('molly'))).toBe('molly');
    expect(ownerIdOfNode('molly')).toBeNull();
    expect(ownerIdOfNode('town/eyes')).toBeNull();
  });
});

describe('applyScopedPlaceholderDrop', () => {
  const drop = (w: ReturnType<typeof world>, active: string, over: string, offset: number) =>
    applyScopedPlaceholderDrop(w, [], active, over, offset, INDENT);

  it('moves a shared row dropped under an owner node into that owner, id kept', () => {
    const w = world();
    const next = drop(w, 'town', ownerNodeId('molly'), INDENT);
    expect(next).not.toBeNull();
    expect(next!.placeholders).toEqual([]);
    expect(next!.entities[0].placeholders?.map((p) => p.id)).toEqual(['town', 'eyes']);
    expect(next!.dictionaries).toBe(w.dictionaries); // an untouched slice keeps its identity
  });

  it('moves a scoped row dropped at the root back to the world list, the reverse of scoping it', () => {
    const scoped = { ...world(), placeholders: [], entities: [molly([EYES, TOWN]), tam()] };
    const next = drop(scoped, 'town', ownerNodeId('molly'), 0);
    expect(next!.placeholders.map((p) => p.id)).toEqual(['town']);
    expect(next!.entities[0].placeholders?.map((p) => p.id)).toEqual(['eyes']);
  });

  it('nests a shared row dropped under a scoped placeholder in that owner list, taking it privately', () => {
    const next = drop(world(), 'town', 'eyes', INDENT * 2);
    expect(next!.placeholders).toEqual([]);
    const list = next!.entities[0].placeholders ?? [];
    expect(list.map((p) => p.id)).toEqual(['eyes', 'town']);
    expect(list.find((p) => p.id === 'town')?.ownerId).toBe('eyes');
    expect(list.find((p) => p.id === 'eyes')?.values.map((v) => v.text).some((t) => t.includes('town'))).toBe(true);
  });

  it('takes what a moved placeholder owns along with it', () => {
    const shade = P('shade', 'Shade', ['dusk'], 'town');
    const town = P('town', 'Town', [chip('shade')]);
    const w = { ...world(), placeholders: [town, shade] };
    const next = drop(w, 'town', ownerNodeId('molly'), INDENT);
    expect(next!.placeholders).toEqual([]);
    const list = next!.entities[0].placeholders ?? [];
    expect(list.map((p) => p.id).sort()).toEqual(['eyes', 'shade', 'town']);
    expect(list.find((p) => p.id === 'shade')?.ownerId).toBe('town');
    // Dropped onto the owner node, the row lands first among the owner's top-level rows.
    expect(list.filter((p) => !p.ownerId).map((p) => p.id)).toEqual(['town', 'eyes']);
  });

  it('reorders inside one owner section without leaving it', () => {
    const w = { ...world(), entities: [molly([EYES, P('hair', 'Hair', ['red'])]), tam()] };
    const next = drop(w, 'hair', 'eyes', 0);
    expect(next!.entities[0].placeholders?.map((p) => p.id)).toEqual(['hair', 'eyes']);
    expect(next!.placeholders).toBe(w.placeholders);
  });

  it('moves a row between two owners', () => {
    const w = { ...world(), entities: [molly(), tam([P('hair', 'Hair', ['red'])])] };
    const next = drop(w, 'eyes', ownerNodeId('tam'), INDENT);
    expect(next!.entities[0]).not.toHaveProperty('placeholders');
    expect(next!.entities[1].placeholders?.map((p) => p.id)).toEqual(['eyes', 'hair']);
  });

  it('moves the record, not the row: a shared row drawn under a scoped holder still lives in the world list', () => {
    // Molly's Eyes holds the shared Town, so Town draws as a shared row inside Molly's section. Dragging that
    // row up beside Eyes, at the section's top level, scopes the record itself.
    const w = { ...world(), entities: [molly([P('eyes', 'Eyes', [chip('town')])]), tam()] };
    const nodes = placeholderTreeNodes(w);
    const townUnderEyes = nodes.find((n) => n.kind === 'placeholder' && n.shared && n.placeholder.id === 'town');
    expect(townUnderEyes?.home).toEqual({ kind: 'world' });
    const next = drop(w, townUnderEyes!.id, 'eyes', 0);
    expect(next!.placeholders).toEqual([]);
    expect(next!.entities[0].placeholders?.map((p) => p.id).sort()).toEqual(['eyes', 'town']);
  });

  it('refuses to drag an owner node, or to drop onto a row that is collapsed away', () => {
    expect(drop(world(), ownerNodeId('molly'), 'town', 0)).toBeNull();
    expect(applyScopedPlaceholderDrop(world(), [ownerNodeId('molly')], 'town', 'eyes', INDENT, INDENT)).toBeNull();
  });
});

/**
 * Folders over the shared list. A folder holds folders and shared rows, drawn above the loose rows; a
 * scoped placeholder stays with its owner and cannot be dropped into one.
 */
describe('placeholderTreeNodes with groups', () => {
  const G = (id: string, name: string, parentId: string | null = null, order?: number) =>
    ({ id, name, parentId, ...(order !== undefined ? { order } : {}) });
  const HAIR = { ...P('hair', 'Hair', ['red', 'black']), groupId: 'body' };
  const SKIN = { ...P('skin', 'Skin', ['pale']), groupId: 'face' };
  const grouped = () => ({
    placeholders: [TOWN, HAIR, SKIN],
    placeholderGroups: [G('body', 'Body'), G('face', 'Face', 'body')],
    entities: [molly(), tam()],
    entityGroups: [],
    dictionaries: [book([])],
  });
  const shapeG = (nodes: PlaceholderTreeNode[]) => nodes.map((n) => {
    const pad = '  '.repeat(n.depth);
    if (n.kind === 'group') return `${pad}<${n.group.name}>`;
    return n.kind === 'owner' ? `${pad}[${n.owner.name}]` : `${pad}${n.placeholder.name}${n.shared ? ' *' : ''}`;
  });

  it('draws folders first, nested, each holding its subfolders then its rows, then the loose rows, then owners', () => {
    expect(shapeG(placeholderTreeNodes(grouped()))).toEqual([
      '<Body>', '  <Face>', '    Skin', '  Hair', 'Town', '[Molly]', '  Eyes',
    ]);
    const nodes = placeholderTreeNodes(grouped());
    const skin = nodes.find((n) => n.kind === 'placeholder' && n.placeholder.id === 'skin');
    expect(skin?.parentId).toBe('face');
    expect(skin?.home).toEqual({ kind: 'world' });
  });

  it('orders sibling folders by `order` and reads a dangling folder reference as loose', () => {
    const w = {
      ...grouped(),
      placeholders: [TOWN, { ...HAIR, groupId: 'gone' }, { ...SKIN, groupId: 'b' }],
      placeholderGroups: [G('a', 'A', null, 1), G('b', 'B', null, 0)],
    };
    expect(shapeG(placeholderTreeNodes(w))).toEqual(['<B>', '  Skin', '<A>', 'Town', 'Hair', '[Molly]', '  Eyes']);
  });

  it('still draws a shared row a grouped placeholder holds beneath it', () => {
    const w = { ...grouped(), placeholders: [TOWN, { ...HAIR, values: phValues([chip('town')]) }, SKIN] };
    expect(shapeG(placeholderTreeNodes(w))).toEqual([
      '<Body>', '  <Face>', '    Skin', '  Hair', '    Town *', 'Town', '[Molly]', '  Eyes',
    ]);
  });

  describe('applyScopedPlaceholderDrop', () => {
    const drop = (w: ReturnType<typeof grouped>, active: string, over: string, offset: number) =>
      applyScopedPlaceholderDrop(w, [], active, over, offset, INDENT);

    it('puts a loose shared row dropped under a folder into that folder, at the top level', () => {
      const next = drop(grouped(), 'town', 'hair', 0);
      expect(next).not.toBeNull();
      expect(next!.placeholderGroups).toBeUndefined();
      expect(next!.placeholders.find((p) => p.id === 'town')?.groupId).toBe('body');
      expect(shapeG(placeholderTreeNodes({ ...grouped(), ...next! }))).toEqual([
        '<Body>', '  <Face>', '    Skin', '  Town', '  Hair', '[Molly]', '  Eyes',
      ]);
    });

    it('drops the folder reference when a grouped row is dragged out to the loose rows', () => {
      const next = drop(grouped(), 'hair', 'town', 0);
      expect(next!.placeholders.find((p) => p.id === 'hair')).not.toHaveProperty('groupId');
    });

    it('refuses to drop a scoped placeholder into a folder', () => {
      // Eyes is Molly's; dragged up beside Hair at Body's depth.
      expect(drop(grouped(), 'eyes', 'hair', 0)).toBeNull();
    });

    it('drops the folder reference when a grouped row is scoped to an owner', () => {
      const next = drop(grouped(), 'hair', ownerNodeId('molly'), INDENT);
      expect(next!.placeholders.map((p) => p.id)).toEqual(['town', 'skin']);
      const moved = next!.entities[0].placeholders?.find((p) => p.id === 'hair');
      expect(moved).toBeDefined();
      expect(moved).not.toHaveProperty('groupId');
    });

    it('nests a grouped row under a holder and takes it privately, folder reference gone', () => {
      const w = { ...grouped(), placeholders: [TOWN, HAIR, SKIN, P('look', 'Look', ['plain'])] };
      // Hair dragged under Look, one level in.
      const next = drop(w, 'hair', 'look', INDENT);
      const hair = next!.placeholders.find((p) => p.id === 'hair');
      expect(hair?.ownerId).toBe('look');
      expect(hair).not.toHaveProperty('groupId');
    });

    it('moves a folder under another folder and reorders siblings', () => {
      const w = { ...grouped(), placeholderGroups: [G('body', 'Body'), G('face', 'Face', 'body'), G('gear', 'Gear')] };
      // Gear dragged above Body at the root: it becomes the first root folder.
      const next = drop(w, 'gear', 'body', 0);
      expect(next!.placeholderGroups?.map((g) => [g.id, g.parentId, g.order])).toEqual([
        ['body', null, 1], ['face', 'body', undefined], ['gear', null, 0],
      ]);
      expect(next!.placeholders).toBe(w.placeholders);
      // Face dragged one level out, to the root, after Body.
      const out = drop(w, 'face', 'gear', -INDENT);
      expect(out!.placeholderGroups?.find((g) => g.id === 'face')?.parentId).toBeNull();
    });

    it('answers the drag indicator with the same rules as the drop', () => {
      const w = { ...grouped(), placeholderGroups: [G('body', 'Body'), G('face', 'Face', 'body'), G('gear', 'Gear')] };
      const nodes = placeholderTreeNodes(w);
      const allowed = (active: string, parent: string | null) => placeholderDropAllowed(w, nodes, active, parent);
      expect(allowed('town', 'body')).toBe(true);
      expect(allowed('eyes', 'body')).toBe(false);
      expect(allowed('gear', 'body')).toBe(true);
      expect(allowed('gear', 'town')).toBe(false);
      expect(allowed('gear', ownerNodeId('molly'))).toBe(false);
      expect(allowed('body', 'face')).toBe(false);
      expect(allowed(ownerNodeId('molly'), null)).toBe(false);
      expect(allowed('town', 'missing')).toBe(false);
    });

    it('refuses a folder dropped under a row, under an owner node, or into its own subfolder', () => {
      const w = { ...grouped(), placeholderGroups: [G('body', 'Body'), G('face', 'Face', 'body'), G('gear', 'Gear')] };
      // Under Town's depth + 1: Town is a row.
      expect(drop(w, 'gear', 'town', INDENT)).toBeNull();
      // Under Molly's owner node.
      expect(drop(w, 'gear', ownerNodeId('molly'), INDENT)).toBeNull();
      // Body into Face, its own child.
      expect(drop(w, 'body', 'skin', 0)).toBeNull();
    });
  });
});
