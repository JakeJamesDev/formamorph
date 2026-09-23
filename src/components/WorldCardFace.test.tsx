import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WorldCardFace } from './WorldCardFace';
import type { WorldRecord } from '@/components/WorldDetails';

/**
 * The library card's face renders from a world record alone. In Play shows it inside the World Editor,
 * where there is no library board to drag on and no game running.
 */

const world: WorldRecord = {
  id: 'world-1',
  name: 'Saltmarsh',
  description: 'A drowned coastal town.',
  thumbnail: 'data:image/webp;base64,AAAA',
  tags: [],
};

afterEach(cleanup);

describe('WorldCardFace outside the library board', () => {
  it('shows the name, the description and the thumbnail in the detailed layout', () => {
    render(<WorldCardFace world={world} layout="detailed" />);
    expect(screen.getByRole('heading', { name: 'Saltmarsh' })).toBeInTheDocument();
    expect(screen.getByText('A drowned coastal town.')).toBeInTheDocument();
    expect(screen.getByAltText('Saltmarsh')).toHaveAttribute('src', world.thumbnail);
  });

  it('shows the name over the thumbnail in the grid layout', () => {
    render(<WorldCardFace world={world} layout="grid" />);
    expect(screen.getByRole('heading', { name: 'Saltmarsh' })).toBeInTheDocument();
    expect(screen.getByAltText('Saltmarsh')).toHaveAttribute('src', world.thumbnail);
  });

  it('carries no drag handle of its own, in either layout', () => {
    for (const layout of ['grid', 'detailed'] as const) {
      const { container } = render(<WorldCardFace world={world} layout={layout} />);
      expect(container.querySelector('[aria-roledescription="sortable"]')).toBeNull();
      cleanup();
    }
  });
});
