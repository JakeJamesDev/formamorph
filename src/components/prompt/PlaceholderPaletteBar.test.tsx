import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import PlaceholderPaletteBar from './PlaceholderPaletteBar';
import { ChipInsertTargetProvider, useChipInsertTarget } from './ChipInsertTarget';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}` });

// Molly holds Northern, Northern holds Hair; Town stands alone.
const world: Placeholder[] = [
  { id: 'molly', name: 'Molly', values: phValues([chip('northern'), 'Southern']) },
  { id: 'northern', name: 'Northern', values: phValues([chip('hair')]) },
  { id: 'hair', name: 'Hair', values: phValues(['brown']) },
  { id: 'town', name: 'Town', values: phValues(['Sedge']) },
];

/** Stands in for a value field of `ownerId` that holds the caret. */
const Claimer = ({ ownerId }: { ownerId?: string }) => {
  const { claim } = useChipInsertTarget();
  useEffect(() => { claim(Symbol('field'), () => {}, () => {}, null, ownerId); }, [claim, ownerId]);
  return null;
};

const names = () => screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t && t !== 'Placeholders');

describe('PlaceholderPaletteBar cycle filter', () => {
  it('offers every top-level placeholder to a field outside any placeholder', () => {
    render(
      <ChipInsertTargetProvider>
        <Claimer />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    expect(names()).toEqual(['Molly', 'Northern', 'Hair', 'Town']);
  });

  it('leaves out the value’s own placeholder and everything that reaches it', () => {
    render(
      <ChipInsertTargetProvider>
        <Claimer ownerId="hair" />
        <PlaceholderPaletteBar placeholders={world} />
      </ChipInsertTargetProvider>,
    );
    expect(names()).toEqual(['Town']);
  });

  it('keeps the strip when the filter empties it, so the panel does not reflow', () => {
    const lone: Placeholder[] = [{ id: 'town', name: 'Town', values: phValues(['Sedge']) }];
    render(
      <ChipInsertTargetProvider>
        <Claimer ownerId="town" />
        <PlaceholderPaletteBar placeholders={lone} />
      </ChipInsertTargetProvider>,
    );
    expect(screen.getByRole('button', { name: /Placeholders/ })).toBeInTheDocument();
    expect(names()).toEqual([]);
  });
});

/**
 * The strip in sections: the loose shared chips first under no heading, then each folder in tree order
 * under its path, then each owner's under its name. A heading is drawn off the first chip under it, so a
 * section the cycle filter empties shows no heading at all.
 */
describe('PlaceholderPaletteBar sections', () => {
  const groups = [
    { id: 'body', name: 'Body', parentId: null }, { id: 'face', name: 'Face', parentId: 'body' }, { id: 'gear', name: 'Gear', parentId: null },
  ];
  const shared: Placeholder[] = [
    { id: 'skin', name: 'Skin', values: phValues(['pale']), groupId: 'face' },
    { id: 'town', name: 'Town', values: phValues(['Sedge']) },
    { id: 'sword', name: 'Sword', values: phValues(['iron']), groupId: 'gear' },
    { id: 'hair', name: 'Hair', values: phValues(['red']), groupId: 'body' },
  ];
  const eyes: Placeholder = { id: 'eyes', name: 'Eyes', values: phValues(['gray']) };
  const lists = {
    placeholders: shared, placeholderGroups: groups, dictionaries: [],
    entities: [{ id: 'molly', name: 'Molly', placeholders: [eyes] }],
  };
  const all = allPlaceholders(lists);
  const store = { ...placeholderStore(all, () => {}), lists, owners: placeholderOwners(lists) };
  /** Headings and chips in strip order, a heading in brackets. */
  const strip = () => [...document.querySelectorAll('[data-editor-find-skip] span.text-meta, [data-editor-find-skip] button')]
    .map((el) => (el.tagName === 'SPAN' ? `[${el.textContent}]` : el.textContent))
    .filter((t) => t && t !== 'Placeholders');

  it('heads each folder in tree order and each owner by name, loose chips first', () => {
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    expect(strip()).toEqual(['Town', '[Body]', 'Hair', '[Body › Face]', 'Skin', '[Gear]', 'Sword', '[Molly]', 'Eyes']);
  });

  it('hides a heading whose every chip the cycle filter removed', () => {
    render(
      <PlaceholderStoreProvider value={store}>
        <ChipInsertTargetProvider>
          <Claimer ownerId="skin" />
          <PlaceholderPaletteBar placeholders={all} />
        </ChipInsertTargetProvider>
      </PlaceholderStoreProvider>,
    );
    expect(strip()).toEqual(['Town', '[Body]', 'Hair', '[Gear]', 'Sword', '[Molly]', 'Eyes']);
  });
});
