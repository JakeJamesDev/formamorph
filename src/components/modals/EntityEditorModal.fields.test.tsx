import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import type { Entity } from '@/types';

/**
 * What the library character modal's Character tab puts on screen. It composes the same entity field groups
 * the World Editor does, minus the locations picker, so a group that loses a field, gains a duplicate, or
 * lands out of order shows up here as a changed label list.
 */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), storeEntity: vi.fn() },
}));

// jsdom has no matchMedia; SettingsProvider reads it on mount for the theme.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const draft = { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.' } as unknown as Entity;

const FIELD_LABELS =
  /^(Name|Aliases|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Image|Image Tags|3D Model)$/;

describe('the library character modal body', () => {
  it('shows every field once, identity first and the model last, with no locations picker', () => {
    render(
      <SettingsProvider>
        <EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} />
      </SettingsProvider>,
    );
    // The modal opens on the Character tab, so the body is the first thing rendered.
    expect(screen.getAllByText(FIELD_LABELS).map((el) => el.textContent)).toEqual([
      'Name', 'Aliases', 'Type',
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
      'Image', 'Image Tags',
      '3D Model',
    ]);
  });
});
