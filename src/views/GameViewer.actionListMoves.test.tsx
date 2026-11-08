import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, GameLocation, PlayerStat, Stat, Trait, World } from '@/types';

/** Trait toggles, travel and persona switches on the Action List (ticket 04). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const calm: PlayerStat = { id: 'calm', name: 'Calm', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const grit: Stat = { id: 'grit', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value: 10, starting: 10, regen: 0, descriptors: [] };
// Its own switch script writes Calm both ways, so an undo that skipped the revert would show.
const bold: Trait = {
  id: 'bold', name: 'Bold', statChanges: [], playerToggle: true,
  scripts: [{ id: 'sw', timing: 'switch', code: 'stats.Calm.value = trait.enabled ? 80 : 20;' }],
};
const keen: Trait = { id: 'keen', name: 'Keen', statChanges: [], playerToggle: true };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, traits: [keen], stats: [grit] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, personaOnly: true, stats: [grit] };
const HARBOR = { id: 'harbor', name: 'Harbor', isStarting: true } as GameLocation;
const MARKET = { id: 'market', name: 'Market' } as GameLocation;
const world: World = { ...harborWorld({ stats: [calm], entities: [ash, mira] }), traits: [bold], locations: [HARBOR, MARKET],
  connections: [{ id: 'quay', a: 'harbor', b: 'market', aToB: {}, bToA: {} }],
};

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const calmNow = () => gameplay().globalStats.find((s) => s.id === 'calm')?.value;
const isBold = () => gameplay().globalTraits.some((t) => t.id === 'bold') && !gameplay().disabledTraitIds.includes('bold');
const tray = () => screen.queryByRole('region', { name: 'Since Last Turn' });
const rows = () => within(tray() ?? document.body).queryAllByRole('listitem').map((li) => li.textContent);
const undo = () => fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
const traySvg = (name: string) => (tray() as HTMLElement).querySelectorAll(`svg.lucide-${name}`);

async function start() {
  renderGameViewer(world, { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } }, initialOwnedTraits: { ash: ['keen'] } });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation?.id).toBe('harbor'));
}

/** The checkbox of `name` in the Traits tab's owner group `group`. */
async function traitBox(group: string, name: string) {
  gameplay().setActiveTab('traits');
  const section = await screen.findByRole('group', { name: group });
  const header = within(section).getByRole('button', { name: new RegExp(`^${group},`) });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(section).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  return within(section).findByRole('checkbox', { name: new RegExp(name) });
}
const clickTrait = async (group: string, name: string) => {
  const box = await traitBox(group, name);
  await waitFor(() => expect(box).toBeEnabled());
  fireEvent.click(box);
};

async function travelTo(name: string) {
  gameplay().setActiveTab('location');
  const open = await screen.findByRole('button', { name: /^Current Location:/ });
  await waitFor(() => expect(open).toBeEnabled());
  fireEvent.click(open);
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) }));
}

async function switchPersona(name: string) {
  const row = await screen.findByTestId('persona-row');
  const change = within(row).getByRole('button', { name: 'Change' });
  await waitFor(() => expect(change).toBeEnabled());
  fireEvent.click(change);
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('radio', { name }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Change' }));
}

beforeEach(async () => {
  await resetMoveTurnStorage();
  for (const meta of await EntityStorageService.getEntityMetadata()) await EntityStorageService.deleteEntity(meta.id);
  live = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('a trait toggle on the Action List', () => {
  it('lists with the Traits icon, and undo reverts the switch script’s write', async () => {
    await start();
    await clickTrait('Global', 'Bold');
    // The switch script still runs, so undo waits for its write.
    expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeDisabled();
    await waitFor(() => expect(calmNow()).toBe(80));
    expect(rows()).toEqual(['Turned on Bold']);
    expect(traySvg('toggle-right')).toHaveLength(1);
    await waitFor(() => expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeEnabled());
    undo();
    await waitFor(() => expect(calmNow()).toBe(50));
    expect(isBold()).toBe(false);
    expect(tray()).toBeNull();
  });

  it('leaves no entry when turned straight back, and runs no switch-off script', async () => {
    await start();
    await clickTrait('Global', 'Bold');
    await waitFor(() => expect(calmNow()).toBe(80));
    await clickTrait('Global', 'Bold');
    await waitFor(() => expect(tray()).toBeNull());
    expect(isBold()).toBe(false);
    // The switch-off script would set Calm to 20.
    await new Promise((r) => setTimeout(r, 50));
    expect(calmNow()).toBe(50);
  });

  it('names an entity owner’s trait with the owner', async () => {
    await start();
    await clickTrait('Ash', 'Keen');
    await waitFor(() => expect(rows()).toEqual(['Turned off Ash’s Keen']));
    expect(gameplay().ownedTraits.ash?.disabled ?? []).toContain('keen');
    undo();
    await waitFor(() => expect(gameplay().ownedTraits.ash?.disabled ?? []).not.toContain('keen'));
  });
});

describe('travel on the Action List', () => {
  it('lists with the Location icon, and undo returns the player', async () => {
    await start();
    await travelTo('Market');
    await waitFor(() => expect(gameplay().currentLocation?.id).toBe('market'));
    expect(rows()).toEqual(['Traveled to Market']);
    expect(traySvg('map-pin')).toHaveLength(1);
    undo();
    await waitFor(() => expect(gameplay().currentLocation?.id).toBe('harbor'));
    expect(tray()).toBeNull();
  });

  it('leaves no entry for a trip straight back', async () => {
    await start();
    await travelTo('Market');
    await waitFor(() => expect(rows()).toEqual(['Traveled to Market']));
    await travelTo('Harbor');
    await waitFor(() => expect(gameplay().currentLocation?.id).toBe('harbor'));
    expect(tray()).toBeNull();
  });

  it('lists nothing when the player accepts the AI’s move suggestion', async () => {
    localStorage.setItem('FORMAMORPH_locationAutoApply', 'false');
    await start();
    stubMoveEndpoint('The harbor smells of salt.', { narrated: 'Harbor' }, 'Harbor');
    await playTurn(gameplay, 'Begin.');
    stubMoveEndpoint('You walk up into the market.', { router: 'Market', narrated: 'Market' }, 'Harbor');
    await playTurn(gameplay, 'I walk to the market.');
    await screen.findByText(/Move to/);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(gameplay().currentLocation?.id).toBe('market'));
    expect(tray()).toBeNull();
  });
});

describe('a persona switch on the Action List', () => {
  it('lists with the persona icon, and undo restores the previous persona', async () => {
    await start();
    await switchPersona('Mira');
    await waitFor(() => expect(rows()).toEqual(['Switched persona to Mira']));
    expect(gameplay().personaRef).toEqual({ source: 'world', entityId: 'mira' });
    expect(traySvg('circle-user-round')).toHaveLength(1);
    await waitFor(() => expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeEnabled());
    undo();
    await waitFor(() => expect(gameplay().personaRef).toEqual({ source: 'world', entityId: 'ash' }));
    expect(tray()).toBeNull();
  });

  it('lists a library persona at the click, and undo restores the world persona once it settles', async () => {
    const wren: Entity = { id: 'l-wren', name: 'Wren', persona: true };
    await EntityStorageService.storeEntity({ id: wren.id, name: wren.name, data: wren });
    await start();
    await switchPersona('Wren');
    await waitFor(() => expect(rows()).toEqual(['Switched persona to Wren']));
    expect(gameplay().personaRef).toEqual({ source: 'library', entityId: 'l-wren' });
    await waitFor(() => expect(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' })).toBeEnabled());
    undo();
    await waitFor(() => expect(gameplay().personaRef).toEqual({ source: 'world', entityId: 'ash' }));
    expect(tray()).toBeNull();
  });

  it('leaves no entry for a switch straight back', async () => {
    await start();
    await switchPersona('Mira');
    await waitFor(() => expect(rows()).toEqual(['Switched persona to Mira']));
    await switchPersona('Ash');
    await waitFor(() => expect(gameplay().personaRef).toEqual({ source: 'world', entityId: 'ash' }));
    expect(tray()).toBeNull();
  });
});

describe('while a turn runs', () => {
  it('disables trait toggles, travel and the persona switch', async () => {
    await start();
    const box = await traitBox('Global', 'Bold');
    expect(box).toBeEnabled();
    // The narration never answers, so the turn stays running.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(gameplay().isWaitingForAI).toBe(true));
    expect(await traitBox('Global', 'Bold')).toBeDisabled();
    expect(within(await screen.findByTestId('persona-row')).getByRole('button', { name: 'Change' })).toBeDisabled();
    gameplay().setActiveTab('location');
    expect(await screen.findByRole('button', { name: /^Current Location:/ })).toBeDisabled();
  });
});
