import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePlaceholderResolver } from '@/lib/usePlaceholderResolver';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { toldActions } from '@/lib/actionList';
import { phValues } from '@/test/placeholderValues';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { World, WorldOption } from '@/types';

/** The in-game World Options tab: a change applies at once, lists hidden, and undo restores it (ticket 05). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const tone = { id: 'tone', name: 'Tone', values: phValues(['plain', 'lush']) };
const style: WorldOption = {
  id: 'o-style', name: 'Style', type: 'choice', shownToPlayer: true, midGame: true, default: 'v-plain',
  values: [
    { id: 'v-plain', name: 'Plain', placeholderPins: [{ placeholderId: 'tone', value: 'plain' }] },
    { id: 'v-lush', name: 'Lush', placeholderPins: [{ placeholderId: 'tone', value: 'lush' }] },
  ],
};
const setupOnly: WorldOption = { id: 'o-setup', name: 'Starting Season', type: 'boolean', shownToPlayer: true, midGame: false, default: false };
const secret: WorldOption = { id: 'o-secret', name: 'Secret Flag', type: 'boolean', shownToPlayer: false, midGame: true, default: false };

const worldWith = (options: WorldOption[]): World => ({ ...harborWorld(), placeholders: [tone], options }) as unknown as World;

const TOKEN = `Write ${encodePlaceholderToken({ id: 'tone', mode: 'world', placementId: 'p1' })} prose.`;
let live: ReturnType<typeof useGameplay> | null = null;
let resolved = '';
const Probe = () => {
  live = useGameplay();
  resolved = usePlaceholderResolver()(TOKEN);
  return null;
};
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const tray = () => screen.queryByRole('region', { name: 'Since Last Turn' });

async function start(options: WorldOption[]) {
  renderGameViewer(worldWith(options), { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the in-game World Options tab', () => {
  it('has no tab when no Option is shown and flagged for change during play', async () => {
    await start([setupOnly, secret]);
    expect(screen.queryByRole('tab', { name: 'World Options' })).toBeNull();
  });

  it('lists only the shown, mid-game Options', async () => {
    await start([style, setupOnly, secret]);
    gameplay().setActiveTab('options');
    const panel = await screen.findByTestId('world-options-tab');
    expect(within(panel).getByRole('radiogroup', { name: 'Style' })).toBeInTheDocument();
    expect(within(panel).queryByText('Starting Season')).toBeNull();
    expect(within(panel).queryByText('Secret Flag')).toBeNull();
  });

  it('applies a change at once: the next request reads the new pins, the entry lists hidden, undo restores it', async () => {
    await start([style]);
    expect(resolved).toBe('Write plain prose.');
    gameplay().setActiveTab('options');
    fireEvent.click(await screen.findByRole('radio', { name: 'Lush' }));
    await waitFor(() => expect(resolved).toBe('Write lush prose.'));
    expect(gameplay().worldOptionValues).toEqual({ 'o-style': 'v-lush' });
    const region = await screen.findByRole('region', { name: 'Since Last Turn' });
    expect(within(region).getByText('Style Plain → Lush')).toBeInTheDocument();
    expect(within(region).getByText('Only You')).toBeInTheDocument();
    // The narrator is told nothing of it.
    expect(toldActions(gameplay().actionList)).toEqual([]);
    fireEvent.click(within(region).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(resolved).toBe('Write plain prose.'));
    expect(gameplay().worldOptionValues).toEqual({});
    expect(tray()).toBeNull();
  });

  it('disables the controls while a turn runs', async () => {
    await start([style]);
    gameplay().setActiveTab('options');
    await screen.findByRole('radio', { name: 'Lush' });
    gameplay().setIsWaitingForAI(true);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Lush' })).toBeDisabled());
    fireEvent.click(screen.getByRole('radio', { name: 'Lush' }));
    expect(gameplay().worldOptionValues).toEqual({});
  });
});
