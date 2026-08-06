import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntityModal, type EntityDescriptionEditing } from './EntityModal';
import type { Entity } from '@/types';

// The modal's visual/audio children reach for WebGL, VRM and placeholder resolution, none of which this
// suite is about — it tests the description's edit/regenerate controls only.
vi.mock('../game/EntityVisual', () => ({
  EntityVisual: () => null,
  hasEntityVisual: () => false,
}));
vi.mock('../game/AudioPlayer', () => ({ default: () => null }));
vi.mock('@/lib/usePlaceholderResolver', () => ({ usePlaceholderResolver: () => (t: string) => t }));
vi.mock('@/lib/useEntityVisualPreference', () => ({
  useEntityVisualPreference: () => ({ preference: 'image', onPreferenceChange: () => {} }),
}));
vi.mock('@/lib/useEntityGallery', () => ({ useEntityGallery: () => ({ imageIndex: 0, onImageStep: () => {} }) }));

const entity: Entity = { id: 'e1', name: 'Grey Mouse', playerDescription: 'A wiry scavenger.' };

function editing(overrides: Partial<EntityDescriptionEditing> = {}): EntityDescriptionEditing {
  return {
    busy: false,
    onSave: vi.fn(),
    onRegenerate: vi.fn(async () => 'A hollow-cheeked thief who trusts nobody.'),
    ...overrides,
  };
}

describe('EntityModal description controls', () => {
  it('shows no edit or regenerate control for an authored entity', () => {
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} />);
    expect(screen.getByText('A wiry scavenger.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /regenerate/i })).toBeNull();
  });

  it('shows both controls for a discovered entity', () => {
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={editing()} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeTruthy();
  });

  it('saves an edited description through to the caller', () => {
    const hooks = editing();
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A patient thief.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(hooks.onSave).toHaveBeenCalledWith('A patient thief.');
  });

  it('cancelling an edit writes nothing and restores the original text', () => {
    const hooks = editing();
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Discarded.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(hooks.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('A wiry scavenger.')).toBeTruthy();
  });

  it('refuses to save an emptied description', () => {
    const hooks = editing();
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '   ' } });
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(hooks.onSave).not.toHaveBeenCalled();
  });

  it('previews a regeneration instead of applying it, and Keep writes it through', async () => {
    const hooks = editing();
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    // The new text is on screen but nothing has been written yet — the player has not accepted it.
    expect(await screen.findByText('A hollow-cheeked thief who trusts nobody.')).toBeTruthy();
    expect(hooks.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(hooks.onSave).toHaveBeenCalledWith('A hollow-cheeked thief who trusts nobody.');
  });

  it('discarding a regeneration writes nothing and leaves the original', async () => {
    const hooks = editing();
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(hooks.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('A wiry scavenger.')).toBeTruthy();
  });

  it('disables regenerate while other AI work is in flight', () => {
    const hooks = editing({ busy: true });
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    const button = screen.getByRole('button', { name: /regenerate/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(hooks.onRegenerate).not.toHaveBeenCalled();
  });

  it('reports an unusable regeneration instead of blanking the description', async () => {
    const hooks = editing({ onRegenerate: vi.fn(async () => null) });
    render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    expect(await screen.findByText(/nothing usable/i)).toBeTruthy();
    expect(hooks.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('A wiry scavenger.')).toBeTruthy();
  });

  it('aborts an in-flight regeneration when the modal closes', async () => {
    let captured: AbortSignal | undefined;
    const hooks = editing({
      onRegenerate: vi.fn((signal: AbortSignal) => {
        captured = signal;
        return new Promise<string | null>(() => {}); // never settles; only the abort matters
      }),
    });
    const { rerender } = render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    await waitFor(() => expect(captured).toBeDefined());
    expect(captured!.aborted).toBe(false);
    rerender(<EntityModal entity={entity} isOpen={false} onOpenChange={() => {}} editing={hooks} />);
    expect(captured!.aborted).toBe(true);
  });

  it('drops an un-kept preview when the modal is reopened', async () => {
    const hooks = editing();
    const { rerender } = render(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));
    await screen.findByRole('button', { name: 'Keep' });
    rerender(<EntityModal entity={entity} isOpen={false} onOpenChange={() => {}} editing={hooks} />);
    rerender(<EntityModal entity={entity} isOpen onOpenChange={() => {}} editing={hooks} />);
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(screen.getByText('A wiry scavenger.')).toBeTruthy();
  });
});
