import { describe, it, expect } from 'vitest';
import { avatarChangeNames, avatarChangeTip, statAvatarChanges, traitAvatarChanges } from './avatarChanges';
import type { Stat, Trait } from '@/types';

describe('avatarChangeNames', () => {
  it.each([
    ['sliders only', { sliders: [{ name: 'Ear_Shape' }, { name: 'belly' }] }, ['Ear Shape', 'Belly']],
    ['colors only', { colors: [{ channel: 'hair' as const }, { channel: 'skin' as const }] }, ['Skin Color', 'Hair Color']],
    ['both: sliders in row order, then colors', {
      sliders: [{ name: 'Wings' }, { name: 'Ear Shape' }], colors: [{ channel: 'eye' as const }],
    }, ['Wings', 'Ear Shape', 'Eye Color']],
    ['a repeated slider once', { sliders: [{ name: 'Belly' }, { name: 'belly.' }, { name: 'Belly' }] }, ['Belly']],
    ['no rows', {}, []],
    ['empty lists', { sliders: [], colors: [] }, []],
  ])('%s', (_label, rows, names) => {
    expect(avatarChangeNames(rows)).toEqual(names);
  });

  it('gives no name for a trait that only picks a Body', () => {
    const trait = { id: 't', name: 'Elf', statChanges: [], body: { pick: { kind: 'body', id: 'elf' } } } as unknown as Trait;
    expect(traitAvatarChanges(trait)).toEqual([]);
  });

  it('reads a trait’s pins and a stat’s bindings the same way', () => {
    const trait = { morphPins: [{ name: 'Ear Shape', value: 1 }], colorPins: [{ channel: 'skin', color: '#00ff00' }] } as Trait;
    const stat = { morphBindings: [{ name: 'Belly', by: 0.5 }], colorBindings: [{ channel: 'hair', color: '#ff0000' }] } as Stat;
    expect(traitAvatarChanges(trait)).toEqual(['Ear Shape', 'Skin Color']);
    expect(statAvatarChanges(stat)).toEqual(['Belly', 'Hair Color']);
  });
});

describe('avatarChangeTip', () => {
  it('opens with the Avatar line and lists the names', () => {
    expect(avatarChangeTip(['Ear Shape', 'Skin Color'])).toBe("Changes the Avatar's appearance.\nEar Shape and Skin Color.");
  });

  it('gives four names and a count for six changes', () => {
    const names = ['Ear Shape', 'Belly', 'Wings', 'Tail', 'Skin Color', 'Eye Color'];
    expect(avatarChangeTip(names)).toBe("Changes the Avatar's appearance.\nEar Shape, Belly, Wings, Tail, and 2 more.");
  });

  it('lists exactly four names without a count', () => {
    expect(avatarChangeTip(['A', 'B', 'C', 'D'])).toBe("Changes the Avatar's appearance.\nA, B, C, and D.");
  });

  it('holds no number and no color code when the rows carry values', () => {
    const tip = avatarChangeTip(avatarChangeNames({
      sliders: [{ name: 'Ear Shape', value: 0.75 } as { name: string }], colors: [{ channel: 'skin', color: '#12ab34' } as { channel: 'skin' }],
    }));
    expect(tip).not.toMatch(/\d|#/);
  });
});
