import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity, GameLocation, Placeholder, WorldOverview } from '@/types';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import { useListSearch } from '@/components/listToolbarHooks';
import { useWorldOpeningsEditor } from './useWorldOpeningsEditor';

/**
 * The Openings tab's panes against a mutable world: each owner's openings, their chances, weights, kinds,
 * order and collapse, the view with several starts and the default opening. The list's nesting and the
 * editor wiring are the bench's (`WorldEditor.openingsTab.test.tsx`).
 */

const baseOverview = { name: 'Sedge Landing', description: '', systemPrompt: '', tags: [] } as unknown as WorldOverview;

// The world under edit, mutated by the tab's own writes so a test can assert what ends up stored.
const world: { overview: WorldOverview; entities: Entity[]; locations: GameLocation[]; rerender: () => void } = {
  overview: baseOverview, entities: [], locations: [], rerender: () => {},
};
const placeholders = [{ id: 'p1', name: 'Hair Color', values: ['ash', 'copper'] }] as unknown as Placeholder[];

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    worldOverview: world.overview,
    updateWorldOverview: (patch: Partial<WorldOverview>) => {
      world.overview = { ...world.overview, ...patch };
      world.rerender();
    },
    updateEntity: (next: Entity) => {
      world.entities = world.entities.map((e) => (e.id === next.id ? next : e));
      world.rerender();
    },
    updateLocation: (next: GameLocation) => {
      world.locations = world.locations.map((l) => (l.id === next.id ? next : l));
      world.rerender();
    },
    entities: world.entities, entityGroups: [], locations: world.locations, placeholders,
  }),
}));
// The Lexical editor isn't under test: a test drives an edit through the same `onChange` the real field fires.
const fieldProps = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { ariaLabel?: string }) => {
    if (props.ariaLabel) fieldProps.byLabel[props.ariaLabel] = props;
    return <div data-testid={props.ariaLabel ?? 'placeholder-field'} />;
  },
}));

type OpenItem = (id: string) => void;
const Harness = ({ onOpenEntity, onOpenLocation }: { onOpenEntity: OpenItem; onOpenLocation: OpenItem }) => {
  const [, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  world.rerender = () => setTick((n) => n + 1);
  const search = useListSearch();
  const parts = useWorldOpeningsEditor({ selectedId: selected, onSelect: setSelected, search, defaultToWorld: true, onOpenEntity, onOpenLocation });
  return (
    <>
      {parts.toolbar()}
      <div data-testid="list">{parts.list}</div>
      <div data-testid="detail">{parts.detail}</div>
    </>
  );
};

const open = (onOpenEntity: OpenItem = () => {}, onOpenLocation: OpenItem = () => {}) => {
  const user = userEvent.setup();
  render(<Harness onOpenEntity={onOpenEntity} onOpenLocation={onOpenLocation} />);
  return user;
};
const detail = () => within(screen.getByTestId('detail'));
const select = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(screen.getByTestId('list')).getByRole('button', { name: `Select ${name}` }));
/** The owner rows the list shows, by name. */
const owners = () => within(screen.getByTestId('list')).queryAllByRole('button', { name: /^Select / })
  .map((b) => b.getAttribute('aria-label')!.slice('Select '.length));
const edit = (label: string, text: string) =>
  act(() => (fieldProps.byLabel[label].onChange as (v: string) => void)(text));
const chance = (label: string) => detail().getByLabelText(`Chance for ${label}`).textContent;
const addOpening = (user: ReturnType<typeof userEvent.setup>) => user.click(detail().getByRole('button', { name: 'Add Opening' }));

const ROWS = [
  { id: 'o1', text: 'You wake in the reed-beds.', kind: 'action' as const },
  { id: 'o2', text: 'The ferry bell rings twice.', kind: 'action' as const },
];

beforeEach(() => {
  world.overview = baseOverview;
  world.entities = [];
  world.locations = [{ id: 'loc1', name: 'The Jetty' } as unknown as GameLocation];
  fieldProps.byLabel = {};
});

describe("This World's openings", () => {
  it('opens on This World, and browsing writes nothing', () => {
    const before = world.overview;
    open();
    expect(detail().getByRole('heading')).toHaveTextContent('This World');
    expect(world.overview).toBe(before);
  });

  it('shows the default opening text read-only at a lone start where nothing can come up', () => {
    open();
    expect(screen.getByText('No opening can come up at The Jetty, so a game there starts on the text below')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Default Opening' })).toHaveTextContent(OPENING_SCENE_CUE);
    expect(screen.queryByTestId('Opening 1')).not.toBeInTheDocument();
  });

  it('shows the default opening unnamed in a world with no locations', () => {
    world.locations = [];
    open();
    expect(screen.getByText('No opening can come up, so every game starts on the text below')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Default Opening' })).toHaveTextContent(OPENING_SCENE_CUE);
  });

  it('adds a row and writes its text, chips palette and all', async () => {
    const user = open();
    await addOpening(user);
    expect(world.overview.openings).toEqual([{ id: expect.any(String), text: '', kind: 'action' }]);
    expect(fieldProps.byLabel['Opening 1'].placeholders).toEqual(placeholders);

    edit('Opening 1', 'You wake in the reed-beds.');
    expect(world.overview.openings?.[0].text).toBe('You wake in the reed-beds.');
    expect(screen.queryByRole('note', { name: 'Default Opening' })).not.toBeInTheDocument();
  });

  it('shows each row’s chance from its weight, and keeps a weight 0 row', async () => {
    world.overview = { ...world.overview, openings: ROWS };
    const user = open();
    expect(chance('Opening 1')).toBe('50%');

    const weight2 = detail().getByLabelText('Draw weight for Opening 2');
    await user.clear(weight2);
    await user.type(weight2, '3');
    expect(world.overview.openingWeights).toEqual({ o2: 3 });
    expect(chance('Opening 1')).toBe('25%');
    expect(chance('Opening 2')).toBe('75%');

    await user.clear(detail().getByLabelText('Draw weight for Opening 1'));
    expect(world.overview.openingWeights).toEqual({ o1: 0, o2: 3 });
    expect(chance('Opening 1')).toBe('0%');
    expect(detail().getAllByTestId('opening-row')).toHaveLength(2);
  });

  it('sets how a row opens with a two-value toggle, not tabs', async () => {
    world.overview = { ...world.overview, openings: ROWS };
    const user = open();
    const opensAs = within(detail().getByRole('radiogroup', { name: 'Opens As, Opening 2' }));
    expect(opensAs.getByRole('radio', { name: 'Player Action' })).toBeChecked();
    expect(screen.queryByRole('tab', { name: 'Narration' })).not.toBeInTheDocument();

    await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
    expect(world.overview.openings).toEqual([ROWS[0], { ...ROWS[1], kind: 'narration' }]);
    expect(opensAs.getByRole('radio', { name: 'Narration' })).toBeChecked();

    // Pressing the value already set keeps it: a row always has a kind.
    await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
    expect(world.overview.openings?.[1].kind).toBe('narration');
  });

  it('drops a removed row together with its weight', async () => {
    world.overview = { ...world.overview, openings: ROWS, openingWeights: { o1: 2, o2: 5 } };
    const user = open();
    await user.click(detail().getByRole('button', { name: 'Remove Opening 2' }));
    expect(world.overview.openings).toEqual([ROWS[0]]);
    expect(world.overview.openingWeights).toEqual({ o1: 2 });
  });

  it('says how the openings draw for a world that stores them off', () => {
    world.overview = { ...world.overview, openings: ROWS, openingsEnabled: false } as typeof world.overview;
    open();
    expect(detail().getAllByTestId('opening-row')).toHaveLength(2);
    expect(screen.getByText(/Draws one opening by weight when a player starts this world/)).toBeInTheDocument();
    expect(screen.queryByText(/are off/)).toBeNull();
  });

  describe('collapsing', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
      id: `c${i + 1}`, text: `Line ${i + 1}\nSecond line ${i + 1}`, kind: 'action' as const,
    }));
    const textBoxes = () => screen.queryAllByTestId(/^Opening \d+$/);
    const collapseAll = () => screen.getByRole('button', { name: /^(Collapse|Expand) all openings$/ });

    it('opens a list of two rows expanded', () => {
      world.overview = { ...world.overview, openings: rows(2) };
      open();
      expect(textBoxes()).toHaveLength(2);
    });

    it('opens a list of three rows collapsed, each on its first line with an ellipsis', () => {
      world.overview = { ...world.overview, openings: rows(3) };
      open();
      expect(textBoxes()).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Expand Opening 2' })).toHaveTextContent('Opening 2Line 2 …');
    });

    it('opens a row added to a collapsed list expanded', async () => {
      world.overview = { ...world.overview, openings: rows(3) };
      const user = open();
      await addOpening(user);
      expect(textBoxes().map((b) => b.dataset.testid)).toEqual(['Opening 4']);
    });

    it('takes every card down and back up in one press', async () => {
      world.overview = { ...world.overview, openings: rows(2) };
      const user = open();
      await user.click(collapseAll());
      expect(textBoxes()).toHaveLength(0);
      await user.click(collapseAll()); // now reading 'Expand all openings'
      expect(textBoxes()).toHaveLength(2);
    });

    it('is not offered for a lone opening', () => {
      world.overview = { ...world.overview, openings: rows(1) };
      open();
      expect(screen.queryByRole('button', { name: /all openings$/ })).not.toBeInTheDocument();
    });

    it('keeps the kind, weight and remove live on a collapsed card', async () => {
      world.overview = { ...world.overview, openings: rows(3) };
      const user = open();
      const opensAs = within(screen.getByRole('radiogroup', { name: 'Opens As, Opening 2' }));
      await user.click(opensAs.getByRole('radio', { name: 'Narration' }));
      expect(world.overview.openings?.[1].kind).toBe('narration');

      const weight = screen.getByLabelText('Draw weight for Opening 2');
      await user.clear(weight);
      await user.type(weight, '3');
      expect(world.overview.openingWeights).toEqual({ c2: 3 });
      expect(chance('Opening 2')).toBe('60%');

      await user.click(screen.getByRole('button', { name: 'Remove Opening 3' }));
      expect(world.overview.openings?.map((o) => o.id)).toEqual(['c1', 'c2']);
      expect(textBoxes()).toHaveLength(0);
    });

    it('reorders collapsed cards by keyboard drag', async () => {
      world.overview = { ...world.overview, openings: rows(3) };
      // jsdom lays nothing out; stack the rows 40px apart so the keyboard sensor can find a neighbor. Every
      // other element is a container tall enough to hold them.
      const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const row = this.closest<HTMLElement>('[data-testid="opening-row"]');
        if (!row) return DOMRect.fromRect({ x: 0, y: 0, width: 300, height: 600 });
        const i = [...row.parentElement!.children].indexOf(row);
        return DOMRect.fromRect({ x: 0, y: i * 40, width: 300, height: 36 });
      });
      const user = open();
      screen.getByRole('button', { name: 'Reorder Opening 3' }).focus();
      await user.keyboard('[Space]');
      await user.keyboard('[ArrowUp]');
      await user.keyboard('[Space]');
      rect.mockRestore();
      expect(world.overview.openings?.map((o) => o.id)).toEqual(['c1', 'c3', 'c2']);
    });
  });
});

describe("a location's or entity's openings", () => {
  const dock = { id: 'dock', name: 'The Dock', isStarting: true } as unknown as GameLocation;
  const market = { id: 'market', name: 'The Market', isStarting: true } as unknown as GameLocation;
  const cave = { id: 'cave', name: 'The Cave' } as unknown as GameLocation;
  const guide = {
    id: 'guide', name: 'Guide', locations: ['dock'],
    openings: [{ id: 'g1', text: 'The guide waves.', kind: 'action' }, { id: 'g2', text: 'The guide sighs.', kind: 'narration' }],
  } as unknown as Entity;
  const hermit = {
    id: 'hermit', name: 'Hermit', locations: ['cave'],
    openings: [{ id: 'h1', text: 'A cough in the dark.', kind: 'action' }],
  } as unknown as Entity;
  const plain = { id: 'plain', name: 'Plain', locations: ['dock'] } as unknown as Entity;
  const guideNow = () => world.entities.find((e) => e.id === 'guide')!;

  beforeEach(() => {
    world.overview = { ...world.overview, openings: [ROWS[0]] };
    world.entities = [guide, plain, hermit];
    world.locations = [dock, cave];
  });

  it('lists the entities with openings, and follows the entities', () => {
    open();
    expect(owners()).toEqual(['This World', 'Guide', 'Hermit']);
    act(() => {
      world.entities = [hermit, { ...plain, openings: [{ id: 'p1', text: 'Hello.', kind: 'action' }] }];
      world.rerender();
    });
    expect(owners()).toEqual(['This World', 'Hermit', 'Plain']);
  });

  it('writes an edit, a weight, an add and a remove to the selected entity', async () => {
    const user = open();
    const before = world.overview;
    await select(user, 'Guide');

    edit('Opening 1', 'The guide bows.');
    expect(guideNow().openings?.[0].text).toBe('The guide bows.');

    const weight = detail().getByLabelText('Draw weight for Opening 2');
    await user.clear(weight);
    await user.type(weight, '3');
    expect(guideNow().openingWeights).toEqual({ g2: 3 });

    await addOpening(user);
    expect(guideNow().openings).toHaveLength(3);

    await user.click(detail().getByRole('button', { name: 'Remove Opening 2' }));
    expect(guideNow().openings?.map((o) => o.id)).toEqual(['g1', expect.any(String)]);
    expect(guideNow().openingWeights).toBeUndefined();

    expect(world.overview.openings).toEqual(before.openings);
  });

  it('reorders an entity’s rows by keyboard drag, on that entity', async () => {
    // jsdom lays nothing out; stack the rows 100px apart so the keyboard sensor can find a neighbor.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-testid="opening-row"]');
      const i = row ? [...row.parentElement!.children].indexOf(row) : 0;
      return DOMRect.fromRect({ x: 0, y: i * 100, width: 300, height: 90 });
    });
    const user = open();
    await select(user, 'Guide');
    detail().getByRole('button', { name: 'Reorder Opening 2' }).focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    rect.mockRestore();
    expect(guideNow().openings?.map((o) => o.id)).toEqual(['g2', 'g1']);
    expect(world.overview.openings).toEqual([ROWS[0]]);
  });

  it('shows each row’s share of the whole pool, and a dash for an entity elsewhere', async () => {
    const user = open();
    expect(chance('Opening 1')).toBe('33%');
    await select(user, 'Guide');
    expect([chance('Opening 1'), chance('Opening 2')]).toEqual(['33%', '33%']);
    await select(user, 'Hermit');
    expect(chance('Opening 1')).toBe('—');
    expect(screen.queryByRole('combobox', { name: 'Starting Location' })).not.toBeInTheDocument();
  });

  it('says in words, not color alone, that an entity is at no starting location', async () => {
    const user = open();
    await select(user, 'Hermit');
    expect(detail().getByText("Isn't at any starting location, so its openings never come up")).toBeInTheDocument();
    await select(user, 'Guide');
    expect(detail().queryByText(/never come up/)).not.toBeInTheDocument();
  });

  it("opens the entity's own Openings tab from its name", async () => {
    const onOpenEntity = vi.fn();
    const user = open(onOpenEntity);
    await select(user, 'Guide');
    await user.click(detail().getByRole('button', { name: 'Guide' }));
    expect(onOpenEntity).toHaveBeenCalledWith('guide');
  });

  describe('Self rows', () => {
    const warden = {
      id: 'warden', name: 'Warden', persona: true, locations: ['dock'],
      openings: [
        { id: 'w1', text: 'The warden nods.', kind: 'action' },
        { id: 's1', text: 'You take the lamp.', kind: 'narration', self: true },
        { id: 's2', text: 'You bar the gate.', kind: 'narration', self: true },
      ],
      openingWeights: { s2: 3 },
    } as unknown as Entity;
    const drawnFor = (label: string) => detail().queryByRole('radiogroup', { name: `Drawn For, ${label}` });

    it('show in their persona’s pane with their share of its Self rows', async () => {
      world.entities = [guide, warden];
      const user = open();
      await select(user, 'Warden');
      expect(detail().getAllByTestId('opening-row')).toHaveLength(3);
      expect(chance('Opening 2')).toBe('25%');
      expect(chance('Opening 3')).toBe('75%');
      // The Others row still shares the pool at the start with the world's and the guide's rows.
      expect(chance('Opening 1')).toBe('25%');
      await select(user, 'Guide');
      expect(chance('Opening 1')).toBe('25%');
    });

    it('put the Others | Self switch on a persona’s rows only', async () => {
      world.entities = [guide, warden];
      const user = open();
      expect(drawnFor('Opening 1')).toBeNull();
      await select(user, 'Warden');
      expect(drawnFor('Opening 1')).toBeInTheDocument();
      await select(user, 'Guide');
      expect(drawnFor('Opening 1')).toBeNull();
    });

    it('write a flip to the persona, keeping the rest of the row', async () => {
      world.entities = [guide, warden];
      const user = open();
      await select(user, 'Warden');
      await user.click(within(drawnFor('Opening 1')!).getByRole('radio', { name: 'Self' }));
      const next = world.entities.find((e) => e.id === 'warden')!;
      expect(next.openings?.[0]).toEqual({ id: 'w1', text: 'The warden nods.', kind: 'action', self: true });
      expect(next.openingWeights).toEqual({ s2: 3 });
    });

    it('hide on an entity without the Persona mark, with its row when they are all it has', async () => {
      world.entities = [guide, { ...warden, persona: undefined }, { ...warden, id: 'former', name: 'Former', persona: undefined, openings: warden.openings!.slice(1) }];
      const user = open();
      expect(owners()).toEqual(['This World', 'Guide', 'Warden']);
      await select(user, 'Warden');
      expect(detail().getAllByTestId('opening-row')).toHaveLength(1);
    });

    it('take no No Starting Location note when a persona has only Self rows', async () => {
      world.locations = [dock, market];
      world.entities = [guide, { ...warden, locations: ['cave'], openings: warden.openings!.slice(1) }];
      const user = open();
      await select(user, 'Warden');
      expect(detail().queryByText(/never come up/)).not.toBeInTheDocument();
      expect(chance('Opening 1')).toBe('25%');
    });
  });

  describe('with several starting locations', () => {
    const dockRow = { id: 'd1', text: 'Gulls fight over the nets.', kind: 'narration' as const };
    const warden = {
      id: 'warden', name: 'Warden', persona: true, locations: ['market'],
      openings: [
        { id: 'w1', text: 'The warden nods.', kind: 'action' },
        { id: 's1', text: 'You take the lamp.', kind: 'narration', self: true },
        { id: 's2', text: 'You bar the gate.', kind: 'narration', self: true },
      ],
      openingWeights: { s2: 3 },
    } as unknown as Entity;
    const defaultCard = () => screen.queryByRole('note', { name: 'Default Opening' });
    /** Each listed owner's row chances, in list order. */
    const chancesByOwner = async (user: ReturnType<typeof userEvent.setup>) => {
      const out: Record<string, (string | null)[]> = {};
      for (const name of owners()) {
        await select(user, name);
        out[name] = detail().queryAllByLabelText(/^Chance for /).map((el) => el.textContent);
      }
      return out;
    };

    beforeEach(() => {
      world.locations = [{ ...dock, openings: [dockRow] }, market];
      world.entities = [guide, { ...hermit, locations: ['market'] }, warden];
    });

    it('offers no Starting Location filter, and lists every owner', () => {
      open();
      expect(screen.queryByRole('combobox', { name: 'Starting Location' })).not.toBeInTheDocument();
      expect(owners()).toEqual(['This World', 'The Dock', 'Guide', 'Hermit', 'Warden']);
    });

    it('shows every owner, with a chance on Self rows only', async () => {
      const user = open();
      expect(await chancesByOwner(user)).toEqual({
        'This World': ['—'], 'The Dock': ['—'], Guide: ['—', '—'], Hermit: ['—'], Warden: ['—', '25%', '75%'],
      });
    });

    it('names every start that gets the default opening, and hides it when none does', () => {
      world.overview = { ...world.overview, openings: [] };
      world.locations = [dock, market];
      world.entities = [];
      open();
      expect(defaultCard()).toBeInTheDocument();
      expect(screen.getByText('No opening can come up at The Dock or The Market, so a game there starts on the text below'))
        .toBeInTheDocument();

      act(() => {
        world.entities = [guide];
        world.rerender();
      });
      expect(screen.getByText(/^No opening can come up at The Market,/)).toBeInTheDocument();

      act(() => {
        world.overview = { ...world.overview, openings: [ROWS[0]] };
        world.rerender();
      });
      expect(defaultCard()).not.toBeInTheDocument();
      expect(screen.queryByText(/No opening can come up/)).not.toBeInTheDocument();
    });
  });

  describe('locations', () => {
    const dockRow = { id: 'd1', text: 'Gulls fight over the nets.', kind: 'narration' as const };
    const caveRow = { id: 'c1', text: 'Water drips in the dark.', kind: 'action' as const };
    const dockNow = () => world.locations.find((l) => l.id === 'dock')!;

    beforeEach(() => {
      world.locations = [{ ...dock, openings: [dockRow] }, { ...cave, openings: [caveRow] }];
    });

    it('show a location’s share of the pool at its own start, and a dash and the note where it isn’t one', async () => {
      const user = open();
      await select(user, 'The Dock');
      expect(chance('Opening 1')).toBe('25%');
      expect(detail().queryByText(/never come up/)).not.toBeInTheDocument();
      await select(user, 'Guide');
      expect(chance('Opening 1')).toBe('25%');
      await select(user, 'The Cave');
      expect(chance('Opening 1')).toBe('—');
      expect(detail().getByText("Isn't a starting location, so its openings never come up")).toBeInTheDocument();
    });

    it('write an edit, a weight and an add to that location, with no Others | Self switch', async () => {
      const user = open();
      await select(user, 'The Dock');
      edit('Opening 1', 'The tide is out.');
      expect(dockNow().openings?.[0].text).toBe('The tide is out.');

      const weight = detail().getByLabelText('Draw weight for Opening 1');
      await user.clear(weight);
      await user.type(weight, '2');
      expect(dockNow().openingWeights).toEqual({ d1: 2 });

      await addOpening(user);
      expect(dockNow().openings).toHaveLength(2);
      expect(detail().queryByRole('radiogroup', { name: /^Drawn For/ })).toBeNull();
      expect(world.entities.find((e) => e.id === 'dock')).toBeUndefined();
    });

    it("open the location's own Openings tab from its name", async () => {
      const onOpenLocation = vi.fn();
      const onOpenEntity = vi.fn();
      const user = open(onOpenEntity, onOpenLocation);
      await select(user, 'The Dock');
      await user.click(detail().getByRole('button', { name: 'The Dock' }));
      expect(onOpenLocation).toHaveBeenCalledWith('dock');
      expect(onOpenEntity).not.toHaveBeenCalled();
    });
  });
});
