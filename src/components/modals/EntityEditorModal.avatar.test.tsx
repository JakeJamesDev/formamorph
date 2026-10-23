import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import EntityStorageService from '@/services/EntityStorageService';
import { pickLabel } from '@/lib/vrmPickMatch';
import type { Entity } from '@/types';

/** The library entity editor's Avatar dropdown: None, User's Default, and the player's library Avatars. */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: () => Promise.resolve([
      { id: 'heron', name: 'Grey Heron', type: 'model/vrm', size: 1 },
      { id: 'crane', name: 'Crane', type: 'model/vrm', size: 1 },
    ]),
  },
}));

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => undefined,
  useGameDataOptional: () => undefined,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));

// jsdom has no matchMedia; SettingsProvider reads it on mount for the theme.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Pick a Select's option by keyboard: a click needs pointer capture, which jsdom lacks. */
const pickOption = (trigger: HTMLElement, name: string) => {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('option', { name }), { key: 'Enter' });
};

const open = (draft: Entity) =>
  render(<SettingsProvider><EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} /></SettingsProvider>);

beforeEach(() => vi.mocked(EntityStorageService.storeEntity).mockClear());

describe('library entity Avatar', () => {
  it('lists None, User’s Default and the library Avatars, starting on None', async () => {
    open({ id: 'e1', name: 'Wren' } as Entity);
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });
    expect(trigger).toHaveTextContent('None');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['None', "User's Default", 'Grey Heron', 'Crane']));
  });

  it('shows the stored library pick and saves a new one in library form', async () => {
    open({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: 'heron' } } as Entity);
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });
    await waitFor(() => expect(trigger).toHaveTextContent('Grey Heron'));

    pickOption(trigger, 'Crane');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(EntityStorageService.storeEntity).toHaveBeenCalled());
    const saved = vi.mocked(EntityStorageService.storeEntity).mock.calls[0][0];
    expect(saved.data.vrmPick).toEqual({ kind: 'library', id: 'crane' });
  });

  it('shows a library id this device lacks as Missing Avatar, as the link review does', async () => {
    const pick = { kind: 'library', id: 'gone' } as const;
    open({ id: 'e1', name: 'Wren', vrmPick: pick } as Entity);
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });
    await waitFor(() => expect(trigger).toHaveTextContent('Missing Avatar'));
    expect(pickLabel(pick, { world: new Map(), library: new Map() })).toBe('Missing Avatar');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['None', "User's Default", 'Grey Heron', 'Crane', 'Missing Avatar']);
  });

  it.each([
    ['None', undefined],
    ["User's Default", { kind: 'default' }],
    ['Crane', { kind: 'library', id: 'crane' }],
  ])('replaces a missing pick with %s', async (name, expected) => {
    open({ id: 'e1', name: 'Wren', vrmPick: { kind: 'library', id: 'gone' } } as Entity);
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });
    await waitFor(() => expect(trigger).toHaveTextContent('Missing Avatar'));

    pickOption(trigger, name);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(EntityStorageService.storeEntity).toHaveBeenCalled());
    expect(vi.mocked(EntityStorageService.storeEntity).mock.calls[0][0].data.vrmPick).toEqual(expected);
  });

  it('saves None as no pick', async () => {
    open({ id: 'e1', name: 'Wren', vrmPick: { kind: 'default' } } as Entity);
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });
    expect(trigger).toHaveTextContent("User's Default");

    pickOption(trigger, 'None');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(EntityStorageService.storeEntity).toHaveBeenCalled());
    expect(vi.mocked(EntityStorageService.storeEntity).mock.calls[0][0].data.vrmPick).toBeUndefined();
  });
});
