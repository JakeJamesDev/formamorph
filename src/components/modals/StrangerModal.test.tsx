import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrangerModal } from './StrangerModal';
import type { Entity } from '@/types';

// The visual stands in as its entity's name, so a leak of the true name through the image path shows.
vi.mock('../game/EntityVisual', () => ({
  EntityVisual: ({ entity }: { entity: Entity }) => <div data-testid="visual">{entity.name}</div>,
}));
vi.mock('../game/AudioPlayer', () => ({ default: () => <div data-testid="sound" /> }));
// `@NAME` stands in for the Entity Name chip, which fills with the entity's name.
vi.mock('@/lib/usePlaceholderResolver', () => ({
  useEntityTextResolver: () => (entity: Entity, t: string) => t.replace('@NAME', entity.name),
}));
vi.mock('@/lib/useEntityVisualPreference', () => ({
  useEntityVisualPreference: () => ({ preference: 'image', onPreferenceChange: () => {} }),
}));
vi.mock('@/lib/useEntityGallery', () => ({ useEntityGallery: () => ({ imageIndex: 0, onImageStep: () => {} }) }));
vi.mock('@/lib/useEntityStatMorphs', () => ({ useEntityStatMorphs: () => ({}) }));
vi.mock('@/lib/usePlayAvatars', () => ({
  usePlayAvatars: () => ({ sourceOf: () => undefined, played: undefined, playedId: undefined, resolving: false }),
}));

const sylvie = {
  id: 'e1', name: 'Sylvie Thornwhistle', strangerName: 'a hooded figure', strangerDescription: 'Face hidden.',
  playerDescription: 'A spy for the Crown.', aiDescription: 'Secret.', images: [{ data: 'data:image/png;base64,AAAA' }],
  stats: [{ id: 's', name: 'Nerve', value: 7 }],
  sound: { name: 'x.wav', type: 'audio/wav', data: 'data:audio/wav;base64,AAAA' },
} as unknown as Entity;

describe('StrangerModal', () => {
  it('shows the label, the image and the Stranger Description', () => {
    render(<StrangerModal entity={sylvie} label="a hooded figure" isOpen onOpenChange={() => {}} />);
    expect(screen.getByRole('heading', { name: 'a hooded figure' })).toBeTruthy();
    expect(screen.getByTestId('visual').textContent).toBe('a hooded figure');
    expect(screen.getByText('Face hidden.')).toBeTruthy();
  });

  it('shows a stranger with only a Stranger Description under its real Name, with that description alone', () => {
    const ivo = { ...sylvie, name: 'Ivo the Bold', strangerName: undefined, strangerDescription: 'A broad man in a dented helm.' } as Entity;
    const { baseElement } = render(<StrangerModal entity={ivo} label="Ivo the Bold" isOpen onOpenChange={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Ivo the Bold' })).toBeTruthy();
    expect(screen.getByText('A broad man in a dented helm.')).toBeTruthy();
    expect(baseElement.textContent).not.toContain('A spy for the Crown.');
  });

  it('lays the card out in two columns', () => {
    const { baseElement } = render(<StrangerModal entity={sylvie} label="a hooded figure" isOpen onOpenChange={() => {}} />);
    expect(baseElement.querySelector('.lg\\:flex-row')).not.toBeNull();
  });

  it('shows no name, description, stats or sound', () => {
    const { baseElement } = render(<StrangerModal entity={sylvie} label="a hooded figure" isOpen onOpenChange={() => {}} />);
    expect(baseElement.textContent).not.toContain('Sylvie');
    expect(baseElement.textContent).not.toContain('A spy for the Crown.');
    expect(baseElement.textContent).not.toContain('Secret.');
    expect(baseElement.textContent).not.toContain('Nerve');
    expect(screen.queryByTestId('sound')).toBeNull();
  });

  it('fills an Entity Name chip in the Stranger Description with the label', () => {
    const chip = { ...sylvie, strangerDescription: '@NAME watches you.' } as Entity;
    const { baseElement } = render(<StrangerModal entity={chip} label="a hooded figure" isOpen onOpenChange={() => {}} />);
    expect(screen.getByText('a hooded figure watches you.')).toBeTruthy();
    expect(baseElement.textContent).not.toContain('Sylvie');
  });
});
