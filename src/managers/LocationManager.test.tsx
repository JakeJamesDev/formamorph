import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameLocation, Placeholder, Trait } from '@/types';
import { EditorModeContext } from '@/lib/editorMode';
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
];

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
    placeholderOwners: new Map(),
    updateEntity: vi.fn(),
    updateLocation: (next: GameLocation) => {
      store.writes.push(next);
      store.location = next;
      store.rerender();
    },
  }),
}));
// Radix Select never opens its listbox in jsdom, so the placeholder picker stands in as a native select.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: {
    value: string; onValueChange: (v: string) => void; children: React.ReactNode;
  }) => (
    <select aria-label="Select placeholder" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
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

/** Renders the manager against the live store, re-rendering whenever it writes. */
const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return <LocationManager location={store.location} />;
};

const renderManager = (mode: 'simple' | 'advanced' = 'advanced') => render(
  <EditorModeContext.Provider value={{ mode, advanced: mode === 'advanced', setMode: () => {} }}>
    <Harness />
  </EditorModeContext.Provider>,
);

const pinField = () => screen.getByRole('textbox', { name: 'Pinned Value' }) as HTMLInputElement;
const lastPins = () => store.writes[store.writes.length - 1].placeholderPins;

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
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Select placeholder' }), 'p2');
    await userEvent.click(pinField());
    await userEvent.click(screen.getByRole('button', { name: 'fog' }));
    expect(lastPins()).toEqual([{ placeholderId: 'p2', value: 'fog', valueId: phValueId('fog') }]);
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
