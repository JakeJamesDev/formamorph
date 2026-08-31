import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import PlaceholderText from './PlaceholderText';

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
const chip = (id: string, at = '1') => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}-${at}` });
const drilled = (id: string, ...refs: string[]) => encodePlaceholderToken({
  id, mode: 'world', placementId: 'p1', path: refs.map((ref) => ({ kind: 'val', ref })),
});

const P = (id: string, name: string, values: string[] = []): Placeholder => ({ id, name, values });

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
  it('previews a pathless chip as its own values, unchanged by any of this', () => {
    draw(chip('town'));
    expect(screen.getByText('Sedge Landing|Harrow|Bellmoor|…')).toBeInTheDocument();
  });

  it('falls back to the name where a placeholder has nothing to draw from', () => {
    draw(chip('empty'), [...WORLD, P('empty', 'Nickname')]);
    expect(screen.getByText('Nickname')).toBeInTheDocument();
  });

  it('previews the part a path names, not the root it starts at', () => {
    draw(drilled('molly', 'isasian', 'black'));
    expect(screen.getByText('jet black')).toBeInTheDocument();
    // The root's own pool would have read as the two variants joined — the whole point of walking the path.
    expect(screen.queryByText(/chestnut/)).toBeNull();
  });

  it('leaves the literal runs around a chip alone', () => {
    const { container } = draw(`Her hair is ${drilled('molly', 'iswhite', 'fair')}.`);
    expect(container.textContent).toBe('Her hair is chestnut.');
  });
});

describe('the red ? treatment', () => {
  it('marks a chip whose own placeholder is gone', () => {
    draw(chip('vanished'));
    expect(screen.getByText('?')).toHaveClass('text-destructive');
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
