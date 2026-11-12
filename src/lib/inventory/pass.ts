/**
 * The Inventory pass's half of the module: its reply schema, its two parsers, and the step that turns the
 * named operations it returns into the validator's id-form operations (Q23, Q24, Q56). Pure.
 */
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { parseJsonReply } from '@/lib/aiRequest/jsonReply';
import type { PaymentStats } from '@/lib/currency/payment';
import { sameWhere, stateWord } from '@/lib/items';
import { escapeRegExp } from '@/lib/utils';
import type { InventoryPassOp, InventoryPassOpKind, InventoryUseAfter, ItemCopy, ItemCopyWhere, RuntimeItem } from '@/types';
import type { InventoryCall, InventoryResult } from './index';
import { guardTold } from './passGuard';
import { coveredByMoney, settleListedBuy, settlePays } from './passMoney';
import { candidates, distribute, gainId, itemNameKey, listedName, nameMatches, ownerOf, runOps, skip, startPass, type PassRun, type PassScene } from './passRun';

export { itemNameKey, passOwners, PASS_HERE, PASS_YOU, type PassMoney, type PassOwner, type PassScene } from './passRun';

export const PASS_OP_KINDS = ['gain', 'lose', 'transfer', 'equip', 'unequip', 'use', 'change', 'reveal', 'pay', 'buy'] as const satisfies readonly InventoryPassOpKind[];
// Fails to compile when the union gains an operation the list lacks.
const _everyOpListed: Exclude<InventoryPassOpKind, (typeof PASS_OP_KINDS)[number]> extends never ? true : never = true;
void _everyOpListed;

/** The words `after` takes on a use. */
export const PASS_AFTER_WORDS = ['kept', 'used up'] as const satisfies readonly InventoryUseAfter[];

/** The most one operation moves, so a stray number cannot flood the inventory. */
export const PASS_QUANTITY_CAP = 99;

export const inventoryPassSchema = (): ResponseSchema => ({
  name: 'inventory_changes',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['operations'],
    properties: {
      operations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          // Optional, so a reply can close an operation that has no state or after; a required one loops cloud on whitespace.
          required: ['op', 'item', 'quantity', 'owner', 'to'],
          properties: {
            op: { type: 'string', enum: [...PASS_OP_KINDS] },
            item: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            owner: { type: 'string' },
            to: { type: 'string' },
            state: { type: 'string' },
            after: { type: 'string', enum: ['', ...PASS_AFTER_WORDS] },
            target: { type: 'string' },
            slot: { type: 'string' },
            price: { type: 'string' },
            currency: { type: 'string' },
          },
        },
      },
    },
  },
});

/** The text pass's reply format, which rides after the user message out of the author's reach. */
export const INVENTORY_TEXT_FORMAT = `

Reply with one line per change: the operation, the item, the quantity, the owner, the receiver, the state, the after, the target, the slot, the price and the currency, split by " | ". Leave a field empty when the operation has none. Reply NONE when no item or money changed.`;

/** The schema request's reply format: what the text format's NONE is for the JSON reply. */
export const INVENTORY_JSON_FORMAT = `

Reply with one operation per change. Reply with an empty operations list when no item or money changed.`;

const isKind = (value: string): value is InventoryPassOpKind => (PASS_OP_KINDS as readonly string[]).includes(value);

const quantityOf = (value: unknown): number => {
  const n = Math.floor(typeof value === 'number' ? value : Number(String(value ?? '').trim() || 1));
  return Number.isFinite(n) && n > 0 ? Math.min(n, PASS_QUANTITY_CAP) : 1;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Item names a schema reply fills in for a turn with no change. */
const NO_ITEM = /^(nothing|none|no items?|n\/a|null)$/i;

/** `used up` however the model spaces or joins it; anything else reads as none. */
const afterOf = (value: unknown): InventoryUseAfter | undefined => {
  const word = text(value).toLowerCase().replace(/[\s_-]+/g, ' ').replace(/^usedup$/, 'used up');
  return PASS_AFTER_WORDS.find((w) => w === word);
};

const passOp = (raw: Record<string, unknown>): InventoryPassOp | null => {
  const op = text(raw.op).toLowerCase();
  const item = text(raw.item);
  // A pay moves money with no item.
  if (!isKind(op) || (op !== 'pay' && (!item || NO_ITEM.test(item)))) return null;
  const after = afterOf(raw.after);
  const target = text(raw.target);
  const slot = text(raw.slot);
  // A model can answer a price with a bare number, or put a pay's sum in the quantity cell of a text line.
  const quantityText = text(raw.quantity);
  const price = typeof raw.price === 'number' ? String(raw.price)
    : text(raw.price) || (op === 'pay' && quantityText && !/^\d+$/.test(quantityText) ? quantityText : '');
  const currency = text(raw.currency);
  return {
    op, item, quantity: quantityOf(raw.quantity), owner: text(raw.owner), to: text(raw.to),
    ...(raw.state !== undefined && { state: text(raw.state) }), ...(after && { after }),
    ...(target && !NO_ITEM.test(target) && { target }),
    ...(slot && !NO_ITEM.test(slot) && { slot }),
    ...(price && !NO_ITEM.test(price) && { price }),
    ...(currency && !NO_ITEM.test(currency) && { currency }),
  };
};

const jsonOps = (raw: string): InventoryPassOp[] | null => {
  const parsed = parseJsonReply(raw);
  const list = Array.isArray(parsed) ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { operations?: unknown }).operations)
      ? (parsed as { operations: unknown[] }).operations : null;
  if (!list) return null;
  return list.flatMap((entry) => (entry && typeof entry === 'object' ? [passOp(entry as Record<string, unknown>)] : []))
    .filter((op): op is InventoryPassOp => op !== null);
};

/** A cell a reply labeled with its field's name, as in `item: Rope`. */
const FIELD_LABEL = /^(op|operation|item|quantity|owner|to|receiver|state|after|target|slot|price|currency):\s*/i;

/** The text pass's lines: `op | item | quantity | owner | to | state | after | target | slot | price | currency`. A line that names no operation is skipped. */
export function parseInventoryLines(raw: string): InventoryPassOp[] {
  return raw.split('\n').flatMap((line) => {
    const [op = '', item = '', quantity = '', owner = '', to = '', state, after = '', target = '', slot = '', price = '', currency = ''] = line.replace(/^[\s*>-]+/, '').split('|').map((s) => s.trim().replace(FIELD_LABEL, ''));
    const parsed = passOp({ op, item, quantity, owner, to, state, after, target, slot, price, currency });
    return parsed ? [parsed] : [];
  });
}

/** The pass's operations from either reply: the schema's JSON, else the text lines. */
export const parseInventoryReply = (raw: string): InventoryPassOp[] => jsonOps(raw) ?? parseInventoryLines(raw);

export interface InventoryPassResult extends InventoryResult {
  /** Every runtime item: the scene's, and the ones this reply made. */
  runtimeItems: RuntimeItem[];
  /** The reply's operations less the shown Listed Actions' repeats: what a re-roll replays. */
  ops: InventoryPassOp[];
  /** The stats after this reply's payments. Absent when the scene has no money. */
  stats?: PaymentStats;
}

/** One whole reply through the validator, in order (Q22). Presence comes from `scene` unless `call` sets it. */
export function applyInventoryPass(
  copies: readonly ItemCopy[], passOps: readonly InventoryPassOp[], scene: PassScene, call: Omit<InventoryCall, 'source'>,
): InventoryPassResult {
  const pass = startPass(copies, scene, call);
  const ops = guardTold(pass, passOps);
  const money = settlePays(pass, ops);
  const handMoves = new Set<string>();
  for (const named of ops) {
    if (named.op === 'pay') continue;
    if (named.op === 'buy') settleListedBuy(pass, named, money.buys);
    else if (!coveredByMoney(pass, named, money, handMoves)) applyItemOp(pass, named);
  }
  const { list, itemUses, diagnostics, events, runtimeItems, moneyStats } = pass;
  return { copies: list, itemUses, diagnostics, events, runtimeItems, ops, ...(moneyStats && { stats: moneyStats }) };
}

type ItemOp = InventoryPassOp & { op: Exclude<InventoryPassOpKind, 'pay' | 'buy'> };
type HeldOp = InventoryPassOp & { op: Exclude<ItemOp['op'], 'gain'> };

/** One operation that moves or acts on items, with its name read through the Items Here marks. */
function applyItemOp(pass: PassRun, named: InventoryPassOp): void {
  // The reply loop sends only item operations here.
  let op = { ...named, item: listedName(pass, named.item) } as ItemOp;
  const key = itemNameKey(op.item);
  // Taking from this place an item it never listed is finding a new one.
  const from = op.op === 'transfer' ? ownerOf(pass, op.owner) : null;
  if (from?.kind === 'location' && !pass.list.some((c) => nameMatches(pass, c, key) && sameWhere(c.where, from))) op = { ...op, op: 'gain' };
  if (op.op === 'gain') applyGain(pass, op, key);
  // The check above leaves every kind but gain, which an intersection can't narrow.
  else applyHeldOp(pass, op as HeldOp, key);
}

function applyGain(pass: PassRun, op: ItemOp, key: string): void {
  const label = `${op.op} "${op.item}"`;
  const here = pass.scene.location;
  const to = ownerOf(pass, op.to || op.owner);
  if (!to) {
    skip(pass, `${label}: nothing present is named "${op.to || op.owner}"`);
    return;
  }
  // A gain from someone who holds the item is them handing it over.
  const giver = op.owner ? ownerOf(pass, op.owner) : null;
  // A gain whose source is its own recipient is the item it already holds.
  if (giver && sameWhere(giver, to)) {
    skip(pass, `${label}: it comes from "${op.owner}", who receives it`);
    return;
  }
  const held = giver && giver.kind !== 'location' && !sameWhere(giver, to)
    ? candidates(pass, key, giver, 'transfer').filter((c) => c.visibility === 'visible') : [];
  if (held.length) {
    distribute(held, op.quantity, (copy, quantity) => runOps(pass, [{ kind: 'transfer', copyId: copy.id, to, quantity }]));
    return;
  }
  // Taking what lies here moves it rather than making a second one.
  const lying = to.kind !== 'location' && here
    ? candidates(pass, key, { kind: 'location', id: here.id }, 'transfer').filter((c) => c.visibility === 'visible') : [];
  if (lying.length) {
    distribute(lying, op.quantity, (copy, quantity) => runOps(pass, [{ kind: 'transfer', copyId: copy.id, to, quantity }]));
    return;
  }
  // Taking a hidden one finds it first.
  const hidden = to.kind !== 'location' && here
    ? candidates(pass, key, { kind: 'location', id: here.id }, 'reveal').filter((c) => c.visibility === 'hidden') : [];
  if (hidden.length) {
    distribute(hidden, op.quantity, (copy, quantity) => {
      const before = new Set(pass.list.map((c) => c.id));
      runOps(pass, [{ kind: 'reveal', copyId: copy.id, quantity }]);
      // A partial reveal splits a new row off; a whole one keeps its id or merges into a visible stack.
      const shown = pass.list.find((c) => !before.has(c.id)) ?? pass.list.find((c) => c.id === copy.id && c.visibility === 'visible')
        ?? pass.list.find((c) => nameMatches(pass, c, key) && sameWhere(c.where, copy.where) && c.visibility === 'visible');
      if (shown) runOps(pass, [{ kind: 'transfer', copyId: shown.id, to, quantity }]);
    });
    return;
  }
  // An item already lying here is the scene as listed, not a new one.
  if (to.kind === 'location' && candidates(pass, key, to, 'transfer').some((c) => c.visibility === 'visible')) {
    skip(pass, `${label}: it is already at "${op.to || op.owner}"`);
    return;
  }
  const itemId = gainId(pass, op.item, key);
  if (!itemId) {
    skip(pass, `${label}: the world has no item of that name`);
    return;
  }
  runOps(pass, [{ kind: 'gain', itemId, quantity: op.quantity, to }]);
}

/** Lose, transfer, reveal, equip, unequip, use and change: each acts on copies `op.owner` holds. */
function applyHeldOp(pass: PassRun, op: HeldOp, key: string): void {
  const label = `${op.op} "${op.item}"`;
  const where = ownerOf(pass, op.owner);
  if (!where) {
    skip(pass, `${label}: nothing present is named "${op.owner}"`);
    return;
  }
  if (op.op === 'transfer' && !ownerOf(pass, op.to)) {
    skip(pass, `${label}: nothing present is named "${op.to}"`);
    return;
  }
  // A change needs any copy here; its State check follows.
  const held = op.op === 'change' ? pass.list.some((c) => nameMatches(pass, c, key) && sameWhere(c.where, where)) : candidates(pass, key, where, op.op).length > 0;
  if (!held) {
    skip(pass, `${label}: none at "${op.owner}"`);
    return;
  }
  if (op.op === 'change') {
    if (op.state === undefined) {
      skip(pass, `${label}: it names no state`);
      return;
    }
    if (!candidates(pass, key, where, op.op, op.state).length) {
      skip(pass, `${label}: every one at "${op.owner}" is already ${stateWord(op.state) ?? 'without a State'}`);
      return;
    }
  }
  if (op.op === 'lose' || op.op === 'transfer' || op.op === 'reveal') {
    const to = op.op === 'transfer' ? ownerOf(pass, op.to) : null;
    distribute(candidates(pass, key, where, op.op), op.quantity, (copy, quantity) => runOps(pass, [
      op.op === 'transfer' && to ? { kind: 'transfer', copyId: copy.id, to, quantity }
        : op.op === 'reveal' ? { kind: 'reveal', copyId: copy.id, quantity }
        : { kind: 'lose', copyId: copy.id, quantity },
    ]));
    return;
  }
  // Equip, unequip, use and change act on one Item Copy at a time, read again after each.
  for (let i = 0; i < op.quantity; i += 1) {
    const [copy] = candidates(pass, key, where, op.op, op.state);
    if (!copy) break;
    // A use's `to` names no receiver, so an item named there is the target the reply misplaced.
    const aimed = op.op !== 'use' ? '' : op.target || (op.to && !ownerOf(pass, op.to) ? op.to : '');
    // The item named as its own target is a plain use.
    const target = aimed && itemNameKey(listedName(pass, aimed.replace(/^the\s+/i, ''))) !== key ? targetOf(pass, aimed, where, copy.id) : undefined;
    if (target === null) skip(pass, `target "${aimed}" of ${label}: none at "${op.owner}" or here`);
    // The name holds one copy; a further one takes the first free slot.
    const slotId = op.op === 'equip' && i === 0 ? namedSlot(pass, copy, op.slot) : undefined;
    if (slotId === null) {
      skip(pass, `${label}: no slot is named "${op.slot}"`);
      break;
    }
    runOps(pass, [op.op === 'change' ? { kind: 'change', copyId: copy.id, state: op.state ?? '' }
      : op.op === 'use' ? { kind: 'use', copyId: copy.id, ...(op.after && { after: op.after }), ...(target && { targetCopyId: target.id }) }
      : op.op === 'equip' ? { kind: 'equip', copyId: copy.id, ...(slotId && { slotId }) }
      : { kind: op.op, copyId: copy.id }]);
  }
}

/** The visible copy a use acts on: one `where` holds, else one lying here; never the used copy itself. */
function targetOf(pass: PassRun, name: string, where: ItemCopyWhere, usedId: string): ItemCopy | null {
  const key = itemNameKey(listedName(pass, name.replace(/^the\s+/i, '')));
  const { location } = pass.scene;
  const places = [where, ...(location ? [{ kind: 'location' as const, id: location.id }] : [])];
  for (const place of places) {
    const [hit] = candidates(pass, key, place, 'transfer').filter((c) => c.id !== usedId && c.visibility === 'visible');
    if (hit) return hit;
  }
  return null;
}

/** The slot id a reply named: undefined for no name or two or more of the item's own slots joined (Q65), null for a name no slot has. */
function namedSlot(pass: PassRun, copy: ItemCopy, name: string | undefined): string | undefined | null {
  const key = itemNameKey(name ?? '');
  if (!key) return undefined;
  const slots = pass.call.world.slots ?? [];
  const ref = copy.item;
  const rule = ref.kind === 'item' ? pass.authored.find((a) => a.item.id === ref.itemId)?.item.slotRule : undefined;
  const own = slots.filter((s) => rule?.slotIds.includes(s.id)).map((s) => itemNameKey(s.name)).sort((a, b) => b.length - a.length);
  // Longest first, so `hand` never counts inside `off hand`. Whole names only, so `off handle` holds no `off hand`.
  let rest = key;
  let joined = 0;
  for (const slotName of own) {
    const whole = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(slotName)}(?![\\p{L}\\p{N}])`, 'u');
    if (!whole.test(rest)) continue;
    rest = rest.replace(whole, ' ');
    joined += 1;
  }
  if (joined >= 2) return undefined;
  const matches = slots.filter((s) => itemNameKey(s.name) === key);
  return (matches.find((s) => rule?.slotIds.includes(s.id)) ?? matches[0])?.id ?? null;
}
