import { describe, expect, it } from 'vitest';
import type { Placeholder } from '@/types';
import { statCodeName, statCodeNamed } from './statCodeNames';

const beast: Placeholder = {
  id: 'ph-beast',
  name: 'Beast',
  values: [{ id: 'v-wolf', text: 'Wolf' }, { id: 'v-bear', text: 'Bear' }],
};
const mood: Placeholder = { id: 'ph-mood', name: 'Mood', values: [{ id: 'v-calm', text: 'calm' }] };
const chip = (id: string, tail = '') => `{{ph:${id}:world:p1${tail}}}`;

describe('statCodeName', () => {
  it('hands back a chip-free name unchanged, character for character', () => {
    const name = '  Hit  Points ';
    expect(statCodeName(name, [beast])).toBe(name);
  });

  it('reads a chip as the placeholder’s own name', () => {
    expect(statCodeName(`${chip('ph-beast')} Power`, [beast])).toBe('Beast Power');
  });

  it('reads the same name whatever the placeholder rolled', () => {
    // The function takes no rolls at all, so the two saves of the acceptance case are one call.
    expect(statCodeName(`${chip('ph-beast')} Power`, [beast]))
      .toBe(statCodeName(`${chip('ph-beast')} Power`, [{ ...beast, values: [{ id: 'v-bear', text: 'Bear' }] }]));
  });

  it('reads a chip that is the whole name as that placeholder’s name', () => {
    expect(statCodeName(chip('ph-beast'), [beast])).toBe('Beast');
  });

  it('reads a drilled chip as its root placeholder’s name', () => {
    expect(statCodeName(`${chip('ph-beast', ':sColor')} Power`, [beast])).toBe('Beast Power');
  });

  it('drops a chip no placeholder answers, and closes the gap it leaves', () => {
    expect(statCodeName(`${chip('ph-gone')} Power`, [beast])).toBe('Power');
  });

  it('joins two chips under one space', () => {
    expect(statCodeName(`${chip('ph-beast')} ${chip('ph-mood')}`, [beast, mood])).toBe('Beast Mood');
  });

  it('reads an empty name as empty', () => {
    expect(statCodeName('', [beast])).toBe('');
  });
});

describe('statCodeNamed', () => {
  it('keeps the array when no name carries a chip', () => {
    const stats = [{ name: 'Health' }, { name: 'Hit Points' }];
    expect(statCodeNamed(stats, [beast])).toBe(stats);
  });

  it('replaces only the names that carry a chip', () => {
    const stats = [{ name: 'Health' }, { name: `${chip('ph-beast')} Power`, value: 3 }];
    const named = statCodeNamed(stats, [beast]);
    expect(named).not.toBe(stats);
    expect(named[0]).toBe(stats[0]);
    expect(named[1]).toEqual({ name: 'Beast Power', value: 3 });
  });
});
