import { describe, it, expect } from 'vitest';
import type { Trait } from '@/types';
import { checkedAvatarLock, lockedLook } from './customizationLock';

const trait = (id: string, name: string, extra: Partial<Trait> = {}) => ({ id, name, ...extra }) as unknown as Trait;
const elf = trait('elf', 'Elf', { morphPins: [{ name: 'Ear Shape', value: 1 }], colorPins: [{ channel: 'skin', color: '#aabbcc' }] });
const human = trait('human', 'Human', { morphPins: [{ name: 'Ear Shape', value: 0 }] });
const model = { catalog: ['Ear Shape', 'Fat'], channels: ['skin' as const, 'eye' as const] };

const lockFor = (globalIds: string[], ownedIds: Record<string, string[]> = {}, owners: { id: string; traits: Trait[] }[] = []) =>
  checkedAvatarLock({
    trees: { global: { traits: [elf, human], groups: [] }, owners: owners.map((o) => ({ ...o, name: o.id, groups: [] })) },
    played: owners.map((o) => o.id), globalIds, ownedIds, inOrder: (t) => t,
  });

describe('the Customization lock', () => {
  it('holds the slider and color a checked trait pins, naming the trait', () => {
    const lock = lockFor(['elf']);
    const look = lockedLook(lock, model);
    expect(look.morphs['Ear Shape']).toBe(1);
    expect(lock.nameOf(look.holders['Ear Shape'])).toBe('Elf');
    expect(look.colors.skin?.set).toBe('#aabbcc');
    expect(lock.nameOf(look.colorHolders.skin!)).toBe('Elf');
  });

  it('holds nothing once the trait is unchecked', () => {
    const look = lockedLook(lockFor([]), model);
    expect(look.holders).toEqual({});
    expect(look.colorHolders).toEqual({});
  });

  it('skips a slider or channel the model lacks', () => {
    const look = lockedLook(lockFor(['elf']), { catalog: ['Fat'], channels: ['eye'] });
    expect(look.holders).toEqual({});
    expect(look.colorHolders).toEqual({});
  });

  it("holds the played persona's checked own traits", () => {
    const tusked = trait('tusked', 'Tusked', { morphPins: [{ name: 'Fat', value: 0.5 }] });
    const lock = lockFor([], { you: ['tusked'] }, [{ id: 'you', traits: [tusked] }]);
    const look = lockedLook(lock, model);
    expect(look.morphs.Fat).toBe(0.5);
    expect(lock.nameOf(look.holders.Fat)).toBe('Tusked');
  });

  it('leaves an entity that is not played unlocked', () => {
    const tusked = trait('tusked', 'Tusked', { morphPins: [{ name: 'Fat', value: 0.5 }] });
    const lock = checkedAvatarLock({
      trees: { global: { traits: [], groups: [] }, owners: [{ id: 'orc', name: 'Orc', traits: [tusked], groups: [] }] },
      played: ['you'], globalIds: [], ownedIds: { orc: ['tusked'] }, inOrder: (t) => t,
    });
    expect(lockedLook(lock, model).holders).toEqual({});
  });
});
