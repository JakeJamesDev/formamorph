import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityOpenings, OpeningsList, OpeningsPanel } from './OpeningsPanel';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { ownerOpeningRows } from '@/lib/openings';
import { placeholderOwners } from '@/lib/placeholderHomes';
import type { Entity, Opening } from '@/types';

// The World tab's panel reads the world from here; the other fields take props.
const game = { current: null as unknown };
vi.mock('@/contexts/GameDataContext', async (original) => ({
  ...(await original<typeof import('@/contexts/GameDataContext')>()),
  useGameData: () => game.current,
}));

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const keeper = { id: 'keeper', name: 'Keeper', openings: [{ id: 'o1', text: '.', kind: 'narration' }] } as Entity;
const lists = { placeholders: [], placeholderGroups: [], dictionaries: [], entities: [keeper] };
const store = { ...placeholderStore([], () => {}), lists, owners: placeholderOwners(lists) };

const mount = (children: ReactNode) => render(
  <PlaceholderStoreProvider value={store}>
    <EditorPreviewRollsProvider>{children}</EditorPreviewRollsProvider>
  </PlaceholderStoreProvider>,
);

/** The `{` menu's rows, typed at the head of the opening. */
async function menu(): Promise<string[]> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('textbox', { name: /Opening 1/ }));
  await user.keyboard('{{');
  await screen.findByTestId('chip-typeahead');
  return screen.getAllByTestId('chip-typeahead-row').map((row) => row.textContent?.trim() ?? '');
}

/** An entity opening is the entity's own text, so its `{` menu offers Character Name; a world opening has
 *  no entity to name. */
describe('opening fields', () => {
  it('offer Character Name in an entity’s opening', async () => {
    mount(<EntityOpenings entity={keeper} onChange={() => {}} placeholders={[]} />);
    expect(await menu()).toEqual(['Player Name', 'Character Name']);
  });

  it('leave it out of a world opening', async () => {
    mount(<OpeningsList owner={keeper} rows={ownerOpeningRows(keeper)} onChange={() => {}} placeholders={[]} empty={null} />);
    expect(await menu()).toEqual(['Player Name']);
  });
});

describe('an entity opening’s Preview', () => {
  const greeting = { ...keeper, openings: [{ id: 'o1', text: '{{char}} nods to {{user}}.', kind: 'narration' }] } as Entity;

  it('reads Character Name as the entity’s name and Player Name as its label', async () => {
    mount(<EntityOpenings entity={greeting} onChange={() => {}} placeholders={[]} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Keeper nods to Player Name.');
  });

  it('reads the entity’s name on the World tab’s Openings panel too', async () => {
    game.current = {
      worldOverview: {}, updateWorldOverview: () => {}, entities: [greeting], updateEntity: () => {}, locations: [],
      placeholders: [],
    };
    mount(<OpeningsPanel />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Keeper nods to Player Name.');
  });
});

describe('the Others | Self switch on an entity’s Openings tab', () => {
  const rows: Opening[] = [
    { id: 'o1', text: 'You wake as the Warden.', kind: 'narration' },
    { id: 'o2', text: 'The Warden waves you in.', kind: 'action', self: true },
  ];
  const warden = { id: 'warden', name: 'Warden', persona: true, openings: rows, openingWeights: { o1: 3 } } as Entity;
  const switchFor = (n: number) => screen.queryByRole('radiogroup', { name: `Drawn For, Opening ${n}` });

  it('shows on a world entity with the Persona mark, set to each row’s value', () => {
    mount(<EntityOpenings entity={warden} onChange={() => {}} placeholders={[]} />);
    expect(within(switchFor(1)!).getByRole('radio', { name: 'Others' })).toBeChecked();
    expect(within(switchFor(2)!).getByRole('radio', { name: 'Self' })).toBeChecked();
  });

  it('hides, with the Self rows, on a world entity without the Persona mark', () => {
    mount(<EntityOpenings entity={{ ...warden, persona: undefined }} onChange={() => {}} placeholders={[]} />);
    expect(switchFor(1)).toBeNull();
    expect(screen.getAllByTestId('opening-row')).toHaveLength(1);
  });

  it('shows on the Custom Persona entity, which carries no Persona mark', () => {
    mount(<EntityOpenings entity={{ ...warden, persona: undefined, customPersona: true }} onChange={() => {}} placeholders={[]} />);
    expect(within(switchFor(2)!).getByRole('radio', { name: 'Self' })).toBeChecked();
    expect(screen.getAllByTestId('opening-row')).toHaveLength(2);
  });

  it('flips only that field, keeping text, kind and weight', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    mount(<EntityOpenings entity={warden} onChange={onChange} placeholders={[]} />);

    await user.click(within(switchFor(1)!).getByRole('radio', { name: 'Self' }));
    const toSelf = { ...warden, ...onChange.mock.calls[0][0] };
    expect(toSelf.openings).toEqual([{ ...rows[0], self: true }, rows[1]]);
    expect(toSelf.openingWeights).toEqual({ o1: 3 });

    await user.click(within(switchFor(2)!).getByRole('radio', { name: 'Others' }));
    const toOthers = { ...warden, ...onChange.mock.calls[1][0] };
    expect(toOthers.openings).toEqual([rows[0], { id: 'o2', text: 'The Warden waves you in.', kind: 'action' }]);
    expect(toOthers.openingWeights).toEqual({ o1: 3 });
  });

  it('reorders the shown rows around a hidden Self row by id', async () => {
    const onChange = vi.fn();
    const former = {
      id: 'former', name: 'Former',
      openings: [{ id: 'a', text: 'A.', kind: 'action' }, { id: 's', text: 'S.', kind: 'action', self: true }, { id: 'b', text: 'B.', kind: 'action' }],
    } as Entity;
    // jsdom lays nothing out; stack the rows 100px apart so the keyboard sensor can find a neighbor.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest<HTMLElement>('[data-testid="opening-row"]');
      const i = row ? [...row.parentElement!.children].indexOf(row) : 0;
      return DOMRect.fromRect({ x: 0, y: i * 100, width: 300, height: 90 });
    });
    const user = userEvent.setup();
    mount(<EntityOpenings entity={former} onChange={onChange} placeholders={[]} />);
    screen.getByRole('button', { name: 'Reorder Opening 2' }).focus();
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    rect.mockRestore();
    expect(onChange.mock.calls[0][0].openings.map((o: Opening) => o.id)).toEqual(['b', 'a', 's']);
  });
});
