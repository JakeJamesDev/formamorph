import { describe, it, expect } from 'vitest';
import type { Entity, ItemCopy, ItemRequirement, PersonaRef, Trait, TraitRequirement } from '@/types';
import { gateOf, gateStates, requirementOptions, sameRequirement, settle, type GateInput, type GateStatSet } from './traitGates';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { itemRuleStates } from './imageVisibility';
import { gateLine } from './traitGateLine';
import { itemHostStatSections } from './requirementStatOptions';
import { bindOwnedTraits, portableOwnedTraits, traitWorldOf } from './portableTraits';
import { scoped, type OwnerId } from './scope';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const ring = (status: ItemRequirement['status'] = 'owned', extra: Partial<ItemRequirement> = {}): ItemRequirement =>
  ({ kind: 'item', id: 'ring', status, ...extra });
const copy = (id: string, where: ItemCopy['where'], over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId: 'ring' }, where, quantity: 1, visibility: 'visible', ...over });
const worldItems = [{ id: 'ring', name: 'Cursed Ring', slotId: 'finger' }, { id: 'cup', name: 'Cup' }];
const entities = [{ id: 'ash', name: 'Ash' }];

const input = (
  traits: Trait[], itemCopies: ItemCopy[], extra: Partial<GateInput> = {},
): GateInput => ({
  global: { traits, groups: [] },
  owners: [],
  active: scoped([]),
  entities,
  persona: { source: 'none' } as PersonaRef,
  worldItems,
  itemCopies,
  ...extra,
});
const gated = (...all: TraitRequirement[]) => T('Curse', { requires: [{ all }] });
const unlocked = (req: TraitRequirement, copies: ItemCopy[], extra: Partial<GateInput> = {}, owner: OwnerId = null) =>
  gateOf(gateStates(input([gated(req)], copies, extra)), owner, 'Curse')?.unlocked;

describe('item Conditions', () => {
  it('holds while the persona owns the item, carried or equipped, and not after it leaves', () => {
    expect(unlocked(ring(), [copy('a', { kind: 'you' })])).toBe(true);
    expect(unlocked(ring(), [copy('a', { kind: 'you' }, { equipped: { slotId: 'finger', order: 1 } })])).toBe(true);
    expect(unlocked(ring(), [copy('a', { kind: 'location', id: 'cave' })])).toBe(false);
    expect(unlocked(ring(), [])).toBe(false);
  });

  it('fails an equipped Condition while the item is only carried', () => {
    expect(unlocked(ring('equipped'), [copy('a', { kind: 'you' })])).toBe(false);
    expect(unlocked(ring('equipped'), [copy('a', { kind: 'you' }, { equipped: { slotId: 'finger', order: 1 } })])).toBe(true);
  });

  it('counts a hidden Item Copy (Q63)', () => {
    expect(unlocked(ring(), [copy('a', { kind: 'you' }, { visibility: 'hidden' })])).toBe(true);
  });

  it('flips under Not', () => {
    expect(unlocked(ring('owned', { not: true }), [])).toBe(true);
    expect(unlocked(ring('owned', { not: true }), [copy('a', { kind: 'you' })])).toBe(false);
    expect(unlocked(ring('equipped', { not: true }), [copy('a', { kind: 'you' })])).toBe(true);
  });

  it('reads the named owner, and the persona for a played world entity (Q90)', () => {
    const onAsh = [copy('a', { kind: 'entity', id: 'ash' })];
    expect(unlocked(ring('owned', { owner: { kind: 'entity', id: 'ash' } }), onAsh)).toBe(true);
    expect(unlocked(ring('owned', { owner: { kind: 'you' } }), onAsh)).toBe(false);
    const played = { persona: { source: 'world', entityId: 'ash' } as PersonaRef };
    const carried = [copy('a', { kind: 'you' })];
    expect(unlocked(ring('owned', { owner: { kind: 'entity', id: 'ash' } }), carried, played)).toBe(true);
    expect(unlocked(ring('owned', { owner: { kind: 'entity', id: 'ash' } }), carried)).toBe(false);
  });

  it('never holds an unknown item or a missing owner, Not included', () => {
    const gone = { ...ring(), id: 'gone', name: 'Old Ring' };
    expect(unlocked(gone, [])).toBe(false);
    expect(unlocked({ ...gone, not: true }, [])).toBe(false);
    expect(unlocked(ring('owned', { not: true, owner: { kind: 'entity', id: 'nobody' } }), [])).toBe(false);
    expect(unlocked(ring(), [copy('a', { kind: 'you' })], { worldItems: undefined })).toBe(false);
  });

  it('keeps a trait off while its Not item is gone or its owner is gone, through settle', () => {
    const goneItem = T('Curse', { mode: 'alwaysOn', requires: [{ all: [{ ...ring('owned', { not: true }), id: 'gone' }] }] });
    expect(settle(input([goneItem], [])).active.global).toEqual([]);
    const goneOwner = T('Curse', { mode: 'alwaysOn', requires: [{ all: [ring('owned', { not: true, owner: { kind: 'entity', id: 'nobody' } })] }] });
    expect(settle(input([goneOwner], [])).active.global).toEqual([]);
  });

  it('turns an Automatic trait on when the ring is owned and off when it leaves', () => {
    const curse = T('Curse', { mode: 'alwaysOn', requires: [{ all: [ring()] }] });
    const owned = settle(input([curse], [copy('a', { kind: 'you' })]));
    expect(owned.active.global).toEqual(['Curse']);
    const lost = settle(input([curse], [], { active: owned.active }));
    expect(lost.active.global).toEqual([]);
  });

  it('reads in the gate line and compares by status', () => {
    const state = gateOf(gateStates(input([gated(ring('equipped', { owner: { kind: 'entity', id: 'ash' } }))], [])), null, 'Curse');
    expect(state?.rows[0].conditions[0]).toMatchObject({ text: 'Ash: equipping Cursed Ring', unresolved: false, holds: false });
    expect(sameRequirement(ring('owned'), ring('equipped'))).toBe(false);
    expect(sameRequirement(ring('owned'), ring('owned'))).toBe(true);
  });

  it("keeps a hidden Item Copy's item out of the player's gate line while the Condition still holds (Q63, Q115)", () => {
    const line = (copies: ItemCopy[]) => gateLine(gateOf(gateStates(input([gated(ring())], copies)), null, 'Curse'));
    const hiddenOnly = [copy('a', { kind: 'you' }, { visibility: 'hidden' })];
    expect(unlocked(ring(), hiddenOnly)).toBe(true);
    expect(line(hiddenOnly)).toBeNull();
    expect(line([copy('a', { kind: 'you' })])).toBe('Unlocked by owning Cursed Ring');
    expect(line([copy('a', { kind: 'you' }, { visibility: 'hidden' }), copy('b', { kind: 'you' })])).toBe('Unlocked by owning Cursed Ring');
  });

  it('offers each item as owned, and as equipped when it fits a slot', () => {
    const { items } = requirementOptions({ ...input([T('Curse')], []), }, 'Curse');
    expect(items?.map((o) => [o.label, o.requirement.kind === 'item' && o.requirement.status])).toEqual([
      ['Cursed Ring', 'owned'], ['Cursed Ring', 'equipped'], ['Cup', 'owned'],
    ]);
    expect(items?.[0].owners.map((o) => o.name)).toEqual(['Persona', 'Ash']);
  });
});

describe('item Condition State and identity (Q22, Q45)', () => {
  const lantern = (status: ItemRequirement['status'] = 'owned', extra: Partial<ItemRequirement> = {}): ItemRequirement =>
    ({ kind: 'item', id: 'ring', status, ...extra });
  const held = (id: string, state: ItemCopy['state'], over: Partial<ItemCopy> = {}) => copy(id, { kind: 'you' }, { state, ...over });

  it('requires a State word on a matching copy, trimmed and in any case', () => {
    const req = lantern('owned', { state: ' Lit ' });
    expect(unlocked(req, [held('a', { state: 'lit' })])).toBe(true);
    expect(unlocked(req, [held('a', { state: 'unlit' })])).toBe(false);
    expect(unlocked(req, [held('a', undefined)])).toBe(false);
    expect(unlocked(lantern('owned', { state: '  ' }), [held('a', undefined)])).toBe(true);
  });

  it('needs every check on the same copy', () => {
    const req = lantern('equipped', { state: 'lit', identity: 'identified' });
    const equipped = { slotId: 'finger', order: 1 };
    expect(unlocked(req, [held('a', { state: 'lit' }), held('b', undefined, { equipped })])).toBe(false);
    expect(unlocked(req, [held('a', { state: 'lit', unidentified: true }, { equipped })])).toBe(false);
    expect(unlocked(req, [held('a', { state: 'lit' }, { equipped })])).toBe(true);
  });

  it('requires identified or unidentified', () => {
    const copies = [held('a', { unidentified: true })];
    expect(unlocked(lantern('owned', { identity: 'unidentified' }), copies)).toBe(true);
    expect(unlocked(lantern('owned', { identity: 'identified' }), copies)).toBe(false);
    expect(unlocked(lantern('owned', { identity: 'identified' }), [held('a', undefined)])).toBe(true);
  });

  it('combines with the owner and Not', () => {
    const onAsh = [copy('a', { kind: 'entity', id: 'ash' }, { state: { state: 'lit' } })];
    const ash = { kind: 'entity', id: 'ash' } as const;
    expect(unlocked(lantern('owned', { owner: ash, state: 'lit' }), onAsh)).toBe(true);
    expect(unlocked(lantern('owned', { owner: { kind: 'you' }, state: 'lit' }), onAsh)).toBe(false);
    expect(unlocked(lantern('owned', { owner: ash, state: 'lit', not: true }), onAsh)).toBe(false);
    expect(unlocked(lantern('owned', { owner: ash, state: 'out', not: true }), onAsh)).toBe(true);
  });

  it('compares by State and identity', () => {
    expect(sameRequirement(lantern('owned', { state: 'Lit' }), lantern('owned', { state: ' lit' }))).toBe(true);
    expect(sameRequirement(lantern('owned', { state: 'lit' }), lantern('owned'))).toBe(false);
    expect(sameRequirement(lantern('owned', { identity: 'identified' }), lantern('owned', { identity: 'unidentified' }))).toBe(false);
  });

  it('reads the checks in parentheses after the name', () => {
    const text = (req: ItemRequirement) => gateOf(gateStates(input([gated(req)], [])), null, 'Curse')?.rows[0].conditions[0].text;
    expect(text(lantern('owned', { state: 'lit' }))).toBe('owning Cursed Ring (lit)');
    expect(text(lantern('equipped', { identity: 'unidentified' }))).toBe('equipping Cursed Ring (unidentified)');
    expect(text(lantern('owned', { state: 'lit', identity: 'unidentified', not: true }))).toBe('not owning Cursed Ring (lit, unidentified)');
  });

  describe('the unidentified face', () => {
    const masked = { reader: 'player' as const, worldItems: [{ id: 'ring', name: 'Cursed Ring', unidentifiedName: 'Plain Ring' }] };
    const text = (copies: ItemCopy[], extra: Partial<GateInput> = masked) =>
      gateOf(gateStates(input([gated(ring())], copies, extra)), null, 'Curse')?.rows[0].conditions[0].text;

    it('names the unidentified face while the owner holds no identified copy', () => {
      expect(text([])).toBe('owning Plain Ring');
      expect(text([held('a', { unidentified: true })])).toBe('owning Plain Ring');
      expect(text([held('a', { unidentified: true }), held('b', undefined)])).toBe('owning Cursed Ring');
    });

    it('ignores a hidden identified copy and another owner\'s identified copy', () => {
      expect(text([held('a', undefined, { visibility: 'hidden' })])).toBe('owning Plain Ring');
      expect(text([copy('a', { kind: 'entity', id: 'ash' })])).toBe('owning Plain Ring');
    });

    it('keeps the true name for the author and for an item with no unidentified face', () => {
      expect(text([], { ...masked, reader: 'author' })).toBe('owning Cursed Ring');
      expect(text([], { reader: 'player' })).toBe('owning Cursed Ring');
    });
  });

  it('round-trips through a character card', () => {
    const req = ring('owned', { state: 'lit', identity: 'identified' });
    const entity = { id: 'ash', name: 'Ash', description: '', traits: [T('Cursed', { requires: [{ all: [req] }] })] } as Entity;
    const home = traitWorldOf({ traits: [], entities: [], items: [{ id: 'ring', name: 'Cursed Ring' }] })!;
    const card = JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, home)));
    expect(parseEntityCardData(card).traits![0].requires![0].all[0]).toEqual({ ...req, name: 'Cursed Ring' });
  });
});

describe('item rules', () => {
  const rows = [{ all: [ring() as TraitRequirement] }];
  const base = input([], [copy('a', { kind: 'entity', id: 'ash' })]);

  it('reads an owner-less Condition as the Item Copy\'s owner', () => {
    expect(itemRuleStates(base, { where: { kind: 'entity', id: 'ash' } }, rows)[0].holds).toBe(true);
    expect(itemRuleStates(base, { where: { kind: 'you' } }, rows)[0].holds).toBe(false);
  });

  it('never holds an owner-less Condition while the copy lies at a location, under Not too (Q91)', () => {
    const at = { where: { kind: 'location', id: 'cave' } } as const;
    expect(itemRuleStates(base, at, rows)[0].holds).toBe(false);
    expect(itemRuleStates(base, at, [{ all: [ring('owned', { not: true })] }])[0].holds).toBe(false);
    // A named owner still reads.
    expect(itemRuleStates(base, at, [{ all: [ring('owned', { owner: { kind: 'entity', id: 'ash' } })] }])[0].holds).toBe(true);
  });

  it('offers one Item Owner section for stats, with no separate Global section', () => {
    const stats = scoped<GateStatSet>({ gold: { name: 'Gold', value: 1, min: 0, max: 9 } }, { ash: { grit: { name: 'Grit', value: 1, min: 0, max: 9 } } });
    const sections = itemHostStatSections({ owners: [], entities: [{ id: 'ash', name: 'Ash' }], stats });
    expect(sections[0]).toMatchObject({ owner: 'Item Owner', own: true });
    expect(sections[0].options.map((o) => o.label).sort()).toEqual(['Gold', 'Grit']);
    expect(sections.some((s) => s.owner === 'Global')).toBe(false);
  });
});

describe('entity files', () => {
  const ash: Entity = {
    id: 'ash', name: 'Ash', description: '',
    traits: [T('Cursed', { requires: [{ all: [ring('equipped')] }] })],
  } as Entity;

  it('round-trips through a character card with its status, owner and Not', () => {
    const req = ring('equipped', { owner: { kind: 'you' }, not: true });
    const entity = { ...ash, traits: [T('Cursed', { requires: [{ all: [req] }] })] } as Entity;
    const home = traitWorldOf({ traits: [], entities: [], items: [{ id: 'ring', name: 'Cursed Ring' }] })!;
    const card = JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, home)));
    expect(parseEntityCardData(card).traits![0].requires![0].all[0]).toEqual({ ...req, name: 'Cursed Ring' });
    const bad = JSON.parse(JSON.stringify(card).replace('"equipped"', '"worn"'));
    expect(parseEntityCardData(bad).traits![0].requires ?? []).toEqual([]);
  });

  it('stores an item by name and rebinds it by name in another world', () => {
    const world = traitWorldOf({ traits: [], entities: [ash], items: [{ id: 'ring', name: 'Cursed Ring' }] })!;
    const carried = portableOwnedTraits(ash, world).traits![0].requires![0].all[0];
    expect(carried).toMatchObject({ kind: 'item', id: 'ring', name: 'Cursed Ring', status: 'equipped' });
    const other = traitWorldOf({ traits: [], entities: [], items: [{ id: 'ring-2', name: 'Cursed Ring' }] })!;
    const bound = bindOwnedTraits({ ...ash, traits: [T('Cursed', { requires: [{ all: [carried] }] })] }, other);
    expect(bound.traits![0].requires![0].all[0]).toMatchObject({ kind: 'item', id: 'ring-2', status: 'equipped' });
  });
});
