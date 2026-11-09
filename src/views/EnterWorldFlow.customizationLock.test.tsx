import { useEffect } from 'react';
import { screen, fireEvent, waitFor, cleanup, render } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderEnterWorld } from '@/test/enterWorldBench';
import WorldStorageService from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { useVrmCustomization } from '@/lib/useVrmCustomization';
import type { StoredWorldRecord } from '@/services/WorldStorageService';
import type { VRMCapabilities } from './VRMViewer';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
// The viewer reports a model with an Ear Shape slider and skin color; rendering stays outside this contract.
const caps: VRMCapabilities = {
  bodyMorphs: ['Fat'], headMorphs: ['EarShape'], hairStyles: [], hairLength: false,
  colors: { skin: '#fcdec7', eye: '#86ff70', hair: '#7d0909' }, extras: [],
};
vi.mock('./VRMViewer', async () => {
  const { forwardRef, useEffect: effect } = await import('react');
  return {
    default: forwardRef<unknown, { onCapabilities?: (c: VRMCapabilities) => void }>(({ onCapabilities }) => {
      effect(() => { onCapabilities?.(caps); }, [onCapabilities]);
      return null;
    }),
  };
});
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    seedBundledAvatars: vi.fn(async () => {}),
    getModelMetadata: vi.fn(async () => [{ id: 'heron', name: 'Heron', type: 'model/vrm', size: 1, createdAt: '2026-01-01', thumbnail: 'data:,', hasFileThumbnail: false }]),
    ensureThumbnail: vi.fn(async () => null),
    getModelData: vi.fn(async () => null),
    bundledAvatarHashes: vi.fn(async () => []),
  },
}));

const world: StoredWorldRecord = {
  id: 'lock-world', name: 'Lock World',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Lock World', description: '', author: '', systemPrompt: '', tags: [], legacyVrmFallback: { kind: 'default' } },
    stats: [], statUpdates: [], entities: [], dictionaries: [],
    traits: [
      { id: 'elf', name: 'Elf', groupId: 'group', statChanges: [], morphPins: [{ name: 'EarShape', value: 1 }], colorPins: [{ channel: 'skin', color: '#aabbcc' }] },
    ],
    traitGroups: [{ id: 'group', name: 'Kin' }],
    locations: [{ id: 'inn', name: 'Inn', isStarting: true }],
  },
};

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function toAvatarStep() {
  renderEnterWorld({ onStartGame: vi.fn() });
  fireEvent.click(await screen.findByText('Lock World'));
  fireEvent.click(await screen.findByRole('button', { name: 'Enter World' }));
  await screen.findByRole('dialog', { name: 'Enter Lock World' });
}

describe('the Avatar step lock', () => {
  it('locks Ear Shape and Skin Color while Elf is checked, and frees them when Elf is unchecked', async () => {
    await toAvatarStep();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Elf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Avatar' });
    await waitFor(() => expect(screen.getAllByText(/Set by Elf/)).toHaveLength(2));
    expect(document.getElementById('morph-EarShape')).toHaveAttribute('data-disabled');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Elf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Avatar' }));
    await screen.findByRole('button', { name: 'Finalize Avatar' });
    await waitFor(() => expect(document.getElementById('morph-EarShape')).not.toBeNull());
    expect(document.getElementById('morph-EarShape')).not.toHaveAttribute('data-disabled');
    expect(screen.queryByText(/Set by Elf/)).toBeNull();
  });
});

describe('Customization without a lock', () => {
  it('shows no lock note in the Model Library, which has no world', async () => {
    const Library = () => {
      const { setCaps, controls } = useVrmCustomization(false);
      useEffect(() => { setCaps(caps); }, [setCaps]);
      return <>{controls}</>;
    };
    render(<Library />);
    await waitFor(() => expect(document.getElementById('morph-EarShape')).not.toBeNull());
    expect(document.getElementById('morph-EarShape')).not.toHaveAttribute('data-disabled');
    expect(screen.queryByText(/Set by/)).toBeNull();
  });
});
