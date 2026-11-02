/**
 * The Inventory pass's half of the module: its reply schema, its two parsers, and the step that turns the
 * named operations it returns into the validator's id-form operations (Q23, Q24, Q56). Pure.
 */
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { slotOwnerKey, type SlotOwner } from '@/lib/bodies';
import { applyPaymentStats, currenciesSettle, currencyOf, namesMoney, planPayment, readStatedPrice, type PaymentStats } from '@/lib/currency';
import { sameCharacterName } from '@/lib/entityMatch';
import { isUnidentified, sameState, sameWhere, stateWord, usesLeft } from '@/lib/items';
import { escapeRegExp } from '@/lib/utils';
import type { Currency, InventoryPassOp, InventoryPassOpKind, InventoryUseAfter, Item, ItemCopy, ItemCopyWhere, Placement, PlayerStat, RuntimeItem } from '@/types';
import { applyInventoryOps, type InventoryCall, type InventoryOp, type InventoryResult } from './index';

export const PASS_OP_KINDS = ['gain', 'lose', 'transfer', 'equip', 'unequip', 'use', 'change', 'reveal', 'pay', 'buy'] as const satisfies readonly InventoryPassOpKind[];
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
  /** What a pay settles against. Absent, every pay is skipped. */
  money?: PassMoney;
}

/** The world's money and the stats that can hold it. */
export interface PassMoney {
  currencies: readonly Currency[];
  placements: readonly Placement[];
  stats: PaymentStats;
  /** The entities the player plays as, whose stats are the player's. */
  playedIds: readonly string[];
  /** Which of `stats`, an owner's or the world's on null, are switched on. */
  statsOn: (ownerId: string | null, stats: readonly PlayerStat[]) => readonly PlayerStat[];
}

export interface InventoryPassResult extends InventoryResult {
  /** Every runtime item: the scene's, and the ones this reply made. */
  runtimeItems: RuntimeItem[];
  /** The stats after this reply's payments. Absent when the scene has no money. */
  stats?: PaymentStats;
}

/** What a buy's money comes to before anything moves. */
type BuyQuote = { kind: 'alone'; currency?: Currency } | { kind: 'priced'; currency: Currency; amount: number } | { kind: 'refused'; reason: string };

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
  const itemUses: InventoryResult['itemUses'] = [];
  const events: InventoryResult['events'] = [];
  const diagnostics: string[] = [];
  const skip = (why: string) => diagnostics.push(`Inventory (pass) skipped ${why}`);
  const presence = call.presence ?? {
    locationId: scene.location?.id, entityIds: new Set(scene.owners.map((o) => o.id)),
  };

  const run = (ops: InventoryOp[]) => {
    const result = applyInventoryOps(list, ops, { ...call, source: 'pass', presence, runtimeItems });
    list = result.copies;
    itemUses.push(...result.itemUses);
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

  /** Who a pay or buy names. A name no one present answers to, or this place, holds no money and reads as no one (Q51). */
  const partyOf = (name: string): SlotOwner | null => {
    const where = ownerOf(name);
    if (where) return where.kind === 'location' ? null : where;
    return name.trim() && scene.playerNames.some((player) => sameCharacterName(player, name)) ? { kind: 'you' } : null;
  };

  let moneyStats = scene.money?.stats;

  const moneyNames = scene.items.map((item) => ({ id: item.id, name: resolve(item.name) }));
  const moneyCurrencies = (scene.money?.currencies ?? []).map((currency) => ({ ...currency, name: resolve(currency.name) }));

  /** Moves the money, or answers why it can't move. */
  const movePayment = (currency: Currency, payer: SlotOwner | null, payee: SlotOwner | null, amount: number): string | null => {
    if (!scene.money || !moneyStats) return 'the world has no Currency';
    const { money } = scene;
    const stats = moneyStats;
    const onFor = (id: string) => money.statsOn(id, stats.entityStats[id] ?? []);
    const plan = planPayment(currency, payer, payee, amount, {
      copies: list, placements: money.placements, globalStats: money.statsOn(null, stats.globalStats),
      statsOf: (owner) => (owner.kind === 'entity' ? onFor(owner.id) : money.playedIds.flatMap(onFor)),
    }, moneyNames);
    if (!plan.settled) return plan.reason;
    if (plan.ops.length) run(plan.ops);
    // A switched-off stat reads as untracked, so the charge lands on the played entity whose stat was read.
    moneyStats = applyPaymentStats(stats, plan.stats, (statId) => money.playedIds.find((id) => onFor(id).some((stat) => stat.id === statId)));
    return null;
  };

  const payLabel = (op: InventoryPassOp) => `pay "${op.price ?? ''}"`;

  /** The words of a pay's sum. A reply can name the money as the item or the currency alone, with how many as a quantity above 1. */
  const payPrice = (op: InventoryPassOp) => op.price || op.item || (op.currency && op.quantity > 1 ? String(op.quantity) : '');

  const statedPay = (op: InventoryPassOp) =>
    readStatedPrice(payPrice(op), op.currency ?? '', moneyCurrencies, moneyNames, op.quantity > 1 ? op.quantity : undefined);

  /** Settles one pay and answers the Currencies it governs (Q56, Q76). */
  const settlePay = (op: InventoryPassOp): readonly Currency[] => {
    if (!scene.money) {
      skip(`${payLabel(op)}: the world has no Currency`);
      return [];
    }
    // A pay names no item, so one that names anything but money is talk about a price (Q70).
    if (op.item && !namesMoney(listedName(op.item), moneyCurrencies, moneyNames)) {
      skip(`${payLabel(op)}: "${op.item}" isn't money`);
      return !op.price && partyOf(op.owner)?.kind !== 'you' ? [] : moneyCurrencies;
    }
    const stated = statedPay(op);
    if ('refused' in stated) {
      skip(`${payLabel(op)}: ${stated.refused}`);
      return !op.price && partyOf(op.owner)?.kind !== 'you' ? [] : moneyCurrencies;
    }
    const payer = partyOf(op.owner);
    const payee = partyOf(op.to);
    const refused = movePayment(stated.currency, payer, payee, stated.amount);
    if (refused) skip(`${payLabel(op)}: ${refused}`);
    return payer || payee ? [stated.currency] : [];
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
      // A spent copy goes last, so a charged one beside it is used first.
      case 'use': {
        const spent = (c: ItemCopy) => (c.item.kind === 'item'
          && usesLeft(c, authored.find((a) => c.item.kind === 'item' && a.item.id === c.item.itemId)?.item) === 0 ? 4 : 0);
        return here.sort((a, b) => spent(a) + rank(a) - spent(b) - rank(b));
      }
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

  /** A name copied with the Items Here summary or marks after it reads as the name before the colon or " (". */
  const listedName = (name: string): string => {
    const cut = [name.indexOf(':'), name.indexOf(' (')].filter((at) => at > 0)
      .find((at) => !known(itemNameKey(name)) && known(itemNameKey(name.slice(0, at))));
    return cut !== undefined ? name.slice(0, cut) : name;
  };

  /** The visible copy a use acts on: one `where` holds, else one lying here; never the used copy itself. */
  const targetOf = (name: string, where: ItemCopyWhere, usedId: string): ItemCopy | null => {
    const key = itemNameKey(listedName(name.replace(/^the\s+/i, '')));
    const places = [where, ...(scene.location ? [{ kind: 'location' as const, id: scene.location.id }] : [])];
    for (const place of places) {
      const [hit] = candidates(key, place, 'transfer').filter((c) => c.id !== usedId && c.visibility === 'visible');
      if (hit) return hit;
    }
    return null;
  };

  /** The slot id a reply named: undefined for no name or two or more of the item's own slots joined (Q65), null for a name no slot has. */
  const namedSlot = (copy: ItemCopy, name: string | undefined): string | undefined | null => {
    const key = itemNameKey(name ?? '');
    if (!key) return undefined;
    const slots = call.world.slots ?? [];
    const ref = copy.item;
    const rule = ref.kind === 'item' ? authored.find((a) => a.item.id === ref.itemId)?.item.slotRule : undefined;
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
  };

  const authoredNamed = (name: string) => {
    const key = itemNameKey(listedName(name));
    return (authored.find((a) => a.key === key) ?? byFace(key))?.item;
  };

  /** What a name means across a reply: the authored item it names, else the name itself. */
  const itemIdentity = (name: string): string => authoredNamed(name)?.id ?? itemNameKey(listedName(name));

  /** What a buy costs. `alone` moves the item with no money (Q64); a stated price beats Value (Q65). */
  const quoteBuy = (op: InventoryPassOp): BuyQuote => {
    if (!scene.money || !currenciesSettle(scene.money.currencies)) return { kind: 'alone' };
    const item = authoredNamed(op.item);
    const own = item && currencyOf(item, moneyCurrencies);
    if (op.price) {
      // A bare number reads in the first Currency listed, so the item's own goes first.
      const order = own ? [own, ...moneyCurrencies.filter((currency) => currency !== own)] : moneyCurrencies;
      const stated = readStatedPrice(op.price, op.currency ?? '', order, moneyNames);
      return 'refused' in stated ? { kind: 'refused', reason: stated.refused } : { kind: 'priced', ...stated };
    }
    if (!own) return { kind: 'refused', reason: 'it has no price' };
    if (own.backing.kind === 'name' || item?.value === 0) return { kind: 'alone', currency: own };
    if (item?.value === undefined) return { kind: 'refused', reason: 'it has no price' };
    const amount = item.value * op.quantity;
    if (own.backing.kind === 'items' && !Number.isInteger(amount)) return { kind: 'refused', reason: `${amount} is no whole number of items` };
    return { kind: 'priced', currency: own, amount };
  };

  /** Settles one buy: the money and the item apply together, or nothing changes and it logs why (Q69). */
  const settleBuy = (op: InventoryPassOp, quote: BuyQuote) => {
    const label = `buy "${op.item}"`;
    if (quote.kind === 'refused') {
      skip(`${label}: ${quote.reason}`);
      return;
    }
    const seller = partyOf(op.owner);
    const buyer = partyOf(op.to);
    const sold = seller?.kind === 'you';
    if (!buyer && !sold) {
      skip(`${label}: nothing present is named "${op.to}" to buy it`);
      return;
    }
    if (buyer && seller && slotOwnerKey(buyer) === slotOwnerKey(seller)) {
      skip(`${label}: "${op.owner}" sells it to itself`);
      return;
    }
    const before = { list, runtimeItems, moneyStats, lines: diagnostics.length, uses: itemUses.length, fired: events.length };
    const refuse = (why: string) => {
      ({ list, runtimeItems, moneyStats } = before);
      diagnostics.length = before.lines;
      itemUses.length = before.uses;
      events.length = before.fired;
      skip(`${label}: ${why}`);
    };
    const key = itemNameKey(listedName(op.item));
    const visibleAt = (where: ItemCopyWhere) => candidates(key, where, 'transfer').filter((copy) => copy.visibility === 'visible');
    const sellerPlace = seller ?? ownerOf(op.owner);
    const held = sellerPlace ? visibleAt(sellerPlace) : [];
    // The new-copy rule stocks shops, so a player sells only what they hold (Q63).
    if (sold && held.reduce((sum, copy) => sum + copy.quantity, 0) < op.quantity) {
      refuse(`none or too few at "${op.owner}"`);
      return;
    }
    if (quote.kind === 'priced') {
      const unpaid = movePayment(quote.currency, buyer, seller, quote.amount);
      if (unpaid) {
        refuse(unpaid);
        return;
      }
    }
    let left = op.quantity;
    const takeFrom = (copies: readonly ItemCopy[]) => distribute(copies, left, (copy, quantity) => {
      left -= quantity;
      run([buyer ? { kind: 'transfer', copyId: copy.id, to: buyer, quantity } : { kind: 'lose', copyId: copy.id, quantity }]);
    });
    takeFrom(held);
    if (left > 0 && scene.location) takeFrom(visibleAt({ kind: 'location', id: scene.location.id }));
    if (left > 0 && buyer) {
      const itemId = gainId(op.item, key);
      if (!itemId) {
        refuse('the world has no item of that name');
        return;
      }
      run([{ kind: 'gain', itemId, quantity: left, to: buyer }]);
    }
    if (diagnostics.length > before.lines) refuse(diagnostics[diagnostics.length - 1]);
  };

  const buyWords = (op: InventoryPassOp) => [itemIdentity(op.item), op.quantity, itemNameKey(op.owner), itemNameKey(op.to), op.price ?? '', itemNameKey(op.currency ?? '')];
  // A reply that repeats a buy word for word states one buy (Q68).
  const saidBuys = new Set<string>();
  const buys = new Map(passOps.flatMap((named) => {
    if (named.op !== 'buy') return [];
    const said = JSON.stringify(buyWords(named));
    if (saidBuys.has(said)) return [];
    saidBuys.add(said);
    return [[named, quoteBuy(named)] as const];
  }));
  const partyKey = (name: string) => { const party = partyOf(name); return party && slotOwnerKey(party); };
  const pricedByPay = new Set<InventoryPassOp>();
  /** Whether a pay is a buy said again (Q68), or states the price of a buy with none (Q71). */
  const repeatsBuy = (pay: InventoryPassOp): boolean => {
    const stated = statedPay(pay);
    if ('refused' in stated) return false;
    const sides = [partyKey(pay.owner), partyKey(pay.to)];
    const shares = (buy: InventoryPassOp) => sides.some((side) => !side || side === partyKey(buy.owner) || side === partyKey(buy.to));
    const sameSum = [...buys].some(([buy, quote]) => quote.kind === 'priced' && quote.currency === stated.currency && quote.amount === stated.amount && shares(buy));
    if (!sameSum) {
      const unpriced = [...buys.keys()].find((buy) => {
        const item = authoredNamed(buy.item);
        const own = item && currencyOf(item, moneyCurrencies);
        return !buy.price && !pricedByPay.has(buy) && (!own || own === stated.currency) && shares(buy);
      });
      if (!unpriced) return false;
      pricedByPay.add(unpriced);
      buys.set(unpriced, { kind: 'priced', ...stated });
    }
    skip(`${payLabel(pay)}: a buy in the reply is the same sum`);
    return true;
  };

  // Pays settle first. A pay or buy is the reply's only statement about its Currency's money, settled or refused (Q56, Q68).
  const paidIn = [
    ...passOps.filter((named) => named.op === 'pay' && !repeatsBuy(named)).flatMap(settlePay),
    ...[...buys.values()].flatMap((quote) => (quote.kind === 'refused' ? moneyCurrencies : quote.currency ? [quote.currency] : [])),
  ];
  const boughtItems = new Set([...buys.keys()].map((buy) => itemIdentity(buy.item)));
  const handMoves = new Set<string>();
  const movesHands = (op: InventoryPassOp) => op.op === 'gain' || op.op === 'lose' || op.op === 'transfer';
  const movesMoney = (op: InventoryPassOp, currencies: readonly Currency[]) =>
    movesHands(op) && namesMoney(listedName(op.item), currencies, moneyNames);
  for (const named of passOps) {
    if (named.op === 'pay') continue;
    if (named.op === 'buy') {
      const quote = buys.get(named);
      if (quote) settleBuy(named, quote);
      else skip(`buy "${named.item}": the reply repeats it`);
      buys.delete(named);
      continue;
    }
    if (movesHands(named) && boughtItems.has(itemIdentity(named.item))) {
      skip(`${named.op} "${named.item}": a buy in the reply covers this item`);
      continue;
    }
    if (movesMoney(named, paidIn)) {
      skip(`${named.op} "${named.item}": a pay in the reply covers this money`);
      continue;
    }
    // A reply that repeats a gain of money, by item, quantity and receiver, states one gain (Q56).
    if (named.op === 'gain' && movesMoney(named, moneyCurrencies)) {
      const said = JSON.stringify([itemNameKey(named.item), named.quantity, itemNameKey(named.to || named.owner)]);
      if (handMoves.has(said)) {
        skip(`${named.op} "${named.item}": the reply repeats it`);
        continue;
      }
      handMoves.add(said);
    }
    let op = { ...named, item: listedName(named.item) } as InventoryPassOp & { op: Exclude<InventoryPassOpKind, 'pay' | 'buy'> };
    const key = itemNameKey(op.item);
    // Taking from this place an item it never listed is finding a new one.
    const from = op.op === 'transfer' ? ownerOf(op.owner) : null;
    if (from?.kind === 'location' && !list.some((c) => nameMatches(c, key) && sameWhere(c.where, from))) op = { ...op, op: 'gain' };
    const label = `${op.op} "${op.item}"`;
    if (op.op === 'gain') {
      const to = ownerOf(op.to || op.owner);
      if (!to) {
        skip(`${label}: nothing present is named "${op.to || op.owner}"`);
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
        skip(`${label}: it is already at "${op.to || op.owner}"`);
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
      skip(`${label}: nothing present is named "${op.owner}"`);
      continue;
    }
    if (op.op === 'transfer' && !ownerOf(op.to)) {
      skip(`${label}: nothing present is named "${op.to}"`);
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
      // A use's `to` names no receiver, so an item named there is the target the reply misplaced.
      const aimed = op.op !== 'use' ? '' : op.target || (op.to && !ownerOf(op.to) ? op.to : '');
      // The item named as its own target is a plain use.
      const target = aimed && itemNameKey(listedName(aimed.replace(/^the\s+/i, ''))) !== key ? targetOf(aimed, where, copy.id) : undefined;
      if (target === null) skip(`target "${aimed}" of ${label}: none at "${op.owner}" or here`);
      // The name holds one copy; a further one takes the first free slot.
      const slotId = op.op === 'equip' && i === 0 ? namedSlot(copy, op.slot) : undefined;
      if (slotId === null) {
        skip(`${label}: no slot is named "${op.slot}"`);
        break;
      }
      run([op.op === 'change' ? { kind: 'change', copyId: copy.id, state: op.state ?? '' }
        : op.op === 'use' ? { kind: 'use', copyId: copy.id, ...(op.after && { after: op.after }), ...(target && { targetCopyId: target.id }) }
        : op.op === 'equip' ? { kind: 'equip', copyId: copy.id, ...(slotId && { slotId }) }
        : { kind: op.op, copyId: copy.id }]);
    }
  }

  return { copies: list, itemUses, diagnostics, events, runtimeItems, ...(moneyStats && { stats: moneyStats }) };
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
