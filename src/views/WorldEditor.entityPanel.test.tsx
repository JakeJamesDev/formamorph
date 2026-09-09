import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's entity panel puts on screen, driven through the real editor.
 *
 * The panel composes its body from the exported entity field groups, so a group that loses a field, gains a
 * duplicate, or lands out of order shows up here as a changed label list.
 */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD: World = benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] }],
});

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Aliases|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Image|Image Tags|3D Model)$/;

/** Every field label the panel shows, in document order. The editor's own Locations tab shares a label with
 *  the picker, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

const selectWren = () => {
  openTab(/Entities/);
  fireEvent.click(screen.getByText('Wren'));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor entity panel body', () => {
  it('shows every Advanced field once, identity first and the model last', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectWren();
    expect(panelLabels()).toEqual([
      'Name', 'Aliases', 'Type',
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
      'Locations',
      'Image', 'Image Tags',
      '3D Model',
    ]);
  });

  it('drops the Advanced-only fields in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectWren();
    expect(panelLabels()).toEqual([
      'Name',
      'Player-Facing Description', 'AI-Facing Description',
      'Locations',
      'Image',
    ]);
  });
});
