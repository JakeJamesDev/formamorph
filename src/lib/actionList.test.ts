import { describe, expect, it } from 'vitest';
import {
  addAction, closeList, entryLine, isActionSnapshot, listCounts, mapLiveSnapshots, mapSentSnapshots, recordSent, reopenSent, restoreLive, restoreSent,
  reversalOf, toggleHidden, toldActions, toldLines, undoNewest, type ActionList, type ListedActionFacts,
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

  describe('trait, travel and persona', () => {
    const trait = (enabled: boolean, owner: { id: string; name: string } | null = null, id = 'bold'): ListedActionFacts =>
      ({ kind: 'trait', trait: { id, name: id === 'bold' ? 'Bold' : 'Keen' }, owner, enabled });
    const mira = { id: 'mira', name: 'Mira' };
    const harbor = { id: 'harbor', name: 'Harbor' };
    const market = { id: 'market', name: 'Market' };
    const hall = { id: 'hall', name: 'Hall' };
    const travel = (from: typeof harbor | null, to: typeof harbor): ListedActionFacts => ({ kind: 'travel', from, to });
    const persona = (from: string, to: string): ListedActionFacts => ({
      kind: 'persona', from: { id: from, name: from }, to: { id: to, name: to === 'none' ? null : to },
    });

    it('treats the opposite switch of the same trait and owner as the newest toggle’s undo', () => {
      expect(play([trait(true), trait(false)])).toMatchObject({ list: [], restored: ['s0'] });
      expect(play([trait(false, mira), trait(true, mira)])).toMatchObject({ list: [], restored: ['s0'] });
    });

    it('adds a toggle of another trait, another owner, or the same switch again', () => {
      expect(play([trait(true), trait(false, null, 'keen')]).list).toHaveLength(2);
      expect(play([trait(true), trait(false, mira)]).list).toHaveLength(2);
      expect(play([trait(true, mira), trait(false)]).list).toHaveLength(2);
      expect(play([trait(true), trait(true)]).list).toHaveLength(2);
    });

    it('treats a trip back to where the newest trip left from as its undo', () => {
      expect(play([travel(harbor, market), travel(market, harbor)])).toMatchObject({ list: [], restored: ['s0'] });
      expect(lines(play([travel(harbor, market), travel(market, hall)]).list)).toEqual(['Traveled to Market', 'Traveled to Hall']);
      expect(play([travel(null, market), travel(market, harbor)]).list).toHaveLength(2);
    });

    it('treats a switch back to the persona the newest switch left as its undo', () => {
      expect(play([persona('ash', 'mira'), persona('mira', 'ash')])).toMatchObject({ list: [], restored: ['s0'] });
      expect(play([persona('ash', 'mira'), persona('mira', 'wren')]).list).toHaveLength(2);
    });

    it('never collapses repeats of these kinds', () => {
      expect(play([travel(harbor, market), travel(market, hall), travel(hall, harbor)]).list).toHaveLength(3);
      expect(play([trait(true), trait(true, null, 'keen'), trait(false, null, 'keen')]).list).toHaveLength(1);
    });

    it('never matches a reversal across kinds', () => {
      expect(play([use, trait(true), travel(harbor, market), persona('ash', 'mira')]).list).toHaveLength(4);
    });

    it('writes their lines', () => {
      expect(lines(play([trait(true), trait(false, mira, 'keen'), travel(harbor, market), persona('ash', 'mira'), persona('mira', 'none')]).list))
        .toEqual(['Turned on Bold', 'Turned off Mira’s Keen', 'Traveled to Market', 'Switched persona to mira', 'Switched persona to None']);
    });
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

describe('World Option changes in the Action List', () => {
  const pick = (from: string, to: string, option = 'o-style'): ListedActionFacts => ({
    kind: 'option', option: { id: option, name: option === 'o-style' ? 'Style' : 'Length' }, from: { id: from, name: from }, to: { id: to, name: to },
  });

  it('arrives hidden, so the AI is never told, with both values in its line', () => {
    const { list } = play([pick('plain', 'lush')]);
    expect(list[0].hidden).toBe(true);
    expect(toldActions(list)).toEqual([]);
    expect(entryLine(list[0])).toBe('Style plain → lush');
  });

  it('is never told to the AI, even after the player unhides it, and never counts as shown', () => {
    const { list } = play([pick('plain', 'lush')]);
    const unhidden = toggleHidden(list, list[0].id);
    expect(unhidden[0].hidden).toBe(false);
    expect(toldActions(unhidden)).toEqual([]);
    expect(listCounts(unhidden)).toEqual({ shown: 0, hidden: 1 });
  });

  it('merges a run of changes to one Option from the first old value, first snapshot', () => {
    const { list } = play([pick('plain', 'lush'), pick('lush', 'terse')]);
    expect(list).toHaveLength(1);
    expect(entryLine(list[0])).toBe('Style plain → terse');
    expect(list[0].snapshots).toEqual(['s0']);
  });

  it('removes the entry when the Option is set back to its old value', () => {
    expect(play([pick('plain', 'lush'), pick('lush', 'plain')]).list).toEqual([]);
  });

  it('starts a new entry for another Option', () => {
    expect(play([pick('plain', 'lush'), pick('1', '2', 'o-length')]).list).toHaveLength(2);
  });

  it('undoes to the snapshot before the first change', () => {
    const { list } = play([pick('plain', 'lush'), pick('lush', 'terse')]);
    expect(undoNewest(list)?.restore).toBe('s0');
  });

  it('restores from a save, and drops an entry whose facts are malformed', () => {
    const sent = restoreSent({ t1: { told: true, entries: [
      { id: 'a', count: 1, hidden: true, facts: pick('plain', 'lush') },
      { id: 'b', count: 1, hidden: true, facts: { kind: 'option', option: { id: 'o', name: 'X' } } },
    ] } });
    expect(sent.t1.entries.map((e) => e.id)).toEqual(['a']);
  });
});

describe('sending the list', () => {
  it('tells the shown entries with their counts, in list order, and writes one line each', () => {
    const { list } = play([use, use, equip, give()]);
    const told = toldActions(toggleHidden(list, list[1].id));
    expect(told).toEqual([{ facts: use, count: 2 }, { facts: give(), count: 1 }]);
    expect(toldLines(told)).toBe('- Used Healing Potion ×2\n- Gave Healing Potion to Mara');
    expect(toldActions(list.map((e) => ({ ...e, hidden: true })))).toEqual([]);
  });

  it('records the sent list and drops every older turn’s snapshots (Q34)', () => {
    const first = recordSent({}, 't1', play([use, use]).list, true);
    expect(first.t1.entries[0].snapshots).toEqual(['s0', 's1']);
    const second = recordSent(first, 't2', play([equip]).list, false);
    expect(second.t1).toEqual({ told: true, entries: [{ id: 'e0', facts: use, count: 2, hidden: false }] });
    expect(second.t2).toEqual({ told: false, entries: [{ id: 'e0', facts: equip, count: 1, hidden: false, snapshots: ['s0'] }] });
  });

  it('keeps the state at send on the newest record only (Q52)', () => {
    const first = recordSent({}, 't1', play([use]).list, true, 'at-send-1');
    expect(first.t1.after).toBe('at-send-1');
    const second = recordSent(first, 't2', play([equip]).list, true, 'at-send-2');
    expect(second.t1).toEqual({ told: true, entries: [{ id: 'e0', facts: use, count: 1, hidden: false }] });
    expect(second.t2.after).toBe('at-send-2');
    expect(recordSent(second, 't3', [], true, 'unused').t2).not.toHaveProperty('after');
  });

  it('reopens the newest record as a live list with its state at send (Q14)', () => {
    const { list } = play([use, use, equip]);
    const sent = recordSent({}, 't1', toggleHidden(list, list[1].id), true, 'at-send');
    expect(reopenSent(sent.t1)).toEqual({ list: toggleHidden(list, list[1].id), restore: 'at-send' });
    const older = recordSent(sent, 't2', play([use]).list, true, 'later');
    expect(reopenSent(older.t1)).toBeNull();
    expect(reopenSent({ ...sent.t1, after: undefined })).toBeNull();
    expect(reopenSent({ ...sent.t1, entries: [{ ...sent.t1.entries[0], snapshots: ['s0'] }] })).toBeNull();
    expect(reopenSent(undefined)).toBeNull();
  });

  it('reads the state at send back, and drops one that fails the snapshot check', () => {
    const isWord = (v: unknown): v is string => typeof v === 'string';
    const saved = recordSent({}, 't1', play([use]).list, true, 'at-send');
    expect(restoreSent(JSON.parse(JSON.stringify(saved)), isWord)).toEqual(saved);
    expect(restoreSent({ t1: { ...saved.t1, after: 3 } }, isWord).t1).not.toHaveProperty('after');
    expect(mapSentSnapshots(saved, (s) => s.toUpperCase()).t1.after).toBe('AT-SEND');
  });

  it('records nothing for an empty list, and still drops the older snapshots', () => {
    const sent = recordSent(recordSent({}, 't1', play([use]).list, true), 't2', [], true);
    expect(Object.keys(sent)).toEqual(['t1']);
    expect(sent.t1.entries[0].snapshots).toBeUndefined();
  });

  it('reads a saved map back, leaving out what is malformed', () => {
    const saved = recordSent(recordSent({}, 't1', play([use]).list, true), 't2', play([equip, statEdit(60)]).list, true);
    expect(restoreSent<string>(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(restoreSent({
      t1: { told: true, entries: [{ id: 'x', facts: { kind: 'eat', item: potion }, count: 1, hidden: false }] },
      t2: { told: 'yes', entries: [] },
      t3: { told: true, entries: [{ id: 'e', facts: use, count: 1, hidden: false }, 'junk'] },
    })).toEqual({ t3: { told: true, entries: [{ id: 'e', facts: use, count: 1, hidden: false }] } });
    expect(restoreSent(undefined)).toEqual({});
  });

  it('drops an entry’s snapshots when one fails the snapshot check', () => {
    const isWord = (v: unknown): v is string => typeof v === 'string';
    const saved = { t1: { told: true, entries: [{ id: 'e', facts: use, count: 1, hidden: false, snapshots: [3] }] } };
    expect(restoreSent(saved, isWord)).toEqual({ t1: { told: true, entries: [{ id: 'e', facts: use, count: 1, hidden: false }] } });
  });

  it('reads back trait, travel and persona entries, and leaves out one without its subject', () => {
    const facts: ListedActionFacts[] = [
      { kind: 'trait', trait: { id: 'bold', name: 'Bold' }, owner: null, enabled: true },
      { kind: 'travel', from: null, to: { id: 'market', name: 'Market' } },
      { kind: 'persona', from: { id: 'ash', name: 'Ash' }, to: { id: 'none', name: null } },
    ];
    const saved = recordSent({}, 't1', facts.map((f, i) => ({ id: `e${i}`, facts: f, count: 1, hidden: false, snapshots: ['s'] })), true);
    expect(restoreSent<string>(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(restoreSent({ t1: { told: true, entries: [{ id: 'x', facts: { kind: 'travel', from: null }, count: 1, hidden: false }] } })).toEqual({});
  });
});

describe('the live list in a save', () => {
  const isWord = (v: unknown): v is string => typeof v === 'string';
  const saved = () => play([equip, use, use, statEdit(60)]).list;

  it('reads a saved list back whole', () => {
    expect(restoreLive(JSON.parse(JSON.stringify(saved())), isWord)).toEqual(saved());
    expect(restoreLive(undefined, isWord)).toEqual([]);
  });

  it('drops the whole list when any entry is malformed (Q49)', () => {
    const list = saved();
    const variants: unknown[] = [
      [...list.slice(0, 1), { ...list[1], snapshots: ['s1'] }, ...list.slice(2)],
      [...list.slice(0, 1), { ...list[1], snapshots: ['s1', 2] }, ...list.slice(2)],
      [...list.slice(0, 1), { ...list[1], snapshots: undefined }, ...list.slice(2)],
      [...list.slice(0, 1), { ...list[1], facts: { kind: 'eat', item: potion } }, ...list.slice(2)],
      [...list, 'junk'],
      { e0: list[0] },
    ];
    for (const raw of variants) expect(restoreLive(raw, isWord)).toEqual([]);
  });

  it('maps every snapshot, live and sent, and leaves a sent entry without snapshots as it is', () => {
    const list = saved();
    expect(mapLiveSnapshots(list, (s) => s.toUpperCase()).flatMap((e) => e.snapshots)).toEqual(['S0', 'S1', 'S2', 'S3']);
    const sent = recordSent(recordSent({}, 't1', play([use]).list, true), 't2', list, true);
    const mapped = mapSentSnapshots(sent, (s) => s.toUpperCase());
    expect(mapped.t1).toEqual(sent.t1);
    expect(mapped.t2.entries.flatMap((e) => e.snapshots)).toEqual(['S0', 'S1', 'S2', 'S3']);
  });

  it('checks the snapshot shape', () => {
    expect(isActionSnapshot({ state: {}, persona: null })).toBe(true);
    expect(isActionSnapshot({ state: {}, persona: { source: 'world', entityId: 'ash' } })).toBe(true);
    expect(isActionSnapshot({ state: {} })).toBe(false);
    expect(isActionSnapshot({ state: null, persona: null })).toBe(false);
    expect(isActionSnapshot('s0')).toBe(false);
  });
});
