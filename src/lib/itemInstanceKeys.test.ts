import { describe, expect, it } from 'vitest';
import { APP_VERSION, migrateSave } from './version';
import { applyInventoryOps, type InventoryOp } from './inventory';
import type { ChatMessage, GameState, ItemInstance, SaveObject } from '@/types';

const lamp: ItemInstance = {
  id: 'c1', item: { kind: 'item', itemId: 'lamp' }, where: { kind: 'entity', id: 'bram' }, quantity: 3, visibility: 'hidden',
  equipped: { slotId: 'hand', order: 1 }, state: { uses: 2, state: 'lit' },
};
const key: ItemInstance = { id: 'c2', item: { kind: 'item', itemId: 'key' }, where: { kind: 'location', id: 'cellar' }, quantity: 1, visibility: 'visible' };

/** A save as the last release wrote it: the old keys in the snapshots, the Action List and a saved Tool call's writes. */
function oldSave() {
  const snapshot = { itemCopies: [lamp, key], locationId: 'cellar' };
  const facts = { kind: 'use', item: { key: 'item:lamp', name: 'Lamp' }, copyId: 'c1' };
  const message = {
    role: 'assistant',
    content: '{}',
    toolCalls: [{
      toolId: 'fetch', args: {}, timing: 'call',
      writes: { inventory: [{ kind: 'transfer', copyId: 'c1', to: { kind: 'you' }, quantity: 2 }, { kind: 'use', copyId: 'c1', targetCopyId: 'c2' }] },
    }],
  };
  return {
    version: APP_VERSION,
    currentState: snapshot,
    stateHistory: [snapshot],
    messageHistory: [message],
    actionList: [{ id: 'a', facts, count: 1, hidden: false, snapshots: [{ state: { ...snapshot }, persona: null }] }],
  } as unknown as SaveObject;
}

describe('migrateSave — Item Instance keys', () => {
  it('loads an old save with every instance, owner, quantity, equipped state, uses and State in place', () => {
    const out = migrateSave(oldSave());
    expect(out.currentState.itemInstances).toEqual([lamp, key]);
    expect(out.stateHistory[0].itemInstances).toEqual([lamp, key]);
    expect('itemCopies' in out.currentState).toBe(false);
    expect('itemCopies' in out.stateHistory[0]).toBe(false);
  });

  it('renames the instance id in the Action List, its facts and each snapshot', () => {
    const [entry] = migrateSave(oldSave()).actionList!;
    expect(entry.facts).toEqual({ kind: 'use', item: { key: 'item:lamp', name: 'Lamp' }, instanceId: 'c1' });
    expect(entry.snapshots[0].state.itemInstances).toEqual([lamp, key]);
    expect('itemCopies' in entry.snapshots[0].state).toBe(false);
  });

  it('renames the instance ids of a sent list, its entries and its restore point', () => {
    const save = oldSave() as unknown as Record<string, unknown>;
    const facts = { kind: 'equip', item: { key: 'item:lamp', name: 'Lamp' }, copyId: 'c1', resultId: 'c9' };
    save.sentActions = {
      t1: { told: true, entries: [{ id: 'a', facts, count: 1, hidden: false }], after: { state: { itemCopies: [key] }, persona: null } },
    };
    const sent = migrateSave(save as unknown as SaveObject).sentActions!.t1;
    expect(sent.entries[0].facts).toEqual({ kind: 'equip', item: { key: 'item:lamp', name: 'Lamp' }, instanceId: 'c1', resultId: 'c9' });
    expect(sent.after!.state.itemInstances).toEqual([key]);
  });

  it('replays a saved Tool call’s inventory writes on a re-roll after migration', () => {
    const [message] = migrateSave(oldSave()).messageHistory! as (ChatMessage & { toolCalls: { writes: { inventory: InventoryOp[] } }[] })[];
    const ops = message.toolCalls[0].writes.inventory;
    expect(ops).toEqual([
      { kind: 'transfer', instanceId: 'c1', to: { kind: 'you' }, quantity: 2 },
      { kind: 'use', instanceId: 'c1', targetInstanceId: 'c2' },
    ]);
    const world = { items: [{ id: 'lamp', name: 'Lamp', uses: 5, statEffects: [], traitEffects: [], equipRequires: [] },{ id: 'key', name: 'Key', statEffects: [], traitEffects: [], equipRequires: [] }], slots: [], bodies: [] };
    let n = 0;
    const result = applyInventoryOps([lamp, key], ops, { world, source: 'tool', newId: () => `n${n++}` } as never);
    expect(result.diagnostics).toEqual([]);
    const youHold = result.instances.filter((instance) => instance.where.kind === 'you');
    expect(youHold.map((instance) => [instance.item, instance.quantity])).toEqual([[{ kind: 'item', itemId: 'lamp' }, 2]]);
    expect(result.itemUses.map((use) => use.itemId)).toEqual(['lamp']);
  });

  it('is idempotent: a second pass returns the same objects, and a record holding both keys keeps the new one', () => {
    const once = migrateSave(oldSave());
    const twice = migrateSave(once);
    expect(twice.currentState).toBe(once.currentState);
    expect(twice.messageHistory![0]).toBe(once.messageHistory![0]);
    const both = { ...once.currentState, itemCopies: [key] } as unknown as GameState;
    const out = migrateSave({ ...once, currentState: both });
    expect(out.currentState.itemInstances).toEqual([lamp, key]);
    expect('itemCopies' in out.currentState).toBe(false);
  });

  it('keeps the new id when a saved write holds both keys', () => {
    const save = oldSave();
    save.messageHistory = [{ role: 'assistant', content: '{}', toolCalls: [{ toolId: 'fetch', args: {}, timing: 'call', writes: { inventory: [{ kind: 'lose', instanceId: 'new', copyId: 'old' }] } }] }] as unknown as ChatMessage[];
    const [message] = migrateSave(save).messageHistory! as (ChatMessage & { toolCalls: { writes: { inventory: unknown[] } }[] })[];
    expect(message.toolCalls[0].writes.inventory).toEqual([{ kind: 'lose', instanceId: 'new' }]);
  });
});
