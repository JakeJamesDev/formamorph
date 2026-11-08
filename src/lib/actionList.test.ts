import { describe, expect, it } from 'vitest';
import {
  addAction, closeList, entryLine, listCounts, reversalOf, toggleHidden, undoNewest, type ActionList, type ListedActionFacts,
} from './actionList';

const potion = { key: 'item:potion', name: 'Healing Potion' };
const sword = { key: 'item:sword', name: 'Iron Sword' };
const arrow = { key: 'item:arrow', name: 'Arrow' };
const use: ListedActionFacts = { kind: 'use', item: potion, copyId: 'p1' };
const equip: ListedActionFacts = { kind: 'equip', item: sword, copyId: 's1', resultId: 's2' };
const unequip: ListedActionFacts = { kind: 'unequip', item: sword, copyId: 's2', resultId: 's1' };
const drop = (quantity = 1, place = 'yard'): ListedActionFacts => ({ kind: 'drop', item: arrow, quantity, place });
const pickup = (quantity = 1, place = 'yard'): ListedActionFacts => ({ kind: 'pickup', item: arrow, quantity, place });
const give = (to = 'mara'): ListedActionFacts => ({ kind: 'give', item: potion, quantity: 1, to: { id: to, name: to === 'mara' ? 'Mara' : 'Bram' } });

/** Runs each action as the caller does: a reversal undoes, anything else adds with snapshot `s<i>`. */
function play(actions: readonly ListedActionFacts[], start: ActionList<string> = []) {
  let list = [...start];
  const restored: string[] = [];
  actions.forEach((facts, i) => {
    const reversal = reversalOf(list, facts);
    if (reversal) {
      list = reversal.list;
      restored.push(reversal.restore);
      return;
    }
    list = addAction(list, facts, `s${i}`, `e${i}`);
  });
  return { list, restored };
}
const lines = (list: ActionList<string>) => list.map(entryLine);

describe('the Action List', () => {
  it('adds each action as its own row, newest last, told to the AI', () => {
    const { list } = play([use, equip]);
    expect(lines(list)).toEqual(['Used Healing Potion', 'Equipped Iron Sword']);
    expect(list.every((e) => !e.hidden)).toBe(true);
  });

  it('collapses back-to-back repeats into one row, one snapshot per repeat', () => {
    const { list } = play([use, use, use]);
    expect(lines(list)).toEqual(['Used Healing Potion ×3']);
    expect(list[0].snapshots).toEqual(['s0', 's1', 's2']);
  });

  it('starts a new row when a different action breaks the run', () => {
    const { list } = play([use, use, equip, use]);
    expect(lines(list)).toEqual(['Used Healing Potion ×2', 'Equipped Iron Sword', 'Used Healing Potion']);
  });

  it('does not collapse a give to another target, a drop of another quantity, or an equip', () => {
    expect(lines(play([give('mara'), give('bram')]).list)).toEqual(['Gave Healing Potion to Mara', 'Gave Healing Potion to Bram']);
    expect(lines(play([drop(2), drop(1)]).list)).toEqual(['Dropped 2× Arrow', 'Dropped Arrow']);
    expect(lines(play([drop(1, 'yard'), drop(1, 'hall')]).list)).toEqual(['Dropped Arrow', 'Dropped Arrow']);
    const sword2: ListedActionFacts = { kind: 'equip', item: sword, copyId: 's3', resultId: 's4' };
    expect(lines(play([equip, sword2]).list)).toEqual(['Equipped Iron Sword', 'Equipped Iron Sword']);
  });

  it('treats unequip of the copy the newest equip left as its undo', () => {
    const { list, restored } = play([use, equip, unequip]);
    expect(lines(list)).toEqual(['Used Healing Potion']);
    expect(restored).toEqual(['s1']);
  });

  it('treats equip of the row the newest unequip left as its undo', () => {
    const { list, restored } = play([unequip, { kind: 'equip', item: sword, copyId: 's1', resultId: 's5' }]);
    expect(list).toEqual([]);
    expect(restored).toEqual(['s0']);
  });

  it('treats a pick up of the same item, quantity and place as the newest drop’s undo, and the reverse', () => {
    expect(play([drop(2), pickup(2)])).toMatchObject({ list: [], restored: ['s0'] });
    expect(play([pickup(1), drop(1)])).toMatchObject({ list: [], restored: ['s0'] });
  });

  it('adds a near reversal that differs in copy, quantity or place', () => {
    expect(lines(play([equip, { ...unequip, copyId: 'other' } as ListedActionFacts]).list)).toHaveLength(2);
    expect(lines(play([drop(2), pickup(1)]).list)).toEqual(['Dropped 2× Arrow', 'Picked up Arrow']);
    expect(lines(play([drop(1, 'yard'), pickup(1, 'hall')]).list)).toHaveLength(2);
  });

  it('never undoes a reversal of an entry that is not the newest', () => {
    const { list, restored } = play([equip, use, unequip]);
    expect(lines(list)).toEqual(['Equipped Iron Sword', 'Used Healing Potion', 'Unequipped Iron Sword']);
    expect(restored).toEqual([]);
  });

  it('never treats a reversal of a collapsed row as its undo', () => {
    const { list, restored } = play([drop(), drop(), pickup()]);
    expect(lines(list)).toEqual(['Dropped Arrow ×2', 'Picked up Arrow']);
    expect(restored).toEqual([]);
  });

  it('undoes one repeat at a time, restoring that repeat’s snapshot', () => {
    let list = play([equip, use, use, use]).list;
    const steps: string[] = [];
    for (let undo = undoNewest(list); undo; undo = undoNewest(list)) {
      steps.push(undo.restore);
      list = undo.list;
    }
    expect(steps).toEqual(['s3', 's2', 's1', 's0']);
    expect(undoNewest(list)).toBeNull();
  });

  it('shows the remaining count after one undo of a collapsed row', () => {
    const undo = undoNewest(play([use, use, use]).list);
    expect(undo && lines(undo.list)).toEqual(['Used Healing Potion ×2']);
  });

  it('hides and shows an entry, and counts shown and hidden rows', () => {
    const { list } = play([use, equip, give()]);
    const hidden = toggleHidden(list, list[1].id);
    expect(hidden.map((e) => e.hidden)).toEqual([false, true, false]);
    expect(listCounts(hidden)).toEqual({ shown: 2, hidden: 1 });
    expect(toggleHidden(hidden, list[1].id).map((e) => e.hidden)).toEqual([false, false, false]);
  });

  it('keeps a hidden row hidden when it collapses another repeat', () => {
    const { list } = play([use]);
    const repeated = addAction(toggleHidden(list, list[0].id), use, 'later', 'x');
    expect(repeated).toMatchObject([{ hidden: true, count: 2 }]);
  });

  it('closes into the sent list and an empty live list', () => {
    const { list } = play([use, equip]);
    expect(closeList(list)).toEqual({ sent: list, live: [] });
  });

  it('writes every inventory line', () => {
    expect(lines(play([
      use, equip, unequip, give(), drop(3, 'hall'), { kind: 'pickup', item: arrow, quantity: 1, place: 'yard' },
    ]).list)).toEqual(['Used Healing Potion', 'Gave Healing Potion to Mara', 'Dropped 3× Arrow', 'Picked up Arrow']);
    expect(entryLine({ facts: unequip, count: 1 })).toBe('Unequipped Iron Sword');
    expect(entryLine({ facts: equip, count: 1 })).toBe('Equipped Iron Sword');
  });
});

const statEdit = (to: number, from = 40, owner?: { id: string; name: string }): ListedActionFacts => ({
  kind: 'stat', stat: { id: 'hp', name: 'Health' }, ...(owner && { owner }), from, to,
});
const mira = { id: 'mira', name: 'Mira' };

describe('stat edits in the Action List', () => {
  it('arrives hidden, with the old and new value in its line', () => {
    const { list } = play([statEdit(60)]);
    expect(lines(list)).toEqual(['Health 40 → 60']);
    expect(list[0].hidden).toBe(true);
    expect(lines(play([statEdit(60, 40, mira)]).list)).toEqual(['Mira’s Health 40 → 60']);
  });

  it('merges a run of edits to one stat into one entry from the first old value, first snapshot', () => {
    const { list } = play([statEdit(45), statEdit(50, 45), statEdit(60, 50)]);
    expect(lines(list)).toEqual(['Health 40 → 60']);
    expect(list[0].count).toBe(1);
    expect(list[0].snapshots).toEqual(['s0']);
  });

  it('keeps the shown flag through a merge', () => {
    const shown = toggleHidden(play([statEdit(45)]).list, 'e0');
    const { list } = play([statEdit(50, 45)], shown);
    expect(list[0].hidden).toBe(false);
    expect(lines(list)).toEqual(['Health 40 → 50']);
  });

  it('removes the entry when the stat is edited back to the old value', () => {
    expect(play([statEdit(60), statEdit(40, 60)]).list).toEqual([]);
  });

  it('adds nothing for an edit that leaves the value where it was', () => {
    expect(play([statEdit(40)]).list).toEqual([]);
  });

  it('starts a new entry for another stat, another owner, or after another action', () => {
    const other: ListedActionFacts = { kind: 'stat', stat: { id: 'mp', name: 'Mana' }, from: 5, to: 9 };
    expect(lines(play([statEdit(60), other]).list)).toEqual(['Health 40 → 60', 'Mana 5 → 9']);
    expect(lines(play([statEdit(60), statEdit(70, 60, mira)]).list)).toEqual(['Health 40 → 60', 'Mira’s Health 60 → 70']);
    expect(lines(play([statEdit(60), use, statEdit(70, 60)]).list)).toEqual(['Health 40 → 60', 'Used Healing Potion', 'Health 60 → 70']);
  });

  it('undoes to the snapshot before the first edit', () => {
    const { list } = play([statEdit(45), statEdit(50, 45)]);
    expect(undoNewest(list)).toEqual({ list: [], restore: 's0' });
  });
});
