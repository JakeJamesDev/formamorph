import { describe, expect, it, vi } from 'vitest';
import type { SupporterContentSnapshot, SupporterItemRef } from '@/lib/supporterContent/supporterContent';
import { DEFAULT_MASCOT_RIG } from './mascot';
import { buildMascotCardData } from './mascotCard';
import { DEFAULT_MASCOT_ID, supporterMascotId, type MascotPreset, type MascotPresetStore } from './mascotPresets';
import { createSupporterMascotSync } from './supporterMascotSync';

const card = (name: string) => {
  const data = buildMascotCardData(name, DEFAULT_MASCOT_RIG, (ref) => `data:image/png;base64,${btoa(ref.kind === 'bundled' ? ref.name : 'x')}`, '3.0.1');
  return { ...data, images: data.images.map((dataUrl, seed) => ({ dataUrl, seed, version: 1, sourceWidth: 8, sourceHeight: 8 })) };
};

const mine: MascotPreset = { id: 'mine', name: 'Mine', rig: DEFAULT_MASCOT_RIG };
const NOVA = supporterMascotId('nova');

/** A fake module and store: the snapshot and served content change as a test says, and every write is kept. */
function harness(initial: MascotPresetStore = { activeId: 'mine', mascots: [mine] }) {
  let snapshot: SupporterContentSnapshot = { status: 'idle', qualifies: false, entitled: [], installed: [] };
  const served = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  let store = initial;
  let account: string | null = 'account-1';
  const writes: MascotPresetStore[] = [];
  const readItem = vi.fn(async (id: string) => served.get(id) ?? null);
  const sync = createSupporterMascotSync({
    content: { subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); }, getSnapshot: () => snapshot, readItem },
    accountId: () => account,
    readStore: () => store,
    writeStore: (next) => { store = next; writes.push(next); },
  });
  return {
    sync,
    readItem,
    writes,
    store: () => store,
    signIn: (id: string | null) => { account = id; },
    serve: (id: string, content: unknown) => served.set(id, content),
    publish: (next: Partial<SupporterContentSnapshot>) => {
      snapshot = { ...snapshot, status: 'ready', ...next };
      listeners.forEach((listener) => listener());
    },
  };
}

const installed = (revision: number, kind = 'mascot'): SupporterItemRef[] => [{ id: 'nova', kind, revision }];

describe('the Supporter mascot sync', () => {
  it('waits for a ready snapshot, then stores the installed Mascot for the signed-in account', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    await h.sync.sync();
    expect(h.writes).toEqual([]);

    h.publish({ installed: installed(1) });
    await h.sync.sync();
    const nova = h.store().mascots.find((mascot) => mascot.id === NOVA);
    expect(nova).toMatchObject({ name: 'Nova', supporter: { listingId: 'nova', revision: 1, accountId: 'account-1' } });
    expect(h.store().activeId).toBe('mine');
  });

  it('runs again on each change of the module once started', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    const stop = h.sync.start();
    h.publish({ installed: installed(1) });
    await vi.waitFor(() => expect(h.store().mascots.map((mascot) => mascot.id)).toEqual(['mine', NOVA]));
    stop();
  });

  it('keeps an unchanged entry without reading it again, and rebuilds a new revision', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    await h.sync.sync();
    expect(h.readItem).toHaveBeenCalledTimes(1);
    expect(h.writes).toHaveLength(1);

    h.serve('nova', card('Nova II'));
    h.publish({ installed: installed(2) });
    await h.sync.sync();
    expect(h.store().mascots.find((mascot) => mascot.id === NOVA)).toMatchObject({ name: 'Nova II', supporter: { revision: 2 } });
  });

  it('drops a removed item and falls back to the Default when it was active', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    const active = harness({ ...h.store(), activeId: NOVA });
    active.publish({ installed: [] });
    await active.sync.sync();
    expect(active.store()).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [mine] });
  });

  it('keeps the held preset and the selection when the rebuild of a listed item fails', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    const active = harness({ ...h.store(), activeId: NOVA });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    active.readItem.mockRejectedValue(new Error('The cache is unreadable'));
    active.publish({ installed: installed(2) });
    await active.sync.sync();
    expect(active.writes).toEqual([]);
    expect(active.store().activeId).toBe(NOVA);
    error.mockRestore();
  });

  it('drops another account\'s entry at once, before that account\'s check is ready, and falls back', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    const switched = harness({ ...h.store(), activeId: NOVA });
    switched.signIn('account-2');
    // The module is still checking for the new account.
    await switched.sync.sync();
    expect(switched.store()).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [mine] });
  });

  it('drops an entry installed for another account, which the module no longer lists', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    h.signIn('account-2');
    h.publish({ installed: [] });
    await h.sync.sync();
    expect(h.store().mascots).toEqual([mine]);
  });

  it('rebuilds an entry the module lists for a different account than the one it holds', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    h.signIn('account-2');
    await h.sync.sync();
    expect(h.store().mascots.find((mascot) => mascot.id === NOVA)?.supporter?.accountId).toBe('account-2');
  });

  it('keeps the last account\'s entry while signed out, and builds none new', async () => {
    const h = harness();
    h.serve('nova', card('Nova'));
    h.publish({ installed: installed(1) });
    await h.sync.sync();
    h.signIn(null);
    await h.sync.sync();
    expect(h.store().mascots.map((mascot) => mascot.id)).toEqual(['mine', NOVA]);

    const fresh = harness();
    fresh.signIn(null);
    fresh.serve('nova', card('Nova'));
    fresh.publish({ installed: installed(1) });
    await fresh.sync.sync();
    expect(fresh.writes).toEqual([]);
  });

  it('skips items of other kinds and content it cannot read, and logs the bad content', async () => {
    const h = harness();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.serve('nova', { not: 'a card' });
    h.publish({ installed: [...installed(1), { id: 'world-1', kind: 'world', revision: 1 }] });
    await h.sync.sync();
    expect(h.writes).toEqual([]);
    expect(h.readItem).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Could not read a Supporter Mascot:', expect.any(Error));
    error.mockRestore();
  });

  it('joins a call made during a run and runs once more', async () => {
    const h = harness();
    let release!: () => void;
    h.readItem.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(card('Nova')); }));
    h.publish({ installed: installed(1) });
    const first = h.sync.sync();
    await vi.waitFor(() => expect(h.readItem).toHaveBeenCalledTimes(1));
    h.serve('nova', card('Nova II'));
    h.publish({ installed: installed(2) });
    const second = h.sync.sync();
    expect(second).toBe(first);
    release();
    await second;
    expect(h.store().mascots.find((mascot) => mascot.id === NOVA)).toMatchObject({ name: 'Nova II', supporter: { revision: 2 } });
  });
});
