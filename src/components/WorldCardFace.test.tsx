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

describe('WorldCardFace detailed layout by aspect', () => {
  const frameOf = () => screen.getByRole('heading', { name: 'Saltmarsh' }).closest('[data-layout]') as HTMLElement;

  it('puts portrait art beside the text', () => {
    render(<WorldCardFace world={world} layout="detailed" aspect="portrait" />);
    expect(frameOf().dataset.layout).toBe('split');
  });

  it('keeps landscape art above the text', () => {
    render(<WorldCardFace world={world} layout="detailed" />);
    expect(frameOf().dataset.layout).toBe('stacked');
  });

  it('truncates a plain-text author on one line', () => {
    render(<WorldCardFace world={{ ...world, author: 'river-quill-with-a-long-handle' }} layout="detailed" aspect="portrait" />);
    expect(screen.getByText('By river-quill-with-a-long-handle')).toHaveClass('truncate');
  });
});
