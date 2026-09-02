import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, Entity, Placeholder } from '@/types';
import {
  applyScopedPlaceholderDrop, ownerIdOfNode, ownerNodeId, placeholderTreeNodes, type PlaceholderTreeNode,
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
