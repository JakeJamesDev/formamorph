// A stat a script hides or shows mid-play: the panel follows the live `hidden`, chips and all (Q20, Q34).
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderRightPanel, statFixture, type Gameplay } from '@/test/gamePanels';
import type { GameState } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const vigor = statFixture('Vigor', 50);
const rage = (hidden: boolean) => statFixture('Rage', 20, { hidden });

const stage = (hidden: boolean) => ({ stats: [vigor, rage(hidden)], seed: (g: Gameplay) => { g.setGlobalStats([vigor, rage(hidden)]); } });

describe('RightPanel — a stat a script hides or shows', () => {
  it('shows a stat unhidden this turn with this turn’s change chips and no notice', () => {
    const view = renderRightPanel({}, stage(true));
    act(() => { view.gameplay().statDeltas.show(null, { rage: 4 }); });
    expect(screen.queryByText('Rage')).not.toBeInTheDocument();
    expect(screen.queryByText('+4')).not.toBeInTheDocument();
    act(() => { view.gameplay().setGlobalStats([vigor, rage(false)]); });
    expect(screen.getByText('Rage')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('takes a stat a script hides off the panel, with its change chips', () => {
    const view = renderRightPanel({}, stage(false));
    act(() => { view.gameplay().statDeltas.show(null, { rage: 4 }); });
    expect(screen.getByText('+4')).toBeInTheDocument();
    act(() => { view.gameplay().setGlobalStats([vigor, rage(true)]); });
    expect(screen.queryByText('Rage')).not.toBeInTheDocument();
    expect(screen.queryByText('+4')).not.toBeInTheDocument();
  });

  it('restores the earlier hidden when a rollback loads the turn before the reveal', () => {
    const view = renderRightPanel({}, stage(true));
    const before: GameState = {
      globalStats: [vigor, rage(true)], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
      characterData: null, choices: [], isGameStarted: true, timestamp: new Date().toISOString(), worldName: null,
      playerNotes: '', previousStateIndex: null, stateVersion: 2,
    };
    act(() => { view.gameplay().setGlobalStats([vigor, rage(false)]); });
    expect(screen.getByText('Rage')).toBeInTheDocument();
    act(() => { view.gameplay().loadGameState(before, [], { keepLiveHistory: true, worldStats: [vigor, rage(false)] }); });
    expect(view.gameplay().globalStats.find((s) => s.id === 'rage')?.hidden).toBe(true);
    expect(screen.queryByText('Rage')).not.toBeInTheDocument();
  });
});
