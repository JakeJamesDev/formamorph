// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotRig } from '@/lib/formaquestion/mascot';
import { mascotAssetUrl, mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { DISSOLVE_RANGES, JELLY_RANGES } from '@/lib/formaquestion/mascotTransition';
import { addMascotImage, clearMascotImages, getMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { MascotTab } from './FormaquestionMascotTab';
import { MASCOT_COPY } from './formaquestionSettingsTabs';
import { stubReducedMotion } from '@/test/reducedMotion';
import { Blob as NodeBlob } from 'node:buffer';
import { toast } from 'react-toastify';
import { downloadBlob } from '@/lib/downloadBlob';
import { embedEntityCard } from '@/lib/entityCard';
import { buildMascotCardData } from '@/lib/formaquestion/mascotCard';
import { readMascotCard } from '@/lib/formaquestion/mascotCardFile';
import { mascotImageIds } from '@/lib/formaquestion/mascotRigEdits';
import { tinyWebp as webp } from '@/test/webpFixture';

/** Holds an import's store step until a test lets it go, and records the rigs it stored. */
const importGate = vi.hoisted(() => ({ wait: Promise.resolve(), stored: [] as MascotRig[] }));

vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/formaquestion/mascotCardFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/formaquestion/mascotCardFile')>();
  const { tinyWebp } = await import('@/test/webpFixture');
  return {
    ...real,
    // jsdom decodes no image, so the card's look is a stand-in WebP; the card data is the real export's.
    exportMascotCard: (rig: MascotRig) => real.exportMascotCard(rig, { render: async () => ({ bytes: tinyWebp(), width: 1, height: 1 }) }),
    storeMascotCard: async (card: Parameters<typeof real.storeMascotCard>[0]) => {
      await importGate.wait;
      const rig = await real.storeMascotCard(card);
      importGate.stored.push(rig);
      return rig;
    },
  };
});

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
const preview = () => [...document.querySelectorAll<HTMLImageElement>('[data-fq-piece="mascot"][data-fq-view="full"] img')].map((img) => img.getAttribute('src'));
const fileInput = (id: string) => document.getElementById(`image-upload-${id}`) as HTMLInputElement;
const layerOf = (id: string) => current.rig.layers.find((row) => row.id === id)!;

beforeEach(async () => {
  await clearMascotImages();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SCALE_KEY = 'formamorph.formaquestion.mascotScale';

describe('the Scale slider', () => {
  afterEach(() => localStorage.clear());

  it('starts at Auto, steps to a percent and back, and stores each on this device', async () => {
    mount();
    const slider = screen.getByRole('slider', { name: 'Scale' });
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', 'Auto');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(localStorage.getItem(SCALE_KEY)).toBe('25');
    expect(slider).toHaveAttribute('aria-valuetext', '25%');
    expect(screen.getByText('25%')).toBeInTheDocument();
    await userEvent.keyboard('{End}');
    expect(localStorage.getItem(SCALE_KEY)).toBe('150');
    await userEvent.keyboard('{Home}');
    expect(localStorage.getItem(SCALE_KEY)).toBe('auto');
    expect(current).toEqual(expect.not.objectContaining({ scale: expect.anything() }));
  });
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

describe('the preview selection', () => {
  const happy = [mascotAssetUrl('base'), mascotAssetUrl('mouth-grin'), mascotAssetUrl('eyes-closed')];
  const idle = () => composeMascot(DEFAULT_MASCOT_RIG, 'answering', null).map(mascotImageUrl);
  const overlayButton = (n: number) => screen.getByRole('button', { name: `Show overlay ${n}` });
  const selectedOverlays = () => layerRow('Happy').querySelectorAll('[data-editor-row-selected] [aria-label^="Show overlay"]').length;

  it('shows the Idle look with nothing selected, and returns to it when the layer collapses', async () => {
    mount();
    expect(preview()).toEqual(idle());
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(preview()).toEqual(happy);
    await userEvent.click(within(layerRow('Happy')).getByRole('button', { name: 'Collapse' }));
    expect(preview()).toEqual(idle());
  });

  it('collapses a selected layer on a second click of its row, back to the Idle look', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(preview()).toEqual(idle());
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
  });

  it('returns to the whole layer when its row is clicked with an overlay selected', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Show Happy overlay 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(preview()).toEqual(happy);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Happy');
  });

  it('shows the base with a clicked overlay alone, and the whole layer again on a second click', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.click(overlayButton(2));
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('eyes-closed')]);
    expect(selectedOverlays()).toBe(1);
    await userEvent.click(overlayButton(2));
    expect(preview()).toEqual(happy);
  });

  it('selects an overlay from a collapsed row thumbnail, and opens its layer', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Show Happy overlay 1' }));
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('mouth-grin')]);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Happy');
  });

  it('falls back to the whole layer when the selected overlay goes', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.click(overlayButton(1));
    await userEvent.click(within(layerRow('Happy')).getAllByRole('button', { name: 'Remove overlay' })[0]);
    expect(layerOf('happy').images).toEqual([{ kind: 'bundled', name: 'eyes-closed' }]);
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('eyes-closed')]);
    expect(selectedOverlays()).toBe(0);
  });

  it('keeps the same overlay shown after a removal above it', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.click(overlayButton(2));
    await userEvent.click(within(layerRow('Happy')).getAllByRole('button', { name: 'Remove overlay' })[0]);
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('eyes-closed')]);
    expect(selectedOverlays()).toBe(1);
  });

  it('keeps the same overlay shown after it moves', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[aria-roledescription="sortable"]')?.parentElement ?? null;
      if (!row?.parentElement) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 10000 });
      return DOMRect.fromRect({ x: 0, y: [...row.parentElement.children].indexOf(row) * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await user.click(overlayButton(2));
    const grips = within(layerRow('Happy')).getAllByRole('button').filter((el) => el.getAttribute('aria-roledescription') === 'sortable');
    grips[2].focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    expect(layerOf('happy').images[0]).toEqual({ kind: 'bundled', name: 'eyes-closed' });
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('eyes-closed')]);
  });

  it('drops the selection when its layer goes', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await userEvent.click(within(layerRow('Happy')).getByRole('button', { name: 'Remove layer' }));
    expect(preview()).toEqual(idle());
  });
});

describe('the preview widget', () => {
  const widget = () => document.querySelector<HTMLElement>('[data-fq-mascot-preview]')!;
  const controls = () => document.querySelector<HTMLElement>('[data-fq-mascot-controls]')!;

  it('holds the mascot, the head view, the transition mode, its tuning and Play', () => {
    mount();
    expect(within(widget()).getAllByRole('radio', { name: 'Jelly' })).toHaveLength(1);
    expect(within(widget()).getByRole('slider', { name: 'Squash' })).toBeInTheDocument();
    expect(within(widget()).getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(widget().querySelector('[data-fq-piece="mascot"][data-fq-view="full"]')).not.toBeNull();
    expect(widget().querySelector('[data-fq-piece="mascot"][data-fq-view="head"]')).not.toBeNull();
    expect(widget().querySelector('[data-fq-mask-target]')).not.toBeNull();
    expect(within(controls()).queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('keeps the layers, picks and warning in the controls, with the preview first in reading order', async () => {
    mount();
    expect(within(controls()).getByRole('combobox', { name: 'Idle Look State' })).toBeInTheDocument();
    await userEvent.click(within(layerRow('Rest')).getByRole('checkbox', { name: 'Enable Rest' }));
    expect(controls().querySelector('[data-fq-pick-warning]')).not.toBeNull();
    // Stacked under the breakpoint, the preview comes first; the pinned columns are proven by the ticket's frames.
    expect(widget().compareDocumentPosition(controls()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names what the preview shows', async () => {
    mount();
    expect(within(widget()).getByText(MASCOT_COPY.idleShown)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(within(widget()).getByText('Happy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show overlay 2' }));
    expect(within(widget()).getByText('Happy · Overlay 2')).toBeInTheDocument();
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

describe('the Mask', () => {
  /** jsdom loads no image and lays nothing out: the base reports 888 by 1184, drawn at 180 by 240. */
  function laidOut() {
    for (const base of document.querySelectorAll<HTMLImageElement>('[data-fq-piece="mascot"] [data-fq-look="new"] > img:first-child')) {
      Object.defineProperty(base, 'naturalWidth', { configurable: true, value: 888 });
      Object.defineProperty(base, 'naturalHeight', { configurable: true, value: 1184 });
      fireEvent.load(base);
    }
    const target = document.querySelector<HTMLElement>('[data-fq-mask-target]')!;
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 10, y: 20, width: 180, height: 240 }));
    return target;
  }
  const head = () => document.querySelector<HTMLElement>('[data-fq-piece="mascot"][data-fq-view="head"]')!;
  const frame = () => (head().firstElementChild as HTMLElement).style;

  it('draws the head view from the stored Mask', () => {
    mount();
    laidOut();
    // The default Mask is 768 by 680 from (100, 0).
    expect(head().style.height).toBe('96px');
    expect(parseFloat(head().style.width)).toBeCloseTo(108.42, 2);
    expect(parseFloat(frame().left)).toBeCloseTo(-13.02, 2);
    expect(parseFloat(frame().width)).toBeCloseTo(115.63, 2);
  });

  it('stores the box a drag draws, in base pixels, and the head preview follows while it runs', () => {
    mount();
    const target = laidOut();
    // Preview pixels (45, 30) to (135, 120) are base pixels (222, 148) to (666, 592).
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 55, clientY: 50 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 145, clientY: 140 });
    expect(current.rig.mask).toEqual(DEFAULT_MASCOT_RIG.mask);
    expect(head().style.width).toBe('96px');
    expect(parseFloat(frame().left)).toBeCloseTo(-50, 6);
    expect(parseFloat(frame().top)).toBeCloseTo(-33.33, 2);
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(current.rig.mask).toEqual({ x: 222, y: 148, width: 444, height: 444 });
    expect(document.querySelector<HTMLElement>('[data-fq-mask-box]')!.style.left).toBe('25%');
  });

  it('drops the box when the browser cancels the drag', () => {
    mount();
    const target = laidOut();
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 55, clientY: 50 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 145, clientY: 140 });
    fireEvent.pointerCancel(target, { pointerId: 1 });
    expect(current.rig.mask).toEqual(DEFAULT_MASCOT_RIG.mask);
    expect(parseFloat(head().style.width)).toBeCloseTo(108.42, 2);
  });

  it('keeps the Mask through a press that wobbles a pixel', () => {
    mount();
    const target = laidOut();
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 81, clientY: 81 });
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(current.rig.mask).toEqual(DEFAULT_MASCOT_RIG.mask);
  });

  it('restores the default Mask on Reset', async () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: { x: 0, y: 0, width: 300, height: 300 } });
    await userEvent.click(screen.getByRole('button', { name: 'Reset Mascot' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(current.rig.mask).toEqual(DEFAULT_MASCOT_RIG.mask);
  });
});

describe('the picks', () => {
  const pickSelect = (name: string) => screen.getByRole('combobox', { name });
  /** The option names a pick dropdown offers, read with it open, then closed again. */
  async function optionsOf(name: string) {
    const user = userEvent.setup();
    await user.click(pickSelect(name));
    const names = (await screen.findAllByRole('option')).map((option) => option.textContent);
    await user.keyboard('{Escape}');
    return names;
  }
  async function choose(name: string, option: string) {
    const user = userEvent.setup();
    await user.click(pickSelect(name));
    await user.click(await screen.findByRole('option', { name: option }));
  }
  const warning = () => document.querySelector<HTMLElement>('[data-fq-pick-warning]');
  const warned = () => within(warning()!).getAllByRole('listitem').map((item) => item.textContent);
  const faces = DEFAULT_MASCOT_RIG.layers.filter((row) => row.kind === 'expression').map((row) => row.name);

  it('lists the enabled layers of each kind, and None', async () => {
    mount();
    expect(await optionsOf('Idle Look State')).toEqual(['None', 'Wave', 'Rest', 'Thinking']);
    expect(await optionsOf('Thinking Look Expression')).toEqual(['None', ...faces]);
    await userEvent.click(within(layerRow('Happy')).getByRole('checkbox', { name: 'Enable Happy' }));
    expect(await optionsOf('Initial Look Expression')).toEqual(['None', ...faces.filter((name) => name !== 'Happy')]);
  });

  it('points a pick at a layer, and the Idle preview draws it', async () => {
    mount();
    await choose('Idle Look Expression', 'Happy');
    expect(current.rig.picks.idle).toEqual({ expression: 'happy', state: 'rest' });
    expect(preview()).toContain(mascotAssetUrl('mouth-grin'));
    await choose('Idle Look Expression', 'None');
    expect(current.rig.picks.idle).toEqual({ expression: null, state: 'rest' });
    expect(preview()).not.toContain(mascotAssetUrl('mouth-grin'));
  });

  it('keeps a pick whose layer goes off, draws nothing for it and warns, until the layer comes back', async () => {
    mount();
    expect(warning()).toBeNull();
    const rest = within(layerRow('Rest')).getByRole('checkbox', { name: 'Enable Rest' });
    await userEvent.click(rest);
    expect(current.rig.picks.idle.state).toBe('rest');
    expect(preview()).toEqual([mascotAssetUrl('base')]);
    expect(pickSelect('Idle Look State')).toHaveTextContent('Rest');
    expect(warned()).toEqual(['Idle Look State: Rest']);
    await userEvent.click(rest);
    expect(warning()).toBeNull();
    expect(preview()).toContain(mascotAssetUrl('arms-no-wave'));
  });

  it('warns about a pick whose layer is gone', async () => {
    mount();
    await userEvent.click(within(layerRow('Wave')).getByRole('button', { name: 'Remove layer' }));
    expect(current.rig.picks.initial.state).toBe('wave');
    expect(pickSelect('Initial Look State')).toHaveTextContent('Missing Layer');
    expect(warned()).toEqual(['Initial Look State: Missing Layer']);
  });
});

describe('the transition rows', () => {
  const looks = () => [...document.querySelectorAll<HTMLElement>('[data-fq-piece="mascot"][data-fq-view="full"] [data-fq-look]')]
    .map((look) => [...look.querySelectorAll('img')].map((img) => img.getAttribute('src')));
  const thinkingLook = () => composeMascot(DEFAULT_MASCOT_RIG, 'thinking', null).map(mascotImageUrl);
  const modeButton = (name: string) => screen.getAllByRole('radio', { name })[0];
  const slider = (name: string) => screen.getByRole('slider', { name });

  it('shows the Jelly tuning within its ranges at the default, and keeps it across a switch to Dissolve and back', async () => {
    mount();
    expect(modeButton('Jelly')).toHaveAttribute('aria-checked', 'true');
    for (const [name, key] of [['Duration', 'durationMs'], ['Squash', 'squash'], ['Overshoot', 'overshoot'], ['Settle Count', 'settle']] as const) {
      expect(slider(name)).toHaveAttribute('aria-valuemin', String(JELLY_RANGES[key].min));
      expect(slider(name)).toHaveAttribute('aria-valuemax', String(JELLY_RANGES[key].max));
      expect(slider(name)).toHaveAttribute('aria-valuenow', String(DEFAULT_MASCOT_RIG.transition.jelly[key]));
    }

    fireEvent.keyDown(slider('Settle Count'), { key: 'End' });
    expect(current.rig.transition.jelly.settle).toBe(JELLY_RANGES.settle.max);
    fireEvent.keyDown(slider('Settle Count'), { key: 'ArrowRight' });
    expect(current.rig.transition.jelly.settle).toBe(JELLY_RANGES.settle.max);

    await userEvent.click(modeButton('Dissolve'));
    expect(current.rig.transition.mode).toBe('dissolve');
    expect(screen.queryByRole('slider', { name: 'Squash' })).toBeNull();
    expect(slider('Duration')).toHaveAttribute('aria-valuemin', String(DISSOLVE_RANGES.durationMs.min));
    expect(slider('Duration')).toHaveAttribute('aria-valuemax', String(DISSOLVE_RANGES.durationMs.max));
    fireEvent.keyDown(slider('Duration'), { key: 'Home' });
    expect(current.rig.transition.dissolve.durationMs).toBe(DISSOLVE_RANGES.durationMs.min);

    await userEvent.click(modeButton('None'));
    expect(screen.getAllByRole('slider').map((thumb) => thumb.getAttribute('aria-label'))).toEqual(['Scale']);
    await userEvent.click(modeButton('Jelly'));
    expect(current.rig.transition).toEqual({
      mode: 'jelly',
      jelly: { ...DEFAULT_MASCOT_RIG.transition.jelly, settle: JELLY_RANGES.settle.max },
      dissolve: { durationMs: DISSOLVE_RANGES.durationMs.min },
    });
  });

  it('plays to the Thinking look and holds it, then back to the Idle look on the next Play', async () => {
    mount();
    const idle = preview();
    expect(looks()).toEqual([idle]);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(looks()).toEqual([idle, thinkingLook()]);
    await waitFor(() => expect(looks()).toEqual([thinkingLook()]));
    expect(screen.getByText(MASCOT_COPY.picks.thinking.label, { selector: '[data-fq-mascot-preview] *' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(looks()).toEqual([thinkingLook(), idle]);
    await waitFor(() => expect(looks()).toEqual([idle]));
  });

  it("plays from an expanded layer's look to the Thinking look, and a new selection drops the Thinking look", async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    const happy = preview();
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(looks()).toEqual([happy, thinkingLook()]);
    await waitFor(() => expect(looks()).toEqual([thinkingLook()]));
    await userEvent.click(screen.getByRole('button', { name: 'Show overlay 1' }));
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('mouth-grin')]);
  });

  it('says the look swaps at once under the reduced-motion preference, and Play swaps at once', async () => {
    mount();
    expect(screen.queryByText(MASCOT_COPY.transition.reducedMotion)).toBeNull();
    cleanup();
    stubReducedMotion();
    try {
      mount();
      expect(screen.getByText(MASCOT_COPY.transition.reducedMotion)).toBeInTheDocument();
      const idle = preview();
      await userEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(looks()).toEqual([thinkingLook()]);
      await userEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(looks()).toEqual([idle]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the Voice', () => {
  it('shows the rig Voice and stores what the player types', async () => {
    mount();
    const voice = screen.getByRole('textbox', { name: 'Voice' });
    expect(voice).toHaveValue(DEFAULT_MASCOT_RIG.voice);
    await userEvent.clear(voice);
    await userEvent.type(voice, 'Dry and brief.');
    expect(current.rig.voice).toBe('Dry and brief.');
  });
});

describe('the mascot card', () => {
  /** A card file whose images are the given texts standing in for pixels. */
  function cardFile(rig: MascotRig, edit: (json: string) => string = (json) => json): File {
    const data = buildMascotCardData(rig, (ref) => `data:image/png;base64,${btoa(ref.kind === 'stored' ? ref.id : ref.name)}`, '3.0.1');
    return new File([embedEntityCard(webp(), edit(JSON.stringify(data)), { w: 1, h: 1 })], 'friend.webp', { type: 'image/webp' });
  }

  const cardRig: MascotRig = {
    ...DEFAULT_MASCOT_RIG,
    base: stored('friend-body'),
    layers: [{ id: 'hi', name: 'Hi', kind: 'state', enabled: true, images: [stored('friend-arm')] }],
    picks: { initial: { expression: null, state: 'hi' }, idle: { expression: null, state: 'hi' }, thinking: { expression: null, state: null } },
    voice: 'Gruff.',
  };

  const upload = (file: File) => userEvent.upload(screen.getByTestId('mascot-card-input'), file);

  /** Holds the next import's store step; call the result to let it go. */
  function holdImport(): () => void {
    let release = () => undefined as void;
    importGate.wait = new Promise<void>((resolve) => { release = resolve; });
    return release;
  }

  beforeEach(() => {
    importGate.wait = Promise.resolve();
    importGate.stored = [];
  });

  const confirm = async () => userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));

  /** The import's stored images, once its store step has run, and whether each is gone again. */
  async function importedImagesGone(): Promise<boolean[]> {
    await waitFor(() => expect(importGate.stored).toHaveLength(1));
    return Promise.all([...mascotImageIds(importGate.stored[0])].map(async (id) => (await getMascotImage(id)) === null));
  }

  it('imports a card after a confirmation, replacing the rig and deleting the old images', async () => {
    const old = await addMascotImage(png());
    mount({ ...DEFAULT_MASCOT_RIG, base: stored(old) });
    await upload(cardFile(cardRig));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(MASCOT_COPY.card.confirmTitle)).toBeInTheDocument();
    expect(current.rig.base).toEqual(stored(old));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(current.rig.voice).toBe('Gruff.'));
    expect(current.rig.layers.map((row) => row.name)).toEqual(['Hi']);
    // The store's bytes round-trip in mascotCardFile.test; jsdom's Blob does not survive the fake store's clone.
    const ids = [current.rig.base, ...current.rig.layers[0].images].map((ref) => (ref as { kind: string; id: string }));
    expect(ids.every((ref) => ref.kind === 'stored')).toBe(true);
    for (const ref of ids) expect(await getMascotImage(ref.id)).not.toBeNull();
    await waitFor(async () => expect(await getMascotImage(old)).toBeNull());
  });

  it('keeps the device scale through an import', async () => {
    localStorage.setItem(SCALE_KEY, '75');
    mount();
    await upload(cardFile(cardRig));
    await confirm();
    await waitFor(() => expect(current.rig.voice).toBe('Gruff.'));
    expect(localStorage.getItem(SCALE_KEY)).toBe('75');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('keeps the rig when the confirmation is canceled', async () => {
    mount();
    await upload(cardFile(cardRig));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(current.rig).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('names the bad field of a refused card, asks nothing and changes nothing', async () => {
    const error = vi.spyOn(toast, 'error');
    mount();
    await upload(cardFile(cardRig, (json) => json.replace('"voice":"Gruff."', '"voice":5')));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    render(<>{error.mock.calls[0][0] as React.ReactNode}</>);
    expect(screen.getByText('This mascot card has a missing or bad field: rig.voice.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(current.rig).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('exports the rig as mascot.webp', async () => {
    // The fake store clones a jsdom Blob to an empty object; Node's Blob keeps its bytes, as a browser's store does.
    const id = await addMascotImage(new NodeBlob(['pixels'], { type: 'image/png' }) as unknown as Blob);
    mount({ ...cardRig, base: stored(id), layers: [] });
    await userEvent.click(screen.getByRole('button', { name: MASCOT_COPY.card.export }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0];
    expect(name).toBe('mascot.webp');
    expect((await readMascotCard(blob)).rig.voice).toBe('Gruff.');
  });

  it('drops an import that a Reset overtakes, and deletes the images it stored', async () => {
    mount();
    const release = holdImport();
    await upload(cardFile(cardRig));
    await confirm();
    await userEvent.click(screen.getByRole('button', { name: 'Reset Mascot' }));
    await confirm();
    release();
    await waitFor(async () => expect(await importedImagesGone()).toEqual([true, true]));
    expect(current.rig).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('drops an import that lands after the tab closes, and deletes the images it stored', async () => {
    const { unmount } = mount();
    const release = holdImport();
    await upload(cardFile(cardRig));
    await confirm();
    unmount();
    release();
    await waitFor(async () => expect(await importedImagesGone()).toEqual([true, true]));
  });
});
