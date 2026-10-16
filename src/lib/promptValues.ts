import { mapRuns, textOf, type MarkedText } from './markedText';

/** A lookup by affix-free token key of a value as marked runs, or undefined when the key has none. */
export type MarkedLookup = (key: string) => MarkedText | undefined;

/** A value lookup by affix-free token key: the key's value, or undefined when it has none. `marked`, where
 *  the renderer reports origins, holds each value as the runs it was built from. */
export type ValueLookup = ((key: string) => string | undefined) & { readonly marked?: MarkedLookup };

/** What a prompt render reads its token values from: a plain map, or a lookup that renders a key on demand. */
export type TokenValues = Readonly<Record<string, string>> | ValueLookup;

/** The value `values` holds for `key`, or undefined. */
export function readValue(values: TokenValues, key: string): string | undefined {
  return typeof values === 'function' ? values(key) : values[key];
}

/** The runs lookup `values` carries, if any. */
const markedOf = (values: TokenValues): MarkedLookup | undefined => (typeof values === 'function' ? values.marked : undefined);

/** The runs `values` reports for `key`, or undefined where it reports none. */
export function readMarked(values: TokenValues, key: string): MarkedText | undefined {
  return markedOf(values)?.(key);
}

/** `lookup` with `marked` attached, or `lookup` alone when there is none to attach. */
export function withMarked(lookup: (key: string) => string | undefined, marked: MarkedLookup | undefined): ValueLookup {
  return marked ? Object.assign(lookup, { marked }) : lookup;
}

function memo<T>(render: (key: string) => T): (key: string) => T {
  const kept = new Map<string, T>();
  return (key) => {
    if (!kept.has(key)) kept.set(key, render(key));
    return kept.get(key) as T;
  };
}

/** `render` with each key's result kept after its first read, so two reads of one key share one value. */
export function memoLookup(render: ValueLookup): ValueLookup {
  return withMarked(memo(render), render.marked && memo(render.marked));
}

/** A lookup whose values are the texts of `render`'s runs, with those runs as its `marked`. */
export function fromMarked(render: MarkedLookup): ValueLookup {
  const marked = memo(render);
  return withMarked(memo((key) => {
    const text = marked(key);
    return text && textOf(text);
  }), marked);
}

/** Each value of `values` passed through `map`, once per key; a key with no value stays without one. Marked
 *  runs pass through `map` one run at a time. */
export function mapValues(values: TokenValues, map: (value: string, key: string) => string): ValueLookup {
  const marked = markedOf(values);
  const mapped = memo((key: string) => {
    const value = readValue(values, key);
    return value === undefined ? undefined : map(value, key);
  });
  return withMarked(mapped, marked && memo((key) => {
    const text = marked(key);
    // Runs the map leaves alone skip a second pass, which could draw a placeholder differently.
    return text && (textOf(text) === mapped(key) ? text : mapRuns(text, (run) => map(run, key)));
  }));
}

/** The layers as one lookup, a later layer's value over an earlier one's, as object spread layers them. */
export function layerValues(...layers: readonly (TokenValues | null | undefined)[]): ValueLookup {
  const topFirst = layers.filter((layer): layer is TokenValues => layer != null).reverse();
  const reports = topFirst.some((layer) => markedOf(layer));
  return withMarked((key) => {
    for (const layer of topFirst) {
      const value = readValue(layer, key);
      if (value !== undefined) return value;
    }
    return undefined;
  }, reports ? (key) => {
    // The runs of the layer whose value wins, so a report never outlives the value it describes.
    const layer = topFirst.find((each) => readValue(each, key) !== undefined);
    return layer && readMarked(layer, key);
  } : undefined);
}

/** `values` without the keys `omit` matches, which then read as having no value. */
export function omitValues(values: TokenValues, omit: (key: string) => boolean): ValueLookup {
  const marked = markedOf(values);
  return withMarked(
    (key) => (omit(key) ? undefined : readValue(values, key)),
    marked && ((key) => (omit(key) ? undefined : marked(key))),
  );
}
