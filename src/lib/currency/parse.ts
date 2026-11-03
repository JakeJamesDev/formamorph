import type { Currency, CurrencyBacking, CurrencyItem } from '@/types';
import { isWholeWorth } from './index';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const parseCurrencyItem = (raw: unknown): CurrencyItem[] =>
  (isRecord(raw) && typeof raw.itemId === 'string' && isWholeWorth(raw.worth)
    ? [{ itemId: raw.itemId, worth: raw.worth }] : []);

const parseBacking = (raw: unknown): CurrencyBacking | null => {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'name') return { kind: 'name' };
  if (raw.kind === 'stat') return typeof raw.statId === 'string' && raw.statId ? { kind: 'stat', statId: raw.statId } : null;
  if (raw.kind === 'items') return Array.isArray(raw.items) ? { kind: 'items', items: raw.items.flatMap(parseCurrencyItem) } : null;
  return null;
};

/** A world file's Currencies, in order. A record without an id, a name or a known backing is dropped. */
export const parseCurrencies = (raw: unknown): Currency[] => (Array.isArray(raw) ? raw : []).flatMap((value: unknown) => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return [];
  const backing = parseBacking(value.backing);
  return backing ? [{ id: value.id, name: value.name, backing }] : [];
});
