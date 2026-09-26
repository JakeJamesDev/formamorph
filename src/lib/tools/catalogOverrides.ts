import type { CatalogToolOverride, CatalogToolOverrides, Tool } from '@/types';
import type { Codec } from '@/lib/usePersistentState';
import { TOOL_CATALOG } from './toolCatalog';
import { isCallLimit, isRecord, parseOfferedTo } from './toolValidation';

/** The Availability fields of a Tool or override, with no `callLimit` key when it has none. */
function availability({ offeredTo, callLimit }: CatalogToolOverride): CatalogToolOverride {
  return { offeredTo: [...offeredTo], ...(callLimit !== undefined ? { callLimit } : {}) };
}

const sameAvailability = (a: CatalogToolOverride, b: CatalogToolOverride) =>
  a.callLimit === b.callLimit && a.offeredTo.length === b.offeredTo.length && a.offeredTo.every((k) => b.offeredTo.includes(k));

/** The catalog as the player sees it: each overridden Tool with its Offered To and call limit replaced. */
export function withCatalogOverrides(catalog: readonly Tool[], overrides: CatalogToolOverrides): Tool[] {
  return catalog.map((tool) => {
    const override = overrides[tool.id];
    if (!override) return tool;
    const { callLimit: _, ...definition } = tool;
    return { ...definition, ...availability(override) };
  });
}

/**
 * Store `tool`'s Availability fields as its override. Availability the Tool ships with clears the override,
 * so a later shipped change still reaches the player. Unchanged when `tool` is not a catalog Tool.
 */
export function saveCatalogOverride(overrides: CatalogToolOverrides, tool: Tool): CatalogToolOverrides {
  const shipped = TOOL_CATALOG.find((t) => t.id === tool.id);
  if (!shipped) return overrides;
  const { [tool.id]: _, ...rest } = overrides;
  return sameAvailability(tool, shipped) ? rest : { ...rest, [tool.id]: availability(tool) };
}

/** Keeps readable overrides of current catalog Tools; an unreadable entry drops, so that Tool is as shipped. */
export const catalogOverridesCodec: Codec<CatalogToolOverrides> = {
  parse: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      const out: CatalogToolOverrides = {};
      if (!isRecord(parsed)) return out;
      for (const [id, entry] of Object.entries(parsed)) {
        if (!TOOL_CATALOG.some((t) => t.id === id) || !isRecord(entry)) continue;
        const offeredTo = parseOfferedTo(entry.offeredTo);
        const { callLimit } = entry;
        if (!offeredTo || (callLimit !== undefined && !isCallLimit(callLimit))) continue;
        out[id] = availability({ offeredTo, callLimit });
      }
      return out;
    } catch {
      return {};
    }
  },
  serialize: (v) => JSON.stringify(v),
};
