/**
 * The Inventory pass's half of the module: its reply schema, its two parsers, and the step that turns the
 * named operations it returns into the validator's id-form operations (Q23, Q24, Q56). Pure.
 */
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { sameCharacterName } from '@/lib/entityMatch';
import { sameWhere } from '@/lib/items';
import type { InventoryPassOp, InventoryPassOpKind, Item, ItemCopy, ItemCopyWhere, RuntimeItem } from '@/types';
import { applyInventoryOps, type InventoryCall, type InventoryOp, type InventoryResult } from './index';

export const PASS_OP_KINDS = ['gain', 'lose', 'transfer', 'equip', 'unequip', 'consume', 'reveal'] as const satisfies readonly InventoryPassOpKind[];
// Fails to compile when the union gains an operation the list lacks.
const _everyOpListed: Exclude<InventoryPassOpKind, (typeof PASS_OP_KINDS)[number]> extends never ? true : never = true;
void _everyOpListed;

/** The most one operation moves, so a stray number cannot flood the inventory. */
export const PASS_QUANTITY_CAP = 99;

/** The owner word the pass writes for the player character, and the one for the location. */
export const PASS_YOU = 'you';
export const PASS_HERE = 'here';
/** What models write for the player character besides `you`, after a leading "the". */
const PLAYER_WORDS = new Set([PASS_YOU, 'i', 'me', 'player', 'player character']);

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
          required: ['op', 'item', 'quantity', 'owner', 'to'],
          properties: {
            op: { type: 'string', enum: [...PASS_OP_KINDS] },
            item: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            owner: { type: 'string' },
            to: { type: 'string' },
          },
        },
      },
    },
  },
});

/** The text pass's reply format, which rides after the user message out of the author's reach. */
export const INVENTORY_TEXT_FORMAT = `

Reply with one line per change: the operation, the item, the quantity, the owner and the receiver, split by " | ". Leave the owner or the receiver empty when the operation has none. Reply NONE when no item changed.`;

/** The schema request's reply format: what the text format's NONE is for the JSON reply. */
export const INVENTORY_JSON_FORMAT = `

Reply with one operation per change. Reply with an empty operations list when no item changed.`;

const isKind = (value: string): value is InventoryPassOpKind => (PASS_OP_KINDS as readonly string[]).includes(value);

const quantityOf = (value: unknown): number => {
  const n = Math.floor(typeof value === 'number' ? value : Number(String(value ?? '').trim() || 1));
  return Number.isFinite(n) && n > 0 ? Math.min(n, PASS_QUANTITY_CAP) : 1;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Item names a schema reply fills in for a turn with no change. */
const NO_ITEM = /^(nothing|none|no items?|n\/a|null)$/i;

const passOp = (raw: Record<string, unknown>): InventoryPassOp | null => {
  const op = text(raw.op).toLowerCase();
  const item = text(raw.item);
  if (!isKind(op) || !item || NO_ITEM.test(item)) return null;
  return { op, item, quantity: quantityOf(raw.quantity), owner: text(raw.owner), to: text(raw.to) };
};

const jsonOps = (raw: string): InventoryPassOp[] | null => {
  try {
    const parsed: unknown = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    const list = Array.isArray(parsed) ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { operations?: unknown }).operations)
        ? (parsed as { operations: unknown[] }).operations : null;
    if (!list) return null;
    return list.flatMap((entry) => (entry && typeof entry === 'object' ? [passOp(entry as Record<string, unknown>)] : []))
      .filter((op): op is InventoryPassOp => op !== null);
  } catch {
    return null;
  }
};

/** The text pass's lines: `op | item | quantity | owner | to`. A line that names no operation is skipped. */
export function parseInventoryLines(raw: string): InventoryPassOp[] {
  return raw.split('\n').flatMap((line) => {
    const [op = '', item = '', quantity = '', owner = '', to = ''] = line.replace(/^[\s*>-]+/, '').split('|').map((s) => s.trim());
    const parsed = passOp({ op, item, quantity, owner, to });
    return parsed ? [parsed] : [];
  });
}

/** The pass's operations from either reply: the schema's JSON, else the text lines. */
export const parseInventoryReply = (raw: string): InventoryPassOp[] => jsonOps(raw) ?? parseInventoryLines(raw);

/** How a pass name is compared: case and surrounding spaces ignored (Q56). */
export const itemNameKey = (name: string): string => name.trim().toLowerCase();

/** What the pass names resolve against. Names are compared after `resolve`. */
export interface PassScene {
  items: readonly Item[];
  runtimeItems: readonly RuntimeItem[];
  /** The played persona's names, which read as `you` beside "you" itself. */
  playerNames: readonly string[];
  /** The entities present after this turn's moves, discovered ones included (Q62). */
  owners: readonly { id: string; name: string }[];
  location: { id: string; name: string } | null;
  resolve?: (text: string) => string;
}

export interface InventoryPassResult extends InventoryResult {
  /** Every runtime item: the scene's, and the ones this reply made. */
  runtimeItems: RuntimeItem[];
}

/** One whole reply through the validator, in order (Q22). Presence comes from `scene` unless `call` sets it. */
export function applyInventoryPass(
  copies: readonly ItemCopy[], passOps: readonly InventoryPassOp[], scene: PassScene, call: Omit<InventoryCall, 'source'>,
): InventoryPassResult {
  const resolve = scene.resolve ?? ((s: string) => s);
  const authored = scene.items.map((item) => ({ item, key: itemNameKey(resolve(item.name)) }));
  let runtimeItems = [...scene.runtimeItems];
  let list: ItemCopy[] = [...copies];
  const doses: InventoryResult['doses'] = [];
  const events: InventoryResult['events'] = [];
  const diagnostics: string[] = [];
  const skip = (why: string) => diagnostics.push(`Inventory (pass) skipped ${why}`);
  const presence = call.presence ?? {
    locationId: scene.location?.id, entityIds: new Set(scene.owners.map((o) => o.id)),
  };

  const run = (ops: InventoryOp[]) => {
    const result = applyInventoryOps(list, ops, { ...call, source: 'pass', presence, runtimeItems });
    list = result.copies;
    doses.push(...result.doses);
    diagnostics.push(...result.diagnostics);
    events.push(...result.events);
  };

  const ownerOf = (name: string): ItemCopyWhere | null => {
    const key = itemNameKey(name);
    if (!key) return null;
    if (PLAYER_WORDS.has(key.replace(/^the\s+/, '')) || scene.playerNames.some((n) => itemNameKey(n) === key)) return { kind: 'you' };
    if (scene.location && (key === PASS_HERE || itemNameKey(scene.location.name) === key)) return { kind: 'location', id: scene.location.id };
    const exact = scene.owners.find((o) => itemNameKey(o.name) === key);
    if (exact) return { kind: 'entity', id: exact.id };
    const loose = scene.owners.filter((o) => sameCharacterName(o.name, name));
    return loose.length === 1 ? { kind: 'entity', id: loose[0].id } : null;
  };

  const runtimeNamed = (key: string) => runtimeItems.find((r) => itemNameKey(r.name) === key);

  const nameMatches = (copy: ItemCopy, key: string): boolean => {
    if (copy.item.kind === 'item') {
      const id = copy.item.itemId;
      return authored.some((a) => a.item.id === id && a.key === key);
    }
    const id = copy.item.runtimeItemId;
    return runtimeNamed(key)?.id === id;
  };

  /** The Item Copies at `where` named `key`, the likeliest target first. */
  const candidates = (key: string, where: ItemCopyWhere, kind: InventoryPassOpKind): ItemCopy[] => {
    const here = list.filter((c) => nameMatches(c, key) && sameWhere(c.where, where));
    const rank = (c: ItemCopy) => (c.visibility === 'hidden' ? 2 : 0) + (c.equipped ? 1 : 0);
    switch (kind) {
      case 'reveal': return here.filter((c) => c.visibility === 'hidden');
      case 'equip': return here.filter((c) => !c.equipped).sort((a, b) => rank(a) - rank(b));
      case 'unequip': return here.filter((c) => c.equipped).sort((a, b) => rank(a) - rank(b));
      default: return here.sort((a, b) => rank(a) - rank(b));
    }
  };

  const gainId = (name: string, key: string): string | null => {
    const match = authored.find((a) => a.key === key);
    if (match) return match.item.id;
    // A world with no authored items never gets runtime items (Q55).
    if (!authored.length) return null;
    const reused = runtimeNamed(key);
    if (reused) return reused.id;
    const made: RuntimeItem = { id: call.newId(), name: name.trim() };
    runtimeItems = [...runtimeItems, made];
    return made.id;
  };

  const known = (key: string) => authored.some((a) => a.key === key) || !!runtimeNamed(key);

  for (const named of passOps) {
    // A name copied with the Items Here summary after it reads as the name before the colon.
    const colon = named.item.indexOf(':');
    const bare = colon > 0 && !known(itemNameKey(named.item)) && known(itemNameKey(named.item.slice(0, colon)));
    let op = bare ? { ...named, item: named.item.slice(0, colon) } : named;
    const key = itemNameKey(op.item);
    // Taking from this place an item it never listed is finding a new one.
    const from = op.op === 'transfer' ? ownerOf(op.owner) : null;
    if (from?.kind === 'location' && !list.some((c) => nameMatches(c, key) && sameWhere(c.where, from))) op = { ...op, op: 'gain' };
    const label = `${op.op} "${op.item}"`;
    if (op.op === 'gain') {
      const to = ownerOf(op.to || op.owner);
      if (!to) {
        skip(`${label}: no one present is "${op.to || op.owner}"`);
        continue;
      }
      // A gain from someone who holds the item is them handing it over.
      const giver = op.owner ? ownerOf(op.owner) : null;
      const held = giver && giver.kind !== 'location' && !sameWhere(giver, to)
        ? candidates(key, giver, 'transfer').filter((c) => c.visibility === 'visible') : [];
      if (held.length) {
        distribute(held, op.quantity, (copy, quantity) => run([{ kind: 'transfer', copyId: copy.id, to, quantity }]));
        continue;
      }
      // Taking what lies here moves it rather than making a second one.
      const lying = to.kind !== 'location' && scene.location
        ? candidates(key, { kind: 'location', id: scene.location.id }, 'transfer').filter((c) => c.visibility === 'visible') : [];
      if (lying.length) {
        distribute(lying, op.quantity, (copy, quantity) => run([{ kind: 'transfer', copyId: copy.id, to, quantity }]));
        continue;
      }
      // Taking a hidden one finds it first.
      const hidden = to.kind !== 'location' && scene.location ? candidates(key, { kind: 'location', id: scene.location.id }, 'reveal') : [];
      if (hidden.length) {
        distribute(hidden, op.quantity, (copy, quantity) => {
          const before = new Set(list.map((c) => c.id));
          run([{ kind: 'reveal', copyId: copy.id, quantity }]);
          // A partial reveal splits a new row off; a whole one keeps its id or merges into a visible stack.
          const shown = list.find((c) => !before.has(c.id)) ?? list.find((c) => c.id === copy.id && c.visibility === 'visible')
            ?? list.find((c) => nameMatches(c, key) && sameWhere(c.where, copy.where) && c.visibility === 'visible');
          if (shown) run([{ kind: 'transfer', copyId: shown.id, to, quantity }]);
        });
        continue;
      }
      // An item already lying here is the scene as listed, not a new one.
      if (to.kind === 'location' && candidates(key, to, 'transfer').some((c) => c.visibility === 'visible')) {
        skip(`${label}: it already lies at "${op.to || op.owner}"`);
        continue;
      }
      const itemId = gainId(op.item, key);
      if (!itemId) {
        skip(`${label}: the world has no item of that name`);
        continue;
      }
      run([{ kind: 'gain', itemId, quantity: op.quantity, to }]);
      continue;
    }

    const where = ownerOf(op.owner);
    if (!where) {
      skip(`${label}: no one present is "${op.owner}"`);
      continue;
    }
    if (op.op === 'transfer' && !ownerOf(op.to)) {
      skip(`${label}: no one present is "${op.to}"`);
      continue;
    }
    if (!candidates(key, where, op.op).length) {
      skip(`${label}: none at "${op.owner}"`);
      continue;
    }
    if (op.op === 'lose' || op.op === 'transfer' || op.op === 'reveal') {
      const to = op.op === 'transfer' ? ownerOf(op.to) : null;
      distribute(candidates(key, where, op.op), op.quantity, (copy, quantity) => run([
        op.op === 'transfer' && to ? { kind: 'transfer', copyId: copy.id, to, quantity }
          : op.op === 'reveal' ? { kind: 'reveal', copyId: copy.id, quantity }
          : { kind: 'lose', copyId: copy.id, quantity },
      ]));
      continue;
    }
    // Equip, unequip and consume act on one Item Copy at a time, read again after each.
    for (let i = 0; i < op.quantity; i += 1) {
      const [copy] = candidates(key, where, op.op);
      if (!copy) break;
      run([{ kind: op.op, copyId: copy.id }]);
    }
  }

  return { copies: list, doses, diagnostics, events, runtimeItems };
}

/** Splits `quantity` over `copies` in order, each taking what it holds. */
function distribute(copies: readonly ItemCopy[], quantity: number, take: (copy: ItemCopy, quantity: number) => void): void {
  let left = quantity;
  for (const copy of copies) {
    if (left <= 0) break;
    const share = Math.min(left, copy.quantity);
    take(copy, share);
    left -= share;
  }
}
