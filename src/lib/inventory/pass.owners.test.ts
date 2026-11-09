import { describe, expect, it } from 'vitest';
import { encodePlaceholderToken, resolvePlaceholders } from '@/lib/placeholders';
import { resolveEntityNames } from '@/lib/resolveWorldNames';
import { phValues } from '@/test/placeholderValues';
import type { Entity, InventoryPassOp, Item, ItemCopy } from '@/types';
import { applyInventoryPass, passOwners, type PassScene } from '.';

const FIRST = { id: 'ph-first', name: 'First Name', values: phValues(['Wren']) };
const resolve = (text: string) => resolvePlaceholders(text, { placeholders: [FIRST], rolls: {} });

const entity = (over: Partial<Entity>): Entity =>
  ({ id: 'e', name: 'x', playerDescription: '', aiDescription: '', ...over }) as Entity;

const tonic: Item = { id: 'tonic', name: 'Tonic', statEffects: [], traitEffects: [], equipRequires: [] };
const you = { kind: 'you' } as const;
const copy = (id: string, where: ItemCopy['where']): ItemCopy =>
  ({ id, item: { kind: 'item', itemId: 'tonic' }, where, quantity: 1, visibility: 'visible' });
const op = (kind: InventoryPassOp['op'], over: Partial<InventoryPassOp>): InventoryPassOp =>
  ({ op: kind, item: 'Tonic', quantity: 1, owner: '', to: '', ...over });

// The Name is a role title; the in-story first name exists only as an Alias built from a placeholder.
const [captain] = resolveEntityNames([entity({ id: 'captain', name: 'The Captain', aliases: [encodePlaceholderToken({ id: FIRST.id, mode: 'world', placementId: 'p1' })] })], resolve);
const stranger = entity({ id: 'hood', name: 'Odile', strangerName: 'a hooded woman' });
const stored = [{ id: 'captain', name: captain.name }, { id: 'hood', name: 'Odile' }];

const run = (copies: ItemCopy[], ops: InventoryPassOp[], storyAliases: Record<string, string> = {}, owners = stored, entities = [captain, stranger]) => {
  const scene: PassScene = { items: [tonic], runtimeItems: [], playerNames: ['Ash'], owners: passOwners(owners, entities, storyAliases), location: null };
  return applyInventoryPass(copies, ops, scene, { world: { items: [tonic] }, newId: () => 'n' });
};
const whereOf = (result: ReturnType<typeof run>) => result.copies.map((c) => c.where);

describe('Inventory owners by Alias (Q17)', () => {
  it('applies an op owned by an Alias built from a placeholder', () => {
    expect(captain.aliases).toEqual(['Wren']);
    const result = run([copy('t', { kind: 'entity', id: 'captain' })], [op('lose', { owner: 'wren' })]);
    expect(result.diagnostics).toEqual([]);
    expect(result.copies).toEqual([]);
  });

  it('applies a transfer whose `to` is an Alias, and a gain to one', () => {
    const result = run([copy('t', you)], [op('transfer', { owner: 'you', to: 'Wren' }), op('gain', { to: 'Wren' })]);
    expect(result.diagnostics).toEqual([]);
    expect(whereOf(result)).toEqual([{ kind: 'entity', id: 'captain' }]);
    expect(result.copies[0].quantity).toBe(2);
  });

  it("applies an op owned by a stranger's Stranger Name, and by its latest story alias, met or not (Q19)", () => {
    const byName = run([copy('t', you)], [op('transfer', { owner: 'you', to: 'A Hooded Woman' })]);
    expect(byName.diagnostics).toEqual([]);
    expect(whereOf(byName)).toEqual([{ kind: 'entity', id: 'hood' }]);
    const aliased = { hood: 'the veiled courier' };
    const both = run([copy('t', you), copy('u', you)], [
      op('transfer', { owner: 'you', to: 'the veiled courier' }), op('transfer', { owner: 'you', to: 'a hooded woman' }),
    ], aliased);
    expect(both.diagnostics).toEqual([]);
    expect(whereOf(both)).toEqual([{ kind: 'entity', id: 'hood' }]);
    expect(both.copies[0].quantity).toBe(2);
  });

  it('still skips a name no present owner carries, with the same reason', () => {
    const result = run([copy('t', you)], [op('transfer', { owner: 'you', to: 'Odette' })]);
    expect(result.diagnostics).toEqual(['Inventory (pass) skipped transfer "Tonic": nothing present is named "Odette"']);
    expect(whereOf(result)).toEqual([you]);
  });

  it('lets a Name win over another owner\'s Alias, and skips an Alias two owners share', () => {
    const wren = entity({ id: 'wren', name: 'Wren' });
    const twin = entity({ id: 'twin', name: 'The Twin', aliases: ['Wren'] });
    const entities = [captain, wren, twin];
    const give = [op('transfer', { owner: 'you', to: 'Wren' })];
    const named = run([copy('t', you)], give, {}, [{ id: 'captain', name: captain.name }, { id: 'wren', name: 'Wren' }], entities);
    expect(whereOf(named)).toEqual([{ kind: 'entity', id: 'wren' }]);
    const shared = run([copy('t', you)], give, {}, [{ id: 'captain', name: captain.name }, { id: 'twin', name: 'The Twin' }], entities);
    expect(shared.diagnostics).toEqual(['Inventory (pass) skipped transfer "Tonic": nothing present is named "Wren"']);
  });

  it('keeps an owner with no other name as stored', () => {
    const plain = entity({ id: 'plain', name: 'Bram' });
    expect(passOwners([{ id: 'plain', name: 'Bram' }], [plain], {})).toEqual([{ id: 'plain', name: 'Bram' }]);
  });
});
