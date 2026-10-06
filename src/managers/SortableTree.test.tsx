import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Entity, EntityGroup, GameLocation, Placeholder, Trait } from '@/types';
import { TraitStoreContext, type TraitStore } from '@/contexts/TraitStoreContext';
import EntityTree from './EntityTree';
import LocationTree from './LocationTree';
import TraitTree from './TraitTree';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';

/**
 * Redraw cost of the shared tree, read through what each row draws: a row's label renders when the row's
 * spec is built again, so the labels rendered after an action say which rows redrew.
 */

const drawn: string[] = [];

vi.mock('@/components/prompt/PlaceholderText', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/prompt/PlaceholderText')>();
  const Counted = (props: React.ComponentProps<typeof real.default>) => {
    drawn.push(props.text);
    return <real.default {...props} />;
  };
  return { ...real, default: Counted };
});

const entity = (id: string, name: string) => ({ id, name }) as unknown as Entity;

const NO_PLACEHOLDERS: Placeholder[] = [];

const world: { entities: Entity[]; groups: EntityGroup[]; locations: GameLocation[]; placeholders: Placeholder[]; rename?: (id: string, name: string) => void } = {
  entities: [], groups: [], locations: [], placeholders: NO_PLACEHOLDERS,
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameDataOptional: () => null,
  useGameData: () => ({
    entities: world.entities,
    entityGroups: world.groups,
    locations: world.locations,
    setLocations: vi.fn(),
    removeLocation: vi.fn(),
    placeholders: world.placeholders,
    setEntities: vi.fn(),
    setEntityGroups: vi.fn(),
    removeEntity: vi.fn(),
    removeEntityGroup: vi.fn(),
  }),
}));

const NAMES = ['Ada', 'Bram', 'Cyn', 'Dov', 'Eli', 'Fay'];

function EntityTreeHost() {
  const [entities, setEntities] = useState(NAMES.map((n) => entity(n, n)));
  world.entities = entities;
  world.rename = (id, name) => setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  return <EntityTree selectedId={null} onSelect={() => {}} />;
}

const HAIR: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['red']) };
const CHIP = encodePlaceholderToken({ id: 'hair', mode: 'world', placementId: 'v-hair-1' });

function ChipEntityTreeHost() {
  const [placeholders, setPlaceholders] = useState([HAIR]);
  world.placeholders = placeholders;
  world.entities = [entity('chipped', `${CHIP} Ada`), entity('plain', 'Bram'), entity('other', 'Cyn')];
  world.rename = (id, name) => setPlaceholders((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  return <EntityTree selectedId={null} onSelect={() => {}} />;
}

function LocationTreeHost() {
  const [locations, setLocations] = useState(NAMES.map((n) => ({ id: n, name: n }) as unknown as GameLocation));
  world.locations = locations;
  world.rename = (id, name) => setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)));
  return <LocationTree selectedId={null} onSelect={() => {}} />;
}

const NO_STATS: never[] = [];
const NO_GATES = { owners: [], active: {}, entities: [], persona: { source: 'none' } };
const NO_TRAIT_GROUPS: never[] = [];

function TraitTreeHost() {
  const [traits, setTraits] = useState(NAMES.map((n) => ({ id: n, name: n, statChanges: [], groupId: null }) as unknown as Trait));
  world.rename = (id, name) => setTraits((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  const store = {
    traits, traitGroups: NO_TRAIT_GROUPS, entities: [], placeholders: NO_PLACEHOLDERS, stats: NO_STATS, gateInput: NO_GATES,
    setTraits: vi.fn(), setTraitGroups: vi.fn(), removeTrait: vi.fn(), removeTraitGroup: vi.fn(), editEntity: vi.fn(),
  } as unknown as TraitStore;
  return <TraitStoreContext.Provider value={store}><TraitTree selectedId={null} onSelect={() => {}} /></TraitStoreContext.Provider>;
}

beforeEach(() => {
  drawn.length = 0;
  world.groups = [];
  world.placeholders = NO_PLACEHOLDERS;
});

describe('editing one entity in the entity tree', () => {
  it('redraws that row only', () => {
    render(<EntityTreeHost />);
    expect(drawn.slice().sort()).toEqual(NAMES.slice().sort());
    drawn.length = 0;
  
    act(() => world.rename?.('Cyn', 'Cynthia'));

    expect(screen.getByText('Cynthia')).toBeInTheDocument();
    expect(drawn).toEqual(['Cynthia']);
  });
});

describe('renaming a placeholder in the entity tree', () => {
  it('redraws the rows that show it as a chip and no other', () => {
    render(<ChipEntityTreeHost />);
    drawn.length = 0;

    act(() => world.rename?.('hair', 'Mane'));

    expect(drawn).toEqual([`${CHIP} Ada`]);
    expect(screen.getByText('Mane')).toBeInTheDocument();
  });
});

describe('editing one location in the location tree', () => {
  it('redraws that row only', () => {
    render(<LocationTreeHost />);
    drawn.length = 0;

    act(() => world.rename?.('Dov', 'Dovedale'));

    expect(screen.getByText('Dovedale')).toBeInTheDocument();
    expect(drawn).toEqual(['Dovedale']);
  });
});

describe('editing one trait in the trait tree', () => {
  it('redraws that row only', () => {
    render(<TraitTreeHost />);
    drawn.length = 0;

    act(() => world.rename?.('Eli', 'Elinor'));

    expect(screen.getByText('Elinor')).toBeInTheDocument();
    expect(drawn).toEqual(['Elinor']);
  });
});

describe('a drag move in the tree', () => {
  type Node = { id: string; depth: number };
  const nodes: Node[] = NAMES.map((id) => ({ id, depth: 0 }));
  const calls = { visible: 0, rowSpec: 0, project: 0 };
  // The projected depth steps up by one every time the pointer has moved right by `STEP`.
  const STEP = 40;

  function Host() {
    const adapter: SortableTreeAdapter<Node> = {
      visibleDeps: [],
      rowDeps: [],
      placeholders: [],
      getVisible: () => { calls.visible++; return nodes.map((n) => ({ ...n })); },
      projectDepth: (_visible, _active, _over, offsetLeft) => { calls.project++; return Math.floor(offsetLeft / STEP); },
      onDrop: () => {},
      rowSpec: (node) => { calls.rowSpec++; return { lead: 'none', label: node.id }; },
    };
    return <SortableTree adapter={adapter} selectedId={null} onSelect={() => {}} />;
  }

  beforeEach(() => { calls.visible = 0; calls.rowSpec = 0; calls.project = 0; });

  it('leaves the rows alone while the projected depth holds', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const grip = screen.getAllByRole('button', { name: 'Drag to reorder or nest' })[1];
    await user.pointer([
      { keys: '[MouseLeft>]', target: grip, coords: { clientX: 0, clientY: 0 } },
      { coords: { clientX: 10, clientY: 0 } },
    ]);
    const afterStart = { ...calls };

    // Moves right under STEP, so the projected depth stays 0.
    await user.pointer([{ coords: { clientX: 20, clientY: 0 } }, { coords: { clientX: 30, clientY: 0 } }]);

    expect(calls.project).toBeGreaterThan(afterStart.project);
    expect(calls.visible).toBe(afterStart.visible);
    expect(calls.rowSpec).toBe(afterStart.rowSpec);
  });

  it('indents the dragged row when the pointer moves a full step', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const grip = screen.getAllByRole('button', { name: 'Drag to reorder or nest' })[1];
    const row = grip.closest<HTMLElement>('div.cursor-pointer');
    await user.pointer([
      { keys: '[MouseLeft>]', target: grip, coords: { clientX: 0, clientY: 0 } },
      { coords: { clientX: 10, clientY: 0 } },
      { coords: { clientX: STEP * 2 + 10, clientY: 0 } },
    ]);

    expect(row?.style.paddingLeft).toBe(`${8 + 2 * 24}px`);
  });
});
