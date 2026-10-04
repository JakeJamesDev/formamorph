import { useEffect, useState } from 'react';

/** `value` after it has held still for `delayMs`. The first render returns it at once. Pass a primitive: an inline object changes every render and never settles. */
export function useDebouncedValue<T extends string | number | boolean | null>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
