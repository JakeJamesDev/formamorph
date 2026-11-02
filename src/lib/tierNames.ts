import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { API_BASE_URL } from '@/lib/apiBase';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterTier } from '@/types';

/** The name shown for a tier the server has not named. */
const TIER_NAME_FALLBACK = 'Member';

const CACHE_KEY = 'formamorph.tierNames';

type TierNames = Partial<Record<SupporterTier, string>>;

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

function readCache(): TierNames {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? parseNames(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
}

let names: TierNames | null = null;
let requested = false;
const listeners = new Set<() => void>();

const current = (): TierNames => (names ??= readCache());

function publish(next: TierNames) {
  names = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch { /* storage blocked: the names still serve this session */ }
  listeners.forEach((listener) => listener());
}

/** Ask the server once per session. A failed read keeps the cached names and is not retried. */
export function loadTierNames(): Promise<void> {
  if (requested) return Promise.resolve();
  requested = true;

  return fetch(`${API_BASE_URL}/patreon/tier-names`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: { data?: unknown } | null) => {
      // A tier the server cannot name yet keeps its cached name.
      if (payload && payload.data && typeof payload.data === 'object') publish({ ...current(), ...parseNames(payload.data) });
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

/** Forget the session state so a test starts from the cache alone. */
export function resetTierNamesForTest() {
  names = null;
  requested = false;
  listeners.clear();
}

/** Serve these names and skip the server read, so a component test sees fixed names and no extra request. */
export function seedTierNamesForTest(seed: TierNames) {
  resetTierNamesForTest();
  names = seed;
  requested = true;
}
