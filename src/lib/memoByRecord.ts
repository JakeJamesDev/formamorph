/** `fn` with its answer kept per record object, so a pass over a world reads only the records an edit replaced. */
export function memoByRecord<T extends object, R>(fn: (record: T) => R): (record: T) => R {
  const cache = new WeakMap<T, R>();
  return (record) => {
    if (cache.has(record)) return cache.get(record) as R;
    const found = fn(record);
    cache.set(record, found);
    return found;
  };
}
