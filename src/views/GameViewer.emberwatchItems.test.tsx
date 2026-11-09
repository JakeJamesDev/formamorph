import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import raw from '@/defaultworlds/emberwatch.json?raw';
import { renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { balanceOf } from '@/lib/currency';
import { migrateWorld } from '@/lib/version';
import { resolveOwners } from '@/lib/owners';
import { settleDefaults, switchTrait } from '@/lib/traitGates';
import type { SlotOwner } from '@/lib/bodies';
import type { Entity, PersonaRef, World } from '@/types';

/** Emberwatch's purses on a mounted new game: Placements seed them, and class and race scripts add at game start. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const world: World = migrateWorld(JSON.parse(raw));
const entityId = (name: string) => world.entities.find((entity) => entity.name === name)!.id;
const traitId = (name: string) => world.traits.find((trait) => trait.name === name)!.id;
const asEntity = (name: string): PersonaRef => ({ source: 'world', entityId: entityId(name) });
const NONE: PersonaRef = { source: 'none' };
const money = world.currencies![0];
const YOU: SlotOwner = { kind: 'you' };

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const balance = (owner: SlotOwner) => {
  if (!live) throw new Error('no gameplay yet');
  return balanceOf(money, owner, { copies: live.itemCopies, placements: world.placements ?? [], globalStats: [], statsOf: () => [] });
};

/** Every owner's picks at setup, as Enter World gives them: their defaults under `persona`, with each named
 *  trait switched on for the Custom Persona. */
function setupPicks(persona: PersonaRef, ...names: string[]): Record<string, string[]> {
  const { gate } = resolveOwners({ traits: world.traits, traitGroups: world.traitGroups ?? [], entities: world.entities }, persona);
  const wanderer = entityId('Wanderer');
  let state = settleDefaults(gate);
  for (const name of names) {
    const id = traitId(name);
    if (state.active.owners[wanderer]?.includes(id)) continue;
    const next = switchTrait({ ...gate, active: state.active }, wanderer, id, state.cascadeOff);
    if (!next) throw new Error(`${name} would not switch on`);
    state = next;
  }
  return state.active.owners;
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

/** Enter Emberwatch as a new game and play the opening turn to its end, against an endpoint that moves nothing. */
async function playOpening(options: Parameters<typeof renderGameViewer>[1], played: World = world) {
  renderGameViewer(played, { inGameplay: <Probe />, ...options });
  const box = await screen.findByPlaceholderText<HTMLTextAreaElement>(/Type your action/);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.body
    ? sseResponse(sseReply('The gate yard is quiet.'))
    : new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  // The world's readme opens on entry, and the player closes it to reach the box.
  fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
  if (!box.value) fireEvent.change(box, { target: { value: 'I walk in under the arch.' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Narration' })).toBeEnabled(), { timeout: 30_000 });
}

describe('a new game of Emberwatch', () => {
  it('as non-Rogue Albus: gives only the Rogue in the cast the extra items, tracks purses and not an empty shopkeeper, and shows the balance in the Inventory tab', async () => {
    await playOpening({ initialPersona: { ref: asEntity('Albus') }, initialOwnedTraits: setupPicks(asEntity('Albus')) });
    expect(balance({ kind: 'entity', id: entityId('Sylvie Thornwhistle') })).toEqual({ tracked: true, amount: 500 });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 300 });
    // No bonus runs for a Custom Persona nobody picked.
    expect(balance({ kind: 'entity', id: entityId('Wanderer') })).toEqual({ tracked: true, amount: 0 });
    // Jory Pike is tracked by his purse; a shopkeeper with no items placed stays untracked.
    expect(balance({ kind: 'entity', id: entityId('Jory Pike') })).toEqual({ tracked: true, amount: 3250 });
    expect(balance({ kind: 'entity', id: entityId('Bram Oakes') })).toEqual({ tracked: false });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Inventory' }));
    expect(within(await screen.findByRole('list', { name: 'Money' })).getByText('3 Gold')).toBeInTheDocument();
  }, 60_000);

  it('gives the bonus once when the player regenerates the opening', async () => {
    await playOpening({ initialPersona: { ref: asEntity('Sylvie Thornwhistle') }, initialOwnedTraits: setupPicks(asEntity('Sylvie Thornwhistle')) });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 500 });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' }));
    const box = screen.getByPlaceholderText<HTMLTextAreaElement>(/Type your action/);
    await waitFor(() => expect(box).not.toHaveValue(''));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Narration' })).toBeEnabled(), { timeout: 30_000 });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 500 });
  }, 60_000);

  it("lands the Custom Persona's purse and bonus on a library persona", async () => {
    const wren: Entity = { id: 'library-wren', name: 'Wren', persona: true };
    await playOpening({
      initialPersona: { ref: { source: 'library', entityId: wren.id }, libraryEntity: wren },
      initialOwnedTraits: setupPicks(NONE, 'Human', 'Rogue'),
    });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 500 });
  }, 60_000);

  it('pays a library persona what a script pays the Custom Persona owner', async () => {
    const wren: Entity = { id: 'library-wren', name: 'Wren', persona: true };
    const rogueCode = 'currencies.Coin.pay(null, owner, 200);';
    const paying: World = {
      ...world,
      traits: world.traits.map((trait) => (trait.name === 'Rogue'
        ? { ...trait, scripts: [{ id: 'rogue-pay', timing: 'start' as const, code: rogueCode }] } : trait)),
    };
    await playOpening({
      initialPersona: { ref: { source: 'library', entityId: wren.id }, libraryEntity: wren },
      initialOwnedTraits: setupPicks(NONE, 'Human', 'Rogue'),
    }, paying);
    expect(balance(YOU)).toEqual({ tracked: true, amount: 500 });
    expect(balance({ kind: 'entity', id: entityId('Wanderer') })).toEqual({ tracked: true, amount: 0 });
  }, 60_000);

  it('gives a Custom Persona no extra items for a Human Paladin build', async () => {
    await playOpening({ initialPersona: { ref: NONE }, initialOwnedTraits: setupPicks(NONE, 'Human', 'Paladin') });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 300 });
  }, 60_000);

  it('gives a Custom Persona both bonuses for a Halfling Rogue build', async () => {
    await playOpening({ initialPersona: { ref: NONE }, initialOwnedTraits: setupPicks(NONE, 'Halfling', 'Rogue') });
    expect(balance(YOU)).toEqual({ tracked: true, amount: 550 });
  }, 60_000);
});
