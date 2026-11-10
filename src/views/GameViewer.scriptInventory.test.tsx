import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { parseTurnContent } from '@/lib/turnDigest';
import type { Entity, Item, PlayerStat, Script, Trait, World } from '@/types';

/** Script writes on a mounted game: where inventory writes land, and what a stat re-roll keeps. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string, value: number): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const vigor = stat('vigor', 'Vigor', 50);
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: [], ...over });
const gem = item('gem', 'Gem');
const sworn: Trait = { id: 'sworn', name: 'Sworn', statChanges: [], playerToggle: true };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true };
const asAsh = { ref: { source: 'world' as const, entityId: 'ash' } };
const script = (id: string, timing: Script['timing'], code: string): Script => ({ id, timing, code });

const WORLD_WITH = (over: Partial<World>, entities: Entity[] = [ash]): World => ({ ...harborWorld({ stats: [vigor], entities }), ...over });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const statNow = (id: string) => gameplay().globalStats.find((s) => s.id === id)?.value;
const copiesOf = (itemId: string) => gameplay().itemCopies.filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemId);

function stubEndpoint() {
  const calls = { stats: 0 };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('location router')) return sseResponse(sseReply('NONE'));
    if (system.includes('You track where the characters in an interactive story go')) return sseResponse(sseReply('{}'));
    if (system.includes('inventory keeper')) return sseResponse(sseReply(JSON.stringify({ operations: [] })));
    if (system.includes('stat tracker')) {
      calls.stats += 1;
      return sseResponse(sseReply('{"Global Stats": {"Vigor": 0, "Vigor max": 0}}'));
    }
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Walk on\n2. Wait'));
    return sseResponse(sseReply('The ferry bell rings twice.'));
  }));
  return calls;
}

beforeEach(async () => {
  live = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
});
afterEach(() => vi.restoreAllMocks());

async function clickTrait(name: string) {
  gameplay().setActiveTab('traits');
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: new RegExp(name) }));
}

const regenerateStats = () => screen.getByRole('button', { name: 'Regenerate Stats' });

async function playOneTurn(world: World) {
  renderGameViewer(world, { inGameplay: <Probe />, initialPersona: asAsh });
  const box = await screen.findByPlaceholderText(/Type your action/);
  const calls = stubEndpoint();
  fireEvent.change(box, { target: { value: 'I ring the bell.' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(regenerateStats()).toBeEnabled());
  return calls;
}

async function rerollStats(calls: { stats: number }) {
  const before = calls.stats;
  fireEvent.click(regenerateStats());
  await waitFor(() => expect(calls.stats).toBe(before + 1));
  await waitFor(() => expect(regenerateStats()).toBeEnabled());
}

describe('a switch script a panel toggle fires', () => {
  it('lands its give once', async () => {
    renderGameViewer(WORLD_WITH({ items: [gem], traits: [sworn], scripts: [script('sw', 'switch', 'stats.Vigor.value = 7; items.Gem.give(persona);')] }), {
      inGameplay: <Probe />, initialPersona: asAsh,
    });
    await screen.findByPlaceholderText(/Type your action/);
    await clickTrait('Sworn');
    await waitFor(() => expect(statNow('vigor')).toBe(7));
    await waitFor(() => expect(copiesOf('gem')).toHaveLength(1));
  });
});

describe('a turn’s script inventory writes', () => {
  const counted = item('gem', 'Gem', { scripts: [script('gem-gained', 'gained', 'stats.Vigor.value += 1;')] });
  const world = WORLD_WITH({
    items: [counted],
    scripts: [script('b', 'before', 'items.Gem.give(persona);'), script('a', 'after', 'items.Gem.give(persona); stats.Vigor.value += 10;')],
  });

  it('land once, with each item event run once, when the turn commits', async () => {
    await playOneTurn(world);
    await waitFor(() => expect(copiesOf('gem')).toHaveLength(2));
    await waitFor(() => expect(statNow('vigor')).toBe(62));
  });

  it('land once when a stat re-roll replays them', async () => {
    const calls = await playOneTurn(world);
    await waitFor(() => expect(statNow('vigor')).toBe(62));
    await rerollStats(calls);
    expect(copiesOf('gem')).toHaveLength(2);
    expect(statNow('vigor')).toBe(62);
  });

  it('keep a later script’s write on a copy an earlier script made, in a switch run the commit fires', async () => {
    // The commit's settle grants the trait, and the run it fires starts before the commit renders.
    const charm = item('charm', 'Charm', { traitEffects: [{ id: 'grant', traitId: 'sworn', timing: 'owned' }] });
    await playOneTurn(WORLD_WITH({
      items: [charm, item('box', 'Box')],
      scripts: [
        script('b', 'before', 'items.Charm.give(persona);'),
        script('sw1', 'switch', 'items.Box.give(persona);'),
        script('sw2', 'switch', 'persona.items.find((copy) => copy.item === "Box").lose(); stats.Vigor.value = 33;'),
      ],
    }, [{ ...ash, traits: [{ ...sworn, playerToggle: false }] }]));
    await waitFor(() => expect(statNow('vigor')).toBe(33));
    await waitFor(() => expect(copiesOf('charm')).toHaveLength(1));
    expect(copiesOf('box')).toHaveLength(0);
  });

  it('check an equip’s requirement against what an earlier script wrote', async () => {
    const sword = item('sword', 'Sword', {
      slotRule: { mode: 'either', slotIds: ['hand'] },
      equipRequires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 90, unit: 'raw' }] }],
    });
    await playOneTurn(WORLD_WITH({
      items: [sword], slots: [{ id: 'hand', name: 'Hand' }], bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'hand' }] })],
      placements: [{ id: 'mine', source: { kind: 'item', itemId: 'sword' }, where: { kind: 'you' }, quantity: 1 }],
      scripts: [script('a1', 'after', 'stats.Vigor.value = 95;'), script('a2', 'after', 'persona.items[0].equip();')],
    }));
    await waitFor(() => expect(statNow('vigor')).toBe(95));
    await waitFor(() => expect(copiesOf('sword')[0]?.equipped).toBeTruthy());
  });
});

describe('a stat re-roll', () => {
  // Each replayed write would differ from the first, so a replay that landed shows.
  const scene = (who: string) => [
    'location.move({ Harbor: "Dock", Dock: "Far", Far: "Harbor" }[location.name]);',
    'clock.advance(60);',
    `memories.add("${who} " + Math.random());`,
    `memories.pin("${who} " + Math.random());`,
    `entities.Guard.diary("${who} " + Math.random());`,
    'discover("Stranger" + Math.floor(Math.random() * 1e9), "A stranger.");',
  ].join('\n');
  const guard = { id: 'guard', name: 'Guard', description: 'A guard.', locations: ['harbor'] } as Entity;
  const world: World = {
    ...WORLD_WITH({ scripts: [script('b', 'before', scene('before')), script('a', 'after', scene('after'))] }, [ash, guard]),
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }, { id: 'dock', name: 'Dock' }, { id: 'far', name: 'Far' }],
  } as World;
  /** What the latest turn holds, short of the stat fields a re-roll replaces. */
  const scenery = () => {
    const last = gameplay().fullMessageHistory.findLast((message) => message.role === 'assistant');
    const { stat_changes: _changes, statAsks: _asks, ...kept } = parseTurnContent(last?.content ?? '') ?? {};
    return kept;
  };

  it('keeps the turn’s location, time, scene entities, memories and diary lines', async () => {
    const calls = await playOneTurn(world);
    await waitFor(() => expect(gameplay().currentLocation?.name).toBe('Far'));
    const kept = {
      location: gameplay().currentLocation?.id, time: gameplay().gameTime, turn: scenery(), notes: gameplay().memoryNotes,
      discovered: gameplay().discoveredEntities.map((found) => found.entity.name),
    };
    // The control: the turn really holds each kind of write the re-roll must keep.
    expect(kept.notes.length).toBeGreaterThan(0);
    expect(kept.discovered.length).toBeGreaterThan(0);
    expect(JSON.stringify(kept.turn)).toContain('before ');
    await rerollStats(calls);
    expect({
      location: gameplay().currentLocation?.id, time: gameplay().gameTime, turn: scenery(), notes: gameplay().memoryNotes,
      discovered: gameplay().discoveredEntities.map((found) => found.entity.name),
    }).toEqual(kept);
  });
});
