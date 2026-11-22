import { describe, expect, it } from 'vitest';
import type { Entity, PlayerStat, Script } from '@/types';
import { planCodeRename, pickedEdits, type CodeRenameInput } from './statCodeRename';

const gale = (id: string, name = 'Gale'): PlayerStat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [],
});
const script = (id: string, code: string): Script => ({ id, timing: 'used', code });
const torch = (...scripts: Script[]) => ({ id: 'torch', name: 'Torch', scripts });
const holder = (id: string, stats: PlayerStat[]): Entity => ({ id, name: id, stats });

const plan = (input: Omit<CodeRenameInput, 'otherNames' | 'stats'> & { stats?: CodeRenameInput['stats'] }) =>
  planCodeRename({ stats: [], otherNames: [], ...input });

describe('a rename reaches item scripts', () => {
  it('rewrites a trait an item script names', () => {
    const found = plan({ root: 'traits', oldName: 'Brave', newName: 'Bold', items: [torch(script('u', 'if (traits.Brave.enabled) {}'))] });
    expect(found?.edits).toEqual([{ home: { kind: 'item', itemId: 'torch' }, name: 'Torch', scripts: { u: 'if (traits.Bold.enabled) {}' } }]);
  });

  it('rewrites a location an item script moves to', () => {
    const found = plan({ root: 'locations', oldName: 'Cave', newName: 'Grotto', items: [torch(script('u', 'location.move("Cave");'))] });
    expect(found?.edits[0]).toEqual({ home: { kind: 'item', itemId: 'torch' }, name: 'Torch', scripts: { u: 'location.move("Grotto");' } });
  });

  it('rewrites a global stat an item script names', () => {
    const found = plan({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stats: [gale('g', 'Gust')], stat: { id: 'g' },
      items: [torch(script('u', 'stats.Gale.value = 3;'))],
    });
    expect(found?.edits[0].scripts).toEqual({ u: 'stats.Gust.value = 3;' });
    expect(found?.pickBoxes?.flatMap((box) => box.unsure)).toEqual([]);
  });
});

describe('a stat rename meets owner in an item script', () => {
  const code = 'owner.stats.Gale.value += 1;';

  it('rewrites the key outright where no other holder has a stat of the old name', () => {
    const found = plan({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stat: { id: 'g', entityId: 'ann' },
      entities: [holder('ann', [gale('g', 'Gust')]), holder('bo', [])], items: [torch(script('u', code))],
    });
    expect(found?.edits[0].scripts).toEqual({ u: 'owner.stats.Gust.value += 1;' });
    expect(found?.pickBoxes?.flatMap((box) => box.unsure)).toEqual([]);
  });

  it('makes the key a pick where another holder has a stat of the old name', () => {
    const found = plan({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stat: { id: 'g', entityId: 'ann' },
      entities: [holder('ann', [gale('g', 'Gust')]), holder('bo', [gale('h')])], items: [torch(script('a', 'let x = 1;'), script('u', code))],
    });
    expect(found?.edits).toEqual([]);
    const [box] = found?.pickBoxes ?? [];
    expect(box).toMatchObject({ home: { kind: 'item', itemId: 'torch' }, name: 'Torch', scriptNumber: 2 });
    expect(box.unsure).toEqual([expect.objectContaining({ text: code, line: 1 })]);
    expect(pickedEdits(found!.pickBoxes!, new Set([box.unsure[0].id])).edits[0].scripts).toEqual({ u: 'owner.stats.Gust.value += 1;' });
  });

  it('leaves the key alone where only another holder has a stat of the old name', () => {
    const found = plan({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stat: { id: 'g', entityId: 'ann' },
      entities: [holder('ann', [gale('g', 'Gust')]), holder('bo', [gale('h')])], items: [torch(script('u', 'owner.stats.Breeze.value;'))],
    });
    expect(found).toBeNull();
  });
});
