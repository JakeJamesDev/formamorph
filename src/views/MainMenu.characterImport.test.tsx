import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { buildEntityCardData } from '@/lib/entityFile';
import { embedEntityCard } from '@/lib/entityCard';
import { bytesToDataUrl } from '@/lib/imageOptim';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, TraitRequirementRow } from '@/types';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn(), update: vi.fn(), dismiss: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
// Every picture measures small, so the import stores them as they came.
vi.mock('@/lib/imageOptimWorkerClient', () => ({
  measureInWorker: vi.fn(async () => ({ w: 4, h: 4, bytes: 24 })),
  encodeInWorker: vi.fn(async (url: string) => url),
}));

const hurt: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'hp', operator: '<', value: 20, unit: 'percent' }] }];
const knight: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 't-knight' }] }];
const B = 'data:image/webp;base64,BBBB';

// A minimal simple-lossy WebP container to embed into (framing only; the bitstream bytes are arbitrary).
function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(12 + 8 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('importing a character card from the Main Menu', () => {
  it('stores each image with its own rule, slot 0’s included', async () => {
    const wren: Entity = {
      id: 'wren', name: 'Wren Rulecard', stats: [{ id: 'hp', name: 'Health', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] }],
      traits: [{ id: 't-knight', name: 'Knight', statChanges: [] }],
      images: [{ data: 'data:image/webp;base64,AAAA', requires: hurt }, { data: B, requires: knight }],
    };
    const bytes = embedEntityCard(fakeWebp(), JSON.stringify(buildEntityCardData(wren)), { w: 4, h: 4 });
    renderMainMenu();
    await screen.findByRole('radio', { name: 'Worlds' });

    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept^="image/webp"]')!;
    fireEvent.change(input, { target: { files: [new File([bytes], 'wren.webp', { type: 'image/webp' })] } });

    const stored = await waitFor(async () => {
      const record = (await EntityStorageService.getEntityMetadata()).find((m) => m.name === 'Wren Rulecard');
      expect(record).toBeDefined();
      return EntityStorageService.getEntityData(record!.id);
    });
    expect(stored.images).toEqual([{ data: bytesToDataUrl(bytes, 'image/webp'), requires: hurt }, { data: B, requires: knight }]);
  });
});
