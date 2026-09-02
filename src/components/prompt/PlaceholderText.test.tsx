import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encodePlaceholderToken, type PlaceholderMode } from '@/lib/placeholders';
import { placementLetters } from '@/lib/placementLetters';
import { PlacementLettersProvider } from '@/contexts/PlacementLettersContext';
import type { Placeholder } from '@/types';
import PlaceholderText from './PlaceholderText';

import { phValues } from '@/test/placeholderValues';
// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
const chip = (id: string, at = '1', mode: PlaceholderMode = 'world', label?: string) =>
  encodePlaceholderToken({ id, mode, placementId: `v-${id}-${at}`, ...(label ? { label } : {}) });
const drilled = (id: string, ...refs: string[]) => encodePlaceholderToken({
  id, mode: 'world', placementId: 'p1', path: refs.map((ref) => ({ kind: 'val', ref })),
});

const P = (id: string, name: string, values: string[] = []): Placeholder => ({ id, name, values: phValues(values) });

// Molly holds two variants, each variant holds a Hair of its own. Hair is the name that exists twice, so a
// pill that showed only the last step could not tell the two apart.
const WORLD: Placeholder[] = [
  P('molly', 'Molly', [chip('iswhite'), chip('isasian')]),
  P('iswhite', 'isWhite', [chip('fair')]),
  P('isasian', 'isAsian', [chip('black')]),
  P('fair', 'Hair', ['chestnut']),
  P('black', 'Hair', ['jet black']),
  P('town', 'Town', ['Sedge Landing', 'Harrow', 'Bellmoor', 'Wick']),
];

const draw = (text: string, placeholders = WORLD) => render(<PlaceholderText text={text} placeholders={placeholders} />);

describe('the read-only pill', () => {
  it('reads a World chip as its placeholder name, with the values on hover', () => {
    draw(chip('town'));
    const pill = screen.getByText('Town');
    expect(pill).toBeInTheDocument();
    expect(screen.queryByText(/Sedge Landing/)).toBeNull();
  });

  it('reads a Unique chip with its letter under a letters provider, and as Unique outside one', () => {
    const first = chip('town', 'a', 'unique');
    const second = chip('town', 'b', 'unique');
    render(
      <PlacementLettersProvider letters={placementLetters([first, second])}>
        <PlaceholderText text={second} placeholders={WORLD} />
      </PlacementLettersProvider>,
    );
    expect(screen.getByText('Town (B)')).toBeInTheDocument();
    draw(chip('town', 'c', 'unique'));
    expect(screen.getByText('Town (Unique)')).toBeInTheDocument();
  });

  it('reads the author label where the chip carries one', () => {
    draw(chip('town', 'a', 'unique', 'Hometown'));
    expect(screen.getByText('Hometown')).toBeInTheDocument();
    expect(screen.queryByText(/Town \(/)).toBeNull();
  });

  it('reads a path chip as its whole path, so a part and a root never look alike', () => {
    draw(drilled('molly', 'isasian', 'black'));
    expect(screen.getByText('Molly › isAsian › Hair')).toBeInTheDocument();
    expect(screen.queryByText(/jet black/)).toBeNull();
  });

  it('leaves the literal runs around a chip alone', () => {
    const { container } = draw(`Her hair is ${drilled('molly', 'iswhite', 'fair')}.`);
    expect(container.textContent).toBe('Her hair is Molly › isWhite › Hair.');
  });
});

describe('the red ? treatment', () => {
  it('marks a chip whose own placeholder is gone', () => {
    draw(chip('vanished'));
    expect(screen.getByText('?')).toHaveClass('text-destructive');
  });

  it('keeps the author label beside the mark', () => {
    draw(chip('vanished', 'a', 'unique', 'Rival'));
    expect(screen.getByText('? Rival')).toHaveClass('text-destructive');
  });

  it('marks a chip that drills through a part that is gone', () => {
    // Molly and the Hair under it both survive; the variant between them does not, so nothing resolves.
    draw(drilled('molly', 'isasian', 'black'), WORLD.filter((p) => p.id !== 'isasian'));
    expect(screen.getByText('?')).toHaveClass('text-destructive');
  });

  it('leaves a walkable path alone', () => {
    draw(drilled('molly', 'isasian', 'black'));
    expect(screen.queryByText('?')).toBeNull();
  });
});
