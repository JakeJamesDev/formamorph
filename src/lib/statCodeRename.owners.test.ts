import { describe, expect, it } from 'vitest';
import type { Dictionary, Entity, Placeholder, Stat } from '@/types';
import { phValues } from '@/test/placeholderValues';
import type { PlaceholderOwners } from './placeholderHomes';
import { planCodeRename, type CodeRenameSubject } from './statCodeRename';

const stat = (id: string, code: string): Stat => ({ id, name: id, type: 'number', value: 0, min: 0, max: 100, code } as Stat);
const ph = (id: string, name: string): Placeholder => ({ id, name, values: [] });

// Molly can be played and owns Hair; Rook owns a Hair too; the world has its own; the Weather book owns Sky.
const list = [ph('world-hair', 'Hair'), ph('molly-hair', 'Hair'), ph('rook-hair', 'Hair'), ph('sky', 'Sky')];
const owners: PlaceholderOwners = new Map([
  ['molly-hair', { kind: 'entity', id: 'molly', name: 'Molly' }],
  ['rook-hair', { kind: 'entity', id: 'rook', name: 'Rook' }],
  ['sky', { kind: 'dictionary', id: 'weather', name: 'Weather' }],
]);
const entities: Entity[] = [{ id: 'molly', name: 'Molly', persona: true }, { id: 'rook', name: 'Rook' }];
const dictionaries: Dictionary[] = [{ id: 'weather', name: 'Weather', entries: [] }];

/** A rename of one tree node over one stat's code, with the owners named as they read before it. */
const rename = (code: string, subject: CodeRenameSubject, oldName: string, newName: string) => planCodeRename({
  root: 'placeholders', oldName, newName, otherNames: [], subject, stats: [stat('a', code)], entities, dictionaries,
  placeholders: { list, owners },
})?.edits[0]?.boxes.after;

describe('a rename through owner entries', () => {
  it('rewrites an entity’s placeholder under that entity and under persona, and nowhere else', () => {
    const code = 'entities.Molly.placeholders.Hair.value + entities["Molly"].placeholders[\'Hair\'].value'
      + ' + persona.placeholders.Hair.value + entities.Rook.placeholders.Hair.value + placeholders.Hair.value';
    expect(rename(code, { kind: 'placeholder', id: 'molly-hair' }, 'Hair', 'Mane')).toBe(
      'entities.Molly.placeholders.Mane.value + entities["Molly"].placeholders[\'Mane\'].value'
      + ' + persona.placeholders.Mane.value + entities.Rook.placeholders.Hair.value + placeholders.Hair.value',
    );
  });

  it('leaves persona alone for a placeholder no playable entity owns', () => {
    const code = 'entities.Rook.placeholders.Hair.value + persona.placeholders.Hair.value';
    expect(rename(code, { kind: 'placeholder', id: 'rook-hair' }, 'Hair', 'Mane'))
      .toBe('entities.Rook.placeholders.Mane.value + persona.placeholders.Hair.value');
  });

  it('rewrites a dictionary’s placeholder under its entry', () => {
    expect(rename('dictionaries.Weather.placeholders.Sky.pin("gray");', { kind: 'placeholder', id: 'sky' }, 'Sky', 'Cloud Cover'))
      .toBe('dictionaries.Weather.placeholders[\'Cloud Cover\'].pin("gray");');
  });

  it('rewrites a dictionary’s key in dictionaries, and leaves the retired owner path under placeholders', () => {
    expect(rename('dictionaries.Weather.placeholders.Sky.value + placeholders.Weather.Sky.value', { kind: 'dictionary', id: 'weather' }, 'Weather', 'Climate'))
      .toBe('dictionaries.Climate.placeholders.Sky.value + placeholders.Weather.Sky.value');
  });
});

describe('a rename of a placeholder two playable entities own', () => {
  const both: Entity[] = [{ id: 'molly', name: 'Molly', persona: true }, { id: 'rook', name: 'Rook', customPersona: true }];
  const renameBoth = (code: string, id: string) => planCodeRename({
    root: 'placeholders', oldName: 'Hair', newName: 'Mane', otherNames: [], subject: { kind: 'placeholder', id },
    stats: [stat('a', code)], entities: both, dictionaries, placeholders: { list, owners },
  })?.edits[0]?.boxes.after;

  it('leaves the persona path alone and rewrites the owner’s own path', () => {
    expect(renameBoth('persona.placeholders.Hair.value + entities.Molly.placeholders.Hair.value', 'molly-hair'))
      .toBe('persona.placeholders.Hair.value + entities.Molly.placeholders.Mane.value');
  });

  it('rewrites the persona path once the other owner’s name differs', () => {
    const renamedOther = list.map((entry) => (entry.id === 'rook-hair' ? { ...entry, name: 'Fur' } : entry));
    expect(planCodeRename({
      root: 'placeholders', oldName: 'Hair', newName: 'Mane', otherNames: [], subject: { kind: 'placeholder', id: 'molly-hair' },
      stats: [stat('a', 'persona.placeholders.Hair.value')], entities: both, dictionaries, placeholders: { list: renamedOther, owners },
    })?.edits[0]?.boxes.after).toBe('persona.placeholders.Mane.value');
  });

  it('rewrites a deeper persona path the other owner does not answer', () => {
    const child = { ...ph('molly-shade', 'Shade'), ownerId: 'molly-hair' };
    const parent = { ...ph('molly-hair', 'Hair'), values: phValues(['{{ph:molly-shade:world:p1}}']) };
    const deeper = [...list.map((entry) => (entry.id === 'molly-hair' ? parent : entry)), child];
    const nested: PlaceholderOwners = new Map([...owners, ['molly-shade', { kind: 'entity', id: 'molly', name: 'Molly' }]]);
    expect(planCodeRename({
      root: 'placeholders', oldName: 'Shade', newName: 'Tint', otherNames: [], subject: { kind: 'placeholder', id: 'molly-shade' },
      stats: [stat('a', 'persona.placeholders.Hair.Shade.value')], entities: both, dictionaries, placeholders: { list: deeper, owners: nested },
    })?.edits[0]?.boxes.after).toBe('persona.placeholders.Hair.Tint.value');
  });
});
