import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, LibrarySupporterCopyMarker } from '@/types';

/** The library entity editor with entries and Avatars saved from a Supporter Copy. */

const marker: LibrarySupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 1, sourceWorldId: 'w-source' };

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: () => Promise.resolve([
      { id: 'heron', name: 'Grey Heron', type: 'model/vrm', size: 1 },
      { id: 'crane', name: 'Crane', type: 'model/vrm', size: 1, supporterCopy: { listingId: 'L1', accountId: 'A1', revision: 1, sourceWorldId: 'w-source' } },
    ]),
  },
}));

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => undefined,
  useGameDataOptional: () => undefined,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const wren = { id: 'e1', name: 'Wren' } as Entity;

const renderEditor = () => render(
  <SettingsProvider><TooltipProvider><EntityEditorModal entityId="e1" onClose={vi.fn()} onPublish={vi.fn()} /></TooltipProvider></SettingsProvider>,
);

beforeEach(() => {
  vi.mocked(EntityStorageService.getEntityData).mockResolvedValue(wren);
});

describe('a library entity saved from a Supporter Copy', () => {
  it('shows Export and Publish disabled', async () => {
    vi.mocked(EntityStorageService.getEntityMetadata).mockResolvedValue([{ id: 'e1', name: 'Wren', supporterCopy: marker }]);
    renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('keeps Export and Publish enabled for a plain entity', async () => {
    vi.mocked(EntityStorageService.getEntityMetadata).mockResolvedValue([{ id: 'e1', name: 'Wren' }]);
    renderEditor();

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Avatar' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });
});

describe('the library entity Avatar dropdown with an Avatar saved from a Supporter Copy', () => {
  it('lists the marked Avatar disabled and the plain one enabled', async () => {
    vi.mocked(EntityStorageService.getEntityMetadata).mockResolvedValue([{ id: 'e1', name: 'Wren' }]);
    renderEditor();
    const trigger = await screen.findByRole('combobox', { name: 'Avatar' });

    fireEvent.keyDown(trigger, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('option', { name: 'Crane' })).toHaveAttribute('aria-disabled', 'true'));
    expect(screen.getByRole('option', { name: 'Grey Heron' })).not.toHaveAttribute('aria-disabled', 'true');
  });
});
