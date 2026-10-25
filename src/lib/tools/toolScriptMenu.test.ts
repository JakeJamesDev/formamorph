import { describe, expect, it } from 'vitest';
import type { ToolParam } from '@/types';
import { buildVariableTree, readOnlyTree, timingGlobalsOf, variableTreeLeaves, type VariableNode } from '@/lib/statCodeVariableTree';
import { toolScriptSurface } from './toolScriptSurface';
import { worldToolArgsNodes } from './worldToolSurface';

const params: ToolParam[] = [{ name: 'who', type: 'string', description: 'Who to find', required: true, options: [] }];
const surface = toolScriptSurface(params);

/** The menu a user Tool's script box shows, as CodeArea builds it for a read-only surface. */
const menu = (names?: Parameters<typeof buildVariableTree>[0]) =>
  readOnlyTree([...worldToolArgsNodes(params), ...buildVariableTree(names, null, surface.selfIs ?? 'stat', timingGlobalsOf(surface))]);

const labels = (nodes: readonly VariableNode[]) => nodes.flatMap((node) => (node.kind === 'empty' ? [] : [node.label]));

describe('the user Tool script’s Variable menu', () => {
  const names = { statNames: ['Health'], entities: [{ id: 'mira', name: 'Mira', traits: [], persona: false, stats: [] }], locations: ['Dock'] };

  it('lists the converged globals and no old ones', () => {
    expect(labels(menu(names))).toEqual([
      'Arguments', 'Stats', 'Traits', 'Entities', 'Persona', 'Placeholders', 'Dictionaries', 'Clock', 'Turn', 'Locations', 'Location', 'Memories', 'notes',
    ]);
  });

  it('inserts no call, and every field reads read-only', () => {
    for (const tree of [menu(names), menu()]) {
      const leaves = variableTreeLeaves(tree);
      expect(leaves.length).toBeGreaterThan(20);
      expect(leaves.filter((leaf) => /\(/.test(leaf.insert.replace(/\[".*?"\]/g, '')))).toEqual([]);
      expect(leaves.every((leaf) => leaf.access === 'readOnly')).toBe(true);
      expect(leaves.some((leaf) => /^(world|scene)\b/.test(leaf.insert))).toBe(false);
    }
  });

  it('keeps the readable fields of an entity and of the location', () => {
    const inserts = variableTreeLeaves(menu(names)).map((leaf) => leaf.insert);
    expect(inserts).toEqual(expect.arrayContaining(['entities.Mira.location', 'entities.Mira.following', 'location.present', 'clock.elapsedHours', 'notes', 'args.who']));
    expect(inserts).not.toEqual(expect.arrayContaining(['location.move(location.name)']));
  });
});
