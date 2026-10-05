// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotRig } from '@/lib/formaquestion/mascot';
import { mascotAssetUrl, mascotImageUrl } from '@/lib/formaquestion/mascotAssets';
import { DISSOLVE_RANGES, JELLY_RANGES } from '@/lib/formaquestion/mascotTransition';
import { addMascotImage, clearMascotImages, getMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { activeMascotRig } from '@/lib/formaquestion/mascotPresets';
import { mascotStoreOf } from '@/test/helpFixtures';
import { MascotTab } from './FormaquestionMascotTab';
import { useMascotDraft, type MascotDraftControl } from './useMascotDraft';
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

/** The ids the image store handed out, in order, so a test can follow an upload it never sees land. */
const uploaded = vi.hoisted(() => [] as string[]);
/** Holds an upload's store step until a test lets it go. */
const uploadGate = vi.hoisted(() => ({ wait: Promise.resolve() }));

vi.mock('@/lib/formaquestion/mascotImageStore', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/formaquestion/mascotImageStore')>();
  return {
    ...real,
    addMascotImage: async (blob: Blob) => {
      await uploadGate.wait;
      const id = await real.addMascotImage(blob);
      uploaded.push(id);
      return id;
    },
  };
});
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/formaquestion/mascotCardFile', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/formaquestion/mascotCardFile')>();
  const { tinyWebp } = await import('@/test/webpFixture');
  return {
    ...real,
    // jsdom decodes no image, so the card's look is a stand-in WebP; the card data is the real export's.
    exportMascotCard: (name: string, rig: MascotRig) => real.exportMascotCard(name, rig, { render: async () => ({ bytes: tinyWebp(), width: 1, height: 1 }) }),
    storeMascotCard: async (card: Parameters<typeof real.storeMascotCard>[0]) => {
      await importGate.wait;
      const rig = await real.storeMascotCard(card);
      importGate.stored.push(rig);
      return rig;
    },
  };
});

let current: HelpSettings;
let control: MascotDraftControl;
const openGeneral = vi.fn();
/** Flips the Mascot switch the way the General tab does. */
let setMascotOn: (on: boolean) => void;

/** The tab over the draft, with the unsaved-changes prompt Formaquestion Settings draws beside it. */
function Harness({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  current = settings;
  setMascotOn = (mascot) => setSettings((was) => helpSettingsOf({ mascot }, was));
  control = useMascotDraft(settings, (change) => setSettings((was) => helpSettingsOf(change, was)));
  return (
    <>
      <MascotTab settings={settings} control={control} onOpenGeneral={openGeneral} />
      <UnsavedChangesDialog {...control.leavePrompt} />
    </>
  );
}

/** The tab on a custom mascot, "Mine", holding `rig`. */
const mount = (rig: MascotRig = DEFAULT_MASCOT_RIG) => render(<Harness initial={{ ...DEFAULT_HELP_SETTINGS, mascotPresets: mascotStoreOf(rig) }} />);
/** The tab on "Mine" with the Mascot off. */
const mountOff = (rig: MascotRig = DEFAULT_MASCOT_RIG) => render(<Harness initial={{ ...DEFAULT_HELP_SETTINGS, mascot: false, mascotPresets: mascotStoreOf(rig) }} />);
/** The tab on the Default mascot. */
const mountDefault = () => render(<Harness initial={DEFAULT_HELP_SETTINGS} />);
/** The draft's rig: what the tab shows. */
const drafted = () => control.draft.rig;
/** The active mascot's saved rig: what the window draws. */
const saved = () => activeMascotRig(current.mascotPresets);
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));

const png = (name = 'art.png') => new File(['pixels'], name, { type: 'image/png' });
const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });

/** The layer rows, top to bottom, by name. */
const layerNames = () => [...document.querySelectorAll<HTMLElement>('[data-mascot-layer]')]
  .map((row) => within(row).getByRole('button', { name: /^Expand / }).textContent);
const layerRow = (name: string) => screen.getByRole('button', { name: `Expand ${name}` }).closest<HTMLElement>('[data-mascot-layer]')!;
const preview = () => [...document.querySelectorAll<HTMLImageElement>('[data-fq-piece="mascot"][data-fq-view="full"] img')].map((img) => img.getAttribute('src'));
const fileInput = (id: string) => document.getElementById(`image-upload-${id}`) as HTMLInputElement;
const layerOf = (id: string) => drafted().layers.find((row) => row.id === id)!;

beforeEach(async () => {
  openGeneral.mockClear();
  uploaded.length = 0;
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
    expect(drafted().layers.at(-1)).toMatchObject({ name: 'New Layer', kind: 'expression', enabled: true, images: [] });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Grumpy');
    await userEvent.click(within(layerRow('Grumpy')).getByRole('radio', { name: 'State' }));
    expect(drafted().layers.at(-1)).toMatchObject({ name: 'Grumpy', kind: 'state' });
    // The row itself, above the open body, shows the new kind.
    expect(within(layerRow('Grumpy').firstElementChild as HTMLElement).getByText('State')).toBeInTheDocument();
  });

  it('removes a layer', async () => {
    mount();
    await userEvent.click(within(layerRow('Crying')).getByRole('button', { name: 'Remove layer' }));
    expect(layerNames()).not.toContain('Crying');
    expect(drafted().layers.map((row) => row.id)).not.toContain('sad');
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
    expect(drafted().layers.slice(0, 2).map((row) => row.id)).toEqual(['rest', 'wave']);
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

describe('the controls column', () => {
  const sectionOf = (name: string) => screen.getByRole('heading', { name }).closest<HTMLElement>('section')!;

  it('gives the Base Image and the layer list their own headings, with no label column', () => {
    mount();
    const base = sectionOf('Base Image');
    expect(base).toContainElement(fileInput('fq-mascot-base'));
    const layers = sectionOf('Layers');
    for (const name of DEFAULT_MASCOT_RIG.layers.map((row) => row.name)) expect(layers).toContainElement(layerRow(name));
    expect(within(layers).getByRole('button', { name: 'Add Layer' })).toBeInTheDocument();
    // The heading is the only place each name shows, so no label cell sits beside the control.
    expect(within(base).getAllByText('Base Image')).toHaveLength(1);
    expect(within(layers).getAllByText('Layers')).toHaveLength(1);
  });

  it('keeps Voice and the picks in their own Sections, and the card buttons in the preset row', () => {
    mount();
    expect(sectionOf('Mascot')).toContainElement(screen.getByRole('textbox', { name: 'Voice' }));
    expect(sectionOf('Rig')).toContainElement(screen.getByRole('combobox', { name: 'Idle Look State' }));
    const row = screen.getByTestId('mascot-preset-row');
    for (const name of ['Reset', 'Import', 'Export']) expect(row).toContainElement(screen.getByRole('button', { name }));
  });
});

describe('the Mascot off state', () => {
  const OFF_LINE = 'The Mascot is off. Enable it in “General” to customize it.';
  const status = () => screen.getByTestId('mascot-off-status');
  const widget = () => document.querySelector<HTMLElement>('[data-fq-mascot-preview]')!;
  /** Every control the tab draws, the status line's link aside. */
  const tabControls = () => [...document.querySelectorAll<HTMLElement>('button, input, textarea, select, [role="slider"], [role="combobox"]')]
    .filter((el) => !status().contains(el));

  it('has no Mascot switch on the tab, on or off', () => {
    const view = mount();
    expect(screen.queryByRole('checkbox', { name: 'Mascot' })).toBeNull();
    view.unmount();
    mountOff();
    expect(screen.queryByRole('checkbox', { name: 'Mascot' })).toBeNull();
  });

  it('draws no line and leaves every control enabled while the Mascot is on', () => {
    mount();
    expect(status()).toBeEmptyDOMElement();
    expect(screen.queryByText(/The Mascot is off/)).toBeNull();
    expect(document.querySelector('fieldset[disabled]')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Preset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(widget()).getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('draws one line, in an announced region, when the Mascot is off', () => {
    mountOff();
    expect(status()).toHaveTextContent(OFF_LINE);
    expect(screen.getAllByText(/The Mascot is off/)).toHaveLength(1);
    expect(status()).toHaveAttribute('role', 'status');
  });

  it('opens General from the link, and the link stays usable', async () => {
    mountOff();
    const link = within(status()).getByRole('button', { name: 'General' });
    expect(link).toBeEnabled();
    expect(link.closest('fieldset')).toBeNull();
    await userEvent.click(link);
    expect(openGeneral).toHaveBeenCalledTimes(1);
  });

  it('disables the preset header, the preview and its Play, the editor and the footer, all hidden', () => {
    mountOff();
    const controls = tabControls();
    // The preset select and its actions, the preview, the editor rows and the footer are all in this list.
    expect(controls.length).toBeGreaterThan(20);
    for (const el of controls) {
      expect(el.closest('fieldset[disabled]'), el.outerHTML.slice(0, 80)).not.toBeNull();
      if (el.matches('button, input, textarea, select')) expect(el).toBeDisabled();
    }
    for (const control of [screen.getByRole('combobox', { name: 'Preset' }), screen.getByRole('button', { name: 'Duplicate' }), screen.getByRole('textbox', { name: 'Voice' }), within(widget()).getByRole('button', { name: 'Play' }), screen.getByRole('button', { name: 'Undo' }), screen.getByRole('button', { name: 'Save' })]) {
      expect(control).toBeDisabled();
    }
    // jsdom loads no CSS, so the hiding class is the claim here; the e2e spec proves it paints hidden.
    expect(widget().closest('.hidden')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Voice' }).closest('.hidden')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save' }).closest('.hidden')).toBeNull();
  });

  it('keeps a dirty draft through the off state and brings every control back when the Mascot is on again', async () => {
    mount();
    await userEvent.click(within(layerRow('Rest')).getByRole('checkbox', { name: 'Enable Rest' }));
    const dirtyRig = drafted();

    act(() => setMascotOn(false));
    expect(status()).toHaveTextContent(OFF_LINE);
    expect(screen.getByRole('combobox', { name: 'Preset' })).toBeDisabled();
    expect(control.dirty).toBe(true);
    expect(drafted()).toBe(dirtyRig);

    act(() => setMascotOn(true));
    expect(status()).toBeEmptyDOMElement();
    expect(screen.getByRole('combobox', { name: 'Preset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(drafted()).toBe(dirtyRig);
  });
});

describe('the scrollers', () => {
  afterEach(() => vi.unstubAllGlobals());
  const viewport = (name: string) => document.querySelector<HTMLElement>(`[data-fq-scroll="${name}"]`);

  it('puts both columns in one scroller below the wide layout, so the stack has one scrolling owner', () => {
    mount();
    const owner = viewport('mascot-tab')!;
    expect(owner).not.toBeNull();
    expect(owner).toContainElement(document.querySelector('[data-fq-mascot-preview]') as HTMLElement);
    expect(owner).toContainElement(document.querySelector('[data-fq-mascot-controls]') as HTMLElement);
    expect(viewport('mascot-preview')).toBeNull();
    expect(viewport('mascot-controls')).toBeNull();
  });

  it('gives each column its own scroller from the wide layout', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    mount();
    const preview = viewport('mascot-preview')!;
    const side = viewport('mascot-controls')!;
    expect(preview).toContainElement(document.querySelector('[data-fq-mascot-preview]') as HTMLElement);
    expect(side).toContainElement(document.querySelector('[data-fq-mascot-controls]') as HTMLElement);
    expect(preview).not.toContainElement(side);
    expect(viewport('mascot-tab')).toBeNull();
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

  it('keeps a removed overlay image until Save, and then only while another layer holds it', async () => {
    const id = await addMascotImage(png());
    const rig: MascotRig = {
      ...DEFAULT_MASCOT_RIG,
      layers: DEFAULT_MASCOT_RIG.layers.map((row) => (row.id === 'happy' || row.id === 'sad' ? { ...row, images: [stored(id)] } : row)),
    };
    mount(rig);
    await userEvent.click(within(layerRow('Happy')).getByRole('button', { name: 'Remove layer' }));
    await save();
    expect(await getMascotImage(id)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Crying' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove overlay' }));
    expect(await getMascotImage(id)).not.toBeNull();
    await save();
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('replaces the base with an upload, and removing it restores the default base; the image goes at Save', async () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull();
    expect(within(fileInput('fq-mascot-base').parentElement!).getByText('Add Image')).toBeInTheDocument();
    await userEvent.upload(fileInput('fq-mascot-base'), png('base.png'));
    await waitFor(() => expect(drafted().base.kind).toBe('stored'));
    const id = (drafted().base as { id: string }).id;
    await waitFor(() => expect(preview()[0]).toMatch(/^blob:/));
    await save();
    await userEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(drafted().base).toEqual(DEFAULT_MASCOT_RIG.base);
    expect(await getMascotImage(id)).not.toBeNull();
    await save();
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('drops an upload removed again before any Save once the draft goes, though the draft reads as clean', async () => {
    const { unmount } = mount();
    await userEvent.upload(fileInput('fq-mascot-base'), png('base.png'));
    await waitFor(() => expect(drafted().base.kind).toBe('stored'));
    const id = (drafted().base as { id: string }).id;
    await userEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(control.dirty).toBe(false);
    unmount();
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('drops an upload the player cancels away', async () => {
    mount();
    await userEvent.upload(fileInput('fq-mascot-base'), png('base.png'));
    await waitFor(() => expect(drafted().base.kind).toBe('stored'));
    const id = (drafted().base as { id: string }).id;
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('resets the draft to the Default rig with no confirm; Cancel undoes it and Save drops the old images', async () => {
    const id = await addMascotImage(png());
    const mine = { ...DEFAULT_MASCOT_RIG, base: stored(id), layers: DEFAULT_MASCOT_RIG.layers.slice(2) };
    mount(mine);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
    expect(saved()).toEqual(mine);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(drafted()).toEqual(mine);
    expect(await getMascotImage(id)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await save();
    expect(saved()).toEqual(DEFAULT_MASCOT_RIG);
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

  /** A Mask in the base's bottom-left corner, clear of the drags that draw a new box. */
  const CORNER_MASK = { x: 0, y: 984, width: 200, height: 200 };
  const box = () => document.querySelector<HTMLElement>('[data-fq-mask-box]')!;
  const grip = (name: string) => document.querySelector<HTMLElement>(`[data-fq-mask-grip="${name}"]`)!;

  /** Presses `on` at a preview point, drags the pointer by a preview offset, and lets go. */
  function drag(target: HTMLElement, on: HTMLElement, by: { x: number; y: number }, release: 'up' | 'cancel' = 'up') {
    fireEvent.pointerDown(on, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 100 + by.x, clientY: 100 + by.y });
    if (release === 'up') fireEvent.pointerUp(target, { pointerId: 1 });
    else fireEvent.pointerCancel(target, { pointerId: 1 });
  }

  describe('the preview row', () => {
    const piece = () => document.querySelector<HTMLElement>('[data-fq-piece="mascot"][data-fq-view="full"]')!;
    const rowWidth = (width: number) => {
      const real = HTMLElement.prototype.getBoundingClientRect;
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return this.hasAttribute('data-fq-preview-row') ? DOMRect.fromRect({ width, height: 240 }) : real.call(this);
      });
    };

    it('draws the mascot at the full 240px while the row has room for it and the 128px Head View slot', () => {
      rowWidth(340);
      mount();
      laidOut();
      expect(piece().style.height).toBe('240px');
    });

    it('shrinks the mascot to the room the Head View leaves, and keeps the Head View beside it', () => {
      rowWidth(250);
      mount();
      laidOut();
      // 250 less the 128px slot and the 12px gap leaves 110px, so 110 by 146.67 at the 888:1184 aspect.
      expect(piece().style.width).toBe('110px');
      expect(parseFloat(piece().style.height)).toBeCloseTo(146.67, 2);
      expect(piece().parentElement!.parentElement).toBe(head().closest('[data-fq-preview-row]'));
    });
  });

  it('fits the Head View of a wide Mask to its slot, shorter at the Mask aspect', () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: { x: 0, y: 0, width: 888, height: 200 } });
    laidOut();
    expect(head().style.width).toBe('118px');
    expect(parseFloat(head().style.height)).toBeCloseTo(26.58, 2);
  });

  it('stores the box a drag outside the Mask draws, in base pixels, and the head preview follows while it runs', () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: CORNER_MASK });
    const target = laidOut();
    // Preview pixels (45, 30) to (135, 120) are base pixels (222, 148) to (666, 592).
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 55, clientY: 50 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 145, clientY: 140 });
    expect(drafted().mask).toEqual(CORNER_MASK);
    expect(head().style.width).toBe('96px');
    expect(parseFloat(frame().left)).toBeCloseTo(-50, 6);
    expect(parseFloat(frame().top)).toBeCloseTo(-33.33, 2);
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(drafted().mask).toEqual({ x: 222, y: 148, width: 444, height: 444 });
    expect(box().style.left).toBe('25%');
  });

  it('drops the box when the browser cancels the drag', () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: CORNER_MASK });
    const target = laidOut();
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 55, clientY: 50 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 145, clientY: 140 });
    fireEvent.pointerCancel(target, { pointerId: 1 });
    expect(drafted().mask).toEqual(CORNER_MASK);
    expect(head().style.width).toBe('96px');
    expect(box().style.top).toBe(`${(984 / 1184) * 100}%`);
  });

  it('keeps the Mask through a press outside it that wobbles a pixel', () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: CORNER_MASK });
    const target = laidOut();
    fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 80, clientY: 80 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 81, clientY: 81 });
    fireEvent.pointerUp(target, { pointerId: 1 });
    expect(drafted().mask).toEqual(CORNER_MASK);
  });

  const HANDLES = ['Top-Left Corner', 'Top Edge', 'Top-Right Corner', 'Right Edge', 'Bottom-Right Corner', 'Bottom Edge', 'Bottom-Left Corner', 'Left Edge', 'Move Mask'];

  it('draws eight handles and a move grip on the box', () => {
    mount();
    laidOut();
    for (const name of HANDLES) {
      expect(within(box()).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('disables every handle while the Mascot is off', () => {
    mountOff();
    laidOut();
    for (const name of HANDLES) {
      expect(within(box()).getByRole('button', { name, hidden: true }), name).toBeDisabled();
    }
  });

  // The default Mask is 768 by 680 from (100, 0). A preview drag of (-10, 10) is (-49, 49) base pixels.
  it.each([
    ['nw', { x: 51, y: 49, width: 817, height: 631 }],
    ['n', { x: 100, y: 49, width: 768, height: 631 }],
    ['ne', { x: 100, y: 49, width: 719, height: 631 }],
    ['e', { x: 100, y: 0, width: 719, height: 680 }],
    ['se', { x: 100, y: 0, width: 719, height: 729 }],
    ['s', { x: 100, y: 0, width: 768, height: 729 }],
    ['sw', { x: 51, y: 0, width: 817, height: 729 }],
    ['w', { x: 51, y: 0, width: 817, height: 680 }],
  ])('moves the edges the %s handle holds', (name, expected) => {
    mount();
    const target = laidOut();
    drag(target, grip(name), { x: -10, y: 10 });
    expect(drafted().mask).toEqual(expected);
  });

  it('moves the box, at its size, from the center grip or anywhere inside it', () => {
    mount();
    const target = laidOut();
    drag(target, within(box()).getByRole('button', { name: 'Move Mask' }), { x: 2, y: 10 });
    expect(drafted().mask).toEqual({ x: 110, y: 49, width: 768, height: 680 });
    drag(target, box(), { x: -4, y: 20 });
    expect(drafted().mask).toEqual({ x: 90, y: 148, width: 768, height: 680 });
  });

  it('shows a handle drag in the head preview while it runs, and drops it when the browser cancels', () => {
    mount();
    const target = laidOut();
    fireEvent.pointerDown(grip('s'), { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 100, clientY: 210 });
    // The box is now 768 by 1184 deep: the head view narrows to that aspect.
    expect(parseFloat(head().style.width)).toBeCloseTo(62.27, 2);
    fireEvent.pointerCancel(target, { pointerId: 1 });
    expect(drafted().mask).toEqual(DEFAULT_MASCOT_RIG.mask);
    expect(parseFloat(head().style.width)).toBeCloseTo(108.42, 2);
  });

  it('leaves the stored Mask alone on a click of a handle, even one that runs past the base', () => {
    const past = { x: 600, y: 900, width: 500, height: 500 };
    mount({ ...DEFAULT_MASCOT_RIG, mask: past });
    const target = laidOut();
    drag(target, grip('se'), { x: 0, y: 0 });
    drag(target, box(), { x: 0, y: 0 });
    expect(drafted().mask).toEqual(past);
  });

  it('keeps the box inside the base and above the minimum size', () => {
    mount();
    const target = laidOut();
    drag(target, grip('ne'), { x: 100, y: -100 });
    expect(drafted().mask).toEqual({ x: 100, y: 0, width: 788, height: 680 });
    drag(target, grip('w'), { x: 500, y: 0 });
    expect(drafted().mask).toEqual({ x: 872, y: 0, width: 16, height: 680 });
    drag(target, box(), { x: 0, y: 500 });
    expect(drafted().mask).toEqual({ x: 872, y: 504, width: 16, height: 680 });
  });

  it('undoes a Mask drag, and a run of handle nudges, as one step each', async () => {
    mount();
    const target = laidOut();
    drag(target, grip('e'), { x: -10, y: 0 });
    const dragged = drafted().mask!;
    expect(dragged).not.toEqual(DEFAULT_MASCOT_RIG.mask);
    const user = userEvent.setup();
    grip('s').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(drafted().mask!.height).toBe(dragged.height + 3);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(drafted().mask).toEqual(dragged);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(drafted().mask).toEqual(DEFAULT_MASCOT_RIG.mask);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('moves a focused handle one base pixel per arrow key, ten with Shift, on its own axis', async () => {
    mount();
    laidOut();
    const user = userEvent.setup();
    within(box()).getByRole('button', { name: 'Right Edge' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(drafted().mask).toEqual({ x: 100, y: 0, width: 769, height: 680 });
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}{ArrowUp}');
    expect(drafted().mask).toEqual({ x: 100, y: 0, width: 759, height: 680 });
    within(box()).getByRole('button', { name: 'Move Mask' }).focus();
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}{ArrowUp}{ArrowLeft}');
    expect(drafted().mask).toEqual({ x: 99, y: 9, width: 759, height: 680 });
  });

  it('restores the default Mask on Reset', async () => {
    mount({ ...DEFAULT_MASCOT_RIG, mask: { x: 0, y: 0, width: 300, height: 300 } });
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(drafted().mask).toEqual(DEFAULT_MASCOT_RIG.mask);
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
    expect(drafted().picks.idle).toEqual({ expression: 'happy', state: 'rest' });
    expect(preview()).toContain(mascotAssetUrl('mouth-grin'));
    await choose('Idle Look Expression', 'None');
    expect(drafted().picks.idle).toEqual({ expression: null, state: 'rest' });
    expect(preview()).not.toContain(mascotAssetUrl('mouth-grin'));
  });

  it('keeps a pick whose layer goes off, draws nothing for it and warns, until the layer comes back', async () => {
    mount();
    expect(warning()).toBeNull();
    const rest = within(layerRow('Rest')).getByRole('checkbox', { name: 'Enable Rest' });
    await userEvent.click(rest);
    expect(drafted().picks.idle.state).toBe('rest');
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
    expect(drafted().picks.initial.state).toBe('wave');
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
    expect(drafted().transition.jelly.settle).toBe(JELLY_RANGES.settle.max);
    fireEvent.keyDown(slider('Settle Count'), { key: 'ArrowRight' });
    expect(drafted().transition.jelly.settle).toBe(JELLY_RANGES.settle.max);

    await userEvent.click(modeButton('Dissolve'));
    expect(drafted().transition.mode).toBe('dissolve');
    expect(screen.queryByRole('slider', { name: 'Squash' })).toBeNull();
    expect(slider('Duration')).toHaveAttribute('aria-valuemin', String(DISSOLVE_RANGES.durationMs.min));
    expect(slider('Duration')).toHaveAttribute('aria-valuemax', String(DISSOLVE_RANGES.durationMs.max));
    fireEvent.keyDown(slider('Duration'), { key: 'Home' });
    expect(drafted().transition.dissolve.durationMs).toBe(DISSOLVE_RANGES.durationMs.min);

    await userEvent.click(modeButton('None'));
    expect(screen.getAllByRole('slider').map((thumb) => thumb.getAttribute('aria-label'))).toEqual(['Scale']);
    await userEvent.click(modeButton('Jelly'));
    expect(drafted().transition).toEqual({
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
    expect(drafted().voice).toBe('Dry and brief.');
  });
});

describe('the mascot card', () => {
  /** A card file whose images are the given texts standing in for pixels. */
  function cardFile(rig: MascotRig, edit: (json: string) => string = (json) => json): File {
    const data = buildMascotCardData('Captain', rig, (ref) => `data:image/png;base64,${btoa(ref.kind === 'stored' ? ref.id : ref.name)}`, '3.0.1');
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

  /** The import's stored images, once its store step has run, and whether each is gone again. */
  async function importedImagesGone(): Promise<boolean[]> {
    await waitFor(() => expect(importGate.stored).toHaveLength(1));
    return Promise.all([...mascotImageIds(importGate.stored[0])].map(async (id) => (await getMascotImage(id)) === null));
  }

  const names = () => current.mascotPresets.mascots.map((mascot) => mascot.name);

  it('imports a card as a new mascot under its name, selects it, and keeps the old mascot and its images', async () => {
    const old = await addMascotImage(png());
    mount({ ...DEFAULT_MASCOT_RIG, base: stored(old) });
    await upload(cardFile(cardRig));
    await waitFor(() => expect(saved().voice).toBe('Gruff.'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(names()).toEqual(['Mine', 'Captain']);
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveTextContent('Captain');
    expect(drafted().layers.map((row) => row.name)).toEqual(['Hi']);
    // The store's bytes round-trip in mascotCardFile.test; jsdom's Blob does not survive the fake store's clone.
    const ids = [saved().base, ...saved().layers[0].images].map((ref) => (ref as { kind: string; id: string }));
    expect(ids.every((ref) => ref.kind === 'stored')).toBe(true);
    for (const ref of ids) expect(await getMascotImage(ref.id)).not.toBeNull();
    expect(await getMascotImage(old)).not.toBeNull();
  });

  it('names a card without a name after its file, and numbers a name in use', async () => {
    mount();
    await upload(cardFile(cardRig, (json) => json.replace('"name":"Captain",', '')));
    await waitFor(() => expect(names()).toEqual(['Mine', 'friend']));
    await upload(cardFile(cardRig, (json) => json.replace('"name":"Captain"', '"name":"Mine"')));
    await waitFor(() => expect(names()).toEqual(['Mine', 'friend', 'Mine 2']));
    expect(current.mascotPresets.activeId).toBe(current.mascotPresets.mascots[2].id);
  });

  it('asks before an import drops a dirty draft, and imports after Exit Without Saving', async () => {
    mount();
    await userEvent.click(within(layerRow('Crying')).getByRole('button', { name: 'Remove layer' }));
    await upload(cardFile(cardRig));
    const prompt = await screen.findByRole('alertdialog');
    expect(names()).toEqual(['Mine']);
    await userEvent.click(within(prompt).getByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(names()).toEqual(['Mine', 'Captain']));
    expect(activeMascotRig({ ...current.mascotPresets, activeId: 'mine' })).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('keeps the device scale through an import', async () => {
    localStorage.setItem(SCALE_KEY, '75');
    mount();
    await upload(cardFile(cardRig));
    await waitFor(() => expect(saved().voice).toBe('Gruff.'));
    expect(localStorage.getItem(SCALE_KEY)).toBe('75');
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('names the bad field of a refused card and changes nothing', async () => {
    const error = vi.spyOn(toast, 'error');
    mount();
    await upload(cardFile(cardRig, (json) => json.replace('"voice":"Gruff."', '"voice":5')));
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    render(<>{error.mock.calls[0][0] as React.ReactNode}</>);
    expect(screen.getByText('This mascot card has a missing or bad field: rig.voice.')).toBeInTheDocument();
    expect(names()).toEqual(['Mine']);
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('exports the draft under the mascot name as mascot.webp', async () => {
    // The fake store clones a jsdom Blob to an empty object; Node's Blob keeps its bytes, as a browser's store does.
    const id = await addMascotImage(new NodeBlob(['pixels'], { type: 'image/png' }) as unknown as Blob);
    mount({ ...cardRig, base: stored(id), layers: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0];
    expect(name).toBe('mascot.webp');
    const card = await readMascotCard(blob);
    expect(card.name).toBe('Mine');
    expect(card.rig.voice).toBe('Gruff.');
  });

  it('drops an import that a Reset overtakes, and deletes the images it stored', async () => {
    mount();
    const release = holdImport();
    await upload(cardFile(cardRig));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    release();
    await waitFor(async () => expect(await importedImagesGone()).toEqual([true, true]));
    expect(names()).toEqual(['Mine']);
  });

  it('drops an import that lands after the tab closes, and deletes the images it stored', async () => {
    const { unmount } = mount();
    const release = holdImport();
    await upload(cardFile(cardRig));
    unmount();
    release();
    await waitFor(async () => expect(await importedImagesGone()).toEqual([true, true]));
  });
});

describe('full screen', () => {
  const mascotWindow = () => screen.getByRole('dialog', { name: 'Mascot' });
  const enter = () => userEvent.click(screen.getByRole('button', { name: 'View full screen' }));

  it('lifts the whole tab into the window: header, both columns and the footer', async () => {
    mount();
    await enter();
    const box = within(mascotWindow());
    expect(box.getByTestId('mascot-preset-row')).toBeInTheDocument();
    expect(box.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    expect(box.getByRole('textbox', { name: 'Voice' })).toBeInTheDocument();
    expect(box.getByTestId('mascot-footer')).toBeInTheDocument();
    // Moved, not copied: one header on screen.
    expect(screen.getAllByTestId('mascot-preset-row')).toHaveLength(1);
  });

  it('hands the tab back on Exit and returns focus to the toggle', async () => {
    mount();
    await enter();
    await userEvent.click(within(mascotWindow()).getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mascot' })).toBeNull());
    expect(screen.getByTestId('mascot-footer')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'View full screen' })));
  });

  it('runs from the ⋯ menu below md, and Exit returns focus to the ⋯ button', async () => {
    // Below md the breakpoint hides the icon row; jsdom applies no CSS, so visibility follows that class.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) { return !this.classList.contains('md:inline-flex'); },
    });
    try {
      mount();
      const fromMenu = async (item: string) => {
        fireEvent.click(screen.getByRole('button', { name: 'Preset Actions' }));
        fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: item }));
      };
      await fromMenu('View full screen');
      await screen.findByRole('dialog', { name: 'Mascot' });
      await fromMenu('Exit full screen');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mascot' })).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Preset Actions' })));
    } finally {
      delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
    }
  });

  it('saves from inside the window, and keeps the draft across the trip', async () => {
    mount();
    await enter();
    await userEvent.click(within(mascotWindow()).getByRole('checkbox', { name: 'Enable Crying' }));
    await userEvent.click(within(mascotWindow()).getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mascot' })).toBeNull());
    expect(control.dirty).toBe(true);
    await enter();
    const edited = drafted();
    await userEvent.click(within(mascotWindow()).getByRole('button', { name: 'Save' }));
    expect(saved()).toEqual(edited);
    expect(saved()).not.toEqual(DEFAULT_MASCOT_RIG);
    expect(control.dirty).toBe(false);
  });

  it('names the window without a visible title row', async () => {
    mount();
    await enter();
    const box = mascotWindow();
    expect(box).toHaveAccessibleName('Mascot');
    // The title is the dialog's name only: its element is screen-reader-only, so no row is spent on it.
    expect(document.getElementById(box.getAttribute('aria-labelledby')!)!.closest('.sr-only')).not.toBeNull();
    expect(within(box).getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();
  });

  describe('the column split', () => {
    afterEach(() => vi.unstubAllGlobals());
    const columns = () => document.querySelector<HTMLElement>('[data-fq-mascot-columns]')!;
    const wide = () => vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));

    it('keeps the 22rem preview column docked', () => {
      wide();
      mount();
      expect(columns().className).toContain('grid-cols-[22rem_minmax(0,1fr)]');
    });

    it('gives the preview a third and the controls two thirds in the window, and restores 22rem on Exit', async () => {
      wide();
      mount();
      await enter();
      expect(columns().className).toContain('grid-cols-[minmax(0,1fr)_minmax(0,2fr)]');
      expect(columns().className).not.toContain('22rem');
      await userEvent.click(within(mascotWindow()).getByRole('button', { name: 'Exit full screen' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mascot' })).toBeNull());
      expect(columns().className).toContain('grid-cols-[22rem_minmax(0,1fr)]');
    });
  });

  it('undoes with Ctrl+Z from a control inside the window', async () => {
    mount();
    await enter();
    const box = within(mascotWindow());
    await userEvent.click(within(box.getByRole('button', { name: 'Expand Crying' }).closest<HTMLElement>('[data-mascot-layer]')!).getByRole('button', { name: 'Remove layer' }));
    expect(drafted().layers.map((layer) => layer.id)).not.toContain('sad');
    fireEvent.keyDown(box.getByRole('textbox', { name: 'Voice' }), { key: 'z', ctrlKey: true });
    expect(drafted().layers.map((layer) => layer.id)).toContain('sad');
  });
});

describe('the preset row', () => {
  const row = () => screen.getByTestId('mascot-preset-row');
  const actions = () => within(row()).getAllByRole('button').map((button) => button.getAttribute('aria-label'));
  const presetSelect = () => screen.getByRole('combobox', { name: 'Preset' });
  async function selectMascot(name: string) {
    const user = userEvent.setup();
    await user.click(presetSelect());
    await user.click(await screen.findByRole('option', { name }));
  }

  it('offers Duplicate, Import, Export and full screen on the Default, and every action on a custom mascot', () => {
    mountDefault();
    expect(actions()).toEqual(['Duplicate', 'Import', 'Export', 'View full screen', 'Preset Actions']);
    cleanup();
    mount();
    expect(actions()).toEqual(['Delete', 'Reset', 'Duplicate', 'Rename', 'Import', 'Export', 'View full screen', 'Preset Actions']);
  });

  it('lists the same actions in the ⋯ menu, destructive last', async () => {
    mount();
    fireEvent.click(within(row()).getByRole('button', { name: 'Preset Actions' }));
    const items = within(await screen.findByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Duplicate', 'Rename', 'Import', 'Export', 'View full screen', 'Reset', 'Delete']);
  });

  it('exports the Default as a card under its name', async () => {
    // jsdom serves no bundled asset; the browser fetches each one from the build.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(webp(), { headers: { 'Content-Type': 'image/webp' } }));
    mountDefault();
    await userEvent.click(within(row()).getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0];
    expect(fileName).toBe('mascot.webp');
    expect((await readMascotCard(blob)).name).toBe('Default');
  });

  it('shows the Default read-only: no editor control takes input, and the preview still follows a selected layer', async () => {
    mountDefault();
    expect(screen.getByText('Default is read-only')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Voice' })).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Add Layer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove layer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move Mask' })).toBeNull();
    expect(within(layerRow('Happy')).getByRole('checkbox', { name: 'Enable Happy' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Idle Look State' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: MASCOT_COPY.transition.modes.jelly })).toBeDisabled();
    for (const slider of screen.getAllByRole('slider').filter((el) => el.getAttribute('aria-label') !== 'Scale')) {
      expect(slider).toHaveAttribute('data-disabled');
    }
    expect(screen.getByRole('button', { name: MASCOT_COPY.transition.play.label })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('readonly');
    expect(preview()).toEqual([mascotAssetUrl('base'), mascotAssetUrl('mouth-grin'), mascotAssetUrl('eyes-closed')]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('duplicates the Default from the read-only notice into an editable copy', async () => {
    mountDefault();
    await userEvent.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));
    expect(current.mascotPresets.mascots.map((mascot) => mascot.name)).toEqual(['Default (copy)']);
    expect(presetSelect()).toHaveTextContent('Default (copy)');
    expect(screen.getByRole('textbox', { name: 'Voice' })).not.toHaveAttribute('readonly');
  });

  it('duplicates a custom mascot sharing its image ids', async () => {
    const id = await addMascotImage(png());
    mount({ ...DEFAULT_MASCOT_RIG, base: stored(id) });
    await userEvent.click(within(row()).getByRole('button', { name: 'Duplicate' }));
    const [mine, copy] = current.mascotPresets.mascots;
    expect(copy.name).toBe('Mine (copy)');
    expect(copy.rig.base).toEqual(stored(id));
    expect(mine.rig.base).toEqual(stored(id));
  });

  it('renames a custom mascot at once, outside the draft', async () => {
    mount();
    await userEvent.click(within(row()).getByRole('button', { name: 'Rename' }));
    const name = await screen.findByPlaceholderText('Preset name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Captain{Enter}');
    expect(current.mascotPresets.mascots[0].name).toBe('Captain');
    expect(control.dirty).toBe(false);
  });

  it('deletes a mascot after a confirm, selects the Default, and drops only the images no other mascot holds', async () => {
    const shared = await addMascotImage(png('shared.png'));
    const own = await addMascotImage(png('own.png'));
    render(<Harness initial={{
      ...DEFAULT_HELP_SETTINGS,
      mascotPresets: {
        activeId: 'mine',
        mascots: [
          { id: 'mine', name: 'Mine', rig: { ...DEFAULT_MASCOT_RIG, base: stored(shared), layers: [{ id: 'hi', name: 'Hi', kind: 'state', enabled: true, images: [stored(own)] }] } },
          { id: 'twin', name: 'Twin', rig: { ...DEFAULT_MASCOT_RIG, base: stored(shared) } },
        ],
      },
    }} />);
    await userEvent.click(within(row()).getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(current.mascotPresets.mascots.map((mascot) => mascot.name)).toEqual(['Twin']);
    expect(presetSelect()).toHaveTextContent('Default');
    await waitFor(async () => expect(await getMascotImage(own)).toBeNull());
    expect(await getMascotImage(shared)).not.toBeNull();
  });

  it('asks before a switch drops a dirty draft: Cancel stays, Save & Exit saves and switches', async () => {
    mount();
    await userEvent.click(within(layerRow('Crying')).getByRole('button', { name: 'Remove layer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    await selectMascot('Default');
    const prompt = await screen.findByRole('alertdialog');
    await userEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    expect(presetSelect()).toHaveTextContent('Mine');
    expect(control.dirty).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Happy');
    await selectMascot('Default');
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save & Exit' }));
    expect(presetSelect()).toHaveTextContent('Default');
    expect(current.mascotPresets.mascots[0].rig.layers.map((layer) => layer.id)).not.toContain('sad');
  });
});

describe('undo and redo', () => {
  const undoButton = () => screen.getByRole('button', { name: 'Undo' });
  const redoButton = () => screen.getByRole('button', { name: 'Redo' });
  const slider = (name: string) => screen.getByRole('slider', { name });
  /** The pointer release that ends a drag, wherever it lands. */
  const release = () => fireEvent(window, new Event('pointerup'));
  /** A slider drag: `moves` changes, then the release. */
  const drag = (name: string, key: string, moves: number) => {
    for (let move = 0; move < moves; move += 1) fireEvent.keyDown(slider(name), { key });
    release();
  };
  const removeLayer = (name: string) => userEvent.click(within(layerRow(name)).getByRole('button', { name: 'Remove layer' }));
  const layerIds = () => drafted().layers.map((layer) => layer.id);

  it('starts with both buttons off, and Undo then Redo walk one change back and forward', async () => {
    mount();
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
    await removeLayer('Crying');
    expect(undoButton()).toBeEnabled();
    await userEvent.click(undoButton());
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeEnabled();
    await userEvent.click(redoButton());
    expect(layerIds()).not.toContain('sad');
    expect(redoButton()).toBeDisabled();
  });

  it('brings a removed layer back with its overlays, and a removed overlay too', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    const happy = layerOf('happy');
    expect(happy.images).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove overlay' })[0]);
    expect(layerOf('happy').images).toHaveLength(1);
    await userEvent.click(undoButton());
    expect(layerOf('happy')).toEqual(happy);
    await removeLayer('Happy');
    expect(layerIds()).not.toContain('happy');
    await userEvent.click(undoButton());
    expect(layerOf('happy')).toEqual(happy);
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('undoes a Reset in one step and restores the whole custom rig', async () => {
    const id = await addMascotImage(png());
    const mine: MascotRig = { ...DEFAULT_MASCOT_RIG, base: stored(id), voice: 'Gruff.', layers: DEFAULT_MASCOT_RIG.layers.slice(2) };
    mount(mine);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
    await userEvent.click(undoButton());
    expect(drafted()).toEqual(mine);
    expect(control.dirty).toBe(false);
    expect(undoButton()).toBeDisabled();
    // Nothing left the image store.
    expect(await getMascotImage(id)).not.toBeNull();
  });

  it('keeps an upload in the image store when Undo removes it from the draft, until Cancel', async () => {
    mount();
    await userEvent.upload(fileInput('fq-mascot-base'), png('base.png'));
    await waitFor(() => expect(drafted().base.kind).toBe('stored'));
    const id = (drafted().base as { id: string }).id;
    await userEvent.click(undoButton());
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
    expect(await getMascotImage(id)).not.toBeNull();
    await userEvent.click(redoButton());
    expect(drafted().base).toEqual(stored(id));
    await userEvent.click(undoButton());
    await userEvent.click(redoButton());
    await userEvent.click(undoButton());
    // Cancel is disabled on a clean draft, so edit once more, then cancel everything.
    await removeLayer('Crying');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(async () => expect(await getMascotImage(id)).toBeNull());
  });

  it('undoes a slider drag as one step, and a second drag as the next step', async () => {
    mount();
    const start = DEFAULT_MASCOT_RIG.transition.jelly.squash;
    drag('Squash', 'ArrowRight', 3);
    const first = drafted().transition.jelly.squash;
    expect(first).toBeCloseTo(start + 0.03);
    drag('Squash', 'ArrowRight', 2);
    expect(drafted().transition.jelly.squash).toBeCloseTo(start + 0.05);
    await userEvent.click(undoButton());
    expect(drafted().transition.jelly.squash).toBeCloseTo(first);
    await userEvent.click(undoButton());
    expect(drafted().transition.jelly.squash).toBe(start);
    expect(undoButton()).toBeDisabled();
  });

  it('keeps two sliders in two steps even with no release between them', async () => {
    mount();
    fireEvent.keyDown(slider('Squash'), { key: 'ArrowRight' });
    fireEvent.keyDown(slider('Overshoot'), { key: 'ArrowRight' });
    await userEvent.click(undoButton());
    expect(drafted().transition.jelly.overshoot).toBe(DEFAULT_MASCOT_RIG.transition.jelly.overshoot);
    expect(drafted().transition.jelly.squash).toBeGreaterThan(DEFAULT_MASCOT_RIG.transition.jelly.squash);
  });

  it('undoes a typed run as one step, and a run after a blur as the next', async () => {
    mount();
    const voice = screen.getByRole('textbox', { name: 'Voice' });
    await userEvent.type(voice, ' Dry.');
    await userEvent.tab();
    await userEvent.type(voice, ' Brief.');
    expect(drafted().voice).toBe(`${DEFAULT_MASCOT_RIG.voice} Dry. Brief.`);
    await userEvent.click(undoButton());
    expect(drafted().voice).toBe(`${DEFAULT_MASCOT_RIG.voice} Dry.`);
    await userEvent.click(undoButton());
    expect(drafted().voice).toBe(DEFAULT_MASCOT_RIG.voice);
    expect(undoButton()).toBeDisabled();
  });

  it('undoes an added layer and a layer reorder as one step each', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-mascot-layer]');
      if (!row) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 10000 });
      return DOMRect.fromRect({ x: 0, y: [...row.parentElement!.children].indexOf(row) * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Add Layer' }));
    const original = DEFAULT_MASCOT_RIG.layers.map((layer) => layer.id);
    expect(layerIds().slice(0, -1)).toEqual(original);
    within(layerRow('Wave')).getAllByRole('button').find((el) => el.getAttribute('aria-roledescription') === 'sortable')!.focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowDown]');
    await user.keyboard('[Space]');
    expect(layerIds().slice(0, 2)).toEqual(['rest', 'wave']);
    await user.click(undoButton());
    expect(layerIds().slice(0, -1)).toEqual(original);
    expect(layerNames().at(-1)).toBe('New Layer');
    await user.click(undoButton());
    expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('deletes an upload that lands after its layer is gone, at Cancel', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Happy' }));
    const input = fileInput('fq-mascot-overlay-happy');
    // The upload starts, and the layer goes before the image store answers.
    let release: () => void = () => undefined;
    uploadGate.wait = new Promise<void>((resolve) => { release = resolve; });
    fireEvent.change(input, { target: { files: [png('late.png')] } });
    await removeLayer('Happy');
    release();
    uploadGate.wait = Promise.resolve();
    await waitFor(() => expect(uploaded).toHaveLength(1));
    expect(layerIds()).not.toContain('happy');
    expect(await getMascotImage(uploaded[0])).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(async () => expect(await getMascotImage(uploaded[0])).toBeNull());
  });

  it('drops the redo steps when a change follows an Undo', async () => {
    mount();
    await removeLayer('Crying');
    await userEvent.click(undoButton());
    expect(redoButton()).toBeEnabled();
    await removeLayer('Happy');
    expect(redoButton()).toBeDisabled();
  });

  it('clears the history at Save and at Cancel', async () => {
    mount();
    await removeLayer('Crying');
    await save();
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
    await removeLayer('Happy');
    await userEvent.click(undoButton());
    await removeLayer('Rest');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
  });

  it('clears the history on a switch to another mascot', async () => {
    mount();
    await removeLayer('Crying');
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save & Exit' }));
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
  });

  describe('the shortcuts', () => {
    const ctrlZ = (target: Element, shiftKey = false) => fireEvent.keyDown(target, { key: 'z', ctrlKey: true, shiftKey });

    it('undo with Ctrl+Z and redo with Ctrl+Shift+Z or Ctrl+Y from a control in the tab', async () => {
      mount();
      await removeLayer('Crying');
      const voice = screen.getByRole('textbox', { name: 'Voice' });
      voice.focus();
      ctrlZ(voice);
      expect(drafted()).toEqual(DEFAULT_MASCOT_RIG);
      ctrlZ(voice, true);
      expect(layerIds()).not.toContain('sad');
      ctrlZ(voice);
      fireEvent.keyDown(voice, { key: 'y', ctrlKey: true });
      expect(layerIds()).not.toContain('sad');
    });

    it('leave a key from outside the tab alone', async () => {
      mount();
      await removeLayer('Crying');
      ctrlZ(document.body);
      expect(layerIds()).not.toContain('sad');
    });

    it('leave a key from a dialog the tab opened alone', async () => {
      mount();
      await removeLayer('Crying');
      await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
      ctrlZ(await screen.findByPlaceholderText('Preset name'));
      expect(layerIds()).not.toContain('sad');
    });
  });
});
