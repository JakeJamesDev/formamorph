// A stored save loads with every entity where it stood. Storage is real (in-memory). Must be imported before anything
// touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import raw from '@/defaultworlds/rampage.json?raw';
import savedRecord from '@/lib/__fixtures__/rampage-positions-save.json';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { idsAt, positionsIn, type PlacesOf } from '@/lib/entityPlaces';
import { castRoutines } from '@/lib/entityKind';
import { storyMinute } from '@/lib/gameClock';
import { openingPool } from '@/lib/openings';
import { openingPlacesOf, placementOf } from '@/lib/openingPlacement';
import { EMPTY_BOOK } from '@/lib/positionEngine';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { runtimePositions } from '@/lib/entityFollowing';
import { discoveredAsEntities } from '@/lib/runtimeCharacters';
import type { Connection, Entity, GameLocation, SaveRecord, WorldOverview } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

const Expose = ({ expose }: { expose: (g: Gameplay) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let gameplay: Gameplay | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { gameplay = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!gameplay) throw new Error('gameplay context not available (did the render throw?)');
    return gameplay as Gameplay;
  };
};

const world = JSON.parse(raw) as { entities: Entity[]; locations: GameLocation[]; connections: Connection[] };
const record = savedRecord as unknown as SaveRecord;

describe('a stored save under Entity Places', () => {
  it('loads with everyone where the stored list copy put them, at every location', async () => {
    const stored = record.currentState;
    const discovered = stored.discoveredEntities ?? [];
    const cast = [...world.entities, ...discoveredAsEntities(discovered)];
    // The oracle: the cast where the stored positions put it.
    const standingsBefore = { positions: { ...runtimePositions(discovered), ...(stored.entityPositions ?? {}) }, generics: stored.genericStates ?? {} };
    const before = world.locations.map((l) => idsAt(l.id, cast, positionsIn(standingsBefore)));

    const live = mount();
    await putSaveRecord(record);
    await act(async () => { await live().loadGame(record.id, world.locations, [], world.entities, undefined, undefined, undefined, world.connections); });
    const loaded = live();
    const castAfter = [...world.entities, ...discoveredAsEntities(loaded.discoveredEntities)];
    const placesOf = positionsIn({
      positions: { ...runtimePositions(loaded.discoveredEntities), ...loaded.entityPositions }, generics: loaded.genericStates,
    });
    const after = world.locations.map((l) => idsAt(l.id, castAfter, placesOf));

    expect(after).toEqual(before);
    expect(after.flat().length).toBeGreaterThan(world.entities.length / 2);
  });
});

describe('a runtime character through a save and a load (Q41)', () => {
  const PLACES: GameLocation[] = [{ id: 'dock', name: 'Dock', isStarting: true }, { id: 'inn', name: 'Inn' }];
  const LINKS: Connection[] = [{ id: 'lane', a: 'dock', b: 'inn', aToB: {}, bToA: {} }];
  const met = { entity: { id: 'sailor', name: 'Sailor', aiDescription: 'A sailor.' }, locationId: 'inn', sourceTurnId: 'initial' };

  it('keeps the saved record as it was, with no list of places, and stands where its anchor is', async () => {
    const live = mount();
    await act(async () => { live().setDiscoveredEntities([met]); });
    await act(async () => { await live().saveGame('slot', 'Harbor', 'w', 'save-runtime'); });
    const stored = await getSaveRecord('save-runtime') as SaveRecord;
    expect(stored.currentState.discoveredEntities).toEqual([met]);

    await act(async () => { live().setDiscoveredEntities([]); });
    await act(async () => { await live().loadGame('save-runtime', PLACES, [], [], undefined, undefined, undefined, LINKS); });
    const loaded = live().discoveredEntities;
    expect(loaded).toEqual([met]);
    const cast = discoveredAsEntities(loaded);
    expect(cast.map((e) => 'locations' in e)).toEqual([false]);
    const placesOf = positionsIn({ positions: { ...runtimePositions(loaded), ...live().entityPositions }, generics: live().genericStates });
    expect(PLACES.map((l) => idsAt(l.id, cast, placesOf))).toEqual([[], ['sailor']]);
  });
});

describe('the opening placement in the save (Q24)', () => {
  const dock: GameLocation = { id: 'dock', name: 'Dock', isStarting: true };
  const inn: GameLocation = { id: 'inn', name: 'Inn' };
  const PLACES = [dock, inn];
  const LINKS: Connection[] = [{ id: 'lane', a: 'dock', b: 'inn', aToB: {}, bToA: {} }];
  // Two Starts: the Sample Placement takes the inn, and a roll at the top of the range takes the dock.
  const ferryman: Entity = {
    id: 'ferryman', name: 'Ferryman', kind: 'unique', traversable: 'anywhere',
    starts: [{ id: 'at-inn', place: 'inn', weight: 1, schedule: [] }, { id: 'at-dock', place: 'dock', weight: 1, schedule: [] }],
    openings: [{ id: 'ferry-hello', text: 'The ferryman nods.', kind: 'action' }],
  };
  const cast = [ferryman];
  const overview = { name: 'Harbor', description: '' } as WorldOverview;
  const owners = (placesOf: PlacesOf, start = 'dock') =>
    openingPool({ overview, entities: cast, locations: PLACES, startingLocationId: start, placesOf }).map((row) => row.ownerId);
  const world = { locations: PLACES, connections: LINKS };

  it('keeps the rolled cast across a save, so a redraw after the ferryman walked off draws him still', async () => {
    const live = mount();
    const rolled = placeAll(EMPTY_BOOK, positionWorld(castRoutines(cast), storyMinute(0), 'dock', PLACES, LINKS, () => 0.99, 'dock'));
    expect(rolled.positions.ferryman).toBe('dock');
    await act(async () => {
      live().setOpeningPlacement(placementOf(rolled));
      live().setEntityPositions({ ferryman: 'inn' });
    });
    await act(async () => { await live().saveGame('slot', 'Harbor', 'w', 'save-opening'); });
    await act(async () => { live().setOpeningPlacement(undefined); });
    await act(async () => { await live().loadGame('save-opening', PLACES, [], cast, undefined, undefined, undefined, LINKS); });

    expect(live().openingPlacement).toEqual(placementOf(rolled));
    expect(owners(openingPlacesOf(live().openingPlacement, cast, world, 'dock'))).toEqual(['ferryman']);
    // Where he stands now leaves him out of the dock's pool.
    expect(owners(positionsIn({ positions: live().entityPositions, generics: {} }))).toEqual([]);
  });

  it('loads a save without the field, whose redraw reads the Sample Placement at the page-one start', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'Harbor', 'w', 'save-before'); });
    const record = await getSaveRecord('save-before') as SaveRecord;
    expect('openingPlacement' in record.currentState).toBe(false);
    await act(async () => { live().setOpeningPlacement({ positions: { ferryman: 'dock' }, genericPlaces: {} }); });
    await act(async () => { await live().loadGame('save-before', PLACES, [], cast, undefined, undefined, undefined, LINKS); });

    expect(live().openingPlacement).toBeUndefined();
    // The Sample Placement takes the first Start, at the inn.
    expect(owners(openingPlacesOf(live().openingPlacement, cast, world, 'dock'), 'dock')).toEqual([]);
    expect(owners(openingPlacesOf(live().openingPlacement, cast, world, 'inn'), 'inn')).toEqual(['ferryman']);
  });
});
