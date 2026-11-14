/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Entity, GameLocation, GameState, World } from '@/types';
import { chipValues } from '@/lib/chipValues/chipValues';
import { liveChipScene, type LiveSceneSources } from '@/lib/chipValues/liveScene';
import { authoredChipScene } from '@/lib/chipValues/authoredScene';
import { buildAiContext } from '@/lib/testBench/aiContext';
import { buildLens } from '@/lib/testBench/lens';
import { openingBook } from '@/lib/positionPlay';
import { resolveEntityText } from '@/lib/placeholders';
import { playerViewScene, playerViewWorld, type PlayerViewReach } from '@/lib/formaquestion/playerViewWorld';
import { runTestCode, type StatCodeWorld } from '@/lib/statCodeTestRun';
import record from './__fixtures__/entity-places-cast-record.json';
import { migrateWorld } from '@/lib/version';

/**
 * Every reader that read a Position copy gives the cast the record holds, for each
 * bundled world opened at each of its locations: play's roster chips, the authored chip scene, the Test Bench AI
 * context, and Morphie's player view (its scene and its Test Code run).
 */

const ROSTER_TOKENS = ['<ENTITIES|markdown>', '<ENTITIES|sublocations.markdown>', '<ENTITIES|reachable.summary.markdown>', '<ENTITIES|known.summary.markdown>'];

const bundled = Object.entries(import.meta.glob<World>('@/defaultworlds/*.json', { import: 'default', eager: true }))
  .map(([path, world]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), migrateWorld(structuredClone(world))] as const);

/** A name a roster rendered, or `<rolled>` for one a placeholder roll chose: each run rolls afresh. */
const ROLLED = '<rolled>';

// Each roster as the names it lists: the cast, without the text each entry carries.
type Rosters = (values: ReturnType<typeof chipValues>) => string[][];
const rostersOf = (authoredNames: ReadonlySet<string>): Rosters => (values) =>
  ROSTER_TOKENS.map((token) => [...(values(token) ?? '').matchAll(/^- \*\*(.+?)\*\*/gm)].map((m) => (authoredNames.has(m[1]) ? m[1] : ROLLED)));

/** Play at `at`: the opening book as the live standings, the cast as the game view's resolved world hands it over. */
function playRosters(world: World, at: GameLocation, rosters: Rosters): string[][] {
  const entities = world.entities ?? [];
  const locations = world.locations ?? [];
  const connections = world.connections ?? [];
  const standings = openingBook(entities, locations, connections, at.id);
  const sources: LiveSceneSources = {
    overview: '', standings, stats: [], statPlacement: { groups: [], authored: [] }, traits: [], traitGroups: [],
    resolve: (text) => text,
    resolveTrait: (_trait, text, owner) => resolveEntityText(owner ?? null, text, { placeholders: [], rolls: {} }),
    resolveEntity: (entity, text) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
    persona: null, location: at, locations, connections, entities, allEntities: entities, participants: [], notes: '', time: null,
    placeholders: [],
  };
  return rosters(chipValues(liveChipScene(sources)));
}

/** Morphie's reach at `at` after the opening: every entity met, and every other location met with `at`. */
function reachAt(world: World, at: GameLocation): PlayerViewReach {
  const locations = world.locations ?? [];
  const cast = world.entities ?? [];
  const book = openingBook(cast, locations, world.connections ?? [], at.id);
  const metPlaces = locations.filter((l, i) => l.id === at.id || i % 2 === 0);
  // The player view reads only these fields of a snapshot.
  const current = { locationId: at.id, entityPositions: book.positions, genericStates: book.generics } as unknown as GameState;
  return {
    view: {
      entities: cast.map((e: Entity) => ({ kind: 'entity' as const, id: e.id, name: e.name, description: '' })),
      locations: metPlaces.map((l) => ({ kind: 'location' as const, id: l.id, name: l.name, description: '' })),
      items: [], stats: [], traits: [],
    },
    current,
  };
}

const PRESENT_ALL = 'return Object.keys(locations).map((key) => key + ":" + locations[key].present.map((e) => e.name).join("|")).join(";");';

async function worldRecord(world: World) {
  const locations = world.locations ?? [];
  const lensWorld = { ...world, traitGroups: world.traitGroups ?? [] };
  const names = new Map([...(world.entities ?? []), ...locations].map((x) => [x.id, x.name]));
  const nameOf = (id: string) => names.get(id) ?? id;
  const rosters = rostersOf(new Set((world.entities ?? []).map((e) => e.name)));
  const out: Record<string, unknown> = {};
  for (const at of locations) {
    const authored = authoredChipScene(world, { location: at });
    const context = buildAiContext(world, buildLens(lensWorld, { personaId: null, locationId: at.id }));
    const reach = reachAt(world, at);
    const viewScene = playerViewScene(authored, reach);
    const report = await runTestCode(PRESENT_ALL, 'after', { kind: 'tool' }, playerViewWorld(world as StatCodeWorld, reach), { args: {} });
    out[at.name] = {
      play: playRosters(world, at, rosters),
      authored: { presentIds: authored.presentIds.map(nameOf), rosters: rosters(chipValues(authored)) },
      aiContext: context.rosters.map((r) => r.entities.map((e) => nameOf(e.id))),
      playerView: {
        places: Object.fromEntries(viewScene.entities.map((e) => [e.name, viewScene.placesOf(e).map(nameOf)])),
        testCode: report.error ?? report.reply,
      },
    };
  }
  return out;
}

describe.each(bundled)('the bundled world %s keeps its cast through every Position reader', (name, world) => {
  it('matches the record taken at the base', async () => {
    expect(await worldRecord(world)).toEqual((record as Record<string, unknown>)[name]);
  }, 60_000);
});
