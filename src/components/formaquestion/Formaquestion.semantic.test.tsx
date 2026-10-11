import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { sseReply } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openHelpSettings, stubHelpStream } from '@/test/helpFixtures';
import { renderReporting } from '@/test/surfaceReporter';
import type { EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));

const model = vi.hoisted(() => ({
  ready: false,
  cached: false,
  load: vi.fn<(onProgress?: (p: EmbeddingLoadProgress) => void) => Promise<void>>(),
  embed: vi.fn(async (texts: string[]) => texts.map(() => new Float32Array(2))),
}));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  isEmbeddingModelReady: () => model.ready,
  isEmbeddingModelCached: async () => model.cached,
  loadEmbeddingModel: (onProgress?: (p: EmbeddingLoadProgress) => void) => model.load(onProgress),
  openCachedEmbeddingModel: async () => model.ready || model.cached,
  embedTexts: model.embed,
}));
import { Formaquestion } from './Formaquestion';

const PAGES = { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n' };
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));
const STORAGE_KEY = 'FORMAMORPH_helpSettings';

const storedSemantic = () => (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"sources":{}}') as { sources: { semantic?: boolean } }).sources.semantic;
const semanticBox = (dialog: HTMLElement) => within(dialog).getByRole('checkbox', { name: 'Semantic Search' });

async function openSettings() {
  const view = renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await openHelpSettings();
  return { view, field, dialog: screen.getByRole('dialog', { name: 'Formaquestion Settings' }) };
}

/** A download the test settles by hand. */
function pendingLoad() {
  let report: (p: EmbeddingLoadProgress) => void = () => {};
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  model.load.mockImplementationOnce((onProgress) => {
    report = onProgress ?? report;
    return new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  });
  return {
    report: (p: EmbeddingLoadProgress) => act(() => report(p)),
    finish: () => act(async () => finish()),
    fail: (error: Error) => act(async () => fail(error)),
  };
}

beforeEach(() => {
  localStorage.clear();
  model.ready = false;
  model.cached = false;
  model.load.mockReset();
  model.embed.mockClear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  surfaceRegistry.clear(1_000_000);
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Semantic Search switch', () => {
  it('is off by default', async () => {
    const { dialog } = await openSettings();
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'false');
  });

  it('starts one download and shows progress, then turns the source on when the model is ready', async () => {
    const download = pendingLoad();
    const { dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));

    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'true');
    await download.report({ loaded: 5 * 1048576, total: 20 * 1048576 });
    expect(within(dialog).getByText('5 / 20 MB')).toBeInTheDocument();
    expect(storedSemantic()).not.toBe(true);

    await download.finish();
    await waitFor(() => expect(within(dialog).queryByText('5 / 20 MB')).toBeNull());
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'true');
    expect(storedSemantic()).toBe(true);
    expect(model.load).toHaveBeenCalledTimes(1);
  });

  it('goes on at once, with no download, when the model is on the device', async () => {
    model.cached = true;
    // An undecided player's switch already went on at the open, so this player has answered the offer.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ semanticOffer: 'decided' }));
    const { dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));

    await waitFor(() => expect(storedSemantic()).toBe(true));
    expect(model.load).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole('progressbar')).toBeNull();
  });

  it('shows the failed state, leaves the source off, and starts a new download on Retry', async () => {
    const first = pendingLoad();
    const { dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    await first.fail(new Error('network down'));

    expect(await within(dialog).findByText('Model download failed: network down')).toBeInTheDocument();
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'false');
    expect(storedSemantic()).not.toBe(true);

    const second = pendingLoad();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(2));
    expect(within(dialog).queryByText(/download failed/)).toBeNull();
    await second.finish();
    await waitFor(() => expect(storedSemantic()).toBe(true));
  });

  it('joins the download in flight when the switch goes off and on again', async () => {
    const download = pendingLoad();
    const { dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    await userEvent.click(semanticBox(dialog));
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(semanticBox(dialog));
    await download.finish();

    await waitFor(() => expect(storedSemantic()).toBe(true));
    expect(model.load).toHaveBeenCalledTimes(1);
  });

  it('answers a question sent during the download from the other sources', async () => {
    pendingLoad();
    const fetchSpy = stubHelpStream(sseReply('Select **Add Trait**.'));
    const { dialog, field } = await openSettings();
    await userEvent.click(semanticBox(dialog));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Formaquestion Settings' })).toBeNull());

    await userEvent.type(field, 'How do I add a trait?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    // Its sources show under either chrome: a toggle under Minimal, a button in the strip under Bubble.
    await screen.findByRole('button', { name: /^Sources/ });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(model.embed).not.toHaveBeenCalled();
  });

  it('leaves no state update behind when the window unmounts during the download', async () => {
    const download = pendingLoad();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { view, dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    view.unmount();

    await download.report({ loaded: 1, total: 2 });
    await download.finish();
    expect(storedSemantic()).not.toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

const storedOffer = () => (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { semanticOffer?: string }).semanticOffer;
const offerCard = () => screen.queryByRole('region', { name: 'Semantic Search Offer' });

async function openHelp() {
  const view = renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
  return view;
}

describe.each(['auto', 'minimal', 'full'] as const)('the Semantic Search offer card under the %s chat style', (chatStyle) => {
  beforeEach(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ chatStyle })));

  it('offers Semantic Search as recommended on the first open, and leaves the question field usable', async () => {
    await openHelp();
    const card = await screen.findByRole('region', { name: 'Semantic Search Offer' });
    expect(within(card).getByText('Recommended')).toBeInTheDocument();
    expect(within(card).getByText(/downloads a small model once/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Ask a Question' }), 'hi');
    expect(screen.getByRole('textbox', { name: 'Ask a Question' })).toHaveValue('hi');
  });

  it('hides for good on No Thanks, across a reload, and starts no download', async () => {
    const view = await openHelp();
    await userEvent.click(await screen.findByRole('button', { name: 'No Thanks' }));
    expect(offerCard()).toBeNull();
    expect(storedOffer()).toBe('decided');
    expect(model.load).not.toHaveBeenCalled();

    view.unmount();
    await openHelp();
    await waitFor(() => expect(model.embed).not.toHaveBeenCalled());
    expect(offerCard()).toBeNull();
  });
});

describe('the Semantic Search offer card', () => {
  it('shows again after a close with no pick, across a reload', async () => {
    const view = await openHelp();
    await screen.findByRole('region', { name: 'Semantic Search Offer' });
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Ask a Question' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(await screen.findByRole('region', { name: 'Semantic Search Offer' })).toBeInTheDocument();
    expect(storedOffer()).toBeUndefined();

    view.unmount();
    await openHelp();
    expect(await screen.findByRole('region', { name: 'Semantic Search Offer' })).toBeInTheDocument();
  });

  it('follows the download after Turn On, then goes when the model is ready', async () => {
    const download = pendingLoad();
    await openHelp();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn On' }));

    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    const card = screen.getByRole('region', { name: 'Semantic Search Offer' });
    expect(within(card).queryByRole('button', { name: 'Turn On' })).toBeNull();
    await download.report({ loaded: 5 * 1048576, total: 20 * 1048576 });
    expect(within(card).getByText('5 / 20 MB')).toBeInTheDocument();
    expect(storedOffer()).toBe('decided');

    await download.finish();
    await waitFor(() => expect(offerCard()).toBeNull());
    expect(storedSemantic()).toBe(true);
  });

  it('keeps showing a download that runs while the window is closed and opened again', async () => {
    const download = pendingLoad();
    await openHelp();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Ask a Question' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    await download.report({ loaded: 1048576, total: 2 * 1048576 });
    const card = await screen.findByRole('region', { name: 'Semantic Search Offer' });
    expect(within(card).getByText('1 / 2 MB')).toBeInTheDocument();
    await download.finish();
    await waitFor(() => expect(offerCard()).toBeNull());
  });

  it('shows a failed download with Retry, which starts a new download', async () => {
    const first = pendingLoad();
    await openHelp();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    await first.fail(new Error('network down'));
    const card = await screen.findByRole('region', { name: 'Semantic Search Offer' });
    expect(within(card).getByText('Model download failed: network down')).toBeInTheDocument();

    const second = pendingLoad();
    await userEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(2));
    await second.finish();
    await waitFor(() => expect(offerCard()).toBeNull());
    expect(storedSemantic()).toBe(true);
  });

  it('hides a failed download on Dismiss, and the Settings switch still offers Retry', async () => {
    const first = pendingLoad();
    await openHelp();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn On' }));
    await waitFor(() => expect(model.load).toHaveBeenCalledTimes(1));
    await first.fail(new Error('network down'));
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(offerCard()).toBeNull();
    expect(storedSemantic()).not.toBe(true);
  });

  it('turns the switch on with no card when the model got cached while the window was closed', async () => {
    await openHelp();
    await screen.findByRole('region', { name: 'Semantic Search Offer' });
    fireEvent.click(screen.getByRole('button', { name: 'Close Formaquestion' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Ask a Question' })).toBeNull());
    model.cached = true;
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    // No flash of the card while the probe runs.
    expect(offerCard()).toBeNull();

    await waitFor(() => expect(storedSemantic()).toBe(true));
    expect(offerCard()).toBeNull();
  });

  it('hides when the player flips the switch in Settings, and stays hidden after it goes off', async () => {
    pendingLoad();
    const { dialog } = await openSettings();
    await userEvent.click(semanticBox(dialog));
    await waitFor(() => expect(storedOffer()).toBe('decided'));
    await userEvent.click(semanticBox(dialog));
    expect(semanticBox(dialog)).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{Escape}');
    // The window comes back with the switch off and the offer answered.
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    expect(offerCard()).toBeNull();
  });

  it('turns the switch on with no card when the model is already on the device', async () => {
    model.cached = true;
    await openHelp();
    await waitFor(() => expect(storedSemantic()).toBe(true));
    expect(storedOffer()).toBe('decided');
    expect(offerCard()).toBeNull();
    expect(model.load).not.toHaveBeenCalled();
  });

  it('shows no card for a player whose stored switch was on before the offer existed', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sources: { semantic: true } }));
    await openHelp();
    expect(offerCard()).toBeNull();
  });
});
