import { isUnidentified } from '@/lib/items';
import { canBePlayer } from '@/lib/owners';
import { globalStatsOf, resolvedEntityStats, statBlueprintIds, type StatLinkWorld } from '@/lib/statLinks';
import type { Currency, CurrencyBacking, CurrencyCoin, Entity, Item, ItemCopy, Stat } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const parseCoin = (raw: unknown): CurrencyCoin[] =>
  (isRecord(raw) && typeof raw.itemId === 'string' && typeof raw.worth === 'number' && Number.isInteger(raw.worth) && raw.worth > 0
    ? [{ itemId: raw.itemId, worth: raw.worth }] : []);

const parseBacking = (raw: unknown): CurrencyBacking | null => {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'name') return { kind: 'name' };
  if (raw.kind === 'stat') return typeof raw.statId === 'string' && raw.statId ? { kind: 'stat', statId: raw.statId } : null;
  if (raw.kind === 'coins') return Array.isArray(raw.coins) ? { kind: 'coins', coins: raw.coins.flatMap(parseCoin) } : null;
  return null;
};

/** A world file's Currencies, in order. A record without an id, a name or a known backing is dropped. */
export const parseCurrencies = (raw: unknown): Currency[] => (Array.isArray(raw) ? raw : []).flatMap((value: unknown) => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return [];
  const backing = parseBacking(value.backing);
  return backing ? [{ id: value.id, name: value.name, backing }] : [];
});

/** The Currency `item` is priced in. Undefined when it has none, or its Currency is gone. */
export const currencyOf = (item: Pick<Item, 'currencyId'>, currencies: readonly Currency[]): Currency | undefined =>
  (item.currencyId === undefined ? undefined : currencies.find((currency) => currency.id === item.currencyId));

/** What `item` is worth as text, such as "40 Gold". Null without a Value and a Currency. */
export const worthText = (item: Pick<Item, 'value' | 'currencyId'>, currencies: readonly Currency[]): string | null => {
  const currency = currencyOf(item, currencies);
  return currency && item.value !== undefined ? `${item.value} ${currency.name}` : null;
};

/** The worth an Item Copy shows the player. An unidentified copy shows none, because a price can reveal the item. */
export const copyWorthText = (copy: Pick<ItemCopy, 'state'>, item: Pick<Item, 'value' | 'currencyId'> | undefined, currencies: readonly Currency[]): string | null =>
  (item && !isUnidentified(copy) ? worthText(item, currencies) : null);

/** The item popup's worth fact, when the copy shows one. */
export const copyWorthFacts = (copy: Pick<ItemCopy, 'state'>, item: Pick<Item, 'value' | 'currencyId'> | undefined, currencies: readonly Currency[], resolveText: (text: string) => string): string[] => {
  const worth = copyWorthText(copy, item, currencies);
  return worth ? [`Worth ${resolveText(worth)}`] : [];
};

/** A new item's Currency: the Default, the world's first. */
export const defaultCurrencyPatch = (currencies: readonly Currency[]): Pick<Item, 'currencyId'> =>
  (currencies[0] ? { currencyId: currencies[0].id } : {});

/** One heading of the stat picker. `persona` holds that Persona's own stats. */
export type CurrencyStatGroup = { stats: Stat[] } & ({ kind: 'global' | 'linked' } | { kind: 'persona'; persona: Entity });

/**
 * What can back a Currency, each stat once: Global Stats, the Blueprint stats a Persona links, under their
 * original ids, then each Persona's own. A Blueprint stat no Persona links has no owner, so the list omits it.
 * Two Personas can own one id after a link is detached; the first lists it.
 */
export function currencyStatGroups(world: StatLinkWorld & { entities: readonly Entity[] }): CurrencyStatGroup[] {
  const blueprints = statBlueprintIds(world);
  const personas = world.entities.filter(canBePlayer).map((persona) => ({ persona, stats: resolvedEntityStats(world, persona) }));
  const linked = new Map(personas.flatMap(({ stats }) => stats.filter((stat) => blueprints.has(stat.id)).map((stat) => [stat.id, stat] as const)));
  const seen = new Set(blueprints);
  const firstSeen = (stat: Stat) => !seen.has(stat.id) && !!seen.add(stat.id);
  const groups: CurrencyStatGroup[] = [
    { kind: 'global', stats: globalStatsOf([...world.stats], world.statGroups).filter(firstSeen) },
    { kind: 'linked', stats: [...linked.values()] },
    ...personas.map(({ persona, stats }) => ({ kind: 'persona' as const, persona, stats: stats.filter(firstSeen) })),
  ];
  return groups.filter((group) => group.stats.length > 0);
}
