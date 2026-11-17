import { useMemo, useRef } from 'react';

/** `next`, or `previous` when both hold the same keys with equal values, so equal content keeps its identity. */
export function keepEqualMap<K, V>(
  previous: ReadonlyMap<K, V> | undefined, next: ReadonlyMap<K, V>, equal: (a: V, b: V) => boolean = Object.is,
): ReadonlyMap<K, V> {
  if (!previous || previous === next || previous.size !== next.size) return next;
  for (const [key, value] of next) {
    if (!previous.has(key) || !equal(previous.get(key) as V, value)) return next;
  }
  return previous;
}

/** {@link keepEqualMap} across renders: the map last returned while each new one holds equal content. `equal` must be stable. */
export function useKeepEqualMap<K, V>(next: ReadonlyMap<K, V>, equal: (a: V, b: V) => boolean = Object.is): ReadonlyMap<K, V> {
  const kept = useRef<ReadonlyMap<K, V> | undefined>(undefined);
  return useMemo(() => {
    kept.current = keepEqualMap(kept.current, next, equal);
    return kept.current;
  }, [next, equal]);
}

/** `next`, or `previous` when both hold the same values in the same order. */
export function keepEqualList<L extends readonly unknown[]>(previous: L | undefined, next: L): L {
  if (!previous || previous.length !== next.length) return next;
  return next.every((value, i) => Object.is(value, previous[i])) ? previous : next;
}

/** {@link keepEqualList} across renders: the list last returned while each new one holds equal content. */
export function useKeepEqualList<L extends readonly unknown[]>(next: L): L {
  const kept = useRef<L | undefined>(undefined);
  return useMemo(() => {
    kept.current = keepEqualList(kept.current, next);
    return kept.current;
  }, [next]);
}

/** Equal when both objects hold the same fields, each the same value; an array field compares element by element. */
export function shallowEqualRow<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const x = a[key];
    const y = b[key];
    if (Object.is(x, y)) return true;
    return Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((item, i) => Object.is(item, y[i]));
  });
}
