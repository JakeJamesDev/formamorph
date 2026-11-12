import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { DetailFooter, DetailFooterScope } from '@/components/ui/detail-footer';
import { blendColor } from '@/lib/oklab';
import type { VRMCapabilities } from '@/views/VRMViewer';
import StatManager, { FLAT_RANGE_PREVIEW_HINT } from './StatManager';

const CAPS: VRMCapabilities = {
  headMorphs: ['Ear Shape'],
  bodyMorphs: ['Fat'],
  hairStyles: [],
  hairLength: false,
  colors: { hair: '#402010', skin: '#e8c8b0' },
  extras: [],
};

const growth = {
  id: 'growth', name: 'Growth', type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [],
  morphBindings: [{ name: 'Fat' }], colorBindings: [{ channel: 'hair', color: '#ffffff' }],
} as unknown as Stat;
// Another stat bound to the same slider; the Preview never shows it.
const bulk = {
  id: 'bulk', name: 'Bulk', type: 'number', description: '', min: 0, max: 10, value: 10, regen: 0, descriptors: [],
  morphBindings: [{ name: 'Fat', by: 0.3 }],
} as unknown as Stat;

const world = vi.hoisted(() => ({
  stats: [] as Stat[],
  writes: 0,
  rerender: () => {},
}));
vi.mock('@/contexts/GameDataContext', () => {
  const data = () => ({
    stats: world.stats, statGroups: [], playStats: world.stats, placeholders: [], traits: [], traitGroups: [],
    entities: [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'library', id: 'aurelia' } }],
    playEntities: [], entityGroups: [], dictionaries: [], placementLetters: new Map(), placeholderOwners: new Map(),
    worldOverview: { allowedPersonas: 'world' },
    updateStat: (next: Stat) => {
      world.writes += 1;
      world.stats = world.stats.map((s) => (s.id === next.id ? next : s));
      world.rerender();
    },
  });
  return { useGameData: data, useGameDataOptional: data };
});
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value: string }) => <input readOnly value={props.value} />,
}));
vi.mock('@/lib/vrmMorphLoader', () => ({
  loadMorphSplit: async () => ({ body: ['Fat'], head: ['Ear Shape'] }),
  loadMorphCatalog: async () => [{ name: 'Ear Shape', group: 'head' }, { name: 'Fat', group: 'body' }],
  loadVrmLook: async () => ({ catalog: [{ name: 'Ear Shape', group: 'head' }, { name: 'Fat', group: 'body' }], channels: ['skin', 'hair'], colors: CAPS.colors }),
}));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => [{ id: 'aurelia', name: 'Aurelia' }],
    getModelData: async () => ({ blob: new Blob(['x']) }),
  },
}));
// The viewer reports the model it loaded and keeps the look it was last given.
const viewer = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('@/views/VRMViewer', async () => {
  const { useEffect } = await import('react');
  const FakeViewer = (props: { onCapabilities?: (caps: VRMCapabilities) => void } & Record<string, unknown>) => {
    viewer.props = props;
    const report = props.onCapabilities;
    useEffect(() => { report?.(CAPS); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="avatar-viewer" />;
  };
  return { default: FakeViewer };
});

const Harness = () => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  // The hosts draw the editor above its footer row, where the Preview sits.
  return (
    <DetailFooterScope>
      <StatManager stat={world.stats.find((s) => s.id === 'growth')!} tab="appearance" onTabChange={() => {}} />
      <DetailFooter />
    </DetailFooterScope>
  );
};

const growthNow = () => world.stats.find((s) => s.id === 'growth')!;
const footer = () => document.querySelector('[data-detail-footer]') as HTMLElement;
const previewButton = () => within(footer()).getByRole('button', { name: 'Preview' });
const dialog = () => screen.getByRole('dialog', { name: 'Preview Growth' });
const section = (heading: string) => within(dialog()).getByRole('heading', { name: heading }).parentElement as HTMLElement;
const sliderIn = (heading: string) => within(section(heading)).getByRole('slider');
const scrubber = () => within(dialog()).getByRole('slider', { name: 'Growth' });
const undo = (name: string) => within(dialog()).getByRole('button', { name: `Undo ${name}` });
const saveButton = () => within(dialog()).getByRole('button', { name: 'Save' });
const shownSliders = () => viewer.props?.bodyMorphValues as Record<string, number>;
const hairPlan = () => (viewer.props?.colorPlan as Record<string, unknown>).hair;

const openPreview = async () => {
  render(
    <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
      <Harness />
    </EditorModeContext.Provider>,
  );
  await waitFor(() => expect(previewButton()).toBeEnabled());
  await userEvent.click(previewButton());
  await within(dialog()).findByRole('heading', { name: 'Head Features' });
};

/** Sets the scrubber to Min, half, or Max by keyboard. */
const scrubTo = async (value: 0 | 50 | 100) => {
  scrubber().focus();
  await userEvent.keyboard(value === 0 ? '{Home}' : value === 50 ? '{End}{PageDown}{PageDown}{PageDown}{PageDown}{PageDown}' : '{End}');
};

const nudge = async (heading: string, keys: string) => {
  sliderIn(heading).focus();
  await userEvent.keyboard(keys);
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:avatar');
  URL.revokeObjectURL = vi.fn();
  world.stats = [growth, bulk];
  world.writes = 0;
  viewer.props = null;
});

describe('the Preview button on a stat whose Max is not above its Min', () => {
  it('is disabled beside its own hint', async () => {
    render(
      <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
        <Harness />
      </EditorModeContext.Provider>,
    );
    // The row's Avatar resolves first, so only the range keeps the Preview closed.
    await waitFor(() => expect(previewButton()).toBeEnabled());
    expect(screen.queryByText(FLAT_RANGE_PREVIEW_HINT)).toBeNull();
    world.stats = [{ ...growth, max: 0 }, bulk];
    act(() => world.rerender());

    expect(await screen.findByText(FLAT_RANGE_PREVIEW_HINT)).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();
  });
});

describe("a stat's Preview", () => {
  it("opens at Max with each bound slider at the model's own value plus its Change By, and the note", async () => {
    await openPreview();
    expect(scrubber()).toHaveAttribute('aria-valuenow', '100');
    expect(shownSliders()).toEqual({ 'Ear Shape': 0, Fat: 1 });
    expect(hairPlan()).toEqual({ steps: [{ target: '#ffffff', t: 1 }] });
    expect(within(dialog()).getByText("Adds these changes to the player's own slider values during the game")).toBeInTheDocument();
  });

  it('writes Change By 0.8 for a drag to 0.8 on a slider with no row, and adds no other row', async () => {
    await openPreview();
    await nudge('Head Features', '{End}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await userEvent.click(saveButton());

    expect(world.writes).toBe(1);
    expect(growthNow().morphBindings).toEqual([{ name: 'Fat' }, { name: 'Ear Shape', by: 0.8 }]);
    expect(growthNow().colorBindings).toEqual(growth.colorBindings);
  });

  it('shows half the Change By at half, and a drag moves the scrubber to Max and writes the dragged value', async () => {
    await openPreview();
    await scrubTo(50);
    expect(shownSliders()).toMatchObject({ Fat: 0.5 });
    expect(within(section('Body Sliders')).getByText('0.50')).toBeInTheDocument();

    await nudge('Body Sliders', '{ArrowRight}');
    expect(scrubber()).toHaveAttribute('aria-valuenow', '100');
    expect(shownSliders()).toMatchObject({ Fat: 0.55 });
    await userEvent.click(saveButton());
    expect(growthNow().morphBindings).toEqual([{ name: 'Fat', by: 0.55 }]);
  });

  it("shows the model's own slider and color at Min", async () => {
    await openPreview();
    await scrubTo(0);
    expect(shownSliders()).toEqual({ 'Ear Shape': 0, Fat: 0 });
    expect(within(dialog()).getByRole('button', { name: 'Hair Color' })).toHaveAccessibleDescription('#402010');
    expect(hairPlan()).toEqual({ steps: [{ target: '#ffffff', t: 0 }] });
  });

  it("shows the game's blend at half, and a pick writes the Target Color", async () => {
    await openPreview();
    await scrubTo(50);
    const blend = blendColor('#402010', [{ target: '#ffffff', t: 0.5 }]);
    expect(within(dialog()).getByRole('button', { name: 'Hair Color' })).toHaveAccessibleDescription(blend);
    expect(hairPlan()).toEqual({ steps: [{ target: '#ffffff', t: 0.5 }] });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hair Color' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Hex Color' }), { target: { value: 'AA11CC' } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Hex Color' })).toBeNull());
    expect(scrubber()).toHaveAttribute('aria-valuenow', '100');
    await userEvent.click(saveButton());
    expect(growthNow().colorBindings).toEqual([{ channel: 'hair', color: '#aa11cc' }]);
  });

  it('shows a Change By of 5 at the slider end with its number, and keeps it through a Save without a drag', async () => {
    world.stats = [{ ...growth, morphBindings: [{ name: 'Fat', by: 5 }] }, bulk];
    await openPreview();
    expect(sliderIn('Body Sliders')).toHaveAttribute('aria-valuenow', '1.25');
    expect(within(section('Body Sliders')).getByText('5.00')).toBeInTheDocument();

    await nudge('Head Features', '{ArrowRight}');
    await userEvent.click(saveButton());
    expect(growthNow().morphBindings).toEqual([{ name: 'Fat', by: 5 }, { name: 'Ear Shape', by: 0.05 }]);
  });

  it('returns a slider to the look at Max from the saved Change By with its undo, which is then disabled', async () => {
    await openPreview();
    expect(undo('Fat')).toBeDisabled();
    await nudge('Body Sliders', '{ArrowLeft}{ArrowLeft}');
    // At Min the slider shows the model's own value, and still has a change to undo.
    await scrubTo(0);
    expect(undo('Fat')).toBeEnabled();
    await scrubTo(50);
    fireEvent.click(undo('Fat'));

    expect(scrubber()).toHaveAttribute('aria-valuenow', '100');
    await waitFor(() => expect(shownSliders()).toMatchObject({ Fat: 1 }), { timeout: 2000 });
    expect(undo('Fat')).toBeDisabled();
    expect(saveButton()).toBeDisabled();
  });
});
