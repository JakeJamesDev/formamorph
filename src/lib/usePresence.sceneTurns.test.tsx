import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { Presence } from '@/lib/presence';
import type { ChatMessage, Entity } from '@/types';

/** Presence rebuilds only when the recent scene turns change (Q6), not on every history write. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const pell: Entity = { id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor'], aiDescription: 'A lamplighter.' };

let live: ReturnType<typeof useGameplay> | null = null;
let presence: Presence | null = null;
const Probe = () => { live = useGameplay(); presence = usePresence(); return null; };
const gameplay = () => { if (!live) throw new Error('no gameplay yet'); return live; };
const seen = () => { if (!presence) throw new Error('no presence yet'); return presence; };

const turn = (id: string, participants: string[], narration = 'The tide turns.'): ChatMessage => ({
  role: 'assistant',
  content: serializeTurnContent({ narration, choices: [], stat_changes: [], turnId: id, entities: participants, locationId: 'harbor' }),
});
const said: ChatMessage = { role: 'user', content: 'Look around' };

const write = (history: ChatMessage[]) => act(() => { gameplay().setFullMessageHistory(history); });

beforeEach(async () => {
  live = null;
  presence = null;
  renderGameViewer(harborWorld({ entities: [pell] }), { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
});

describe('presence and the history', () => {
  // Four assistant turns: the oldest sits outside the three-turn scene window.
  const base = [turn('a', ['Pell']), turn('b', []), turn('c', []), turn('d', [])];

  it('stays the same object when a write leaves the recent scene turns unchanged', async () => {
    await write(base);
    const before = seen();
    await write([...base, said]);
    expect(seen()).toBe(before);
    await write([...base.slice(0, 3).map((m, i) => (i === 0 ? turn('a', ['Pell'], 'A digest landed.') : m)), base[3], said]);
    expect(seen()).toBe(before);
  });

  it('is new when a recent scene turn changes', async () => {
    await act(() => { gameplay().setEntityPositions({ pell: 'harbor' }); });
    await write(base);
    const before = seen();
    expect(before.inScene).toEqual([]);
    await write([base[0], base[1], base[2], turn('d', ['Pell'])]);
    expect(seen()).not.toBe(before);
    expect(seen().inScene.map((p) => p.entity.id)).toEqual(['pell']);
  });
});
