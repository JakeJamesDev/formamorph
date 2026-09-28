import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Entity, Placeholder, PlaceholderGroup } from '@/types';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderOwners } from './placeholderHomes';
import { placeholderVocabulary, promptVocabulary, usePlaceholderChipVocabulary, worldPromptVocabulary } from './chipVocabulary';
import { decodePlaceholderToken, encodePlaceholderToken } from './placeholders';

const tok = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: 'palette' });
const group: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const garb: Placeholder = { id: 'garb', name: 'Garb', groupId: 'bp', values: [{ id: 'v1', text: 'tabard' }] };
const town: Placeholder = { id: 'town', name: 'Town', values: [{ id: 'v2', text: 'Harrow' }] };
const copy: Placeholder = { id: 'albus-garb', name: 'Garb', blueprintId: 'garb', values: [] };
const albus = { id: 'albus', name: 'Albus', placeholders: [copy] } as Entity;
const lists = { placeholders: [garb, town], placeholderGroups: [group], entities: [albus], dictionaries: [] };
const all = [garb, town, copy];
const ids = (rows: { token: string }[]) => rows.map((r) => decodePlaceholderToken(r.token)?.id);

describe('placeholderVocabulary with refused blueprints', () => {
  const v = placeholderVocabulary([garb, town], { blueprints: new Set(['garb']), refusesBlueprints: true });

  it('leaves them out of every menu and refuses them on every path', () => {
    expect(ids(v.palette())).toEqual(['town']);
    expect(ids(v.allRows!())).toEqual(['town']);
    expect(v.acceptsPaletteToken!(tok('garb'))).toBe(false);
    expect(v.refuses!(tok('garb'))).toBe(true);
    expect(v.acceptsPaletteToken!(tok('town'))).toBe(true);
    expect(v.refuses!(tok('town'))).toBe(false);
  });

  it('marks a blueprint chip wherever it shows, refused or not', () => {
    const takes = placeholderVocabulary([garb, town], { blueprints: new Set(['garb']) });
    expect(takes.blueprint!(tok('garb'))).toBe(true);
    expect(takes.blueprint!(tok('town'))).toBe(false);
    expect(ids(takes.palette())).toEqual(['garb', 'town']);
    expect(takes.refuses!(tok('garb'))).toBe(false);
  });

  it('passes the refusal through a world prompt’s two families', () => {
    const both = worldPromptVocabulary(promptVocabulary([]), v);
    expect(both.refuses!(tok('garb'))).toBe(true);
    expect(both.refuses!('<PERSONA>')).toBe(false);
  });
});

describe('usePlaceholderChipVocabulary — which fields take a blueprint chip', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlaceholderStoreProvider value={{ ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) }}>
      {children}
    </PlaceholderStoreProvider>
  );
  const takes = (ownerId?: string, options?: Parameters<typeof usePlaceholderChipVocabulary>[2]) =>
    !renderHook(() => usePlaceholderChipVocabulary(all, ownerId, options), { wrapper }).result.current.refuses!(tok('garb'));

  it.each([
    ['a world trait’s text', undefined, { trait: { owned: false } }, true],
    ['an entity-owned trait’s text', undefined, { trait: { owned: true } }, false],
    ['a blueprint’s values', 'garb', undefined, true],
    ['a copy’s values', 'albus-garb', undefined, true],
    ['a world placeholder’s values', 'town', undefined, false],
    ['an entity’s own fields', 'albus', undefined, false],
    ['any other field', undefined, undefined, false],
    ['the palette strip, which serves no one field', undefined, { anyField: true }, true],
  ] as const)('%s', (_name, ownerId, options, accepted) => {
    expect(takes(ownerId, options)).toBe(accepted);
  });
});
