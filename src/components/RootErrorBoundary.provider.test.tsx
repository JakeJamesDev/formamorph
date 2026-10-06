// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { World } from '@/types';

vi.mock('@/services/WorldStorageService', () => ({
  default: { initialize: vi.fn(), getWorldMetadata: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(async (value: unknown) => new Blob([JSON.stringify(value)])),
}));

import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { downloadBlob } from '@/lib/downloadBlob';
import { serializeJsonBlob } from '@/lib/jsonFileWorkerUtils';
import { holdUnsavedWorld } from '@/lib/unsavedWorld';
import { RootErrorBoundary } from './RootErrorBoundary';

const sample = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
} as unknown as World;

/** Loads the sample world, then edits it and crashes on the player's clicks. */
function EditorThatCrashes() {
  const { loadWorldData, updateWorldOverview } = useGameData();
  const [crashed, setCrashed] = useState(false);
  useEffect(() => { loadWorldData(sample); }, [loadWorldData]);
  if (crashed) throw new Error('Editor blew up');
  return (
    <>
      <button onClick={() => updateWorldOverview({ name: 'Edited Name' })}>Edit</button>
      <button onClick={() => setCrashed(true)}>Crash</button>
    </>
  );
}

const renderApp = () => render(
  <RootErrorBoundary>
    <GameDataProvider><EditorThatCrashes /></GameDataProvider>
  </RootErrorBoundary>,
);

beforeEach(() => {
  vi.clearAllMocks();
  holdUnsavedWorld(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the root crash screen with the real data provider', () => {
  it('exports the edited world after the crash unmounts the provider', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crash' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Export World' }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(vi.mocked(downloadBlob).mock.calls[0][1]).toBe('Edited Name.json');
    expect(vi.mocked(serializeJsonBlob).mock.calls[0][0]).toMatchObject({ worldOverview: { name: 'Edited Name' } });
  });

  it('keeps the button through a re-render of the screen', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crash' }));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    await userEvent.click(await screen.findByRole('button', { name: 'Copy Error Details' }));

    await screen.findByText('Copied');
    expect(screen.getByRole('button', { name: 'Export World' })).toBeInTheDocument();
  });

  it('offers no Export World after a crash with nothing unsaved', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Crash' }));

    expect(await screen.findByRole('heading', { name: 'Formamorph Stopped Working' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export World' })).not.toBeInTheDocument();
  });
});
