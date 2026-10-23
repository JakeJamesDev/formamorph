import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaAsset, Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import StatManager, { type StatEditorStore } from './StatManager';

const wounds = {
  id: 's1', name: 'Wounds', type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0, descriptors: [],
} as unknown as Stat;

vi.mock('@/contexts/GameDataContext', () => {
  const world = () => ({
    stats: [wounds], statGroups: [], playStats: [wounds], placeholders: [], traits: [], traitGroups: [], entities: [], playEntities: [], entityGroups: [], dictionaries: [],
    placementLetters: new Map(), placeholderOwners: new Map(), worldOverview: {}, updateStat: () => {},
  });
  return { useGameData: world, useGameDataOptional: world };
});
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value: string; ariaLabel?: string }) => (
    <input readOnly value={props.value} aria-label={props.ariaLabel} />
  ),
}));

// The model files stand behind these loaders; the hooks that pick between them run for real.
const loads = vi.hoisted(() => ({
  player: ['Belly', 'Fat'] as string[],
  owner: new Map<string, string[]>(),
  ownerCalls: 0,
}));
vi.mock('@/lib/vrmMorphLoader', () => ({ loadBodyMorphNames: async () => loads.player }));
vi.mock('@/lib/modelLoader', () => ({
  loadModelMorphNames: async (model: Partial<MediaAsset>) => {
    loads.ownerCalls++;
    return loads.owner.get(model.data ?? '') ?? [];
  },
}));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => [{ id: 'm1', name: 'Library Model' }],
    getModelData: async () => ({ blob: new Blob(['x']) }),
  },
}));

const entityStore = (model?: Partial<MediaAsset>): StatEditorStore => ({
  stats: [wounds], updateStat: () => {}, ownerId: 'golem', morphOwner: { name: 'Golem', model },
});

const renderManager = (store?: StatEditorStore, stat: Stat = wounds) => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <StatManager stat={stat} tab="details" onTabChange={() => {}} store={store} />
  </EditorModeContext.Provider>,
);

/** Opens the Body Sliders picker and returns the slider names it offers. */
const offered = async () => {
  const field = screen.getByText('Body Sliders').parentElement!;
  await userEvent.click(within(field).getByRole('combobox'));
  const list = await screen.findByRole('listbox', { name: 'Available options' });
  // Let the lazy load settle before reading the list.
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Slider rows announce their selection; Select All and the Close footer don't.
  return within(list).queryAllByRole('option')
    .map((option) => option.getAttribute('aria-label') ?? '')
    .filter((label) => /, (not )?selected$/.test(label))
    .map((label) => label.replace(/, (not )?selected$/, ''));
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:model');
  URL.revokeObjectURL = vi.fn();
  loads.owner.clear();
  loads.ownerCalls = 0;
});

describe('the Body Sliders picker', () => {
  it("lists the entity model's own shape keys on an entity stat", async () => {
    loads.owner.set('data:golem', ['Cracks', 'Moss']);
    renderManager(entityStore({ name: 'golem.glb', data: 'data:golem' }));
    expect(await offered()).toEqual(['Cracks', 'Moss']);
  });

  it("heads the entity's sliders with its current name", async () => {
    loads.owner.set('data:golem', ['Cracks']);
    const model = { name: 'golem.glb', data: 'data:golem' };
    const view = renderManager(entityStore(model));
    await offered();
    view.rerender(
      <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
        <StatManager stat={wounds} tab="details" onTabChange={() => {}} store={{ ...entityStore(model), morphOwner: { name: 'Stone Golem', model } }} />
      </EditorModeContext.Provider>,
    );
    expect(await screen.findByText('Stone Golem')).toBeInTheDocument();
  });

  it('keeps the player models on a world stat', async () => {
    renderManager();
    expect(await offered()).toEqual(['Belly', 'Fat']);
  });

  it('offers nothing, and loads nothing, for an entity with no model', async () => {
    renderManager(entityStore(undefined));
    expect(await offered()).toEqual([]);
    expect(loads.ownerCalls).toBe(0);
    expect(screen.getByText('This entity has no 3D model. Add one to bind its body sliders.')).toBeInTheDocument();
  });

  it('offers nothing for an entity model with no shape keys', async () => {
    renderManager(entityStore({ name: 'rock.obj', data: 'data:rock' }));
    expect(await offered()).toEqual([]);
    expect(loads.ownerCalls).toBe(1);
    expect(screen.getByText("This entity's 3D model has no body sliders")).toBeInTheDocument();
  });

  it('keeps a binding already on the stat removable when the model offers nothing', async () => {
    const bound = { ...wounds, morphBindings: ['Cracks'] };
    renderManager({ ...entityStore(undefined), stats: [bound] }, bound);
    expect(screen.getByRole('button', { name: /Remove Cracks/ })).toBeInTheDocument();
  });
});
