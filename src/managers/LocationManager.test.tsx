import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameLocation, Placeholder, Trait } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
import type { LocationPanelTab } from '@/views/locationPanelTabs';
import { phValueId, phValues } from '@/test/placeholderValues';
import LocationManager from './LocationManager';

const fen = { id: 'fen', name: 'The Fen' } as GameLocation;
// A trait pinning the same placeholder the location will: the rival the note has to name and outrank.
const sworn = {
  id: 't1', name: 'Sworn', statChanges: [],
  placeholderPins: [{ placeholderId: 'p1', value: 'Marrow' }],
} as unknown as Trait;

const WORLD: Placeholder[] = [
  { id: 'p1', name: 'Town', values: phValues(['Marrow', 'Hollow']) },
  { id: 'p2', name: 'Weather', values: phValues(['fog']) },
  // The Keeper's own: what a pin picker has to head with its owner and read back as a whole path.
  { id: 'p3', name: 'Mood', values: phValues(['sour']) },
];
const OWNERS = new Map([['p3', { kind: 'entity' as const, id: 'keeper', name: 'Keeper' }]]);

const store: { location: GameLocation; writes: GameLocation[]; rerender: () => void } =
  { location: fen, writes: [], rerender: () => {} };

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    entities: [],
    entityGroups: [],
    locations: [store.location],
    traits: [sworn],
    traitGroups: [],
    stats: [],
    placeholders: WORLD,
    placementLetters: new Map(),
    placeholderOwners: OWNERS,
    updateEntity: vi.fn(),
    updateLocation: (next: GameLocation) => {
      store.writes.push(next);
      store.location = next;
      store.rerender();
    },
  }),
}));
// The pin section is what is under test; the rest of the panel pulls in editors and pickers it has no use for.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: { value: string }) => <input readOnly value={props.value} />,
}));
vi.mock('@/components/ui/multi-select', () => ({ MultiSelect: () => null }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));
vi.mock('./LocationConnections', () => ({ default: () => null }));
vi.mock('./ImageTagsField', () => ({ default: () => null }));
vi.mock('../lib/UtilityComponents', () => ({ SoundUpload: () => null }));

/**
 * Renders the manager against the live store, re-rendering whenever it writes.
 *
 * The pins live on the panel's own Pins tab, and the editor is what holds the chosen tab in production, so
 * the harness stands in for it and opens on Pins. That is the tab under test here; the tabs themselves are
 * covered against the real editor in `WorldEditor.locationPanel.test.tsx`.
 */
const Harness = ({ initialTab = 'pins' }: { initialTab?: LocationPanelTab }) => {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<LocationPanelTab>(initialTab);
  store.rerender = () => setTick((n) => n + 1);
  return <LocationManager location={store.location} tab={tab} onTabChange={setTab} />;
};

const renderManager = (mode: 'simple' | 'advanced' = 'advanced', initialTab?: LocationPanelTab) => render(
  <EditorModeContext.Provider value={{ mode, advanced: mode === 'advanced', setMode: () => {} }}>
    <Harness initialTab={initialTab} />
  </EditorModeContext.Provider>,
);

const pinField = () => screen.getByRole('textbox', { name: 'Pinned Value' }) as HTMLInputElement;
const lastWrite = () => store.writes[store.writes.length - 1];
const lastPins = () => lastWrite().placeholderPins;

beforeEach(() => {
  store.location = { ...fen };
  store.writes = [];
});

describe('the location pin section', () => {
  it('mounts its help topic', () => {
    renderManager();
    expect(screen.getByRole('button', { name: 'About Placeholder Pins' })).toBeInTheDocument();
  });

  it('adds a pin, aims it, and writes the value onto the location by id', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder Pin' }));
    expect(lastPins()).toEqual([{ placeholderId: '', value: '' }]);
    await userEvent.click(screen.getByRole('button', { name: 'Select placeholder' }));
    await userEvent.click(screen.getByRole('button', { name: 'Weather' }));
    await userEvent.click(pinField());
    await userEvent.click(screen.getByRole('button', { name: 'fog' }));
    expect(lastPins()).toEqual([{ placeholderId: 'p2', value: 'fog', valueId: phValueId('fog') }]);
  });

  it('heads an owner’s section and reads the pick back as its whole path', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder Pin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select placeholder' }));
    // Under the Keeper's heading the row is bare; closed, the trigger has to say whose Mood it is.
    await userEvent.click(screen.getByRole('button', { name: 'Mood' }));
    const trigger = screen.getByRole('button', { name: /Mood/ });
    expect(trigger).toHaveTextContent('Keeper › Mood');
    expect(within(trigger).getByRole('img', { name: 'Entity' })).toBeInTheDocument();
  });

  it('names a trait pinning the same placeholder and says the location wins', () => {
    store.location = { ...fen, placeholderPins: [{ placeholderId: 'p1', value: 'Hollow' }] };
    renderManager();
    const note = screen.getByText(/Also pinned by/);
    expect(note.textContent).toBe(
      'Also pinned by the trait Sworn. A stat band outranks a location, a location a trait, and a trait a value pin: this location.',
    );
  });

  it('removes a pin', async () => {
    store.location = { ...fen, placeholderPins: [{ placeholderId: 'p1', value: 'Hollow' }] };
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(lastPins()).toBeUndefined();
  });

  it('shows none of it in Simple mode, pins or no pins', () => {
    store.location = { ...fen, placeholderPins: [{ placeholderId: 'p1', value: 'Hollow' }] };
    renderManager('simple');
    expect(screen.queryByText('Placeholder Pins')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Pinned Value' })).toBeNull();
  });
});

describe('the location Openings tab', () => {
  const tabNames = () => within(screen.getByRole('tablist', { name: 'Location Fields' }))
    .getAllByRole('tab').map((t) => t.textContent);
  const rows = [
    { id: 'o1', text: 'Mist lifts off the reeds.', kind: 'narration' as const },
    { id: 'o2', text: 'I wade in.', kind: 'action' as const },
  ];

  it('sits last in Advanced mode and is gone in Simple mode', () => {
    const { unmount } = renderManager('advanced');
    expect(tabNames().at(-1)).toBe('Openings');
    unmount();
    renderManager('simple');
    expect(tabNames()).not.toContain('Openings');
  });

  it('adds an opening onto the location', async () => {
    renderManager('advanced', 'openings');
    await userEvent.click(screen.getByRole('button', { name: 'Add Opening' }));
    expect(lastWrite().openings).toEqual([{ id: expect.any(String), text: '', kind: 'action' }]);
  });

  it('writes kind and weight onto the location, with chances within its own list', async () => {
    store.location = { ...fen, openings: rows, openingWeights: { o1: 3 } };
    renderManager('advanced', 'openings');
    expect(screen.getByLabelText('Chance for Opening 1')).toHaveTextContent('75%');
    expect(screen.getByLabelText('Chance for Opening 2')).toHaveTextContent('25%');

    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Opens As, Opening 2' })).getByRole('radio', { name: 'Narration' }));
    expect(lastWrite().openings).toEqual([rows[0], { ...rows[1], kind: 'narration' }]);

    const weight = screen.getByLabelText('Draw weight for Opening 2');
    await userEvent.clear(weight);
    await userEvent.type(weight, '2');
    expect(lastWrite().openingWeights).toEqual({ o1: 3, o2: 2 });
  });

  it('never offers the Others | Self switch', () => {
    store.location = { ...fen, openings: rows };
    renderManager('advanced', 'openings');
    expect(screen.getAllByTestId('opening-row')).toHaveLength(2);
    expect(screen.queryByRole('radiogroup', { name: /^Drawn For/ })).toBeNull();
  });
});
