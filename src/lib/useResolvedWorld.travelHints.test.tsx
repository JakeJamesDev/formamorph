// Real in-memory storage for saves and the entity library; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from '@/contexts/GameplayContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { buildDestinationsContext } from '@/lib/locationContext';
import { worldFixture } from '@/test/gamePanels';
import { phValues } from '@/test/placeholderValues';
import type { Connection, GameLocation, Placeholder } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
  session: ReturnType<typeof usePlaceholderSession>;
  world: ReturnType<typeof useResolvedWorld>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData(), session: usePlaceholderSession(), world: useResolvedWorld() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

const door: Placeholder = { id: 'door', name: 'Door Color', values: phValues(['red', 'green', 'blue', 'gray', 'black', 'white']) };
const lamp: Placeholder = { id: 'lamp', name: 'Lamp Fuel', values: phValues(['oil', 'gas']) };
const quay: GameLocation = { id: 'quay', name: 'Quay', isStarting: true };
// The Garden holds the lamp at gas while the player is there.
const garden: GameLocation = { id: 'garden', name: 'Garden', placeholderPins: [{ placeholderId: 'lamp', value: 'gas' }] };
const cellar: GameLocation = { id: 'cellar', name: 'Cellar' };
const doorHint = 'past the {{ph:door:unique:d1}} door';
const connections: Connection[] = [
  // Linked: both legs carry the same placement.
  { id: 'c1', a: 'quay', b: 'garden', aToB: { hint: doorHint }, bToA: { hint: doorHint } },
  { id: 'c2', a: 'garden', b: 'cellar', aToB: { hint: 'down by {{ph:lamp:world:l1}} light' }, bToA: { hint: 'up by {{ph:lamp:world:l2}} light' } },
  // The placeholder behind this chip was deleted.
  { id: 'c3', a: 'quay', b: 'cellar', aToB: { hint: 'through the {{ph:gone:world:g1}}hatch' } },
];

const start = async () => {
  const live = mount();
  await act(async () => {
    live().gameData.loadWorldData(worldFixture({ locations: [quay, garden, cellar], connections, placeholders: [door, lamp] }));
  });
  await act(async () => { live().session.beginSession({ world: { lamp: 'oil' } }); });
  return live;
};

/** The location context's destination lines from wherever the player stands. */
const destinations = (live: () => Live) => {
  const { currentLocation, locations, connections: links } = live().world;
  return buildDestinationsContext(currentLocation, locations, links);
};

const at = async (live: () => Live, location: GameLocation) => {
  await act(async () => { live().gameplay.setCurrentLocation(location); });
};

describe('Travel Hints in play', () => {
  it('reads a Unique chip in a linked hint as one value both ways, and keeps it across renders', async () => {
    const live = await start();
    await at(live, quay);
    const there = destinations(live);
    const color = /past the (\w+) door/.exec(there)?.[1];
    expect(door.values?.map((v) => v.text)).toContain(color);

    await at(live, garden);
    expect(destinations(live)).toContain(`past the ${color} door`);
    await at(live, quay);
    expect(destinations(live)).toBe(there);
  });

  it('reads a chip of a deleted placeholder as nothing', async () => {
    const live = await start();
    await at(live, quay);
    expect(destinations(live)).toContain('Cellar — via through the hatch');
  });

  it("reads the current location's pin over the roll", async () => {
    const live = await start();
    await at(live, garden);
    expect(destinations(live)).toContain('down by gas light');
    await at(live, cellar);
    expect(destinations(live)).toContain('up by oil light');
  });
});
