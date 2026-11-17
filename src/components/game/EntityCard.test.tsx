import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EntityCardBody, EntityDescription } from './EntityCard';
import { SettingsProvider } from '@/contexts/SettingsContext';
import type { Entity, MediaList } from '@/types';

// The open world's Media List, which the card reads through its context hook.
const media = vi.hoisted(() => ({ list: undefined as MediaList | undefined }));
vi.mock('@/lib/useMediaList', () => ({ useMediaList: () => media.list }));

/**
 * The entity card body renders from the entity alone. In Game shows it inside the World Editor, where no
 * game is running and no game state exists to read.
 */

const IMAGE = 'data:image/webp;base64,AAAA';
const sedge: Entity = { id: 'e1', name: 'Sedge', playerDescription: 'A heron-thin ferryman.', images: [{ data: IMAGE }] };

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

  it('stacks unless the host asks for two columns', () => {
    const { container, rerender } = render(<EntityCardBody entity={sedge}>text</EntityCardBody>);
    expect(container.firstElementChild).not.toHaveClass('lg:flex-row');
    rerender(<EntityCardBody entity={sedge} sideBySide>text</EntityCardBody>);
    expect(container.firstElementChild).toHaveClass('lg:flex-row');
  });

  it("plays the entity's sound through the world's Media List, and none for a missing entry", () => {
    const GROWL = 'data:audio/ogg;base64,R1JPV0w=';
    media.list = { growl: { id: 'growl', name: 'Growl', kind: 'sound', data: GROWL, type: 'audio/ogg' } };
    try {
      // The player reads its volume from Settings.
      const card = (sound: Entity['sound']) => <SettingsProvider><EntityCardBody entity={{ ...sedge, sound }}>text</EntityCardBody></SettingsProvider>;
      const { container, rerender } = render(card({ mediaId: 'growl' }));
      expect(container.querySelector('audio')).toHaveAttribute('src', GROWL);
      rerender(card({ mediaId: 'gone' }));
      expect(container.querySelector('audio')).toBeNull();
    } finally {
      media.list = undefined;
    }
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
