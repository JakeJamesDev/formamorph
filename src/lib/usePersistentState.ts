import { useState, useEffect, useRef } from 'react';

/** Converts a setting to/from its stored string form. Reusable codecs cover the common shapes. */
export interface Codec<T> {
  parse: (raw: string) => T;
  serialize: (value: T) => string;
}

/** Reject a non-finite number so `usePersistentState` falls back to the default instead of seeding NaN. */
function requireFinite(n: number): number {
  if (!Number.isFinite(n)) throw new Error('not a finite number');
  return n;
}

export const stringCodec: Codec<string> = { parse: (r) => r, serialize: (v) => v };
export const boolCodec: Codec<boolean> = { parse: (r) => JSON.parse(r), serialize: (v) => JSON.stringify(v) };
export const intCodec: Codec<number> = { parse: (r) => requireFinite(parseInt(r)), serialize: (v) => String(v) };
export const floatCodec: Codec<number> = { parse: (r) => requireFinite(parseFloat(r)), serialize: (v) => String(v) };
export const nullableIntCodec: Codec<number | null> = {
  parse: (r) => (r === '' ? null : requireFinite(parseInt(r))),
  serialize: (v) => (v == null ? '' : String(v)),
};

/** useState mirrored to a localStorage `key`: seeds from the stored value (or `defaultValue` when
 *  absent) and writes back on every change. `codec` maps the value to/from its stored string. */
export function usePersistentState<T>(key: string, defaultValue: T, codec: Codec<T>) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    // A corrupt/legacy stored value must never crash the app at boot (this runs during the first render of
    // a root provider). Fall back to the default; the write effect then rewrites the bad key with it.
    try {
      return codec.parse(raw);
    } catch {
      return defaultValue;
    }
  });
  const codecRef = useRef(codec); // avoid re-running the write effect on inline-codec identity changes
  codecRef.current = codec;
  useEffect(() => {
    localStorage.setItem(key, codecRef.current.serialize(value));
  }, [key, value]);
  return [value, setValue] as const;
}
