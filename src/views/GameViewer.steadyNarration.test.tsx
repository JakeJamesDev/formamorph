import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { oneRoutine } from '@/test/routines';
import { useGameplay } from '@/contexts/GameplayContext';
import { narrationHash } from '@/lib/coref/mentionReadings';
import { buildPlayerView, buildPlayerViewEntities } from '@/lib/formaquestion/playerView';
import { parseTurnContent } from '@/lib/turnDigest';
import type { Entity } from '@/types';

/**
 * With Character Mentions on, the narration renderer keeps its DOM through a turn: streamed choices and history
 * writes leave the speaker colors equal, so nothing remounts it. A new speaker the player can name repaints once.
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
// Counted, not replaced: every Player View build the game runs still runs.
vi.mock('@/lib/formaquestion/playerView', async (original) => {
  const real = await original<typeof import('@/lib/formaquestion/playerView')>();
  return { ...real, buildPlayerView: vi.fn(real.buildPlayerView), buildPlayerViewEntities: vi.fn(real.buildPlayerViewEntities) };
});
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const unique = (id: string, name: string, more: Partial<Entity> = {}): Entity => ({
  id, name, kind: 'unique', locations: ['harbor'], knownIn: ['harbor'],
  routines: oneRoutine([{ id: `${id}-start`, place: 'harbor', weight: 1, schedule: [] }]), ...more,
});
// Wren hides her name behind a blank Stranger Name, so the player cannot name her until they meet her.
const world = harborWorld({ entities: [unique('mira', 'Mira'), unique('wren', 'Wren', { strangerName: '' })] });

const FIRST = '"Welcome to the harbor,"';
const SECOND = '"Mind the ropes."';
const NARRATION = `Mira smiles. ${FIRST} she says. Someone behind her mutters, ${SECOND}`;

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};

/** How many times the game built the Player View or its entity rows. */
const builds = () => vi.mocked(buildPlayerView).mock.calls.length + vi.mocked(buildPlayerViewEntities).mock.calls.length;

/** The paragraph the narration renderer drew the turn into. */
const narrationNode = () => [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('Welcome to the harbor'));
/** The speaker the renderer colored the quote holding `text` for, or empty when it has no color. */
const quoteColor = (text: string) => {
  const holder = [...(narrationNode()?.querySelectorAll<HTMLElement>('[data-speaker]') ?? [])].find((el) => el.textContent?.includes(text));
  return holder?.dataset.speaker ?? '';
};

/** Plays one turn and gives it a reading: the first quote is Mira's, the second Wren's. */
async function playReadTurn() {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubMoveEndpoint(NARRATION, {}, 'NONE');
  await playTurn(gameplay, 'Look around');
  const turn = gameplay().fullMessageHistory.flatMap((m) => (m.role === 'assistant' ? [parseTurnContent(m.content)] : [])).at(-1);
  const narration = turn?.narration ?? '';
  const turnId = turn?.turnId ?? '';
  expect(narration).toContain('Welcome to the harbor');
  const span = (quote: string) => ({ start: narration.indexOf(quote), end: narration.indexOf(quote) + quote.length });
  act(() => {
    gameplay().setMentionReadings({
      [turnId]: {
        model: 'small', version: 1, textHash: narrationHash(narration),
        reading: { mentions: [], quotes: [{ ...span(FIRST), speaker: 'mira' }, { ...span(SECOND), speaker: 'wren' }] },
      },
    });
  });
  await waitFor(() => expect(quoteColor('Welcome to the harbor')).not.toBe(''));
  return turnId;
}

describe('steady narration with Character Mentions on', () => {
  beforeEach(async () => {
    await resetMoveTurnStorage();
    localStorage.setItem('FORMAMORPH_characterMentions', 'true');
    live = null;
  });

  it('keeps the narration node through streamed choices and a history write, and repaints once for a new speaker', async () => {
    const turnId = await playReadTurn();
    const node = narrationNode();
    expect(node).toBeDefined();
    expect(quoteColor('Mind the ropes')).toBe('');
    const buildsBefore = builds();

    // The choices stream in, one line at a time.
    for (const lines of [['Wave'], ['Wave', 'Ask about the ship'], ['Wave', 'Ask about the ship', 'Leave']]) {
      act(() => { gameplay().setChoices(lines); });
    }
    expect(narrationNode()).toBe(node);
    expect(builds()).toBe(buildsBefore);

    // A background pass writes the turn's summary: the history changes, no entity state does.
    act(() => {
      gameplay().setFullMessageHistory((history) => history.map((m) => {
        const turn = m.role === 'assistant' ? parseTurnContent(m.content) : null;
        return turn?.turnId === turnId ? { ...m, content: JSON.stringify({ ...turn, summary: 'Mira greets the player.' }) } : m;
      }));
    });
    expect(gameplay().fullMessageHistory.some((m) => parseTurnContent(m.content)?.summary === 'Mira greets the player.')).toBe(true);
    expect(narrationNode()).toBe(node);
    expect(builds()).toBe(buildsBefore);

    // Wren becomes someone the player can name: the speaker colors gain her, through one fresh mount.
    let unmounts = 0;
    const removals = new MutationObserver((records) => {
      for (const { removedNodes } of records) {
        for (const removed of removedNodes) if (removed.textContent?.includes('Welcome to the harbor')) unmounts += 1;
      }
    });
    removals.observe(document.body, { childList: true, subtree: true });
    act(() => { gameplay().setMetEntities((met) => [...met, 'wren']); });
    await waitFor(() => expect(narrationNode()).not.toBe(node));
    const repainted = narrationNode();
    expect(repainted).toBeDefined();
    act(() => { gameplay().setChoices(['Wave']); });
    expect(narrationNode()).toBe(repainted);
    await waitFor(() => expect(unmounts).toBeGreaterThan(0));
    removals.disconnect();
    expect(unmounts).toBe(1);
  });
});
