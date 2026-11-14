import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn as playOneTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { storyMinute } from '@/lib/gameClock';
import type { Entity, GameLocation, World } from '@/types';
import { oneRoutine } from '@/test/routines';

/** Routines in play on a mounted game: who moves while the player is elsewhere, and who stays while the player is there. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const VILLAGE = { id: 'village', name: 'Village' } as GameLocation;
const HUT = { id: 'hut', name: 'Hut', parentId: 'village' } as GameLocation;
const WELL = { id: 'well', name: 'Well', parentId: 'village' } as GameLocation;
// Tess starts at the well and wanders between the well and the hut, an hour at each: one turn's time.
const TESS: Entity = {
  id: 'tess', name: 'Tess', kind: 'unique', locations: ['well', 'hut'],
  routines: oneRoutine([{ id: 'start', place: 'well', weight: 1, schedule: [{
    id: 'rounds', time: 'allDay', action: { kind: 'wander', places: [{ place: 'well', weight: 1 }, { place: 'hut', weight: 1 }], idle: 60 },
  }] }]),
};

const worldStartingAt = (start: string): World => ({
  ...harborWorld({ entities: [TESS] }),
  locations: [VILLAGE, HUT, WELL].map((l) => ({ ...l, ...(l.id === start && { isStarting: true }) })),
} as unknown as World);

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

beforeEach(resetMoveTurnStorage);

const playTurn = (action: string) => playOneTurn(() => play, action);
/** Plays one quiet turn at `at`: an hour passes and nobody is moved by the story. */
const quietTurn = async (at: string) => {
  stubMoveEndpoint('Time passes quietly.', { router: 'NONE', narrated: at }, at);
  await playTurn('I wait.');
};

describe('a character on a Wander row', () => {
  it('moves between its places while the player is elsewhere', async () => {
    renderGameViewer(worldStartingAt('village'), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await quietTurn('Village');
    const seen = [play.entityPositions.tess];
    for (let turn = 0; turn < 3; turn++) {
      await quietTurn('Village');
      seen.push(play.entityPositions.tess);
      // The engine placed her for the clock the turn ended on, not the one it began on.
      expect(play.uniqueStates.tess.lastRun).toBe(storyMinute(play.gameTime, play.calendar));
    }
    expect(play.currentLocation?.id).toBe('village');
    // Each hour her idle runs out, and with two places she always goes to the other one.
    expect(new Set(seen)).toEqual(new Set(['well', 'hut']));
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
  });

  it('stays where the player is with her', async () => {
    renderGameViewer(worldStartingAt('well'), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(play.entityPositions.tess).toBe('well'));
    for (let turn = 0; turn < 4; turn++) {
      await quietTurn('Well');
      expect(play.currentLocation?.id).toBe('well');
      expect(play.entityPositions.tess).toBe('well');
    }
    expect(play.uniqueStates.tess.startId).toBe('start');
  });
});
