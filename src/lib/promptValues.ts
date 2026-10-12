/** A value lookup by affix-free token key: the key's value, or undefined when it has none. */
export type ValueLookup = (key: string) => string | undefined;

/** What a prompt render reads its token values from: a plain map, or a lookup that renders a key on demand. */
export type TokenValues = Readonly<Record<string, string>> | ValueLookup;

/** The value `values` holds for `key`, or undefined. */
export function readValue(values: TokenValues, key: string): string | undefined {
  return typeof values === 'function' ? values(key) : values[key];
}

/** `render` with each key's result kept after its first read, so two reads of one key share one value. */
export function memoLookup(render: ValueLookup): ValueLookup {
  const kept = new Map<string, string | undefined>();
  return (key) => {
    if (!kept.has(key)) kept.set(key, render(key));
    return kept.get(key);
  };
}

/** Each value of `values` passed through `map`, once per key; a key with no value stays without one. */
export function mapValues(values: TokenValues, map: (value: string, key: string) => string): ValueLookup {
  return memoLookup((key) => {
    const value = readValue(values, key);
    return value === undefined ? undefined : map(value, key);
  });
}

/** The layers as one lookup, a later layer's value over an earlier one's, as object spread layers them. */
export function layerValues(...layers: readonly (TokenValues | null | undefined)[]): ValueLookup {
  const topFirst = layers.filter((layer): layer is TokenValues => layer != null).reverse();
  return (key) => {
    for (const layer of topFirst) {
      const value = readValue(layer, key);
      if (value !== undefined) return value;
    }
    return undefined;
  };
}

/** `values` without the keys `omit` matches, which then read as having no value. */
export function omitValues(values: TokenValues, omit: (key: string) => boolean): ValueLookup {
  return (key) => (omit(key) ? undefined : readValue(values, key));
}
