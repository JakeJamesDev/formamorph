import { describe, it, expect } from 'vitest';
import type { ToolParam } from '@/types';
import { variableTreeLeaves, type VariableNode } from '@/lib/statCodeVariableTree';
import { runToolScript } from './toolScript';
import { emptyToolSnapshot, sampleToolSnapshot } from './toolSnapshot';
import { buildToolVariableTree } from './toolVariableTree';

const params: ToolParam[] = [
  { name: 'name', type: 'string', description: 'Who to find.', required: true, options: [] },
  { name: 'place-name', type: 'number', description: '', required: true, options: [] },
];

const top = (tree: readonly VariableNode[], label: string) => tree.find((node) => 'label' in node && node.label === label)!;

describe('the Tool script Variable menu', () => {
  const snapshot = sampleToolSnapshot();
  const tree = buildToolVariableTree(params, snapshot);

  it('lists the script’s globals in the order an author meets them', () => {
    expect(tree.map((node) => 'label' in node && node.label)).toEqual(['Arguments', 'Scene', 'Entities', 'Locations', 'Dictionary', 'Placeholders']);
  });

  it('inserts paths that run as inserted, and each named one reads a value', async () => {
    const leaves = variableTreeLeaves(tree).concat(
      // Name lists of values keep their insert on the row.
      tree.flatMap(function rowFields(node): ReturnType<typeof variableTreeLeaves> {
        if (node.kind === 'group') return node.children.flatMap(rowFields);
        if (node.kind !== 'names') return [];
        return node.rows.flatMap((row) => (row.field ? [row.field] : row.children.flatMap(rowFields)));
      }),
    );
    const inserts = leaves.map((leaf) => leaf.insert);
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

  it('marks each empty list instead of hiding it', () => {
    const empty = buildToolVariableTree([], emptyToolSnapshot());
    for (const [label, message] of [
      ['Arguments', 'No parameters in this Tool'], ['Entities', 'No entities in this world'], ['Placeholders', 'No placeholders in this world'],
    ]) {
      expect(top(empty, label)).toMatchObject({ kind: 'group', children: [{ kind: 'empty', message }] });
    }
  });
});
