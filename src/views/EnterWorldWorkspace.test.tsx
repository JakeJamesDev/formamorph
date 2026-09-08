import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EnterWorldWorkspace from './EnterWorldWorkspace';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import type { EntityMetadata, Trait } from '@/types';

const identity = (text: string) => text;
const traitIdentity = (_trait: Trait, text: string) => text;

const mockPhoneViewport = () => {
  vi.stubGlobal('innerWidth', 390);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(max-width: 767px)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const groups = [
  { id: 'origin', name: 'Origin', parentId: null, order: 0, playerDescription: 'Where you came from.' },
  { id: 'culture', name: 'Culture', parentId: 'origin', order: 0, playerDescription: 'What shaped you.', exclusive: true },
  { id: 'calling', name: 'Calling', parentId: 'culture', order: 0 },
  { id: 'discipline', name: 'Discipline', parentId: 'calling', order: 0 },
  { id: 'practice', name: 'Practice', parentId: 'discipline', order: 0 },
  { id: 'empty', name: 'Empty branch', parentId: null, order: 1 },
];

const traits: Trait[] = [
  { id: 'local', name: 'Local', groupId: 'culture', order: 0, isDefault: true, statChanges: [] },
  { id: 'outsider', name: 'Outsider', groupId: 'culture', order: 1, statChanges: [] },
  { id: 'artisan', name: 'Artisan', groupId: 'practice', order: 0, statChanges: [] },
];

const libraryEntities: EntityMetadata[] = [
  { id: 'portrait', name: 'Mara Vale', description: 'A practiced guide.', image: 'data:image/png;base64,portrait' },
  { id: 'fallback', name: 'Quiet Cartographer', description: 'Maps forgotten roads.' },
];

const dictionaryItems: DictionarySelectionItem[] = [
  {
    key: 'world:shared', source: 'world', enabled: true, entryCount: 2,
    book: { id: 'shared', name: 'World Atlas', description: 'Authored routes.', thumbnail: 'data:image/png;base64,world', entries: [] },
  },
  {
    key: 'library:shared', source: 'library', enabled: false, entryCount: 3,
    book: { id: 'shared', name: 'Traveler Notes', description: 'Collected rumors.', entries: [] },
  },
];

function Harness(props: Partial<ComponentProps<typeof EnterWorldWorkspace>> = {}) {
  const [selectedTraits, setSelectedTraits] = useState(['local']);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState(new Set<string>());
  const [selectedDictionaries, setSelectedDictionaries] = useState(dictionaryItems);
  const [categoryIndex, setCategoryIndex] = useState(0);
  return (
    <EnterWorldWorkspace
      worldName="Entry World"
      traits={traits}
      traitGroups={groups}
      stats={[]}
      locations={[]}
      resolveText={identity}
      resolveTraitText={traitIdentity}
      selectedTraits={selectedTraits}
      selectedLocationId={selectedLocationId}
      libraryEntities={libraryEntities}
      selectedEntityIds={selectedEntityIds}
      dictionaryItems={selectedDictionaries}
      categoryIndex={categoryIndex}
      onCategoryChange={setCategoryIndex}
      onTraitSelect={(id) => setSelectedTraits((current) => current.includes(id)
        ? current.filter((traitId) => traitId !== id)
        : [...current, id])}
      onLocationChange={setSelectedLocationId}
      onEntityToggle={(id, selected) => setSelectedEntityIds((current) => {
        const next = new Set(current);
        if (selected) next.add(id); else next.delete(id);
        return next;
      })}
      onDictionaryItemsChange={setSelectedDictionaries}
      onIntroduction={vi.fn()}
      onCancel={vi.fn()}
      onContinue={vi.fn()}
      continueLabel="Start game"
      {...props}
    />
  );
}

describe('EnterWorldWorkspace', () => {
  it('keeps phone categories collapsed and returns focus after choosing one', async () => {
    mockPhoneViewport();
    const user = userEvent.setup();
    render(<Harness />);

    const disclosure = screen.getByRole('button', { name: /Categories/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveTextContent('Culture');
    const panel = document.getElementById(disclosure.getAttribute('aria-controls')!);
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');
    expect(screen.queryByRole('navigation', { name: 'World setup categories' })).not.toBeInTheDocument();

    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(panel).not.toHaveAttribute('inert');
    const navigation = screen.getByRole('navigation', { name: 'World setup categories' });

    await user.click(within(navigation).getByRole('button', { name: /Practice/ }));
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    expect(disclosure).toHaveTextContent('Practice');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');
    expect(disclosure).toHaveFocus();
  });

  it('keeps the phone Introduction action compact and explicitly named', () => {
    mockPhoneViewport();
    render(<Harness />);

    expect(screen.getByRole('button', { name: 'Read Introduction' })).toBeInTheDocument();
  });

  it('opens the first meaningful category in an always-expanded authored hierarchy', () => {
    render(<Harness />);

    const navigation = screen.getByRole('navigation', { name: 'World setup categories' });
    expect(within(navigation).getByText('Origin').closest('button')).toBeNull();
    expect(within(navigation).getByRole('button', { name: /Culture/ })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByLabelText('1 of 2 selected')).toHaveTextContent('1/2');
    expect(within(navigation).getByText('Calling').closest('button')).toBeNull();
    expect(within(navigation).getByText('Discipline').closest('button')).toBeNull();
    expect(within(navigation).getByRole('button', { name: /Practice/ })).toBeInTheDocument();
    expect(within(navigation).queryByText('Empty branch')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('General')).not.toBeInTheDocument();
    expect(within(navigation).queryByText(/Selected|Folder/)).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Culture' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Culture choices' })).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Outsider')).toBeInTheDocument();
    expect(screen.getAllByText('Where you came from.')).toHaveLength(2);

    fireEvent.click(within(navigation).getByRole('button', { name: /Practice/ }));
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    expect(screen.getByText('Artisan')).toBeInTheDocument();
  });

  it('activates exclusive radios and other checkboxes exactly once from the row or indicator', async () => {
    const user = userEvent.setup();
    const onTraitSelect = vi.fn();
    render(<Harness onTraitSelect={onTraitSelect} />);

    expect(fireEvent.click(screen.getByText('Local'))).toBe(true);
    expect(onTraitSelect).toHaveBeenLastCalledWith('local');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Local' }));
    expect(onTraitSelect).toHaveBeenLastCalledWith('local');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    await user.click(screen.getByRole('radio', { name: 'Outsider' }));
    expect(onTraitSelect).toHaveBeenLastCalledWith('outsider');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Practice/ }));
    expect(screen.getByRole('checkbox', { name: 'Artisan' })).not.toBeChecked();
    onTraitSelect.mockClear();
    await user.click(screen.getByText('Artisan'));
    expect(onTraitSelect).toHaveBeenLastCalledWith('artisan');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    await user.click(screen.getByRole('checkbox', { name: 'Artisan' }));
    expect(onTraitSelect).toHaveBeenLastCalledWith('artisan');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps exclusive trait choices optional and changes them as one selection', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const local = screen.getByRole('radio', { name: 'Local' });
    const outsider = screen.getByRole('radio', { name: 'Outsider' });
    expect(local).toBeChecked();
    expect(outsider).not.toBeChecked();

    local.focus();
    await user.keyboard('[Space]');
    expect(local).not.toBeChecked();
    expect(outsider).not.toBeChecked();

    outsider.focus();
    await user.keyboard('[Space]');
    expect(local).not.toBeChecked();
    expect(outsider).toBeChecked();

    fireEvent.click(outsider);
    expect(outsider).not.toBeChecked();
  });

  it('uses Starting Location as the first category when a world has no traits', async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    render(
      <Harness
        traits={[]}
        traitGroups={[]}
        locations={[
          { id: 'harbor', name: 'Harbor', isStarting: true, playerDescription: 'A salty dock.' },
          { id: 'hill', name: 'Hill', isStarting: true },
        ]}
        onLocationChange={onLocationChange}
      />,
    );

    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Starting Location' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Random' })).toBeChecked();
    expect(screen.getByText('A salty dock.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Hill' }));
    expect(onLocationChange).toHaveBeenCalledOnce();
    expect(onLocationChange).toHaveBeenCalledWith('hill');
  });

  it('shows resolved trait descriptions and visible stat-effect previews', () => {
    render(
      <Harness
        traits={[
          {
            id: 'local', name: 'Local', groupId: 'culture', order: 0, statChanges: [
              { statId: 'favor', value: 5, type: 'starting' },
              { statId: 'secret', value: -2, type: 'starting' },
            ],
            playerDescription: 'Known around TOKEN.',
          },
        ]}
        stats={[
          { id: 'favor', name: 'TOKEN Standing', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] },
          { id: 'secret', name: 'Secret', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], hidden: true },
        ]}
        resolveTraitText={(_trait, text) => text.replace('TOKEN', 'Sedge')}
      />,
    );

    expect(screen.getByText('Known around Sedge.')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'LI' && element.textContent === 'Sedge Standing: +5',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Secret/)).not.toBeInTheDocument();
  });

  it('presents selectable entities and source-separated dictionaries with artwork fallbacks', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('heading', { name: 'Entities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Library dictionaries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Included with this world' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mara Vale portrait' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quiet Cartographer has no portrait')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'World Atlas cover' })).toBeInTheDocument();
    expect(screen.getByLabelText('Traveler Notes has no cover')).toBeInTheDocument();
    expect(screen.getByText('A practiced guide.')).toBeInTheDocument();
    expect(screen.getByText('Collected rumors.')).toBeInTheDocument();

    const entity = screen.getByRole('checkbox', { name: 'Include Mara Vale' });
    const libraryBook = screen.getByRole('checkbox', { name: 'Enable Traveler Notes from library' });
    expect(entity).not.toBeChecked();
    expect(libraryBook).not.toBeChecked();
    await user.click(entity);
    await user.click(libraryBook);
    expect(entity).toBeChecked();
    expect(libraryBook).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World Atlas from world' })).toBeChecked();
  });

  it('filters presentation without clearing hidden selections', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Mara Vale' }));
    await user.click(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from library' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search library additions' }), 'cartographer');

    expect(screen.getByText('Quiet Cartographer')).toBeInTheDocument();
    expect(screen.queryByText('Mara Vale')).not.toBeInTheDocument();
    expect(screen.queryByText('Traveler Notes')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search library additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from library' })).toBeChecked();
  });

  it('orders world and library dictionaries together without changing enablement', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    const order = screen.getByRole('list', { name: 'Dictionary order' });
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('World Atlas'),
      expect.stringContaining('Traveler Notes'),
    ]);

    await user.click(within(order).getByRole('button', { name: 'Move Traveler Notes from library up' }));
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Traveler Notes'),
      expect.stringContaining('World Atlas'),
    ]);
    expect(screen.getByRole('checkbox', { name: 'Enable World Atlas from world' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from library' })).not.toBeChecked();

    const keyboardMove = within(order).getByRole('button', { name: 'Move Traveler Notes from library down' });
    keyboardMove.focus();
    await user.keyboard('[Enter]');
    expect(within(order).getAllByRole('listitem')[0]).toHaveTextContent('World Atlas');
    await user.click(within(order).getByRole('button', { name: 'Move Traveler Notes from library up' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search library additions' }), 'Mara');
    await user.clear(screen.getByRole('searchbox', { name: 'Search library additions' }));
    const restoredOrder = screen.getByRole('list', { name: 'Dictionary order' });
    expect(within(restoredOrder).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Traveler Notes'),
      expect.stringContaining('World Atlas'),
    ]);
  });

  it('distinguishes ordering controls when world and library dictionary names match', async () => {
    const matchingNames: DictionarySelectionItem[] = [
      { ...dictionaryItems[0], book: { ...dictionaryItems[0].book, name: 'Shared Notes' } },
      { ...dictionaryItems[1], book: { ...dictionaryItems[1].book, name: 'Shared Notes' } },
    ];
    const user = userEvent.setup();
    render(<Harness dictionaryItems={matchingNames} />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    const order = screen.getByRole('list', { name: 'Dictionary order' });
    expect(within(order).getByRole('button', { name: 'Move Shared Notes from world down' })).toBeEnabled();
    expect(within(order).getByRole('button', { name: 'Move Shared Notes from library up' })).toBeEnabled();
    expect(within(order).getByRole('button', { name: 'Drag Shared Notes from world' })).toBeInTheDocument();
    expect(within(order).getByRole('button', { name: 'Drag Shared Notes from library' })).toBeInTheDocument();
  });

  it('keeps workspace actions outside scrolling content and updates ratios immediately', async () => {
    const user = userEvent.setup();
    const onIntroduction = vi.fn();
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    render(
      <Harness
        onIntroduction={onIntroduction}
        onCancel={onCancel}
        onContinue={onContinue}
        continueLabel="Continue to Dictionaries"
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Enter Entry World' });
    const content = within(dialog).getByRole('main');
    const continueButton = within(dialog).getByRole('button', { name: 'Continue to Dictionaries' });
    expect(content).not.toContainElement(continueButton);

    await user.click(screen.getByRole('radio', { name: 'Local' }));
    expect(screen.getByLabelText('0 of 2 selected')).toHaveTextContent('0/2');

    await user.click(within(dialog).getByRole('button', { name: 'Read Introduction' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(continueButton);
    expect(onIntroduction).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
