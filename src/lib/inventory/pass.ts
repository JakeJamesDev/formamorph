/**
 * The Inventory pass's half of the module: its reply schema, its two parsers, and the step that turns the
 * named operations it returns into the validator's id-form operations (Q23, Q24, Q56). Pure.
 */
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { sameCharacterName } from '@/lib/entityMatch';
import { isUnidentified, sameState, sameWhere, stateWord } from '@/lib/items';
import type { InventoryPassOp, InventoryPassOpKind, InventoryUseAfter, Item, ItemCopy, ItemCopyWhere, RuntimeItem } from '@/types';
import { applyInventoryOps, type InventoryCall, type InventoryOp, type InventoryResult } from './index';

export const PASS_OP_KINDS = ['gain', 'lose', 'transfer', 'equip', 'unequip', 'use', 'change', 'reveal'] as const satisfies readonly InventoryPassOpKind[];
// Fails to compile when the union gains an operation the list lacks.
const _everyOpListed: Exclude<InventoryPassOpKind, (typeof PASS_OP_KINDS)[number]> extends never ? true : never = true;
void _everyOpListed;

/** The words `after` takes on a use. */
export const PASS_AFTER_WORDS = ['kept', 'used up'] as const satisfies readonly InventoryUseAfter[];

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
          },
        },
      },
    },
  },
});

/** The text pass's reply format, which rides after the user message out of the author's reach. */
export const INVENTORY_TEXT_FORMAT = `

Reply with one line per change: the operation, the item, the quantity, the owner, the receiver, the state and the after, split by " | ". Leave a field empty when the operation has none. Reply NONE when no item changed.`;

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

/** `used up` however the model spaces or joins it; anything else reads as none. */
const afterOf = (value: unknown): InventoryUseAfter | undefined => {
  const word = text(value).toLowerCase().replace(/[\s_-]+/g, ' ').replace(/^usedup$/, 'used up');
  return PASS_AFTER_WORDS.find((w) => w === word);
};

const passOp = (raw: Record<string, unknown>): InventoryPassOp | null => {
  const op = text(raw.op).toLowerCase();
  const item = text(raw.item);
  if (!isKind(op) || !item || NO_ITEM.test(item)) return null;
  const after = afterOf(raw.after);
  return {
    op, item, quantity: quantityOf(raw.quantity), owner: text(raw.owner), to: text(raw.to),
    ...(raw.state !== undefined && { state: text(raw.state) }), ...(after && { after }),
  };
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

/** The text pass's lines: `op | item | quantity | owner | to | state | after`. A line that names no operation is skipped. */
export function parseInventoryLines(raw: string): InventoryPassOp[] {
  return raw.split('\n').flatMap((line) => {
    const [op = '', item = '', quantity = '', owner = '', to = '', state, after = ''] = line.replace(/^[\s*>-]+/, '').split('|').map((s) => s.trim());
    const parsed = passOp({ op, item, quantity, owner, to, state, after });
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
  const authored = scene.items.map((item) => ({
    item, key: itemNameKey(resolve(item.name)), face: item.unidentifiedName?.trim() ? itemNameKey(resolve(item.unidentifiedName)) : '',
  }));
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

  /** `key` is the item's Unidentified Name. */
  const isFace = (a: (typeof authored)[number], key: string) => !!a.face && a.face === key;

  const runtimeNamed = (key: string) => runtimeItems.find((r) => itemNameKey(r.name) === key);

  /** A copy goes by its true name, and by its Unidentified Name while unidentified. */
  const nameMatches = (copy: ItemCopy, key: string): boolean => {
    if (copy.item.kind === 'item') {
      const id = copy.item.itemId;
      return authored.some((a) => a.item.id === id && (a.key === key || (isFace(a, key) && isUnidentified(copy))));
    }
    const id = copy.item.runtimeItemId;
    return runtimeNamed(key)?.id === id;
  };

  /** The Item Copies at `where` named `key`, the likeliest target first. */
  const candidates = (key: string, where: ItemCopyWhere, kind: InventoryPassOpKind, state = ''): ItemCopy[] => {
    const here = list.filter((c) => nameMatches(c, key) && sameWhere(c.where, where));
    const rank = (c: ItemCopy) => (c.visibility === 'hidden' ? 2 : 0) + (c.equipped ? 1 : 0);
    switch (kind) {
      // Hidden copies first, then visible unidentified ones.
      case 'reveal': return [...here.filter((c) => c.visibility === 'hidden'), ...here.filter((c) => c.visibility === 'visible' && isUnidentified(c))];
      case 'equip': return here.filter((c) => !c.equipped).sort((a, b) => rank(a) - rank(b));
      case 'unequip': return here.filter((c) => c.equipped).sort((a, b) => rank(a) - rank(b));
      // A copy already at the new State is not changed again.
      case 'change': return here.filter((c) => !sameState(c, { state: { state } })).sort((a, b) => rank(a) - rank(b));
      default: return here.sort((a, b) => rank(a) - rank(b));
    }
  };

  /** The one authored item whose Unidentified Name is `key`; none when several share it (Q43). */
  const byFace = (key: string) => {
    const faces = authored.filter((a) => isFace(a, key));
    return faces.length === 1 ? faces[0] : undefined;
  };

  const gainId = (name: string, key: string): string | null => {
    const match = authored.find((a) => a.key === key) ?? byFace(key);
    if (match) return match.item.id;
    // A world with no authored items never gets runtime items (Q55).
    if (!authored.length) return null;
    const reused = runtimeNamed(key);
    if (reused) return reused.id;
    const made: RuntimeItem = { id: call.newId(), name: name.trim() };
    runtimeItems = [...runtimeItems, made];
    return made.id;
  };

  const known = (key: string) => authored.some((a) => a.key === key || isFace(a, key)) || !!runtimeNamed(key);

  for (const named of passOps) {
    // A name copied with the Items Here summary or marks after it reads as the name before the colon or " (".
    const cut = [named.item.indexOf(':'), named.item.indexOf(' (')].filter((at) => at > 0)
      .find((at) => !known(itemNameKey(named.item)) && known(itemNameKey(named.item.slice(0, at))));
    let op = cut !== undefined ? { ...named, item: named.item.slice(0, cut) } : named;
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
      // A gain whose source is its own recipient is the item it already holds.
      if (giver && sameWhere(giver, to)) {
        skip(`${label}: it comes from "${op.owner}", who receives it`);
        continue;
      }
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
      const hidden = to.kind !== 'location' && scene.location
        ? candidates(key, { kind: 'location', id: scene.location.id }, 'reveal').filter((c) => c.visibility === 'hidden') : [];
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
    // A change needs any copy here; its State check follows.
    const held = op.op === 'change' ? list.some((c) => nameMatches(c, key) && sameWhere(c.where, where)) : candidates(key, where, op.op).length > 0;
    if (!held) {
      skip(`${label}: none at "${op.owner}"`);
      continue;
    }
    if (op.op === 'change') {
      if (op.state === undefined) {
        skip(`${label}: it names no state`);
        continue;
      }
      if (!candidates(key, where, op.op, op.state).length) {
        skip(`${label}: every one at "${op.owner}" is already ${stateWord(op.state) ?? 'without a State'}`);
        continue;
      }
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
    // Equip, unequip, use and change act on one Item Copy at a time, read again after each.
    for (let i = 0; i < op.quantity; i += 1) {
      const [copy] = candidates(key, where, op.op, op.state);
      if (!copy) break;
      run([op.op === 'change' ? { kind: 'change', copyId: copy.id, state: op.state ?? '' }
        : op.op === 'use' ? { kind: 'use', copyId: copy.id, ...(op.after && { after: op.after }) }
        : { kind: op.op, copyId: copy.id }]);
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
