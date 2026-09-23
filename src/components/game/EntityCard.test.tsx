import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityCardBody, EntityDescription } from './EntityCard';
import type { Entity } from '@/types';

/**
 * The entity card body renders from the entity alone. In Play shows it inside the World Editor, where no
 * game is running and no game state exists to read.
 */

const IMAGE = 'data:image/webp;base64,AAAA';
const sedge: Entity = { id: 'e1', name: 'Sedge', playerDescription: 'A heron-thin ferryman.', images: [IMAGE] };

afterEach(cleanup);

describe('EntityCardBody outside a running game', () => {
  it('shows the image and the Player-Facing Description', () => {
    render(
      <EntityCardBody entity={sedge}>
        <EntityDescription text={sedge.playerDescription ?? ''} />
      </EntityCardBody>,
    );
    expect(screen.getByAltText('Sedge')).toHaveAttribute('src', IMAGE);
    expect(screen.getByText('A heron-thin ferryman.')).toBeInTheDocument();
  });

  it('resolves the description through the resolver it is given', () => {
    render(<EntityDescription text="A heron-thin ferryman." resolveText={(text) => text.toUpperCase()} />);
    expect(screen.getByText('A HERON-THIN FERRYMAN.')).toBeInTheDocument();
  });

  it('says so when there is no description', () => {
    render(<EntityDescription text="" />);
    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('draws no picture area for an entity with nothing to show', () => {
    render(
      <EntityCardBody entity={{ id: 'e2', name: 'Voice' }}>
        <EntityDescription text="" />
      </EntityCardBody>,
    );
    expect(screen.queryByRole('img')).toBeNull();
  });
});
