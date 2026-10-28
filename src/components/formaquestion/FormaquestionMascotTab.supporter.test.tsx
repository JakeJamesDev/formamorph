// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { DEFAULT_MASCOT_RIG, type MascotImageRef } from '@/lib/formaquestion/mascot';
import { buildMascotCardData } from '@/lib/formaquestion/mascotCard';
import { DEFAULT_MASCOT_ID, supporterMascotId, type MascotPresetStore } from '@/lib/formaquestion/mascotPresets';
import { previewMascot } from '@/lib/formaquestion/mascotSelection';
import { supporterMascotFromContent } from '@/lib/formaquestion/supporterMascot';
import { toastError } from '@/lib/linkToast';
import type { ScrambledLayer, SupporterContentSnapshot } from '@/lib/supporterContent';
import { recordLayerCopies } from '@/test/supporterLayers';
import { MascotTab } from './FormaquestionMascotTab';
import { currentHelpSettings, useHelpSettings } from './useHelpSettings';
import { useMascotDraft } from './useMascotDraft';
import type { SupporterMascotListing } from './useSupporterMascotListings';

/** The fake Supporter content module: its snapshot, the content it serves and its listeners. */
const fake = vi.hoisted(() => ({
  snapshot: { status: 'ready', qualifies: false, entitled: [], installed: [] } as SupporterContentSnapshot,
  served: new Map<string, unknown>(),
  listeners: new Set<() => void>(),
  install: null as unknown as ReturnType<typeof vi.fn>,
  refresh: null as unknown as ReturnType<typeof vi.fn>,
  listings: [] as SupporterMascotListing[],
}));

vi.mock('@/lib/supporterContent', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/supporterContent')>();
  fake.install = vi.fn();
  fake.refresh = vi.fn();
  return {
    ...real,
    supporterContent: {
      subscribe: (listener: () => void) => { fake.listeners.add(listener); return () => { fake.listeners.delete(listener); }; },
      getSnapshot: () => fake.snapshot,
      readItem: async (id: string) => fake.served.get(id) ?? null,
      install: (id: string) => fake.install(id),
      refresh: () => fake.refresh(),
      check: async () => undefined,
    },
    unscrambleToCanvas: (await import('@/test/supporterLayers')).fakeUnscramble,
  };
});
// The app's sync, on the fake module, for one signed-in account.
vi.mock('./supporterMascots', async () => {
  const { createSupporterMascotSync } = await import('@/lib/formaquestion/supporterMascotSync');
  const { supporterContent } = await import('@/lib/supporterContent');
  const settings = await import('./useHelpSettings');
  return {
    supporterMascotSync: createSupporterMascotSync({
      content: supporterContent,
      accountId: () => 'account-1',
      readStore: () => settings.currentHelpSettings().mascotPresets,
      writeStore: (mascotPresets) => settings.changeHelpSettings({ mascotPresets }),
    }),
  };
});
vi.mock('./useSupporterMascotListings', () => ({ useSupporterMascotListings: () => fake.listings }));
vi.mock('@/lib/linkToast', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/linkToast')>()), toastError: vi.fn() }));

const card = buildMascotCardData('Nova', DEFAULT_MASCOT_RIG, (ref) => `data:image/png;base64,${btoa(ref.kind === 'bundled' ? `nova-${ref.name}` : 'x')}`, '3.0.1');
const content = { ...card, images: card.images.map((dataUrl, seed): ScrambledLayer => ({ dataUrl, seed, version: 1, sourceWidth: 888, sourceHeight: 1184 })) };
const nova = supporterMascotFromContent({ listingId: 'nova', revision: 1, accountId: 'account-1' }, content);
const LISTING: SupporterMascotListing = { id: 'nova', name: 'Nova', thumbnailUrl: 'https://api.example/thumbnails/nova.webp' };

const publish = (next: Partial<SupporterContentSnapshot>) => {
  fake.snapshot = { ...fake.snapshot, ...next };
  fake.listeners.forEach((listener) => listener());
};

const openListing = vi.fn();

/** The tab over the device's help settings, as Formaquestion Settings draws it. */
function Harness() {
  const [settings, change] = useHelpSettings();
  const control = useMascotDraft(settings, change);
  return (
    <>
      <MascotTab settings={settings} control={control} onOpenGeneral={() => undefined} onOpenListing={openListing} />
      <UnsavedChangesDialog {...control.leavePrompt} />
    </>
  );
}

const mountWith = (store?: MascotPresetStore) => {
  if (store) localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ mascotPresets: store }));
  return render(<Harness />);
};

const row = () => screen.getByTestId('mascot-preset-row');
const actions = () => within(row()).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
const presetSelect = () => screen.getByRole('combobox', { name: 'Preset' });
const previewLayers = () => [...document.querySelectorAll<HTMLCanvasElement>('[data-fq-mascot-preview] [data-fq-view="full"] [data-fq-look="new"] canvas')]
  .map((layer) => layer.dataset.drawn);
const layerOf = (ref: MascotImageRef) => (ref.kind === 'supporter' ? content.images[ref.index].dataUrl : null);

async function pick(name: string) {
  const user = userEvent.setup();
  await user.click(presetSelect());
  await user.click(await screen.findByRole('option', { name }));
}

beforeEach(() => {
  localStorage.clear();
  fake.snapshot = { status: 'ready', qualifies: false, entitled: [], installed: [] };
  fake.served.clear();
  fake.listings = [];
  fake.install.mockReset();
  fake.refresh.mockReset().mockResolvedValue(undefined);
  recordLayerCopies();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(toastError).mockClear();
  openListing.mockClear();
});

describe('an installed Supporter Mascot in the Mascot tab', () => {
  beforeEach(() => {
    fake.served.set('nova', content);
    fake.snapshot = { status: 'ready', qualifies: true, entitled: [{ id: 'nova', kind: 'mascot', revision: 1 }], installed: [{ id: 'nova', kind: 'mascot', revision: 1 }] };
  });

  it('is a read-only entry beside Morphie, with no Duplicate, Rename, Export, Publish, Reset or Delete', async () => {
    mountWith({ activeId: nova.id, mascots: [nova] });
    expect(presetSelect()).toHaveTextContent('Nova');
    expect(actions()).toEqual(['Import', 'View full screen', 'Preset Actions']);
    expect(screen.getByText("Nova is Supporter content. You can't edit, duplicate, export or publish it.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duplicate & Edit/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Voice' })).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Add Layer' })).toBeNull();
    expect(screen.getByText('Supporter Image')).toBeInTheDocument();

    await userEvent.click(presetSelect());
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Morphie', 'Nova']);
  });

  it('draws its unscrambled layers in the preview', async () => {
    mountWith({ activeId: nova.id, mascots: [nova] });
    await waitFor(() => expect(previewLayers()).toEqual(previewMascot(nova.rig, null).map(layerOf)));
  });

  it('lists no locked entry for a listing it has installed', async () => {
    fake.listings = [LISTING];
    mountWith({ activeId: DEFAULT_MASCOT_ID, mascots: [nova] });
    await userEvent.click(presetSelect());
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Morphie', 'Nova']);
  });
});

describe('a locked Supporter Mascot in the Mascot tab', () => {
  beforeEach(() => {
    fake.listings = [LISTING];
  });

  it('shows the listing thumbnail beside its name', async () => {
    mountWith();
    await userEvent.click(presetSelect());
    const option = await screen.findByRole('option', { name: 'Nova (Locked)' });
    expect(option.querySelector('img')).toHaveAttribute('src', LISTING.thumbnailUrl);
  });

  it('opens its listing for a signed-in account that does not qualify, and keeps the selection', async () => {
    mountWith();
    await pick('Nova (Locked)');
    await waitFor(() => expect(openListing).toHaveBeenCalledWith('nova'));
    expect(fake.refresh).toHaveBeenCalledTimes(1);
    expect(fake.install).not.toHaveBeenCalled();
    expect(presetSelect()).toHaveTextContent('Morphie');
  });

  it('installs instead when the refresh finds a pledge made since the last check', async () => {
    fake.refresh.mockImplementation(async () => {
      publish({ qualifies: true, entitled: [{ id: 'nova', kind: 'mascot', revision: 1 }] });
    });
    fake.install.mockImplementation(async () => {
      fake.served.set('nova', content);
      publish({ installed: [{ id: 'nova', kind: 'mascot', revision: 1 }] });
    });
    mountWith();
    await pick('Nova (Locked)');
    await waitFor(() => expect(fake.install).toHaveBeenCalledWith('nova'));
    expect(openListing).not.toHaveBeenCalled();
  });

  it('opens its listing when signed out, where the module lists nothing', async () => {
    fake.snapshot = { status: 'ready', qualifies: false, entitled: [], installed: [] };
    mountWith();
    await pick('Nova (Locked)');
    await waitFor(() => expect(openListing).toHaveBeenCalledWith('nova'));
  });

  it.each(['idle', 'checking'] as const)('shows Checking and opens nothing while the check is %s, then installs once ready', async (status) => {
    fake.snapshot = { status, qualifies: false, entitled: [], installed: [] };
    fake.install.mockImplementation(async () => {
      fake.served.set('nova', content);
      publish({ installed: [{ id: 'nova', kind: 'mascot', revision: 1 }] });
    });
    mountWith();
    const user = userEvent.setup();
    await user.click(presetSelect());
    const option = await screen.findByRole('option', { name: 'Nova (Checking…)' });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    await user.click(option);
    expect(openListing).not.toHaveBeenCalled();
    expect(fake.install).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    act(() => publish({ status: 'ready', qualifies: true, entitled: [{ id: 'nova', kind: 'mascot', revision: 1 }] }));
    await pick('Nova (Locked)');
    expect(fake.install).toHaveBeenCalledWith('nova');
    expect(openListing).not.toHaveBeenCalled();
  });

  it('installs and then selects it for a Supporter', async () => {
    fake.snapshot = { status: 'ready', qualifies: true, entitled: [{ id: 'nova', kind: 'mascot', revision: 1 }], installed: [] };
    fake.install.mockImplementation(async () => {
      fake.served.set('nova', content);
      publish({ installed: [{ id: 'nova', kind: 'mascot', revision: 1 }] });
    });
    mountWith();
    await pick('Nova (Locked)');
    expect(fake.install).toHaveBeenCalledWith('nova');
    await waitFor(() => expect(presetSelect()).toHaveTextContent('Nova'));
    expect(currentHelpSettings().mascotPresets.activeId).toBe(supporterMascotId('nova'));
    expect(openListing).not.toHaveBeenCalled();
    await waitFor(() => expect(previewLayers()).toEqual(previewMascot(nova.rig, null).map(layerOf)));
  });

  it('keeps the selection and reports a failed install', async () => {
    fake.snapshot = { status: 'ready', qualifies: true, entitled: [{ id: 'nova', kind: 'mascot', revision: 1 }], installed: [] };
    fake.install.mockRejectedValue(new Error('The Supporter content download failed with status 503'));
    mountWith();
    await pick('Nova (Locked)');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.any(Error), "Couldn't install this Supporter Mascot."));
    expect(presetSelect()).toHaveTextContent('Morphie');
    expect(presetSelect()).toBeEnabled();
    expect(currentHelpSettings().mascotPresets.mascots).toEqual([]);
  });
});
