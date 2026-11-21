import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { isDaylight, type WeatherChange } from '@/lib/weather';
import type { PlayerStat, Script, Trait, World } from '@/types';

/** A weather set from a script that runs between turns lands on the latest turn. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const lever: Trait = { id: 'lever', name: 'Lever', statChanges: [], playerToggle: true };
/** `spin` loops that many times first (about 17 ms per million), so the run is still going when a turn starts. */
const setting = (kind: string, spin = 0): Script => ({
  id: 'set', timing: 'switch', code: `for (let i = 0; i < ${spin}; i += 1) {}
if (trait.enabled) world.weather = ${JSON.stringify(kind)};`,
});

const world = (kind: string, defaultTime?: 'night' | 'morning', spin = 0): World => {
  const base = harborWorld({ stats: [vigor] });
  return {
    ...base,
    worldOverview: { ...base.worldOverview, weather: { on: true, allowed: ['rain', 'storm', 'brightSun'], defaultWeather: 'rain' }, ...(defaultTime && { defaultTime }) },
    traits: [lever], scripts: [setting(kind, spin)],
  } as World;
};

let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  return null;
}
const live = () => {
  if (!play) throw new Error('no gameplay yet');
  return play;
};
const latestSnapshot = () => live().gameStates.at(-1);
const reported = () => (window as unknown as { __fmDev: { weatherChange: () => { change: WeatherChange | null } | null } }).__fmDev.weatherChange()?.change ?? null;

/** Holds the narration stream until `release` runs, so a turn stays in flight. */
function stubEndpoint(gate?: Promise<void>) {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
      .find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    if (system.includes('You track the weather')) return sseResponse(sseReply('rain'));
    await gate;
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
}

async function sendAction(gate?: Promise<void>) {
  stubEndpoint(gate);
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}
const playTurn = async () => {
  await sendAction();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
};

async function leverBox() {
  live().setActiveTab('traits');
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  return within(global).findByRole('checkbox', { name: /Lever/ });
}
async function clickLever() {
  fireEvent.click(await leverBox());
}

beforeEach(async () => {
  play = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => vi.restoreAllMocks());

describe('a between-turn weather set', () => {
  it('changes the World Weather, records it on the latest turn and reports a foreground change', async () => {
    renderGameViewer(world('storm', 'morning'), { inGameplay: <Probe /> });
    await playTurn();
    expect(live().weather).toBe('rain');
    await clickLever();
    await waitFor(() => expect(live().weather).toBe('storm'));
    expect(latestSnapshot()?.weather).toBe('storm');
    expect(reported()).toEqual({ from: 'rain', to: 'storm', foreground: true });
  });

  it('turns Bright Sun into Clear at night, with no foreground', async () => {
    renderGameViewer(world('brightSun', 'night'), { inGameplay: <Probe /> });
    await playTurn();
    expect(isDaylight(live().gameTime, live().calendar)).toBe(false);
    await clickLever();
    await waitFor(() => expect(live().weather).toBe('clear'));
    expect(latestSnapshot()?.weather).toBeUndefined();
    expect(reported()?.foreground).toBe(false);
  });

  it('is held while a turn runs and lands once the turn commits', async () => {
    renderGameViewer(world('storm', 'morning', 2e7), { inGameplay: <Probe /> });
    await playTurn();
    const box = await leverBox();
    let release = () => {};
    // The switch run is async and the panel locks its toggles once a turn runs, so the click and the send go together.
    stubEndpoint(new Promise<void>((resolve) => { release = resolve; }));
    fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
    const send = screen.getByRole('button', { name: 'Send' });
    fireEvent.click(box);
    fireEvent.click(send);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(live().weather).toBe('rain');
    release();
    await waitFor(() => expect(live().weather).toBe('storm'));
    expect(live().fullMessageHistory).toHaveLength(4);
    expect(latestSnapshot()?.weather).toBe('storm');
  });
});
