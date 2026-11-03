import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { API_BASE_URL } from '@/lib/apiBase';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';

/** The name shown for a tier the server has not named. */
const TIER_NAME_FALLBACK = 'Member';

const CACHE_KEY = 'formamorph.tierNames';
const PRICES_CACHE_KEY = 'formamorph.tierPrices';

type TierNames = Partial<Record<SupporterTier, string>>;
/** Integer US cents per tier; a tier with no known price is absent. */
type TierPrices = Partial<Record<SupporterTier, number>>;

/** Keeps the names that are non-empty strings; anything else is unnamed. */
function parseNames(raw: unknown): TierNames {
  const names: TierNames = {};
  if (!raw || typeof raw !== 'object') return names;

  for (const tier of SUPPORTER_TIERS) {
    const value = (raw as Record<string, unknown>)[tier];
    if (typeof value === 'string' && value.trim()) names[tier] = value.trim();
  }

  return names;
}

/** Keeps the prices that are positive whole cents; anything else is unknown. */
function parsePrices(raw: unknown): TierPrices {
  const parsed: TierPrices = {};
  if (!raw || typeof raw !== 'object') return parsed;

  for (const tier of SUPPORTER_TIERS) {
    const value = (raw as Record<string, unknown>)[tier];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) parsed[tier] = value;
  }

  return parsed;
}

function readCache<T>(key: string, parse: (raw: unknown) => T): T {
  try {
    const stored = localStorage.getItem(key);
    return parse(stored ? JSON.parse(stored) : null);
  } catch {
    return parse(null);
  }
}

let names: TierNames | null = null;
let prices: TierPrices | null = null;
let requested = false;
const listeners = new Set<() => void>();

const current = (): TierNames => (names ??= readCache(CACHE_KEY, parseNames));
const currentPrices = (): TierPrices => (prices ??= readCache(PRICES_CACHE_KEY, parsePrices));

function publish(next: TierNames, nextPrices: TierPrices) {
  names = next;
  prices = nextPrices;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    localStorage.setItem(PRICES_CACHE_KEY, JSON.stringify(nextPrices));
  } catch { /* storage blocked: the reply still serves this session */ }
  listeners.forEach((listener) => listener());
}

/** Ask the server once per session. A failed read keeps the cached names and is not retried. */
export function loadTierNames(): Promise<void> {
  if (requested) return Promise.resolve();
  requested = true;

  return fetch(`${API_BASE_URL}/patreon/tier-names`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { data?: unknown } | null) => {
      // A tier the server cannot name yet keeps its cached name. Its answer on prices replaces the cached ones, so a removed price hides.
      if (payload && payload.data && typeof payload.data === 'object') {
        publish({ ...current(), ...parseNames(payload.data) }, parsePrices((payload.data as { prices?: unknown }).prices));
      }
    })
    .catch(() => { /* offline: the cached names stand */ });
}

/** The tier's name now: the server's, else the cached one, else "Member". */
export const tierName = (tier: SupporterTier): string => current()[tier] ?? TIER_NAME_FALLBACK;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** A tier-to-name function that re-renders its component when the server's answer arrives. */
export function useTierName(): (tier: SupporterTier) => string {
  const snapshot = useSyncExternalStore(subscribe, current);
  useEffect(() => { void loadTierNames(); }, []);

  return useCallback((tier) => snapshot[tier] ?? TIER_NAME_FALLBACK, [snapshot]);
}

/** A tier-to-name function like `useTierName`, undefined for a tier with no name, so the caller can pick its own fallback. */
export function useTierTitle(): (tier: SupporterTier) => string | undefined {
  const snapshot = useSyncExternalStore(subscribe, current);
  useEffect(() => { void loadTierNames(); }, []);

  return useCallback((tier) => snapshot[tier], [snapshot]);
}

/** A tier-to-cents function, null when the price is unknown. */
export function useTierPrice(): (tier: SupporterTier) => number | null {
  const snapshot = useSyncExternalStore(subscribe, currentPrices);
  useEffect(() => { void loadTierNames(); }, []);

  return useCallback((tier) => snapshot[tier] ?? null, [snapshot]);
}

/** Forget the session state so a test starts from the cache alone. */
export function resetTierNamesForTest() {
  names = null;
  prices = null;
  requested = false;
  listeners.clear();
}

/** Serve these names and skip the server read, so a component test sees fixed names and no extra request. */
export function seedTierNamesForTest(seed: TierNames, seedPrices: TierPrices = {}) {
  resetTierNamesForTest();
  names = seed;
  prices = seedPrices;
  requested = true;
}
