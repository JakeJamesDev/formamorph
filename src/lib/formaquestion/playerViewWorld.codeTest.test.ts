/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { Entity, GameLocation, GameState } from '@/types';
import { runTestCode, type StatCodeWorld } from '@/lib/statCodeTestRun';
import { buildPlayerView } from './playerView';
import { playerViewWorld, type PlayerViewReach } from './playerViewWorld';
import { oneRoutine } from '@/test/routines';

/** Morphie's Test Code in a game reads where met entities stand now, and only that (Q42). */

const LOCATIONS: GameLocation[] = [{ id: 'gate', name: 'Gate' }, { id: 'hall', name: 'Hall' }, { id: 'vault', name: 'Vault' }];
// The warden begins at the gate, so a Sample Placement would put it there.
const WARDEN: Entity = {
  id: 'warden', name: 'Warden', playerDescription: 'A guard.', kind: 'unique',
  routines: oneRoutine([{ id: 'w1', place: 'gate', weight: 1, schedule: [] }], []),
};
// The stranger hides its name and stands in the vault, so the player has never met it.
const STRANGER: Entity = { id: 'stranger', name: 'Stranger', strangerName: 'a passer-by', playerDescription: 'Someone.', locations: ['vault'] };
const WORLD: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [WARDEN, STRANGER], entityGroups: [], placeholders: [],
  placeholderGroups: [], dictionaries: [], locations: LOCATIONS,
};

/** The player met the warden, and the gate and the hall, never the vault. */
function reach(positions: Record<string, string>): PlayerViewReach {
  const current = {
    globalStats: [], globalTraits: [], disabledTraitIds: [], logEntries: [], gameplayText: '', gameTime: 0, characterData: null, choices: [],
    isGameStarted: true, timestamp: '', worldName: null, playerNotes: '', previousStateIndex: null, stateVersion: 1,
    visibleEntities: [], metEntities: ['warden'], locationId: 'gate', entityPositions: positions,
  } as GameState;
  const turn = { role: 'assistant' as const, content: JSON.stringify({ narration: 'A turn.', choices: [], stat_changes: [], turnId: 't1', locationId: 'hall' }) };
  const view = buildPlayerView({ world: { entities: [WARDEN, STRANGER], locations: LOCATIONS, traits: [] }, chain: [current], history: [turn], persona: null, resolve: (t) => t });
  return { view, current };
}

const CODE = 'return Object.values(entities).map((e) => e.name).join(",") + "|" + Object.keys(locations).map((k) => k + ":" + locations[k].present.map((e) => e.name).join("/")).join(";");';
const run = async (positions: Record<string, string>) => {
  const report = await runTestCode(CODE, 'after', { kind: 'tool' }, playerViewWorld(WORLD, reach(positions)), { args: {} });
  expect(report.error).toBeNull();
  return report.reply;
};

describe("Morphie's Test Code in a game", () => {
  it('places a met entity where it stands now', async () => {
    expect(await run({ warden: 'hall' })).toBe('Warden|Gate:;Hall:Warden');
  });

  it('places a met entity whose current place the player has not met nowhere, not at its Start', async () => {
    expect(await run({ warden: 'vault' })).toBe('Warden|Gate:;Hall:');
  });

  it('places nobody at a Start when the live places hold no one, even in a world that keeps its routines', async () => {
    const report = await runTestCode(CODE, 'after', { kind: 'tool' }, { ...WORLD, livePlaces: { positions: {}, genericPositions: {} } }, { args: {} });
    expect(report.error).toBeNull();
    // The warden's Start is the gate; the stranger has no kind, so its own list is where it is.
    expect(report.reply?.split('|')[1]).toBe('Gate:;Hall:;Vault:Stranger');
  });

  it('places a met entity with no Position nowhere, not at its Start', async () => {
    expect(await run({})).toBe('Warden|Gate:;Hall:');
  });
});
