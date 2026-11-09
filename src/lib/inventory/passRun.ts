/**
 * One Inventory pass reply in progress: what its names resolve against, what it has done so far, and the
 * name and owner readings every operation shares (Q56).
 */
import { actionItemKey, type ToldAction } from '@/lib/actionList';
import type { SlotOwner } from '@/lib/bodies';
import type { MoneyOwners, PaymentStats } from '@/lib/currency/payment';
import { sameCharacterName } from '@/lib/entityMatch';
import { isUnidentified, sameState, sameWhere, usesLeft } from '@/lib/items';
import type { Currency, Entity, InventoryOwner, InventoryPassOpKind, Item, ItemCopy, ItemCopyWhere, RuntimeItem } from '@/types';
import { applyInventoryOps, type InventoryCall, type InventoryOp, type InventoryResult } from './index';

/** The owner word the pass writes for the player character, and the one for the location. */
export const PASS_YOU = 'you';
export const PASS_HERE = 'here';
/** What models write for the player character besides `you`, after a leading "the". */
const PLAYER_WORDS = new Set([PASS_YOU, 'i', 'me', 'player', 'player character']);

/** How a pass name is compared: case and surrounding spaces ignored (Q56). */
export const itemNameKey = (name: string): string => name.trim().toLowerCase();

/** The world's money and the stats that can hold it. */
export interface PassMoney extends MoneyOwners {
  currencies: readonly Currency[];
  stats: PaymentStats;
}

/** An owner the pass can name: by its Name, else by any of `aliases` (Q17). */
export interface PassOwner {
  id: string;
  name: string;
  aliases?: readonly string[];
}

/** What the pass names resolve against. Names are compared after `resolve`. */
export interface PassScene {
  items: readonly Item[];
  runtimeItems: readonly RuntimeItem[];
  /** The played persona's names, which read as `you` beside "you" itself. */
  playerNames: readonly string[];
  /** The entities present after this turn's moves, discovered ones included (Q62). */
  owners: readonly PassOwner[];
  location: { id: string; name: string } | null;
  resolve?: (text: string) => string;
  /** What a pay settles against. Absent, every pay is skipped. */
  money?: PassMoney;
  /** The shown Listed Actions the turn was sent with, which the reply must not repeat (Q7, Q21). */
  told?: readonly ToldAction[];
}

type AuthoredName = { item: Item; key: string; face: string };

/** One reply through the validator. Each step reads and moves these fields in reply order. */
export interface PassRun {
  scene: PassScene;
  call: Omit<InventoryCall, 'source'>;
  presence: NonNullable<InventoryCall['presence']>;
  authored: readonly AuthoredName[];
  moneyNames: readonly { id: string; name: string }[];
  moneyCurrencies: readonly Currency[];
  list: ItemCopy[];
  runtimeItems: RuntimeItem[];
  moneyStats: PaymentStats | undefined;
  itemUses: InventoryResult['itemUses'];
  events: InventoryResult['events'];
  diagnostics: string[];
}

export function startPass(copies: readonly ItemCopy[], scene: PassScene, call: Omit<InventoryCall, 'source'>): PassRun {
  const resolve = scene.resolve ?? ((s: string) => s);
  return {
    scene,
    call,
    presence: call.presence ?? { locationId: scene.location?.id, entityIds: new Set(scene.owners.map((o) => o.id)) },
    authored: scene.items.map((item) => ({
      item, key: itemNameKey(resolve(item.name)), face: item.unidentifiedName?.trim() ? itemNameKey(resolve(item.unidentifiedName)) : '',
    })),
    moneyNames: scene.items.map((item) => ({ id: item.id, name: resolve(item.name) })),
    moneyCurrencies: (scene.money?.currencies ?? []).map((currency) => ({ ...currency, name: resolve(currency.name) })),
    list: [...copies],
    runtimeItems: [...scene.runtimeItems],
    moneyStats: scene.money?.stats,
    itemUses: [],
    events: [],
    diagnostics: [],
  };
}

export const skip = (pass: PassRun, why: string) => pass.diagnostics.push(`Inventory (pass) skipped ${why}`);

export function runOps(pass: PassRun, ops: InventoryOp[]): void {
  const result = applyInventoryOps(pass.list, ops, { ...pass.call, source: 'pass', presence: pass.presence, runtimeItems: pass.runtimeItems });
  pass.list = result.copies;
  pass.itemUses.push(...result.itemUses);
  pass.diagnostics.push(...result.diagnostics);
  pass.events.push(...result.events);
}

export function ownerOf(pass: PassRun, name: string): ItemCopyWhere | null {
  const { scene } = pass;
  const key = itemNameKey(name);
  if (!key) return null;
  if (PLAYER_WORDS.has(key.replace(/^the\s+/, '')) || scene.playerNames.some((n) => itemNameKey(n) === key)) return { kind: 'you' };
  if (scene.location && (key === PASS_HERE || itemNameKey(scene.location.name) === key)) return { kind: 'location', id: scene.location.id };
  // A Name beats an Alias; an Alias or a loose match counts only when it points at one owner.
  const exact = scene.owners.find((o) => itemNameKey(o.name) === key);
  if (exact) return { kind: 'entity', id: exact.id };
  const soleOwner = (hits: readonly PassOwner[]): ItemCopyWhere | null => (hits.length === 1 ? { kind: 'entity', id: hits[0].id } : null);
  const aliased = scene.owners.filter((o) => o.aliases?.some((a) => itemNameKey(a) === key));
  if (aliased.length) return soleOwner(aliased);
  const loose = scene.owners.filter((o) => sameCharacterName(o.name, name));
  if (loose.length) return soleOwner(loose);
  return soleOwner(scene.owners.filter((o) => o.aliases?.some((a) => sameCharacterName(a, name))));
}

/** The pass's owners from the stored ones: each entity's Aliases, Stranger Name and story alias, met or not (Q19). */
export function passOwners(
  owners: readonly InventoryOwner[],
  entities: readonly Pick<Entity, 'id' | 'aliases' | 'strangerName'>[],
  storyAliases: Readonly<Record<string, string>>,
): PassOwner[] {
  return owners.map((owner) => {
    const entity = entities.find((e) => e.id === owner.id);
    const names = [...(entity?.aliases ?? []), entity?.strangerName ?? '', storyAliases[owner.id] ?? '']
      .map((n) => n.trim()).filter(Boolean);
    return names.length ? { ...owner, aliases: [...new Set(names)] } : owner;
  });
}

/** Who a pay or buy names. A name no one present answers to, or this place, holds no money and reads as no one (Q51). */
export function partyOf(pass: PassRun, name: string): SlotOwner | null {
  const where = ownerOf(pass, name);
  if (where) return where.kind === 'location' ? null : where;
  return name.trim() && pass.scene.playerNames.some((player) => sameCharacterName(player, name)) ? { kind: 'you' } : null;
}

/** `key` is the item's Unidentified Name. */
const isFace = (authored: AuthoredName, key: string) => !!authored.face && authored.face === key;

const runtimeNamed = (pass: PassRun, key: string) => pass.runtimeItems.find((r) => itemNameKey(r.name) === key);

/** A copy goes by its true name, and by its Unidentified Name while unidentified. */
export function nameMatches(pass: PassRun, copy: ItemCopy, key: string): boolean {
  if (copy.item.kind === 'item') {
    const id = copy.item.itemId;
    return pass.authored.some((a) => a.item.id === id && (a.key === key || (isFace(a, key) && isUnidentified(copy))));
  }
  return runtimeNamed(pass, key)?.id === copy.item.runtimeItemId;
}

/** The Item Copies at `where` named `key`, the likeliest target first. */
export function candidates(pass: PassRun, key: string, where: ItemCopyWhere, kind: InventoryPassOpKind, state = ''): ItemCopy[] {
  const here = pass.list.filter((c) => nameMatches(pass, c, key) && sameWhere(c.where, where));
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
        && usesLeft(c, pass.authored.find((a) => c.item.kind === 'item' && a.item.id === c.item.itemId)?.item) === 0 ? 4 : 0);
      return here.sort((a, b) => spent(a) + rank(a) - spent(b) - rank(b));
    }
    default: return here.sort((a, b) => rank(a) - rank(b));
  }
}

/** The one authored item whose Unidentified Name is `key`; none when several share it (Q43). */
function byFace(pass: PassRun, key: string) {
  const faces = pass.authored.filter((a) => isFace(a, key));
  return faces.length === 1 ? faces[0] : undefined;
}

/** The item a gain makes: the authored one of that name, else a runtime item, made new when none has it. */
export function gainId(pass: PassRun, name: string, key: string): string | null {
  const match = pass.authored.find((a) => a.key === key) ?? byFace(pass, key);
  if (match) return match.item.id;
  // A world with no authored items never gets runtime items (Q55).
  if (!pass.authored.length) return null;
  const reused = runtimeNamed(pass, key);
  if (reused) return reused.id;
  const made: RuntimeItem = { id: pass.call.newId(), name: name.trim() };
  pass.runtimeItems = [...pass.runtimeItems, made];
  return made.id;
}

const known = (pass: PassRun, key: string) => pass.authored.some((a) => a.key === key || isFace(a, key)) || !!runtimeNamed(pass, key);

/** A name copied with the Items Here summary or marks after it reads as the name before the colon or " (". */
export function listedName(pass: PassRun, name: string): string {
  const cut = [name.indexOf(':'), name.indexOf(' (')].filter((at) => at > 0)
    .find((at) => !known(pass, itemNameKey(name)) && known(pass, itemNameKey(name.slice(0, at))));
  return cut !== undefined ? name.slice(0, cut) : name;
}

export function authoredNamed(pass: PassRun, name: string): Item | undefined {
  const key = itemNameKey(listedName(pass, name));
  return (pass.authored.find((a) => a.key === key) ?? byFace(pass, key))?.item;
}

/** The Listed Action key of the item `name` means, or null when no item has that name. */
export function actionKeyNamed(pass: PassRun, name: string): string | null {
  const authored = authoredNamed(pass, name);
  if (authored) return actionItemKey({ kind: 'item', itemId: authored.id });
  const runtime = runtimeNamed(pass, itemNameKey(listedName(pass, name)));
  return runtime ? actionItemKey({ kind: 'runtime', runtimeItemId: runtime.id }) : null;
}

/** What a name means across a reply: the authored item it names, else the name itself. */
export const itemIdentity = (pass: PassRun, name: string): string => authoredNamed(pass, name)?.id ?? itemNameKey(listedName(pass, name));

/** Splits `quantity` over `copies` in order, each taking what it holds. */
export function distribute(copies: readonly ItemCopy[], quantity: number, take: (copy: ItemCopy, quantity: number) => void): void {
  let left = quantity;
  for (const copy of copies) {
    if (left <= 0) break;
    const share = Math.min(left, copy.quantity);
    take(copy, share);
    left -= share;
  }
}
