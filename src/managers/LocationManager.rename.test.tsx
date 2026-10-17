import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameLocation, Script, Tool } from '@/types';
import { CodeRenameProvider } from '@/components/editor/CodeRenameOffer';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import LocationManager from './LocationManager';

/**
 * The panel's own wiring to the rename offer: a location's name field has to hand the offer its rename when the
 * author commits it. Whether the offer then rewrites correctly is covered beside the offer.
 */

const store: { location: GameLocation; worldScripts: Script[]; worldTools: Tool[]; rerender: () => void } = {
  location: { id: 'inn', name: 'Inn' } as GameLocation, worldScripts: [], worldTools: [], rerender: () => {},
};

vi.mock('@/contexts/GameDataContext', () => {
  const world = () => ({
    entities: [], entityGroups: [], traits: [], traitGroups: [], stats: [], statGroups: [], placeholders: [],
    placementLetters: new Map(), placeholderOwners: new Map(),
    locations: [store.location], worldScripts: store.worldScripts, worldTools: store.worldTools,
    updateEntity: vi.fn(),
    updateLocation: (next: GameLocation) => {
      store.location = next;
      store.rerender();
    },
    setWorldTools: (next: Tool[]) => {
      store.worldTools = next;
      store.rerender();
    },
    setWorldScripts: (next: Script[]) => {
      store.worldScripts = next;
      store.rerender();
    },
  });
  // Both readers of the one context, as the real module has.
  return { useGameData: world, useGameDataOptional: world };
});

// The real name field is a Lexical editor; a plain input over the same value and the same commit handlers
// is what this test drives.
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: (props: { label: string; value: string }) => <input readOnly aria-label={props.label} value={props.value} />,
  PlaceholderNameField: (props: {
    value: string; ariaLabel: string; onChange: (next: string) => void; onFocus?: () => void; onBlur?: () => void;
  }) => (
    <input
      aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)}
      onFocus={props.onFocus} onBlur={props.onBlur}
    />
  ),
}));
vi.mock('@/components/ui/multi-select', () => ({ MultiSelect: () => null }));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));
vi.mock('./LocationConnections', () => ({ default: () => null }));
vi.mock('./ImageTagsField', () => ({ default: () => null }));
vi.mock('../lib/UtilityComponents', () => ({ SoundUpload: () => null }));

const Harness = () => {
  const [, setTick] = useState(0);
  store.rerender = () => setTick((n) => n + 1);
  return (
    <CodeRenameProvider>
      <LocationManager location={store.location} tab="details" onTabChange={() => {}} />
      <button type="button">elsewhere</button>
    </CodeRenameProvider>
  );
};

beforeEach(() => {
  store.location = { id: 'inn', name: 'Inn' } as GameLocation;
  store.worldScripts = [{ id: 'w', timing: 'after', code: 'location.move("Inn");' }];
  store.worldTools = [scriptWorldTool('t', 'travel', 'location.move("Inn");')];
});

describe('the location panel’s rename offer', () => {
  it('asks about the new name when the author commits it, and rewrites every location.move on Yes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('Name');
    await user.click(field);
    await user.clear(field);
    await user.paste('Harbor Steps');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.getByText(/The code of 1 world script and 1 World Tool names the location “Inn” 2 times\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update Code' }));
    expect(store.worldScripts[0].code).toBe('location.move("Harbor Steps");');
    expect(store.worldTools[0]).toEqual(scriptWorldTool('t', 'travel', 'location.move("Harbor Steps");'));
  });

  it('asks nothing while the name is still being typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'X');
    expect(screen.queryByText(/names the location/)).toBeNull();
  });
});
