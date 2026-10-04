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
    expect(screen.queryByRole('slider')).toBeNull();
    await userEvent.click(modeButton('Jelly'));
    expect(current.rig.transition).toEqual({
      mode: 'jelly',
      jelly: { ...DEFAULT_MASCOT_RIG.transition.jelly, settle: JELLY_RANGES.settle.max },
      dissolve: { durationMs: DISSOLVE_RANGES.durationMs.min },
    });
  });

  it('plays from the Thinking look to the Idle look on the preview', async () => {
    mount();
    const idle = preview();
    expect(looks()).toEqual([idle]);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(looks()).toEqual([thinkingLook(), idle]);
    await waitFor(() => expect(looks()).toEqual([idle]));
  });

  it("plays from the Thinking look to an expanded layer's look", async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    const happy = preview();
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(looks()).toEqual([thinkingLook(), happy]);
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
