// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotRig } from '@/lib/formaquestion/mascot';
import { mascotAssetUrl } from '@/lib/formaquestion/mascotAssets';
import { addMascotImage, clearMascotImages, getMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { MascotTab } from './FormaquestionMascotTab';

let current: HelpSettings;

function Harness({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  current = settings;
  return <MascotTab settings={settings} onChange={(change) => setSettings((was) => helpSettingsOf(change, was))} />;
}

const mount = (rig: MascotRig = DEFAULT_MASCOT_RIG) => render(<Harness initial={{ ...DEFAULT_HELP_SETTINGS, rig }} />);

const png = (name = 'art.png') => new File(['pixels'], name, { type: 'image/png' });
const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });

/** The layer rows, top to bottom, by name. */
const layerNames = () => [...document.querySelectorAll<HTMLElement>('[data-mascot-layer]')]
  .map((row) => within(row).getByRole('button', { name: /^Expand / }).textContent);
const layerRow = (name: string) => screen.getByRole('button', { name: `Expand ${name}` }).closest<HTMLElement>('[data-mascot-layer]')!;
const preview = () => [...document.querySelectorAll<HTMLImageElement>('[data-fq-piece="mascot"] img')].map((img) => img.getAttribute('src'));
const fileInput = (id: string) => document.getElementById(`image-upload-${id}`) as HTMLInputElement;
const layerOf = (id: string) => current.rig.layers.find((row) => row.id === id)!;

beforeEach(async () => {
  await clearMascotImages();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the layer list', () => {
  it('lists every layer in order with its kind and its switch', () => {
    mount();
    expect(layerNames()).toEqual(DEFAULT_MASCOT_RIG.layers.map((row) => row.name));
    expect(within(layerRow('Wave')).getByText('State')).toBeInTheDocument();
    expect(within(layerRow('Happy')).getByText('Expression')).toBeInTheDocument();
    expect(within(layerRow('Happy')).getByRole('checkbox', { name: 'Enable Happy' })).toHaveAttribute('aria-checked', 'true');
  });

  it('switches a layer off, and the Idle preview stops drawing it', async () => {
    mount();
    const rest = DEFAULT_MASCOT_RIG.layers.find((row) => row.id === 'rest')!;
    expect(preview()).toEqual([mascotAssetUrl('base'), ...rest.images.map((ref) => ref.kind === 'bundled' && mascotAssetUrl(ref.name))]);
    await userEvent.click(within(layerRow('Rest')).getByRole('checkbox', { name: 'Enable Rest' }));
    expect(layerOf('rest').enabled).toBe(false);
    expect(preview()).toEqual([mascotAssetUrl('base')]);
  });

  it('expands a layer to show its overlays, and the preview draws the base with that layer alone', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Happy');
    expect(screen.getAllByRole('button', { name: 'Remove overlay' })).toHaveLength(2);
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('mouth-grin'), mascotAssetUrl('eyes-closed')]);
  });

  it('adds a New Layer expression, open, and edits its name and kind', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    expect(layerNames().at(-1)).toBe('New Layer');
    expect(current.rig.layers.at(-1)).toMatchObject({ name: 'New Layer', kind: 'expression', enabled: true, images: [] });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Grumpy');
    await userEvent.click(within(layerRow('Grumpy')).getByRole('radio', { name: 'State' }));
    expect(current.rig.layers.at(-1)).toMatchObject({ name: 'Grumpy', kind: 'state' });
    // The row itself, above the open body, shows the new kind.
    expect(within(layerRow('Grumpy').firstElementChild as HTMLElement).getByText('State')).toBeInTheDocument();
  });

  it('removes a layer', async () => {
    mount();
    await userEvent.click(within(layerRow('Sad')).getByRole('button', { name: 'Remove layer' }));
    expect(layerNames()).not.toContain('Sad');
    expect(current.rig.layers.map((row) => row.id)).not.toContain('sad');
  });

  it('moves a layer down with the keyboard, and the rig keeps the new order', async () => {
    // jsdom lays nothing out; stack the rows 100px apart so the keyboard sensor finds a neighbor.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-mascot-layer]');
      // Anything outside a row, the scroll viewport included, spans the whole list, so no clamp bites.
      if (!row) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 10000 });
      return DOMRect.fromRect({ x: 0, y: [...row.parentElement!.children].indexOf(row) * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    mount();
    within(layerRow('Wave')).getAllByRole('button').find((el) => el.getAttribute('aria-roledescription') === 'sortable')!.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowDown]');
    await user.keyboard('[Space]');
    expect(current.rig.layers.slice(0, 2).map((row) => row.id)).toEqual(['rest', 'wave']);
    expect(layerNames().slice(0, 2)).toEqual(['Rest', 'Wave']);
  });

  it('moves an overlay up with the keyboard', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[aria-roledescription="sortable"]')?.parentElement ?? null;
      if (!row?.parentElement) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 10000 });
      return DOMRect.fromRect({ x: 0, y: [...row.parentElement.children].indexOf(row) * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Expand Happy' }));
    const body = layerRow('Happy');
    const grips = within(body).getAllByRole('button').filter((el) => el.getAttribute('aria-roledescription') === 'sortable');
    // The layer's own grip first, then one per overlay.
    grips[2].focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    expect(layerOf('happy').images).toEqual([{ kind: 'bundled', name: 'eyes-closed' }, { kind: 'bundled', name: 'mouth-grin' }]);
  });
});

describe('player images', () => {
  it('stores an uploaded overlay, puts its id in the rig, and draws it from an object URL', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.upload(fileInput('fq-mascot-overlay-happy'), png());
    await waitFor(() => expect(layerOf('happy').images).toHaveLength(3));
    const added = layerOf('happy').images[2];
    expect(added.kind).toBe('stored');
    expect(await getMascotImage((added as { id: string }).id)).not.toBeNull();
    await waitFor(() => expect(preview().at(-1)).toMatch(/^blob:/));
    expect(screen.getByText('Your Image')).toBeInTheDocument();
  });

  it('offers no link field and refuses a dropped link', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(screen.queryByRole('textbox', { name: 'Image URL' })).toBeNull();
    const slot = fileInput('fq-mascot-overlay-happy').parentElement!.querySelector('label')!;
    const link = 'https://example.com/face.png';
    await act(async () => {
      fireEvent.drop(slot, { dataTransfer: { files: [], types: ['text/uri-list'], getData: (type: string) => (type === 'text/uri-list' ? link : ''), dropEffect: 'none' } });
    });
    expect(screen.getByText('This slot takes image files, not links.')).toBeInTheDocument();
    expect(layerOf('happy').images).toHaveLength(2);
  });

  it('deletes an overlay image once its last reference goes, and keeps it while another layer holds it', async () => {
    const id = await addMascotImage(png());
    const rig: MascotRig = {
      ...DEFAULT_MASCOT_RIG,
      layers: DEFAULT_MASCOT_RIG.layers.map((row) => (row.id === 'happy' || row.id === 'sad' ? { ...row, images: [stored(id)] } : row)),
    };
    mount(rig);
    await userEvent.click(within(layerRow('Happy')).getByRole('button', { name: 'Remove layer' }));
    expect(await getMascotImage(id)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Sad' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove overlay' }));
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('replaces the base with an upload, and removing it restores the default base and deletes the image', async () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull();
    expect(within(fileInput('fq-mascot-base').parentElement!).getByText('Add Image')).toBeInTheDocument();
    await userEvent.upload(fileInput('fq-mascot-base'), png('base.png'));
    await waitFor(() => expect(current.rig.base.kind).toBe('stored'));
    const id = (current.rig.base as { id: string }).id;
    await waitFor(() => expect(preview()[0]).toMatch(/^blob:/));
    await userEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(current.rig.base).toEqual(DEFAULT_MASCOT_RIG.base);
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('resets to the default rig after a confirmation, and empties the store', async () => {
    const id = await addMascotImage(png());
    mount({ ...DEFAULT_MASCOT_RIG, base: stored(id), layers: DEFAULT_MASCOT_RIG.layers.slice(2) });
    await userEvent.click(screen.getByRole('button', { name: 'Reset Mascot' }));
    expect(current.rig.base).toEqual(stored(id));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(current.rig).toEqual(DEFAULT_MASCOT_RIG);
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('revokes every object URL it made at unmount', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    let n = 0;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { const url = `blob:mascot/${++n}`; created.push(url); return url; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { revoked.push(url); });
    const id = await addMascotImage(png());
    const { unmount } = mount({ ...DEFAULT_MASCOT_RIG, base: stored(id) });
    // The preview and the base slot each hold their own URL.
    await waitFor(() => expect(created.length).toBeGreaterThanOrEqual(2));
    unmount();
    expect(revoked.sort()).toEqual(created.sort());
  });
});
