import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MediaAsset, Stat } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { clearUserDefaultAvatar, setUserDefaultAvatar } from '@/lib/defaultAvatar';
import { NO_MODEL_HINT, WORLD_NO_MODEL_HINT } from '@/lib/useSliderPicker';
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
  /** A VRM's Body Sliders and Head Features by url; the player split otherwise. */
  splits: new Map<string, { body: string[]; head: string[] }>(),
  catalogs: new Map<string, string[]>(),
  /** Each VRM's color channels and their own colors, by url. */
  looks: new Map<string, { channels: string[]; colors: Record<string, string> }>(),
  ownerCalls: 0,
}));
vi.mock('@/lib/vrmMorphLoader', () => ({
  loadMorphSplit: async (url: string) => {
    if (url.startsWith('data:broken')) throw new Error('unreadable VRM');
    return loads.splits.get(url) ?? loads.player;
  },
  loadMorphCatalog: async (url: string) => (loads.catalogs.get(url) ?? []).map((name) => ({ name, group: 'body' })),
  loadVrmLook: async (url: string) => ({
    catalog: (loads.catalogs.get(url) ?? []).map((name) => ({ name, group: 'body' })),
    ...(loads.looks.get(url) ?? { channels: [], colors: {} }),
  }),
}));
vi.mock('@/lib/modelLoader', () => ({
  loadModelMorphNames: async (model: Partial<MediaAsset>) => {
    loads.ownerCalls++;
    return loads.owner.get(model.data ?? '') ?? [];
  },
}));
// The author's Avatar library, newest first. Each Avatar's blob URL is `blob:<id>`.
const library = vi.hoisted(() => ({ models: [] as { id: string; name: string }[] }));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => library.models,
    getModelData: async (id: string) => ({ blob: { id } }),
  },
}));

const entityStore = (model?: Partial<MediaAsset>): StatEditorStore => ({
  stats: [wounds], updateStat: () => {}, ownerId: 'golem', morphOwner: { name: 'Golem', model },
});

const renderManager = (store?: StatEditorStore, stat: Stat = wounds) => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <StatManager stat={stat} tab="appearance" onTabChange={() => {}} store={store} />
  </EditorModeContext.Provider>,
);

/** Opens the Body Sliders picker and returns the slider names it offers, with the group heading each sits under. */
const offeredByGroup = async () => {
  const field = screen.getByText('Sliders').parentElement!;
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
  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => `blob:${(blob as unknown as { id: string }).id}`);
  URL.revokeObjectURL = vi.fn();
  library.models = [{ id: 'm1', name: 'Library Model' }];
  clearUserDefaultAvatar();
  loads.owner.clear();
  loads.splits.clear();
  loads.catalogs.clear();
  loads.looks.clear();
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
        <StatManager stat={wounds} tab="appearance" onTabChange={() => {}} store={{ ...entityStore(model), morphOwner: { name: 'Stone Golem', model } }} />
      </EditorModeContext.Provider>,
    );
    expect(await screen.findByText('Stone Golem · Body Sliders')).toBeInTheDocument();
  });

  describe('on a world stat', () => {
    /** A world Avatar the store holds, with its own sliders under `data:<id>`. */
    const worldAvatar = (id: string, name: string, body: string[], head: string[] = []) => {
      loads.splits.set(`data:${id}`, { body, head });
      return { [id]: { name, file: { data: `data:${id}` } } };
    };
    const persona = (id: string, vrmPick?: unknown) => ({ id, name: id, persona: true, locations: [], vrmPick });
    const custom = (vrmPick?: unknown) => ({ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick });

    it('splits a persona Avatar into Body Sliders and Head Features', async () => {
      worldParts.overview = { allowedPersonas: 'world', vrmStore: worldAvatar('wsplit', 'Aki', ['Belly', 'Fat'], ['EarShape']) };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wsplit' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Aki · Body Sliders': ['Belly', 'Fat'], 'Aki · Head Features': ['EarShape'] });
    });

    it('lists only the fixed persona’s Avatar when the world offers one persona', async () => {
      worldParts.overview = { allowedPersonas: 'world', vrmStore: worldAvatar('wfix', 'Fixed', ['Hips']) };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wfix' })];
      library.models = [{ id: 'unused-fix', name: 'Unused' }];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Fixed · Body Sliders': ['Hips'] });
    });

    it('lists each playable persona’s Avatar when the player picks', async () => {
      worldParts.overview = { vrmStore: { ...worldAvatar('wa', 'Alder', ['Hips']), ...worldAvatar('wb', 'Birch', ['Nose']) } };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wa' }), persona('p2', { kind: 'world', id: 'wb' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Alder · Body Sliders': ['Hips'], 'Birch · Body Sliders': ['Nose'] });
    });

    it('gives two personas on one Avatar a single group', async () => {
      worldParts.overview = { vrmStore: worldAvatar('wshared', 'Shared', ['Hips']) };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wshared' }), persona('p2', { kind: 'world', id: 'wshared' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Shared · Body Sliders': ['Hips'] });
    });

    it('lists the Custom Persona’s Avatar for a library persona or None', async () => {
      worldParts.overview = { vrmStore: { ...worldAvatar('wp', 'Pine', ['Hips']), ...worldAvatar('wc', 'Cedar', ['Nose']) } };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wp' }), custom({ kind: 'world', id: 'wc' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Pine · Body Sliders': ['Hips'], 'Cedar · Body Sliders': ['Nose'] });
    });

    it("lists the author's resolved default once for personas on User's Default", async () => {
      library.models = [{ id: 'wd-newer', name: 'Newer' }, { id: 'wd-marked', name: 'Marked' }];
      loads.splits.set('blob:wd-marked', { body: ['Hips'], head: [] });
      setUserDefaultAvatar('wd-marked');
      worldParts.entities = [persona('p1', { kind: 'default' }), persona('p2', { kind: 'default' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Marked · Body Sliders': ['Hips'] });
    });

    it('does not list a library Avatar that no playable persona resolves to', async () => {
      library.models = [{ id: 'wl-used', name: 'Used' }, { id: 'wl-idle', name: 'Idle' }];
      loads.splits.set('blob:wl-used', { body: ['Hips'], head: [] });
      loads.splits.set('blob:wl-idle', { body: ['Tail'], head: [] });
      worldParts.entities = [persona('p1', { kind: 'library', id: 'wl-used' })];
      renderManager();
      expect(await offeredByGroup()).toEqual({ 'Used · Body Sliders': ['Hips'] });
    });

    it('shows the hint when every playable persona has None', async () => {
      worldParts.entities = [persona('p1'), persona('p2', undefined)];
      renderManager();
      expect(await screen.findByText(WORLD_NO_MODEL_HINT)).toBeInTheDocument();
      expect(screen.queryByText(NO_MODEL_HINT)).toBeNull();
      expect(await offered()).toEqual([]);
    });

    it('keeps a bound slider that is not listed, and removes it', async () => {
      worldParts.overview = { vrmStore: worldAvatar('wkeep', 'Keeper', ['Hips']) };
      worldParts.entities = [persona('p1', { kind: 'world', id: 'wkeep' })];
      const written: Stat[] = [];
      worldParts.updateStat = (next) => { written.push(next as Stat); };
      const bound = { ...wounds, morphBindings: [{ name: 'Tusks' }] };
      worldParts.stats = [bound];
      renderManager(undefined, bound);
      expect(await offered()).toEqual(['Hips']);
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: /Remove Tusks/ }));
      expect(written.at(-1)?.morphBindings).toEqual([]);
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
    expect(screen.getByText('No sliders to bind')).toBeInTheDocument();
    expect(screen.getByText(NO_MODEL_HINT)).toBeInTheDocument();
  });

  describe("with the owner's Avatar", () => {
    // Each test names its own data: the loaders cache by it for the life of the module.
    const withAvatar = (model?: Partial<MediaAsset>, data = 'data:elf-solo'): StatEditorStore => {
      worldParts.overview = { vrmStore: { elf: { name: 'Elf', file: { data } } } };
      loads.splits.set(data, { body: ['Belly'], head: ['EarShape'] });
      return { ...entityStore(model), morphOwner: { name: 'Golem', model, vrmPick: { kind: 'world', id: 'elf' } } };
    };

    it('lists its Body Sliders and Head Features on an entity with no 3D model', async () => {
      renderManager(withAvatar());
      expect(await offeredByGroup()).toEqual({ 'Elf · Body Sliders': ['Belly'], 'Elf · Head Features': ['EarShape'] });
    });

    it("lists both the 3D model's and the Avatar's groups", async () => {
      loads.owner.set('data:golem-avatar', ['Cracks']);
      renderManager(withAvatar({ name: 'golem.glb', data: 'data:golem-avatar' }, 'data:elf-both'));
      expect(await offeredByGroup()).toEqual({
        'Golem · Body Sliders': ['Cracks'], 'Elf · Body Sliders': ['Belly'], 'Elf · Head Features': ['EarShape'],
      });
    });

    it("lists only the world Avatar's groups, not the library's", async () => {
      library.models = [{ id: 'lib-other', name: 'Other' }];
      renderManager(withAvatar(undefined, 'data:elf-only'));
      expect(await offeredByGroup()).toEqual({ 'Elf · Body Sliders': ['Belly'], 'Elf · Head Features': ['EarShape'] });
    });

    it('lists a library Avatar by its library name', async () => {
      // The mocked library holds one model, m1 "Library Model".
      renderManager({ ...entityStore(), morphOwner: { name: 'Golem', vrmPick: { kind: 'library', id: 'm1' } } });
      expect(await offeredByGroup()).toEqual({
        'Library Model · Body Sliders': ['Belly', 'Fat'], 'Library Model · Head Features': ['EarShape'],
      });
    });

    it('treats a world pick the store lacks as no Avatar', async () => {
      worldParts.overview = { vrmStore: {} };
      renderManager({ ...entityStore(), morphOwner: { name: 'Golem', vrmPick: { kind: 'world', id: 'gone' } } });
      expect(await offered()).toEqual([]);
      expect(screen.getByText('No sliders to bind')).toBeInTheDocument();
      expect(screen.getByText(NO_MODEL_HINT)).toBeInTheDocument();
    });

    it("resolves a library pick the library lacks as User's Default", async () => {
      library.models = [{ id: 'lib-kept', name: 'Kept' }];
      loads.splits.set('blob:lib-kept', { body: ['Hips'], head: ['Nose'] });
      renderManager({ ...entityStore(), morphOwner: { name: 'Golem', vrmPick: { kind: 'library', id: 'gone' } } });
      expect(await offeredByGroup()).toEqual({ 'Kept · Body Sliders': ['Hips'], 'Kept · Head Features': ['Nose'] });
    });

    it("keeps the 3D model's sliders when the Avatar fails to load", async () => {
      loads.owner.set('data:golem-broken', ['Cracks']);
      renderManager(withAvatar({ name: 'golem.glb', data: 'data:golem-broken' }, 'data:broken-elf'));
      expect(await offeredByGroup()).toEqual({ 'Golem · Body Sliders': ['Cracks'] });
    });

    it('says the Avatar has no sliders when it has none', async () => {
      worldParts.overview = { vrmStore: { elf: { name: 'Elf', file: { data: 'data:elf-bare' } } } };
      loads.splits.set('data:elf-bare', { body: [], head: [] });
      renderManager({ ...entityStore(), morphOwner: { name: 'Golem', vrmPick: { kind: 'world', id: 'elf' } } });
      expect(await offered()).toEqual([]);
      expect(screen.getByText("This entity's Avatar has no sliders")).toBeInTheDocument();
    });
  });

  describe("on User's Default", () => {
    const onDefault = (model?: Partial<MediaAsset>): StatEditorStore =>
      ({ ...entityStore(model), morphOwner: { name: 'Golem', model, vrmPick: { kind: 'default' } } });

    it("lists the author's Default Avatar's Body Sliders and Head Features", async () => {
      library.models = [{ id: 'def-newer', name: 'Newer' }, { id: 'def-marked', name: 'Marked' }];
      loads.splits.set('blob:def-marked', { body: ['Hips'], head: ['Nose'] });
      setUserDefaultAvatar('def-marked');
      renderManager(onDefault());
      expect(await offeredByGroup()).toEqual({ 'Marked · Body Sliders': ['Hips'], 'Marked · Head Features': ['Nose'] });
    });

    it('lists the first available library Avatar when no Default Avatar is marked', async () => {
      library.models = [{ id: 'first-newest', name: 'Newest' }, { id: 'first-older', name: 'Older' }];
      loads.splits.set('blob:first-newest', { body: ['Hips'], head: [] });
      renderManager(onDefault());
      expect(await offeredByGroup()).toEqual({ 'Newest · Body Sliders': ['Hips'] });
    });

    it('lists the 3D model beside the resolved Avatar', async () => {
      library.models = [{ id: 'beside', name: 'Beside' }];
      loads.splits.set('blob:beside', { body: ['Hips'], head: [] });
      loads.owner.set('data:golem-default', ['Cracks']);
      renderManager(onDefault({ name: 'golem.glb', data: 'data:golem-default' }));
      expect(await offeredByGroup()).toEqual({ 'Golem · Body Sliders': ['Cracks'], 'Beside · Body Sliders': ['Hips'] });
    });

    it('shows the hint when the library is empty', async () => {
      library.models = [];
      renderManager(onDefault());
      expect(await screen.findByText(NO_MODEL_HINT)).toBeInTheDocument();
    });

    it('marks a bound slider the resolved Avatar lacks', async () => {
      library.models = [{ id: 'mark-def', name: 'Marked' }];
      loads.catalogs.set('blob:mark-def', ['Hips']);
      setUserDefaultAvatar('mark-def');
      const bound = { ...wounds, morphBindings: [{ name: 'Hips' }, { name: 'Tusks' }] };
      renderManager({ ...onDefault(), stats: [bound] }, bound);
      const rowOf = (name: string) => screen.getByRole('spinbutton', { name: `Change By for ${name}` }).previousElementSibling as HTMLElement;
      expect(await within(rowOf('Tusks')).findByText('Not on this model')).toBeInTheDocument();
      expect(within(rowOf('Hips')).queryByText('Not on this model')).toBeNull();
    });

    it('keeps a bound slider that is not listed, and removes it', async () => {
      library.models = [{ id: 'keep-def', name: 'Keeper' }];
      loads.splits.set('blob:keep-def', { body: ['Hips'], head: [] });
      const written: Stat[] = [];
      worldParts.updateStat = (next) => { written.push(next as Stat); };
      const bound = { ...wounds, morphBindings: [{ name: 'Tusks' }] };
      renderManager({ ...onDefault(), stats: [bound], updateStat: worldParts.updateStat }, bound);
      expect(await offered()).toEqual(['Hips']);
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: /Remove Tusks/ }));
      expect(written.at(-1)?.morphBindings).toEqual([]);
    });
  });

  describe('on None', () => {
    it('shows the hint in the Appearance tab with no 3D model', async () => {
      renderManager(entityStore(undefined));
      expect(await screen.findByText(NO_MODEL_HINT)).toBeInTheDocument();
    });

    it("lists the 3D model's sliders and shows no hint", async () => {
      loads.owner.set('data:golem-none', ['Cracks']);
      renderManager(entityStore({ name: 'golem.glb', data: 'data:golem-none' }));
      expect(await offeredByGroup()).toEqual({ 'Golem · Body Sliders': ['Cracks'] });
      expect(screen.queryByText(NO_MODEL_HINT)).toBeNull();
    });
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
    worldParts.entities = [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'library', id: 'm1' } }];
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
          <StatManager stat={stat} tab="appearance" onTabChange={() => {}} />
        </EditorModeContext.Provider>,
      );
    };
    mounted.view = renderManager(undefined, start);
    return written;
  };

  it('adds a row at 1 for a picked slider and drops it when the slider goes', async () => {
    worldParts.entities = [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'library', id: 'm1' } }];
    const written = editing(wounds);
    await userEvent.click(within(screen.getByText('Sliders').parentElement!).getByRole('combobox'));
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

describe('the Colors rows', () => {
  /** A world stat editor whose writes land in `written`, re-rendered with each write as the World Editor does. */
  const editing = (start: Stat) => {
    const written: Stat[] = [];
    const mounted: { view?: ReturnType<typeof renderManager> } = {};
    worldParts.updateStat = (next) => {
      const stat = next as Stat;
      written.push(stat);
      mounted.view?.rerender(
        <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
          <StatManager stat={stat} tab="appearance" onTabChange={() => {}} />
        </EditorModeContext.Provider>,
      );
    };
    mounted.view = renderManager(undefined, start);
    return written;
  };
  // The known-model cache outlives a test, so each test's Avatar carries its own data.
  const fixAvatar = (data: string, look: { channels: string[]; colors: Record<string, string> }) => {
    loads.looks.set(data, look);
    worldParts.overview = { startPersona: { source: 'none' }, vrmStore: { aki: { name: 'Aki', file: { data } } } };
    worldParts.entities = [{ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
  };
  const openColors = async () => {
    await userEvent.click(within(screen.getByText('Colors').parentElement!).getByRole('combobox'));
    // Let the known model load once the list opens.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it("seeds a picked channel with the world Avatar's own color and drops the field when it goes", async () => {
    fixAvatar('data:aki-colors', { channels: ['skin', 'eye', 'hair'], colors: { skin: '#e8c8b0' } });
    const written = editing(wounds);
    await openColors();
    await userEvent.click(await screen.findByRole('option', { name: /^Skin, not selected$/ }));
    expect(written.at(-1)?.colorBindings).toEqual([{ channel: 'skin', color: '#e8c8b0' }]);
    expect(screen.getByRole('button', { name: 'Target Color for Skin' })).toHaveTextContent('#e8c8b0');
    await userEvent.click(screen.getByRole('option', { name: /^Skin, selected$/ }));
    expect(written.at(-1)?.colorBindings).toBeUndefined();
  });

  it('seeds white when no Avatar resolves', async () => {
    const written = editing(wounds);
    await openColors();
    await userEvent.click(await screen.findByRole('option', { name: /^Hair, not selected$/ }));
    expect(written.at(-1)?.colorBindings).toEqual([{ channel: 'hair', color: '#ffffff' }]);
  });

  it('writes a color typed in the picker', async () => {
    const written = editing({ ...wounds, colorBindings: [{ channel: 'eye', color: '#000000' }] });
    await userEvent.click(screen.getByRole('button', { name: 'Target Color for Eye' }));
    const hex = await screen.findByRole('textbox', { name: 'Hex Color' });
    await userEvent.clear(hex);
    await userEvent.type(hex, '#3366cc');
    expect(written.at(-1)?.colorBindings).toEqual([{ channel: 'eye', color: '#3366cc' }]);
  });

  it("marks a channel the world's player Avatar lacks", async () => {
    fixAvatar('data:aki-bald', { channels: ['skin', 'eye'], colors: {} });
    const bound = { ...wounds, colorBindings: [{ channel: 'skin' as const, color: '#ffffff' }, { channel: 'hair' as const, color: '#ffffff' }] };
    worldParts.stats = [bound];
    renderManager(undefined, bound);
    const rowOf = (label: string) => screen.getByRole('button', { name: `Target Color for ${label}` }).previousElementSibling as HTMLElement;
    expect(await within(rowOf('Hair')).findByText('Not on this model')).toBeInTheDocument();
    expect(within(rowOf('Skin')).queryByText('Not on this model')).toBeNull();
  });

  it('marks every color on an entity whose model is not an Avatar', async () => {
    loads.owner.set('data:golem', ['Cracks']);
    const bound = { ...wounds, colorBindings: [{ channel: 'skin' as const, color: '#ffffff' }] };
    renderManager({ ...entityStore({ name: 'golem.glb', data: 'data:golem' }), stats: [bound] }, bound);
    expect(await screen.findByText('Not on this model')).toBeInTheDocument();
  });

  describe("on an entity with an Avatar", () => {
    const withAvatar = (data: string, model?: Partial<MediaAsset>) => {
      loads.looks.set(data, { channels: ['skin'], colors: {} });
      loads.catalogs.set(data, ['EarShape']);
      worldParts.overview = { vrmStore: { elf: { name: 'Elf', file: { data } } } };
      const bound = {
        ...wounds,
        colorBindings: [{ channel: 'skin' as const, color: '#ffffff' }, { channel: 'hair' as const, color: '#ffffff' }],
        morphBindings: [{ name: 'EarShape' }, { name: 'Cracks' }],
      };
      const store: StatEditorStore = {
        ...entityStore(model), stats: [bound],
        morphOwner: { name: 'Golem', model, vrmPick: { kind: 'world', id: 'elf' } },
      };
      renderManager(store, bound);
    };
    const colorRow = (label: string) => screen.getByRole('button', { name: `Target Color for ${label}` }).previousElementSibling as HTMLElement;

    it("reads the owner's Avatar as well as its 3D model", async () => {
      loads.owner.set('data:golem-both', ['Cracks']);
      withAvatar('data:elf-both', { name: 'golem.glb', data: 'data:golem-both' });
      expect(await within(colorRow('Hair')).findByText('Not on this model')).toBeInTheDocument();
      expect(within(colorRow('Skin')).queryByText('Not on this model')).toBeNull();
      const rowOf = (name: string) => screen.getByRole('spinbutton', { name: `Change By for ${name}` }).previousElementSibling as HTMLElement;
      expect(within(rowOf('EarShape')).queryByText('Not on this model')).toBeNull();
      expect(within(rowOf('Cracks')).queryByText('Not on this model')).toBeNull();
    });

    it('still marks a color when only a non-Avatar 3D model is known', async () => {
      loads.owner.set('data:golem-only', ['Cracks']);
      const bound = { ...wounds, colorBindings: [{ channel: 'skin' as const, color: '#ffffff' }] };
      renderManager({ ...entityStore({ name: 'golem.glb', data: 'data:golem-only' }), stats: [bound] }, bound);
      expect(await screen.findByText('Not on this model')).toBeInTheDocument();
    });

    it("marks nothing when User's Default resolves to no Avatar and there is no 3D model", async () => {
      const bound = { ...wounds, colorBindings: [{ channel: 'skin' as const, color: '#ffffff' }] };
      renderManager({ ...entityStore(), stats: [bound], morphOwner: { name: 'Golem', vrmPick: { kind: 'default' } } }, bound);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByText('Not on this model')).toBeNull();
    });
  });
});
