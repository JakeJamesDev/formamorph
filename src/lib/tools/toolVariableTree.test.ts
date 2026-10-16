import { describe, it, expect } from 'vitest';
import type { ToolParam } from '@/types';
import type { VariableField, VariableNode } from '@/lib/statCodeVariableTree';
import { runToolScript } from './toolScript';
import { emptyToolSnapshot, sampleToolSnapshot } from './toolSnapshot';
import { buildToolVariableTree } from './toolVariableTree';

const params: ToolParam[] = [
  { name: 'name', type: 'string', description: 'Who to find.', required: true, options: [] },
  { name: 'place-name', type: 'number', description: '', required: true, options: [] },
];

/** Every field a pick inserts: the leaves, and the name rows that insert in one pick. */
function allFields(nodes: readonly VariableNode[]): VariableField[] {
  return nodes.flatMap((node): VariableField[] => {
    if (node.kind === 'field') return [node];
    if (node.kind === 'group') return allFields(node.children);
    if (node.kind === 'names') return node.rows.flatMap((row) => (row.field ? [row.field] : allFields(row.children)));
    return [];
  });
}

const top = (tree: readonly VariableNode[], label: string) => tree.find((node) => 'label' in node && node.label === label)!;

describe('the Tool script Variable menu', () => {
  const snapshot = sampleToolSnapshot();
  const tree = buildToolVariableTree(params, snapshot);

  it('lists the script’s globals in the order an author meets them', () => {
    expect(tree.map((node) => 'label' in node && node.label)).toEqual(['Arguments', 'Scene', 'Entities', 'Locations', 'Dictionary', 'Placeholders']);
  });

  it('inserts paths that run as inserted, and each named one reads a value', async () => {
    const inserts = allFields(tree).map((leaf) => leaf.insert);
    for (const prefix of ['args.name', 'world.entities.find(', 'world.locations.find(', 'world.dictionary.find(', 'scene.stats', 'placeholders']) {
      expect(inserts.some((insert) => insert.startsWith(prefix)), prefix).toBe(true);
    }
    const result = await runToolScript(`return JSON.stringify([${inserts.map((insert) => `typeof (${insert})`).join(', ')}]);`, { name: 'Wren', 'place-name': 2 }, snapshot);
    const types = JSON.parse((result as { text: string }).text) as string[];
    // The scene may have no location or clock; every other path names something the world has.
    const nullable = (insert: string) => /^scene\.(location|time)\?\./.test(insert);
    expect(inserts.filter((insert, i) => types[i] === 'undefined' && !nullable(insert))).toEqual([]);
  });

  it('reads an argument whose name is not an identifier through brackets', () => {
    const args = top(tree, 'Arguments');
    expect(args.kind === 'group' && args.children.map((child) => child.kind === 'field' && child.insert)).toEqual(['args.name', 'args["place-name"]']);
  });

  it('lists one Name to type over in each list without a world, selected in the path it inserts', () => {
    const typeOver = buildToolVariableTree(params, null);
    const named = allFields(typeOver).filter((leaf) => leaf.insert.includes('"Name"'));
    for (const prefix of ['world.entities.find(', 'world.locations.find(', 'world.dictionary.find(', 'scene.stats["Name"]', 'placeholders["Name"]']) {
      expect(named.some((leaf) => leaf.insert.startsWith(prefix)), prefix).toBe(true);
    }
    // The first Name is the one selected, also when an entity's placeholder adds a second.
    for (const leaf of named) {
      expect(leaf.selection && leaf.insert.slice(leaf.selection.from, leaf.selection.to), leaf.insert).toBe('Name');
      expect(leaf.selection!.from, leaf.insert).toBe(leaf.insert.indexOf('"Name"') + 1);
    }
    expect(named.some((leaf) => leaf.insert === 'world.entities.find((entity) => entity.name === "Name")?.placeholders["Name"]')).toBe(true);
    // No leaf names anything the sample world holds.
    expect(JSON.stringify(typeOver)).not.toContain('Wren');
  });

  it('marks each empty list instead of hiding it', () => {
    const empty = buildToolVariableTree([], emptyToolSnapshot());
    for (const [label, message] of [
      ['Arguments', 'No parameters in this Tool'], ['Entities', 'No entities in this world'], ['Placeholders', 'No placeholders in this world'],
    ]) {
      expect(top(empty, label)).toMatchObject({ kind: 'group', children: [{ kind: 'empty', message }] });
    }
  });
});
