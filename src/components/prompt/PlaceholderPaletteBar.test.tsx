import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import PlaceholderPaletteBar from './PlaceholderPaletteBar';
import { ChipInsertTargetProvider, useChipInsertTarget } from './ChipInsertTarget';
import { encodePlaceholderToken } from '@/lib/placeholders';
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
