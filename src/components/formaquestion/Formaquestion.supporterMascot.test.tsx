import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { HELP_FACE } from '@/lib/formaquestion/helpFace';
import { composeMascot, DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotPhase } from '@/lib/formaquestion/mascot';
import { mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { buildMascotCardData } from '@/lib/formaquestion/mascotCard';
import { DEFAULT_MASCOT_ID, supporterMascotId, type MascotPresetStore } from '@/lib/formaquestion/mascotPresets';
import { supporterMascotFromContent } from '@/lib/formaquestion/supporterMascot';
import { createSupporterMascotSync } from '@/lib/formaquestion/supporterMascotSync';
import type { ScrambledLayer, SupporterContentSnapshot } from '@/lib/supporterContent';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseFrame, sseResponse, sseReply, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { stubHelpStream, storeMinimalWindow } from '@/test/helpFixtures';
import { recordLayerCopies } from '@/test/supporterLayers';
import type { HelpAi } from './useHelpAi';
import { changeHelpSettings, currentHelpSettings } from './useHelpSettings';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
/** The installed Supporter content by listing id, as the module would serve it. */
const served = vi.hoisted(() => new Map<string, unknown>());
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
vi.mock('@/lib/supporterContent', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/supporterContent')>();
  return {
    ...real,
    supporterContent: { ...real.supporterContent, readItem: async (id: string) => served.get(id) ?? null },
    unscrambleToCanvas: (await import('@/test/supporterLayers')).fakeUnscramble,
  };
});
import { Formaquestion } from './Formaquestion';

const LISTING = 'listing-7';
const ACCOUNT = 'account-1';

/** The exclusive: the default rig's shape under its own art, one scrambled layer per bundled image. */
const card = buildMascotCardData('Nova', DEFAULT_MASCOT_RIG, (ref) => `data:image/png;base64,${btoa(ref.kind === 'bundled' ? `nova-${ref.name}` : 'x')}`, '3.0.1');
const content = {
  ...card,
  images: card.images.map((dataUrl, index): ScrambledLayer => ({ dataUrl, seed: index, version: 1, sourceWidth: 888, sourceHeight: 1184 })),
};
const nova = supporterMascotFromContent({ listingId: LISTING, revision: 2, accountId: ACCOUNT }, content);

const helpWindow = () => screen.getByRole('dialog', { name: 'Formaquestion' });
const mascot = () => helpWindow().querySelector<HTMLElement>('[data-fq-piece="mascot"]')!;
/** The layers the newest look draws, by the card image each copies. */
const drawnLayers = () => [...mascot().querySelectorAll<HTMLCanvasElement>('[data-fq-look="new"] canvas')].map((layer) => layer.dataset.drawn);
const drawnImages = () => [...mascot().querySelectorAll('[data-fq-look="new"] img')].map((image) => image.getAttribute('src'));
const lookCount = () => mascot().querySelectorAll('[data-fq-look]').length;
const layerOf = (ref: MascotImageRef) => (ref.kind === 'supporter' ? content.images[ref.index].dataUrl : null);
const novaLook = (phase: MascotPhase, face: string | null = null) => composeMascot(nova.rig, phase, face).map(layerOf);

async function openWindow() {
  render(<Formaquestion loadIndex={() => Promise.resolve(createDocsIndex({ pages: { Traits: '# Traits\n\nA trait.\n' }, sidebar: '- [Traits](Traits)\n' }))} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  return screen.findByRole('textbox', { name: 'Ask a Question' });
}

async function send(field: HTMLElement, question: string) {
  await userEvent.click(field);
  await userEvent.type(field, question, { delay: null, skipClick: true });
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
}

const storeNova = () => {
  const store: MascotPresetStore = { activeId: nova.id, mascots: [nova] };
  localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ mascotPresets: store }));
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('formamorph.formaquestion.mascotPlacement', 'inside');
  localStorage.setItem('formamorph.formaquestion.mascotScale', 'auto');
  storeMinimalWindow();
  served.clear();
  served.set(LISTING, content);
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
  recordLayerCopies();
  storeNova();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('an installed Supporter Mascot in the window', () => {
  it('draws its unscrambled layers as canvases, never as image URLs, and is named for itself', async () => {
    await openWindow();
    await waitFor(() => expect(drawnLayers()).toEqual(novaLook('initial')));
    expect(drawnImages()).toEqual([]);
    expect(mascot()).toHaveAccessibleName('Nova');
    // The base canvas gives the aspect, as a loaded base image does.
    await waitFor(() => expect(parseFloat(mascot().style.width)).toBeCloseTo(parseFloat(mascot().style.height) * 0.75));
  });

  it('runs its transition on a change of look and takes face calls', async () => {
    const reasoning = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' as const } };
    ai.current = helpAi({ snapshot: textSnapshot(textTarget({ reasoning })), answerTarget: { reasoning, localEngine: false, maxTokens: undefined }, revalidate: vi.fn(async () => true) });
    const faceCall = sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: HELP_FACE.name, arguments: JSON.stringify({ face: 'Wink' }) } }] });
    let request = 0;
    stubHelpStream(() => (request++ === 0 ? sseResponse([faceCall, sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n']) : sseResponse(sseReply('Open the Traits tab.'))));
    const field = await openWindow();
    await waitFor(() => expect(drawnLayers()).toEqual(novaLook('initial')));

    await send(field, 'How do I add a trait?');
    // The old look stays under the new one while the transition runs.
    expect(lookCount()).toBe(2);
    await waitFor(() => expect(drawnLayers()).toEqual(novaLook('answering', 'wink')));
    expect(request).toBe(2);
  });

  it('falls back to Morphie, with her art and no missing layer, when a sync finds it removed', async () => {
    await openWindow();
    await waitFor(() => expect(drawnLayers()).toEqual(novaLook('initial')));
    const snapshot: SupporterContentSnapshot = { status: 'ready', qualifies: false, entitled: [], installed: [] };
    const sync = createSupporterMascotSync({
      content: { subscribe: () => () => undefined, getSnapshot: () => snapshot, readItem: async () => null },
      accountId: () => ACCOUNT,
      readStore: () => currentHelpSettings().mascotPresets,
      writeStore: (mascotPresets) => changeHelpSettings({ mascotPresets }),
    });
    await act(() => sync.sync());

    expect(currentHelpSettings().mascotPresets).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [] });
    await waitFor(() => expect(drawnImages()).toEqual(composeMascot(DEFAULT_MASCOT_RIG, 'initial', null).map(mascotImageUrl)));
    expect(drawnLayers()).toEqual([]);
    expect(mascot()).toHaveAccessibleName('Morphie');
  });

  it('draws nothing of it while the module serves another account, and keeps the id for the sync to settle', async () => {
    served.clear();
    await openWindow();
    // No layer resolves, so no stale or foreign art draws; the sync then drops the entry.
    await act(async () => { await Promise.resolve(); });
    expect(drawnLayers()).toEqual([]);
    expect(currentHelpSettings().mascotPresets.activeId).toBe(supporterMascotId(LISTING));
  });
});
