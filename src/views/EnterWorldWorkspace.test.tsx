import { useState, type ComponentProps } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

const mockContainerWidths = (dialogWidth: number, libraryWidth: number) => {
  const callbacks = new Set<ResizeObserverCallback>();
  let widths = { dialog: dialogWidth, library: libraryWidth };

  class StubResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {
      callbacks.add(callback);
    }

    observe() {}
    unobserve() {}
    disconnect() { callbacks.delete(this.callback); }
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function measuredWidth(this: HTMLElement) {
    if (this.dataset.enterWorldContainer === 'dialog') return widths.dialog;
    if (this.dataset.enterWorldContainer === 'library') return widths.library;
    return 0;
  });

  return {
    resize(dialog: number, library: number) {
      widths = { dialog, library };
      act(() => callbacks.forEach((callback) => callback([], {} as ResizeObserver)));
    },
  };
};

const mockAnimationFrames = () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));

  return {
    step() {
      const current = [...callbacks.values()];
      callbacks.clear();
      act(() => current.forEach((callback) => callback(performance.now())));
    },
    get pending() { return callbacks.size; },
  };
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

function Harness({ initialDictionaryItems = dictionaryItems, ...props }: Partial<ComponentProps<typeof EnterWorldWorkspace>> & {
  initialDictionaryItems?: DictionarySelectionItem[];
} = {}) {
  const [selectedTraits, setSelectedTraits] = useState(['local']);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState(new Set<string>());
  const [selectedDictionaries, setSelectedDictionaries] = useState(initialDictionaryItems);
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
  it('uses dialog and library container widths for all three responsive stages', async () => {
    const containers = mockContainerWidths(72 * 16, 44 * 16);
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole('button', { name: /Categories/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByTestId('enter-world-library-layout')).toHaveAttribute('data-pane-mode', 'split');

    containers.resize(72 * 16 - 1, 44 * 16);
    expect(screen.getByRole('button', { name: /Categories/ })).toBeInTheDocument();
    expect(screen.getByTestId('enter-world-library-layout')).toHaveAttribute('data-pane-mode', 'split');

    containers.resize(72 * 16 - 1, 44 * 16 - 1);
    expect(screen.getByRole('button', { name: /Categories/ })).toBeInTheDocument();
    expect(screen.getByTestId('enter-world-library-layout')).toHaveAttribute('data-pane-mode', 'single');
    expect(screen.getByRole('region', { name: 'Library Additions List' })).not.toHaveAttribute('inert');
    expect(document.querySelector('section[aria-label="Addition Details"]')).toHaveAttribute('inert');
  });

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

  it('presents selectable entities and one source-labeled dictionary list with artwork fallbacks', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByRole('heading', { name: 'Entities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dictionaries' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mara Vale portrait' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quiet Cartographer has no portrait')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'World Atlas cover' })).toBeInTheDocument();
    expect(screen.getByLabelText('Traveler Notes has no cover')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));
    expect(screen.getByText('A practiced guide.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Traveler Notes from Library' }));
    expect(screen.getByText('Collected rumors.')).toBeInTheDocument();

    const entity = screen.getByRole('checkbox', { name: 'Include Mara Vale' });
    const libraryBook = screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' });
    expect(entity).not.toBeChecked();
    expect(libraryBook).not.toBeChecked();
    await user.click(entity);
    await user.click(libraryBook);
    expect(entity).toBeChecked();
    expect(libraryBook).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable World Atlas from World' })).toBeChecked();
  });

  it('filters presentation without clearing hidden selections', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Mara Vale' }));
    await user.click(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search Library Additions' }), 'cartographer');

    expect(screen.getByText('Quiet Cartographer')).toBeInTheDocument();
    expect(screen.queryByText('Mara Vale')).not.toBeInTheDocument();
    expect(screen.queryByText('Traveler Notes')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search Library Additions' }));
    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' })).toBeChecked();
  });

  it('orders world and library dictionaries together without changing enablement', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    const order = screen.getByRole('list', { name: 'Dictionary Order' });
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('World Atlas'),
      expect.stringContaining('Traveler Notes'),
    ]);

    expect(within(order).queryByRole('button', { name: /^Move / })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect Traveler Notes from Library' }));
    await user.click(screen.getByRole('button', { name: 'Move Traveler Notes from Library Up' }));
    expect(within(order).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Traveler Notes'),
      expect.stringContaining('World Atlas'),
    ]);
    expect(screen.getByRole('checkbox', { name: 'Enable World Atlas from World' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' })).not.toBeChecked();

    const keyboardMove = screen.getByRole('button', { name: 'Move Traveler Notes from Library Down' });
    keyboardMove.focus();
    await user.keyboard('[Enter]');
    expect(within(order).getAllByRole('listitem')[0]).toHaveTextContent('World Atlas');
    await user.click(screen.getByRole('button', { name: 'Move Traveler Notes from Library Up' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search Library Additions' }), 'Mara');
    await user.clear(screen.getByRole('searchbox', { name: 'Search Library Additions' }));
    const restoredOrder = screen.getByRole('list', { name: 'Dictionary Order' });
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
    const order = screen.getByRole('list', { name: 'Dictionary Order' });
    await user.click(within(order).getByRole('button', { name: 'Inspect Shared Notes from World' }));
    expect(screen.getByRole('button', { name: 'Move Shared Notes from World Down' })).toBeEnabled();
    await user.click(within(order).getByRole('button', { name: 'Inspect Shared Notes from Library' }));
    expect(screen.getByRole('button', { name: 'Move Shared Notes from Library Up' })).toBeEnabled();
    expect(within(order).getByRole('button', { name: 'Drag Shared Notes from World' })).toBeInTheDocument();
    expect(within(order).getByRole('button', { name: 'Drag Shared Notes from Library' })).toBeInTheDocument();
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

describe('Enter World library inspection', () => {
  it('stages every narrow detail entry offscreen and cancels replaced or resized entries', () => {
    const containers = mockContainerWidths(1000, 680);
    const frames = mockAnimationFrames();
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Categories/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    const layout = screen.getByTestId('enter-world-library-layout');
    const list = screen.getByRole('region', { name: 'Library Additions List' });
    const details = document.querySelector<HTMLElement>('section[aria-label="Addition Details"]')!;

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));
    expect(within(details).getByRole('heading', { name: 'Mara Vale', hidden: true })).toBeInTheDocument();
    expect(details).toHaveClass('translate-x-full');
    expect(details).toHaveAttribute('inert');
    expect(list).not.toHaveAttribute('inert');
    expect(frames.pending).toBe(1);

    frames.step();
    expect(details).toHaveClass('translate-x-full');
    expect(frames.pending).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Quiet Cartographer' }));
    expect(within(details).getByRole('heading', { name: 'Quiet Cartographer', hidden: true })).toBeInTheDocument();
    frames.step();
    frames.step();
    expect(details).toHaveClass('translate-x-0');
    expect(details).not.toHaveAttribute('inert');
    expect(list).toHaveClass('-translate-x-1/4');
    expect(within(details).getByRole('heading', { name: 'Quiet Cartographer' })).toHaveFocus();

    fireEvent.click(within(details).getByRole('button', { name: 'Back to Additions' }));
    expect(details).toHaveClass('translate-x-full');
    expect(list).not.toHaveClass('-translate-x-1/4');
    expect(screen.getByRole('button', { name: 'Inspect Quiet Cartographer' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect Quiet Cartographer' }));
    frames.step();
    containers.resize(1000, 800);
    frames.step();
    expect(layout).toHaveAttribute('data-pane-mode', 'split');
    expect(details).not.toHaveClass('translate-x-full');
    expect(details).not.toHaveClass('translate-x-0');
    expect(list).not.toHaveClass('-translate-x-1/4');
    expect(details).not.toHaveAttribute('inert');
    expect(list).not.toHaveAttribute('inert');
    expect(frames.pending).toBe(0);

    containers.resize(1000, 680);
    expect(layout).toHaveAttribute('data-pane-mode', 'single');
    expect(details).toHaveClass('translate-x-0');
    expect(details).not.toHaveAttribute('inert');
  });

  it('keeps narrow navigation outcomes while reduced motion skips staged entry', () => {
    mockContainerWidths(1000, 680);
    const frames = mockAnimationFrames();
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /Categories/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Library Additions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));

    const details = screen.getByRole('region', { name: 'Addition Details' });
    expect(details).toHaveClass('translate-x-0');
    expect(within(details).getByRole('heading', { name: 'Mara Vale' })).toHaveFocus();
    expect(frames.pending).toBe(0);

    fireEvent.click(within(details).getByRole('button', { name: 'Back to Additions' }));
    expect(screen.getByRole('button', { name: 'Inspect Mara Vale' })).toHaveFocus();
  });

  it('keeps inspection independent from row and detail inclusion controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));

    const details = screen.getByRole('region', { name: 'Addition Details' });
    expect(within(details).getByRole('heading', { name: 'Mara Vale' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' }));
    expect(within(details).getByRole('heading', { name: 'Mara Vale' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2 dictionaries enabled')).toBeInTheDocument();

    await user.click(within(details).getByRole('checkbox', { name: 'Include Mara Vale in This Game' }));
    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeChecked();
    expect(screen.getByText('1 of 2 entities included')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inspect Traveler Notes from Library' }));
    expect(within(details).getByText('Library Dictionary')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Inspect World Atlas from World' }));
    expect(within(details).getByText('World Dictionary')).toBeInTheDocument();
  });

  it('keeps inspected details and choices while search changes presentation', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('checkbox', { name: 'Include Mara Vale' }));
    await user.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));
    const search = screen.getByRole('searchbox', { name: 'Search Library Additions' });
    await user.type(search, 'no matching addition');

    expect(screen.getByText('No entities match your search.')).toBeInTheDocument();
    expect(screen.getByText('No dictionaries match your search.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Addition Details' })).toHaveTextContent('Mara Vale');

    await user.clear(search);
    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeChecked();
  });

  it('distinguishes an empty library from empty search results', async () => {
    const user = userEvent.setup();
    const first = render(<Harness libraryEntities={[]} />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByText('No entities are available.')).toBeInTheDocument();
    expect(screen.queryByText(/match your search/i)).not.toBeInTheDocument();

    first.unmount();
    render(<Harness initialDictionaryItems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    expect(screen.getByText('No dictionaries are available.')).toBeInTheDocument();
    expect(screen.queryByText(/match your search/i)).not.toBeInTheDocument();
  });

  it('keeps a truncated row name available in full through inspection', async () => {
    const longName = 'The Cartographer Whose Complete Ceremonial Name Cannot Fit on One Library Row';
    const user = userEvent.setup();
    render(<Harness libraryEntities={[{ id: 'long-name', name: longName, description: 'The full record.' }]} />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    await user.click(screen.getByRole('button', { name: `Inspect ${longName}` }));

    expect(within(screen.getByRole('region', { name: 'Addition Details' }))
      .getByRole('heading', { name: longName })).toBeInTheDocument();
  });

  it('uses complete dictionary order for details controls and keeps disabled items in place', async () => {
    const orderedItems: DictionarySelectionItem[] = [
      dictionaryItems[0],
      { ...dictionaryItems[1], key: 'library:hidden', book: { ...dictionaryItems[1].book, id: 'hidden', name: 'Hidden Notes' } },
      { ...dictionaryItems[0], key: 'world:third', book: { ...dictionaryItems[0].book, id: 'third', name: 'Third Atlas' } },
      { ...dictionaryItems[1], key: 'library:last', book: { ...dictionaryItems[1].book, id: 'last', name: 'Last Notes' } },
    ];
    const user = userEvent.setup();
    render(<Harness initialDictionaryItems={orderedItems} />);

    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    const list = screen.getByRole('list', { name: 'Dictionary Order' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('World Atlas'),
      expect.stringContaining('Hidden Notes'),
      expect.stringContaining('Third Atlas'),
      expect.stringContaining('Last Notes'),
    ]);

    await user.click(screen.getByRole('button', { name: 'Inspect Third Atlas from World' }));
    const details = screen.getByRole('region', { name: 'Addition Details' });
    expect(within(details).getByText(/Position 3 of 4/)).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: 'Move Third Atlas from World Up' }));
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('World Atlas'),
      expect.stringContaining('Third Atlas'),
      expect.stringContaining('Hidden Notes'),
      expect.stringContaining('Last Notes'),
    ]);

    await user.click(screen.getByRole('checkbox', { name: 'Enable Hidden Notes from Library' }));
    expect(within(list).getAllByRole('listitem')[2]).toHaveTextContent('Hidden Notes');
    expect(within(details).getByText(/Position 2 of 4/)).toBeInTheDocument();
  });

  it('uses a full-width detail pane on phones and restores focus to the inspected row', async () => {
    mockPhoneViewport();
    const frames = mockAnimationFrames();
    const user = userEvent.setup();
    render(<Harness />);

    const categories = screen.getByRole('button', { name: /Categories/ });
    await user.click(categories);
    await user.click(screen.getByRole('button', { name: 'Library Additions' }));
    const opener = screen.getByRole('button', { name: 'Inspect Mara Vale' });
    await user.click(opener);
    frames.step();
    frames.step();

    expect(document.querySelector('section[aria-label="Library Additions List"]')).toHaveAttribute('inert');
    const details = screen.getByRole('region', { name: 'Addition Details' });
    expect(details).not.toHaveAttribute('inert');
    expect(within(details).getByRole('heading', { name: 'Mara Vale' })).toHaveFocus();

    await user.click(within(details).getByRole('button', { name: 'Back to Additions' }));
    expect(screen.getByRole('region', { name: 'Library Additions List' })).not.toHaveAttribute('inert');
    expect(opener).toHaveFocus();

    await user.click(opener);
    frames.step();
    frames.step();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Library Additions', hidden: true }), {
      target: { value: 'no visible opener' },
    });
    await user.click(within(details).getByRole('button', { name: 'Back to Additions' }));
    expect(screen.getByRole('searchbox', { name: 'Search Library Additions' })).toHaveFocus();
  });
});
