import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { SURFACE_LABELS } from '@/lib/promptGroups';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import { resolveToken } from '@/lib/promptTemplate';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import type { Entity } from '@/types';

/** The game host hands Chip Options the live scene, never the sample world's cast (spec Q22). */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));
// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

// Only the fields the chips read; the full Entity shape adds nothing to this test.
const MIRA = {
  id: 'mira', name: 'Mira', locations: ['harbor'], aiDescription: 'The ferry keeper, wary of strangers.', traits: [], stats: [],
} as unknown as Entity;

let requester: ReturnType<typeof createSurfaceRequester>;

beforeEach(() => {
  localStorage.clear();
  requester = createSurfaceRequester();
});

describe('Chip Options in a running game', () => {
  it("reads the game's own entities, not the sample world's", async () => {
    renderGameViewer(harborWorld({ entities: [MIRA] }), { children: <requester.Requester /> });
    fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    requester.send('settings.prompts');
    fireEvent.click(await screen.findByRole('button', { name: SURFACE_LABELS.system }));
    const chip = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('[data-chip]')].find((el) => el.textContent?.startsWith('Entities'));
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.click(chip);

    const reads = within(await screen.findByRole('dialog', { name: 'Chip Options' })).getByRole('region', { name: 'What the AI Reads' });
    expect(reads).toHaveTextContent('Mira');
    expect(reads).not.toHaveTextContent('Wren');
  });

  it("previews the Dictionary chip from the sample lore, since a turn activates lore per request (Q37)", async () => {
    renderGameViewer(harborWorld({ entities: [MIRA] }), { children: <requester.Requester /> });
    fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    requester.send('settings.prompts');
    fireEvent.click(await screen.findByRole('button', { name: SURFACE_LABELS.system }));
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Preview' }));

    const sample = resolveToken('<DICTIONARY>', SAMPLE_PREVIEW_VALUES) ?? '';
    expect(sample).not.toBe('');
    expect(sample).not.toBe(NONE_PLACEHOLDER);
    // The world has no lore, so only the sample can supply this text.
    expect(await screen.findByTestId('prompt-preview')).toHaveTextContent(sample.slice(0, 40));
  });
});
