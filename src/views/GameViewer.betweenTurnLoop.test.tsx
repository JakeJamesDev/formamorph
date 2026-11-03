import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { ITEM_RUN_TOTAL, SWITCH_RUN_TOTAL } from '@/lib/statCodeTurn';
import type { Entity, Item, PlayerStat, Script, Trait, World } from '@/types';

/** A trait granted by an item, whose switch script takes or gives that item, flips between turns. One action's totals span every pass it starts. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100000, value: 0, regen: 0, descriptors: [] });
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: [], ...over });
const script = (id: string, timing: Script['timing'], code: string): Script => ({ id, timing, code });
const toggle = (id: string, name: string): Trait => ({ id, name, statChanges: [], playerToggle: true });

const sworn: Trait = { id: 'sworn', name: 'Sworn', statChanges: [] };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, traits: [sworn] };
const charm = (over: Partial<Item> = {}) => item('charm', 'Charm', { traitEffects: [{ id: 'grant', traitId: 'sworn', timing: 'owned' }], ...over });

/** Lever gives the Charm, the Charm grants Sworn, and Sworn's switch-on takes the Charm back, which switches Sworn off,
 *  which gives it again. The brake sits past the total: an unguarded loop never yields, and would hang the test run. */
const flipping = script('flip', 'switch', `
  stats.Runs.value += 1;
  if (stats.Runs.value < ${SWITCH_RUN_TOTAL * 3}) {
    if (trait.name === 'Lever' && trait.enabled) items.Charm.give(persona);
    if (trait.name === 'Sworn' && trait.enabled) persona.items.find((copy) => copy.item === 'Charm').lose();
    if (trait.name === 'Sworn' && !trait.enabled) items.Charm.give(persona);
  }
`);

const world = (scripts: Script[], over: Partial<World> = {}): World => ({
  ...harborWorld({ stats: [stat('runs', 'Runs')], entities: [ash] }),
  items: [charm()], traits: [toggle('lever', 'Lever'), toggle('other', 'Other')], scripts, ...over,
});

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const statNow = (id: string) => gameplay().globalStats.find((s) => s.id === id)?.value ?? 0;
const charms = () => gameplay().itemCopies.filter((copy) => copy.item.kind === 'item' && copy.item.itemId === 'charm');
const swornOn = () => !!gameplay().ownedTraits.ash?.granted?.includes('sworn');

async function clickTrait(name: string) {
  gameplay().setActiveTab('traits');
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: new RegExp(name) }));
}

/** Waits until Runs holds still for a while; a run past `limit` fails at once, so a loop that never ends fails too. */
async function runsWhenQuiet(limit: number): Promise<number> {
  let last = -1;
  let stillSince = Date.now();
  while (Date.now() - stillSince < 800) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
    const now = statNow('runs');
    if (now > limit) throw new Error(`${now} switch runs from one action; the limit is ${limit}`);
    if (now !== last) stillSince = Date.now();
    last = now;
  }
  return last;
}

const totalWarnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.filter(([line]) => String(line).includes(`fired ${SWITCH_RUN_TOTAL} runs`)).length;

async function mountGame(played: World, initialTraits?: string[]) {
  renderGameViewer(played, { inGameplay: <Probe />, initialPersona: { ref: { source: 'world' as const, entityId: 'ash' } }, ...(initialTraits ? { initialTraits } : {}) });
  await screen.findByPlaceholderText(/Type your action/);
}

beforeEach(async () => {
  live = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a flip loop from a panel toggle', () => {
  it('ends within the switch total, with one warning', { timeout: 60000 }, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error');
    await mountGame(world([flipping]));
    await clickTrait('Lever');
    expect(await runsWhenQuiet(SWITCH_RUN_TOTAL)).toBe(SWITCH_RUN_TOTAL);
    expect(totalWarnings(warn)).toBe(1);
    expect(error).not.toHaveBeenCalled();
    // The last switch applied with no script, so the trait follows what the Item Copies hold.
    expect(swornOn()).toBe(charms().length > 0);
  });

  it('leaves the next action a full total', { timeout: 60000 }, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mountGame(world([flipping]));
    await clickTrait('Lever');
    await runsWhenQuiet(SWITCH_RUN_TOTAL);
    await clickTrait('Other');
    await waitFor(() => expect(statNow('runs')).toBe(SWITCH_RUN_TOTAL + 1));
    expect(totalWarnings(warn)).toBe(1);
  });

  it('ends within the item total, with one log line', { timeout: 60000 }, async () => {
    // Each flip gives Tokens three times, so the item total runs out before the switch total.
    const giving = script('give', 'switch', `${flipping.code}\nif (stats.Runs.value < ${SWITCH_RUN_TOTAL * 3}) for (let i = 0; i < 3; i += 1) items.Token.give(persona);`);
    const token = item('token', 'Token', { scripts: [script('gained', 'gained', 'stats.Gains.value += 1;')] });
    await mountGame(world([giving], { stats: [stat('runs', 'Runs'), stat('gains', 'Gains')], items: [charm(), token] }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await clickTrait('Lever');
    await runsWhenQuiet(SWITCH_RUN_TOTAL);
    expect(statNow('gains')).toBe(ITEM_RUN_TOTAL);
    expect(gameplay().logEntries.filter(({ text }) => text.includes(`fired ${ITEM_RUN_TOTAL} runs`))).toHaveLength(1);
  });

  it('counts the switches a batch of item events fires', { timeout: 60000 }, async () => {
    // Lever's switch-off drops the Ring. Its When Unequipped runs as its own batch and switches Spark on, which starts the flips.
    const ring = item('ring', 'Ring', {
      slotRule: { mode: 'either', slotIds: ['finger'] }, equipRequires: [{ all: [{ kind: 'trait', id: 'lever' }] }],
      scripts: [script('off', 'unequipped', 'traits.Spark.enabled = true;')],
    });
    const sparking = script('spark', 'switch', `${flipping.code}\nif (trait.name === 'Spark') items.Charm.give(persona);`);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mountGame(world([sparking], {
      items: [charm(), ring], slots: [{ id: 'finger', name: 'Finger' }], bodies: [bodyFixture({ id: 'hand', name: 'Hand', entries: [{ slotId: 'finger' }] })],
      placements: [{ id: 'p-ring', where: { kind: 'you' }, quantity: 1, equipped: true, source: { kind: 'item', itemId: 'ring' } }],
      traits: [toggle('lever', 'Lever'), { ...toggle('spark', 'Spark'), playerToggle: false }],
    }), ['lever']);
    await waitFor(() => expect(gameplay().itemCopies.filter((copy) => copy.equipped)).toHaveLength(1));
    await clickTrait('Lever');
    expect(await runsWhenQuiet(SWITCH_RUN_TOTAL)).toBe(SWITCH_RUN_TOTAL);
  });

  it('ends within the switch total when a turn’s script starts it', { timeout: 60000 }, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await mountGame(world([flipping, script('b', 'before', 'items.Charm.give(persona);')]));
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
        .find((m) => m.role === 'system')?.content ?? '';
      if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
      if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
      return sseResponse(sseReply('The ferry bell rings.'));
    }));
    fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled(), { timeout: 30000 });
    expect(await runsWhenQuiet(SWITCH_RUN_TOTAL)).toBe(SWITCH_RUN_TOTAL);
    expect(totalWarnings(warn)).toBe(1);
  });
});

describe('one normal switch whose script gives an item', () => {
  it('lands the item, and its item events and the switch it grants fire', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const once = script('once', 'switch', `
      if (trait.name === 'Lever') { stats.Runs.value += 1; items.Charm.give(persona); }
      if (trait.name === 'Sworn') stats.Runs.value += 10;
    `);
    const gained = charm({ scripts: [script('gained', 'gained', 'stats.Runs.value += 100;')] });
    await mountGame(world([once], { items: [gained] }));
    await clickTrait('Lever');
    await waitFor(() => expect(statNow('runs')).toBe(111));
    expect(charms()).toHaveLength(1);
    expect(swornOn()).toBe(true);
    expect(totalWarnings(warn)).toBe(0);
  });
});
