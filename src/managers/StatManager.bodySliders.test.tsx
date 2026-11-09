import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaAsset, Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import StatManager, { type StatEditorStore } from './StatManager';

const wounds = {
  id: 's1', name: 'Wounds', type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0, descriptors: [],
} as unknown as Stat;

// The world's own parts a test sets: its Avatars and persona picks, its stats, and the stat write.
const worldParts = vi.hoisted(() => ({
  overview: {} as Record<string, unknown>,
  entities: [] as unknown[],
  stats: [] as unknown[],
  updateStat: (() => {}) as (stat: unknown) => void,
}));
vi.mock('@/contexts/GameDataContext', () => {
  const world = () => {
    const stats = worldParts.stats.length ? worldParts.stats : [wounds];
    return {
      stats, statGroups: [], playStats: stats, placeholders: [], traits: [], traitGroups: [], entities: worldParts.entities, playEntities: [], entityGroups: [], dictionaries: [],
      placementLetters: new Map(), placeholderOwners: new Map(), worldOverview: worldParts.overview, updateStat: worldParts.updateStat,
    };
  };
  return { useGameData: world, useGameDataOptional: world };
});
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value: string; ariaLabel?: string }) => (
    <input readOnly value={props.value} aria-label={props.ariaLabel} />
  ),
}));

// The model files stand behind these loaders; the hooks that pick between them run for real.
const loads = vi.hoisted(() => ({
  player: { body: ['Belly', 'Fat'], head: ['EarShape'] } as { body: string[]; head: string[] },
  owner: new Map<string, string[]>(),
  catalogs: new Map<string, string[]>(),
  ownerCalls: 0,
}));
vi.mock('@/lib/vrmMorphLoader', () => ({
  loadMorphSplit: async () => loads.player,
  loadMorphCatalog: async (url: string) => (loads.catalogs.get(url) ?? []).map((name) => ({ name, group: 'body' })),
}));
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

/** Opens the Body Sliders picker and returns the slider names it offers, with the group heading each sits under. */
const offeredByGroup = async () => {
  const field = screen.getByText('Body Sliders').parentElement!;
  await userEvent.click(within(field).getByRole('combobox'));
  const list = await screen.findByRole('listbox', { name: 'Available options' });
  // Let the lazy load settle before reading the list.
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Slider rows announce their selection; Select All and the Close footer don't.
  const groups: Record<string, string[]> = {};
  for (const group of within(list).queryAllByRole('group')) {
    const names = within(group).queryAllByRole('option')
      .map((option) => option.getAttribute('aria-label') ?? '')
      .filter((label) => /, (not )?selected$/.test(label))
      .map((label) => label.replace(/, (not )?selected$/, ''));
    const heading = group.parentElement?.querySelector('[cmdk-group-heading]')?.textContent ?? '';
    if (names.length) groups[heading] = names;
  }
  return groups;
};

const offered = async () => Object.values(await offeredByGroup()).flat();

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:model');
  URL.revokeObjectURL = vi.fn();
  loads.owner.clear();
  loads.catalogs.clear();
  loads.ownerCalls = 0;
  worldParts.overview = {};
  worldParts.entities = [];
  worldParts.stats = [];
  worldParts.updateStat = () => {};
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
    expect(await screen.findByText('Stone Golem · Body Sliders')).toBeInTheDocument();
  });

  it('splits a world stat model into Body Sliders and Head Features', async () => {
    renderManager();
    expect(await offeredByGroup()).toEqual({
      'Library Model · Body Sliders': ['Belly', 'Fat'],
      'Library Model · Head Features': ['EarShape'],
    });
  });

  it('lists an entity model under Body Sliders only', async () => {
    loads.owner.set('data:statue', ['Cracks']);
    renderManager(entityStore({ name: 'statue.glb', data: 'data:statue' }));
    expect(await offeredByGroup()).toEqual({ 'Golem · Body Sliders': ['Cracks'] });
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
    const bound = { ...wounds, morphBindings: [{ name: 'Cracks' }] };
    renderManager({ ...entityStore(undefined), stats: [bound] }, bound);
    expect(screen.getByRole('button', { name: /Remove Cracks/ })).toBeInTheDocument();
  });

  it('keeps a slider another stat uses pickable', async () => {
    const fatness = { ...wounds, id: 's2', name: 'Fatness', morphBindings: [{ name: 'Belly' }] };
    worldParts.stats = [wounds, fatness];
    renderManager();
    expect(await offered()).toEqual(['Belly', 'Fat', 'EarShape']);
  });
});

describe('the Change By rows', () => {
  /** A stat editor whose writes land in `written`, re-rendered with each write as the World Editor does. */
  const editing = (start: Stat) => {
    const written: Stat[] = [];
    const mounted: { view?: ReturnType<typeof renderManager> } = {};
    worldParts.updateStat = (next) => {
      const stat = next as Stat;
      written.push(stat);
      mounted.view?.rerender(
        <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
          <StatManager stat={stat} tab="details" onTabChange={() => {}} />
        </EditorModeContext.Provider>,
      );
    };
    mounted.view = renderManager(undefined, start);
    return written;
  };

  it('adds a row at 1 for a picked slider and drops it when the slider goes', async () => {
    const written = editing(wounds);
    await userEvent.click(within(screen.getByText('Body Sliders').parentElement!).getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /^Fat, not selected$/ }));
    expect(written.at(-1)?.morphBindings).toEqual([{ name: 'Fat' }]);
    expect(screen.getByRole('spinbutton', { name: 'Change By for Fat' })).toHaveValue(1);
    await userEvent.click(screen.getByRole('option', { name: /^Fat, selected$/ }));
    expect(written.at(-1)?.morphBindings).toEqual([]);
    expect(screen.queryByRole('spinbutton', { name: 'Change By for Fat' })).toBeNull();
  });

  it('stores a typed amount, negatives included, and stores 1 as absent', async () => {
    const written = editing({ ...wounds, morphBindings: [{ name: 'Belly' }, { name: 'Fat', by: 2 }] });
    const belly = screen.getByRole('spinbutton', { name: 'Change By for Belly' });
    await userEvent.clear(belly);
    await userEvent.type(belly, '-1.5');
    expect(written.at(-1)?.morphBindings).toEqual([{ name: 'Belly', by: -1.5 }, { name: 'Fat', by: 2 }]);
    const fat = screen.getByRole('spinbutton', { name: 'Change By for Fat' });
    await userEvent.clear(fat);
    await userEvent.type(fat, '1');
    expect(written.at(-1)?.morphBindings).toEqual([{ name: 'Belly', by: -1.5 }, { name: 'Fat' }]);
  });

  it('stores an emptied field as absent once it loses focus', async () => {
    const written = editing({ ...wounds, morphBindings: [{ name: 'Fat', by: 2 }] });
    const fat = screen.getByRole('spinbutton', { name: 'Change By for Fat' });
    await userEvent.clear(fat);
    expect(written).toEqual([]);
    await userEvent.tab();
    expect(written.at(-1)?.morphBindings).toEqual([{ name: 'Fat' }]);
    expect(fat).toHaveValue(1);
  });

  it("marks a slider the owner's model lacks, and not an alias-mate it has", async () => {
    loads.owner.set('data:golem', ['Cracks', 'Fat']);
    const bound = { ...wounds, morphBindings: [{ name: 'Cracks' }, { name: 'Moss' }, { name: 'Thickness' }] };
    renderManager({ ...entityStore({ name: 'golem.glb', data: 'data:golem' }), stats: [bound] }, bound);
    const rowOf = (name: string) => screen.getByRole('spinbutton', { name: `Change By for ${name}` }).previousElementSibling as HTMLElement;
    expect(await within(rowOf('Moss')).findByText('Not on this model')).toBeInTheDocument();
    expect(within(rowOf('Cracks')).queryByText('Not on this model')).toBeNull();
    expect(within(rowOf('Thickness')).queryByText('Not on this model')).toBeNull();
  });

  it("checks a world stat against the world's player Avatar", async () => {
    loads.catalogs.set('data:aki', ['Belly']);
    worldParts.overview = {
      startPersona: { source: 'none' },
      vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } },
    };
    worldParts.entities = [{ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
    const bound = { ...wounds, morphBindings: [{ name: 'Belly' }, { name: 'Tusks' }] };
    worldParts.stats = [bound];
    renderManager(undefined, bound);
    expect(await screen.findAllByText('Not on this model')).toHaveLength(1);
    const tusks = screen.getByRole('spinbutton', { name: 'Change By for Tusks' }).previousElementSibling as HTMLElement;
    expect(within(tusks).getByText('Not on this model')).toBeInTheDocument();
  });

  it('marks nothing when the world leaves the Avatar to the player', async () => {
    loads.catalogs.set('data:aki', ['Belly']);
    worldParts.overview = { vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } } };
    const bound = { ...wounds, morphBindings: [{ name: 'Tusks' }] };
    worldParts.stats = [bound];
    renderManager(undefined, bound);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Not on this model')).toBeNull();
  });
});
