import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, Trait, TraitGroup } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import { NO_MODEL_HINT } from '@/lib/useSliderPicker';
import TraitManager, { type TraitLinkEdit } from './TraitManager';

const elf: Trait = { id: 'elf', name: 'Elf', statChanges: [] };

// The world a test sets: its traits and groups, its Avatar, and the trait write.
const world = vi.hoisted(() => ({
  traits: [] as Trait[],
  traitGroups: [] as TraitGroup[],
  overview: {} as Record<string, unknown>,
  entities: [] as unknown[],
  bodies: [] as unknown[] | undefined,
  rerender: () => {},
}));
vi.mock('@/contexts/GameDataContext', () => {
  const data = () => ({
    stats: [], statGroups: [], traits: world.traits, traitGroups: world.traitGroups, entities: world.entities, locations: [],
    placeholders: [], worldOverview: world.overview, bodies: world.bodies,
    updateTrait: (next: Trait) => {
      world.traits = world.traits.map((t) => (t.id === next.id ? next : t));
      world.rerender();
    },
  });
  return { useGameData: data, useGameDataOptional: data };
});
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: { value: string }) => <input readOnly value={props.value} />,
}));

// The model files stand behind these loaders; the hooks that pick between them run for real.
const loads = vi.hoisted(() => ({ catalogs: new Map<string, string[]>() }));
vi.mock('@/lib/vrmMorphLoader', () => ({
  loadMorphSplit: async () => ({ body: ['Fat'], head: ['Ear Shape'] }),
  loadMorphCatalog: async (url: string) => (loads.catalogs.get(url) ?? []).map((name) => ({ name, group: 'body' })),
  loadVrmLook: async (url: string) => ({
    catalog: (loads.catalogs.get(url) ?? []).map((name) => ({ name, group: 'body' })),
    channels: url.includes('bald') ? ['skin', 'eye'] : ['skin', 'eye', 'hair'],
    colors: { skin: '#e8c8b0' },
  }),
}));
vi.mock('@/services/ModelStorageService', () => ({
  default: {
    getModelMetadata: async () => [{ id: 'm1', name: 'Aurelia' }],
    getModelData: async () => ({ blob: new Blob(['x']) }),
  },
}));

const Harness = ({ id, owner, link }: { id: string; owner?: Entity; link?: TraitLinkEdit }) => {
  const [, setTick] = useState(0);
  world.rerender = () => setTick((n) => n + 1);
  return <TraitManager trait={world.traits.find((t) => t.id === id)!} owner={owner} link={link} onOpenTrait={() => {}} tab="appearance" onTabChange={() => {}} />;
};

const renderTrait = (id = 'elf', owner?: Entity, link?: TraitLinkEdit) => render(
  <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
    <Harness id={id} owner={owner} link={link} />
  </EditorModeContext.Provider>,
);

const pinsOf = (id = 'elf') => world.traits.find((t) => t.id === id)?.morphPins;
const rowOf = (name: string) => screen.getByRole('spinbutton', { name: `Set To for ${name}` }).previousElementSibling as HTMLElement;
const earPin = (value: number) => [{ name: 'Ear Shape', value }];

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:model');
  URL.revokeObjectURL = vi.fn();
  loads.catalogs.clear();
  world.traits = [elf];
  world.traitGroups = [];
  world.overview = {};
  world.entities = [];
  world.bodies = [];
});

describe("the trait's Sliders", () => {
  it('adds a picked Head Features slider at Set To 1, and takes any number', async () => {
    // A world trait lists the Avatar its playable persona has.
    world.entities = [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'library', id: 'm1' } }];
    renderTrait();
    const field = screen.getByText('Sliders').parentElement!.parentElement!;
    await userEvent.click(within(field).getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Ear Shape, not selected' }));
    expect(pinsOf()).toEqual(earPin(1));
    await userEvent.keyboard('{Escape}');
    const value = screen.getByRole('spinbutton', { name: 'Set To for Ear Shape' });
    await userEvent.clear(value);
    await userEvent.type(value, '2.5');
    expect(pinsOf()).toEqual(earPin(2.5));
  });

  it('lists only the playable persona’s Avatar on a world trait, not the library’s', async () => {
    world.overview = { allowedPersonas: 'world', vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } } };
    world.entities = [{ id: 'p1', name: 'P', persona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
    renderTrait();
    const field = screen.getByText('Sliders').parentElement!.parentElement!;
    await userEvent.click(within(field).getByRole('combobox'));
    expect(await screen.findByText('Aki · Body Sliders')).toBeInTheDocument();
    expect(screen.queryByText('Aurelia · Body Sliders')).toBeNull();
  });

  it("marks a slider the world's player Avatar lacks", async () => {
    loads.catalogs.set('data:aki', ['Fat']);
    world.overview = { startPersona: { source: 'none' }, vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } } };
    world.entities = [{ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
    world.traits = [{ ...elf, morphPins: [...earPin(1), { name: 'Thickness', value: 0.5 }] }];
    renderTrait();
    expect(await within(rowOf('Ear Shape')).findByText('Not on this model')).toBeInTheDocument();
    expect(within(rowOf('Thickness')).queryByText('Not on this model')).toBeNull();
  });
});

describe("an owned trait's Sliders", () => {
  it("lists the owner's Avatar groups when the entity has no 3D model", async () => {
    world.overview = { vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } } };
    const owner = { id: 'ash', name: 'Ash', locations: [], vrmPick: { kind: 'world', id: 'aki' } } as unknown as Entity;
    world.entities = [owner];
    renderTrait('elf', owner);
    const field = screen.getByText('Sliders').parentElement!.parentElement!;
    await userEvent.click(within(field).getByRole('combobox'));
    expect(await screen.findByText('Aki · Body Sliders')).toBeInTheDocument();
    expect(screen.getByText('Aki · Head Features')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ear Shape, not selected' })).toBeInTheDocument();
  });

  it('shows the hint in the Appearance tab when the entity has no Avatar and no 3D model', async () => {
    const owner = { id: 'ash', name: 'Ash', locations: [] } as unknown as Entity;
    world.entities = [owner];
    renderTrait('elf', owner);
    expect(await screen.findByText(NO_MODEL_HINT)).toBeInTheDocument();
  });

  it('shows no hint when the entity has an Avatar', async () => {
    const owner = { id: 'ash', name: 'Ash', locations: [], vrmPick: { kind: 'default' } } as unknown as Entity;
    world.entities = [owner];
    renderTrait('elf', owner);
    const field = screen.getByText('Sliders').parentElement!.parentElement!;
    await userEvent.click(within(field).getByRole('combobox'));
    expect(await screen.findByText('Aurelia · Body Sliders')).toBeInTheDocument();
    expect(screen.queryByText(NO_MODEL_HINT)).toBeNull();
  });
});

describe('the slider overlap note', () => {
  const human: Trait = { id: 'human', name: 'Human', statChanges: [], morphPins: earPin(0) };

  it('names another free trait on the same slider', () => {
    world.traits = [{ ...elf, morphPins: earPin(1) }, human];
    renderTrait();
    expect(within(rowOf('Ear Shape')).getByRole('paragraph')).toHaveTextContent('Also set by Human. The trait switched on last wins.');
  });

  it('stays silent for a pick-one pair', () => {
    world.traitGroups = [{ id: 'race', name: 'Race', maxPicks: 1 } as TraitGroup];
    world.traits = [{ ...elf, groupId: 'race', morphPins: earPin(1) }, { ...human, groupId: 'race' }];
    renderTrait();
    expect(within(rowOf('Ear Shape')).queryByText(/Also set by/)).toBeNull();
  });

  it('counts two names on one model key as one slider', async () => {
    loads.catalogs.set('data:aki', ['Fat']);
    world.overview = { startPersona: { source: 'none' }, vrmStore: { aki: { name: 'Aki', file: { data: 'data:aki' } } } };
    world.entities = [{ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
    world.traits = [{ ...elf, morphPins: [{ name: 'Thickness', value: 1 }] }, { ...human, morphPins: [{ name: 'Fat', value: 0 }] }];
    renderTrait();
    expect(await within(rowOf('Thickness')).findByText(/Also set by/)).toHaveTextContent('Also set by Human.');
  });
});

describe("the trait's Colors", () => {
  const drow: Trait = { id: 'drow', name: 'Drow', statChanges: [], colorPins: [{ channel: 'skin', color: '#606070' }] };
  const colorsOf = (id = 'elf') => world.traits.find((t) => t.id === id)?.colorPins;
  const colorRow = (label: string) => screen.getByRole('button', { name: `Set To for ${label}` }).previousElementSibling as HTMLElement;
  const fixAvatar = (data: string) => {
    world.overview = { startPersona: { source: 'none' }, vrmStore: { aki: { name: 'Aki', file: { data } } } };
    world.entities = [{ id: 'you', name: 'You', customPersona: true, locations: [], vrmPick: { kind: 'world', id: 'aki' } }];
  };

  it("adds a picked channel at the world Avatar's own color", async () => {
    fixAvatar('data:aki-colors');
    renderTrait();
    await userEvent.click(within(screen.getByText('Colors').parentElement!).getByRole('combobox'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await userEvent.click(await screen.findByRole('option', { name: 'Skin, not selected' }));
    expect(colorsOf()).toEqual([{ channel: 'skin', color: '#e8c8b0' }]);
  });

  it("marks a channel the world's player Avatar lacks", async () => {
    fixAvatar('data:aki-bald');
    world.traits = [{ ...elf, colorPins: [{ channel: 'hair', color: '#ffffff' }, { channel: 'eye', color: '#ffffff' }] }];
    renderTrait();
    expect(await within(colorRow('Hair')).findByText('Not on this model')).toBeInTheDocument();
    expect(within(colorRow('Eye')).queryByText('Not on this model')).toBeNull();
  });

  it('names another free trait on the same channel', () => {
    world.traits = [{ ...elf, colorPins: [{ channel: 'skin', color: '#f0e0d0' }] }, drow];
    renderTrait();
    expect(within(colorRow('Skin')).getByRole('paragraph')).toHaveTextContent('Also set by Drow. The trait switched on last wins.');
  });

  it('stays silent for a pick-one pair and for another channel', () => {
    world.traitGroups = [{ id: 'race', name: 'Race', maxPicks: 1 } as TraitGroup];
    world.traits = [
      { ...elf, groupId: 'race', colorPins: [{ channel: 'skin', color: '#f0e0d0' }, { channel: 'eye', color: '#00aa00' }] },
      { ...drow, groupId: 'race' },
      { id: 'tan', name: 'Tan', statChanges: [], colorPins: [{ channel: 'skin', color: '#a07050' }] },
    ];
    renderTrait();
    expect(within(colorRow('Skin')).getByRole('paragraph')).toHaveTextContent('Also set by Tan.');
    expect(within(colorRow('Eye')).queryByText(/Also set by/)).toBeNull();
  });
});

describe("the trait panel's Appearance tab", () => {
  const readOnlyLink: TraitLinkEdit = { ownerId: 'ash', linkId: 'l1', overridden: [], stale: [], write: () => {}, reset: () => {} };
  const ash: Entity = { id: 'ash', name: 'Ash' } as Entity;
  const tabNames = () => within(screen.getByRole('tablist', { name: 'Trait Fields' })).getAllByRole('tab').map((el) => el.textContent);

  it('is left out of a read-only trait with no Body, slider or color to show', () => {
    world.bodies = undefined;
    world.entities = [ash];
    renderTrait('elf', undefined, readOnlyLink);
    expect(tabNames()).not.toContain('Appearance');
    expect(tabNames()[0]).toBe('Details');
  });

  it('stays for a read-only trait that sets a slider', () => {
    world.bodies = undefined;
    world.entities = [ash];
    world.traits = [{ ...elf, morphPins: earPin(1) }];
    renderTrait('elf', undefined, readOnlyLink);
    expect(tabNames()).toContain('Appearance');
  });
});
