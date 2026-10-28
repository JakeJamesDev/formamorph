// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG, MASCOT_PICK_NAMES, type MascotLayer, type MascotRig } from '@/lib/formaquestion/mascot';
import { addMascotImage, clearMascotImages } from '@/lib/formaquestion/mascotImageStore';
import { bytesToDataUrl } from '@/lib/imageBytes';
import { mascotStoreOf } from '@/test/helpFixtures';
import { tinyWebp } from '@/test/webpFixture';
import AuthService from '@/services/AuthService';
import WorldStorageService from '@/services/WorldStorageService';
import { MascotTab } from './FormaquestionMascotTab';
import { useMascotDraft, type MascotDraftControl } from './useMascotDraft';

const MB = 1024 * 1024;
const look = tinyWebp();

// jsdom decodes no image, so the card's look is a stand-in WebP; the card data is the real build's.
// The tab reads the Mascot catalog for locked Supporter Mascots; these suites have none.
vi.mock('./useSupporterMascotListings', () => ({ useSupporterMascotListings: () => [] }));
vi.mock('@/lib/formaquestion/mascotCardFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/formaquestion/mascotCardFile')>();
  const { tinyWebp: stand } = await import('@/test/webpFixture');
  return {
    ...real,
    // A render for a picked expression stamps its layer count into the stand-in, so a test can tell what was drawn.
    buildMascotCardWithLook: (name: string, rig: MascotRig, _deps: unknown, look?: { expression?: string | null }) =>
      real.buildMascotCardWithLook(name, rig, {
        render: async (layers) => {
          const bytes = stand();
          if (look?.expression) bytes[23] = 100 + layers.length;
          return { bytes, width: 1, height: 1 };
        },
      }, look),
  };
});

let current: HelpSettings;
let control: MascotDraftControl;

function Harness({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  current = settings;
  control = useMascotDraft(settings, (change) => setSettings((was) => helpSettingsOf(change, was)));
  return <MascotTab settings={settings} control={control} onOpenGeneral={() => undefined} />;
}

/** A rig of stored images only, its Wave layer holding `art`. */
async function ownRig(art: Uint8Array = tinyWebp()): Promise<MascotRig> {
  // The fake store clones a jsdom Blob to an empty object; Node's Blob keeps its bytes, as a browser's store does.
  const stored = async (bytes: Uint8Array) => ({ kind: 'stored' as const, id: await addMascotImage(new NodeBlob([bytes], { type: 'image/webp' }) as unknown as Blob) });
  const wave: MascotLayer = { id: 'wave', name: 'Wave', kind: 'state', enabled: true, images: [await stored(art)] };
  return {
    ...DEFAULT_MASCOT_RIG,
    base: await stored(tinyWebp()),
    layers: [wave],
    mask: null,
    picks: Object.fromEntries(MASCOT_PICK_NAMES.map((name) => [name, { expression: null, state: name === 'initial' ? 'wave' : null }])) as MascotRig['picks'],
  };
}

const mount = async (rig: Promise<MascotRig>) => render(<Harness initial={{ ...DEFAULT_HELP_SETTINGS, mascotPresets: mascotStoreOf(await rig) }} />);
const publishButton = () => screen.queryByRole('button', { name: 'Publish' });
const openPublish = async () => userEvent.click(screen.getByRole('button', { name: 'Publish' }));

beforeEach(async () => {
  await clearMascotImages();
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'u1', username: 'Maker' } as ReturnType<typeof AuthService.getCurrentUser>);
  vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  vi.spyOn(WorldStorageService, 'publishItem').mockResolvedValue({ _id: 'listing-1', updated_at: '2026-10-27T00:00:00Z' });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('publishing from the Mascot tab', () => {
  it('sends the card data with the Initial render as the thumbnail', async () => {
    await mount(ownRig());
    await openPublish();
    await screen.findByText('Publish Mascot');
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    const [payload, target] = vi.mocked(WorldStorageService.publishItem).mock.calls[0];
    expect(target).toBeNull();
    expect(payload).toMatchObject({ kind: 'mascot', name: 'Mine', thumbnail: bytesToDataUrl(look, 'image/webp') });
    expect(payload.contentData).toMatchObject({ formamorphKind: 'mascot', name: 'Mine' });
  });

  it('sends a replaced thumbnail instead of the Initial render', async () => {
    await mount(ownRig());
    await openPublish();
    await screen.findByText('Publish Mascot');
    const cover = tinyWebp();
    cover[23] = 9;
    await userEvent.upload(document.getElementById('image-upload-publish-mascot-thumbnail') as HTMLInputElement, new File([cover], 'cover.webp', { type: 'image/webp' }));
    await screen.findByRole('button', { name: 'Use Initial Look' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[0][0].thumbnail).toBe(bytesToDataUrl(cover, 'image/webp'));
  });

  it('draws a picked expression into the Initial look and sends it as the thumbnail', async () => {
    const withHappy = ownRig().then(async (rig) => {
      const id = await addMascotImage(new NodeBlob([tinyWebp()], { type: 'image/webp' }) as unknown as Blob);
      const happy: MascotLayer = { id: 'happy', name: 'Happy', kind: 'expression', enabled: true, images: [{ kind: 'stored', id }] };
      return { ...rig, layers: [...rig.layers, happy] };
    });
    await mount(withHappy);
    await openPublish();
    await screen.findByText('Publish Mascot');
    await userEvent.click(screen.getByRole('combobox', { name: 'Expression' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Happy' }));
    const drawn = tinyWebp();
    drawn[23] = 103; // base, Wave and Happy
    await waitFor(() => expect(document.querySelector('[data-testid="mascot-publish-thumbnail"] img')?.getAttribute('src')).toBe(bytesToDataUrl(drawn, 'image/webp')));
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[0][0].thumbnail).toBe(bytesToDataUrl(drawn, 'image/webp'));
  });

  it('offers no Expression picker for a Mascot with no expression layer', async () => {
    await mount(ownRig());
    await openPublish();
    await screen.findByText('Publish Mascot');
    expect(screen.queryByRole('combobox', { name: 'Expression' })).toBeNull();
  });

  it('links the Mascot to its new listing', async () => {
    await mount(ownRig());
    await openPublish();
    await screen.findByText('Publish Mascot');
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);

    await waitFor(() => expect(current.mascotPresets.mascots[0].sourceId).toBe('listing-1'));
    expect(current.mascotPresets.mascots[0]).toMatchObject({ sourceUpdatedAt: '2026-10-27T00:00:00Z', sourceAuthorId: 'u1', sourceAuthorName: 'Maker' });
  });

  it('updates the listing the author picks', async () => {
    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'old1', name: 'Mine', downloads: 2 }]);
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
    await mount(ownRig());
    await openPublish();
    await userEvent.click(await screen.findByLabelText('Mine (old1, 2 downloads)'));
    const submit = screen.getAllByRole('button', { name: 'Publish' }).at(-1)!;
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(1));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[0][1]).toBe('old1');
  });

  it('preselects its own linked listing on the next publish', async () => {
    vi.spyOn(WorldStorageService, 'fetchListingDetails').mockResolvedValue(null);
    await mount(ownRig());
    await openPublish();
    await screen.findByText('Publish Mascot');
    await userEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1)!);
    await waitFor(() => expect(current.mascotPresets.mascots[0].sourceId).toBe('listing-1'));
    await waitFor(() => expect(screen.queryByText('Publish Mascot')).toBeNull());

    vi.mocked(WorldStorageService.getUserWorlds).mockResolvedValue([{ _id: 'listing-1', name: 'Mine', downloads: 0 }]);
    await openPublish();
    const linked = await screen.findByLabelText('Mine (listi, 0 downloads)');
    await waitFor(() => expect(linked).toHaveAttribute('data-state', 'checked'));
    const submit = screen.getAllByRole('button', { name: 'Publish' }).at(-1)!;
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);

    await waitFor(() => expect(WorldStorageService.publishItem).toHaveBeenCalledTimes(2));
    expect(vi.mocked(WorldStorageService.publishItem).mock.calls[1][1]).toBe('listing-1');
  });

  it('shows the measured size of an over-cap Mascot and sends nothing', async () => {
    await mount(ownRig(new Uint8Array(11 * MB)));
    await openPublish();

    expect(await screen.findByText(/11 MB, over the 10 MB publish limit/)).toBeInTheDocument();
    expect(screen.queryByText('Publish Mascot')).not.toBeInTheDocument();
    expect(WorldStorageService.publishItem).not.toHaveBeenCalled();
  });

  it('refuses a Mascot that holds bundled art and names the layers', async () => {
    await mount(Promise.resolve(DEFAULT_MASCOT_RIG));
    await openPublish();

    expect(await screen.findByText(/Replace it in: Base Image, /)).toBeInTheDocument();
    expect(WorldStorageService.publishItem).not.toHaveBeenCalled();
  });

  it('has no Publish on the Default Mascot', () => {
    render(<Harness initial={DEFAULT_HELP_SETTINGS} />);
    expect(publishButton()).not.toBeInTheDocument();
  });

  it('has no Publish while signed out', async () => {
    vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(false);
    await mount(ownRig());
    expect(publishButton()).not.toBeInTheDocument();
  });
});
