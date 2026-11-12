import { useEffect, useMemo, useState } from "react";
import { loadVrmLook } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import { dataKey, withLibraryModelUrl } from "./useRowModels";
import type { RowModel, RowModels } from "./useRowModels";
import type { ColorChannel } from "@/types";

/** What the known model offers bindings: its slider keys, its color channels and each channel's own color. */
interface ModelOffer {
  keys: string[];
  channels: ColorChannel[];
  colors: Partial<Record<ColorChannel, string>>;
}

/** The known model's offer, its lists as sets. */
export interface KnownModel {
  keys: ReadonlySet<string>;
  channels: ReadonlySet<ColorChannel>;
  colors: Readonly<Partial<Record<ColorChannel, string>>>;
}

// Offers by a stable model key, so reopening a stat never reloads its model.
const cache = new Map<string, Promise<ModelOffer>>();

const cached = (key: string, load: () => Promise<ModelOffer>): Promise<ModelOffer> => {
  const hit = cache.get(key);
  if (hit) return hit;
  // A failed load is not kept, so the next open tries again.
  const next = load().catch(() => {
    cache.delete(key);
    return { keys: [], channels: [], colors: {} };
  });
  cache.set(key, next);
  return next;
};

const vrmOffer = async (url: string): Promise<ModelOffer> => {
  const { catalog, channels, colors } = await loadVrmLook(url);
  return { keys: catalog.map((morph) => morph.name), channels, colors };
};

/** A loader for a library Avatar's offer. */
const libraryLoader = (id: string) => () => cached(`library:${id}`, () => withLibraryModelUrl(id, vrmOffer));

/** Several models as one offer: every key and channel any carries; a later model's color wins. */
const mergeOffers = (offers: ModelOffer[]): ModelOffer => ({
  keys: [...new Set(offers.flatMap((offer) => offer.keys))],
  channels: [...new Set(offers.flatMap((offer) => offer.channels))],
  colors: offers.reduce<ModelOffer["colors"]>((all, offer) => ({ ...all, ...offer.colors }), {}),
});

/** A loader for one row model's offer. A non-VRM 3D model has no color channels. */
function rowLoader(row: RowModel): () => Promise<ModelOffer> {
  if (row.kind === "model") {
    return () => cached(dataKey("owner", row.model.data), async () => ({ keys: await loadModelMorphNames(row.model), channels: [], colors: {} }));
  }
  if (row.kind === "world") return () => cached(dataKey("world", row.data), () => vrmOffer(row.data));
  return libraryLoader(row.id);
}

/**
 * The slider keys and color channels of the models a stat's or trait's rows play on: every model of an owned
 * row's `rows`. A key or channel counts when any model carries it. Null while
 * loading, or when no model is known. Loads only when `active`.
 */
export function useKnownMorphKeys(rows: RowModels | undefined, active: boolean): KnownModel | null {
  const load = useMemo(() => {
    if (!rows || rows.resolving || !rows.models.length) return undefined;
    const loaders = rows.models.map(rowLoader);
    return () => Promise.all(loaders.map((loader) => loader())).then(mergeOffers);
  }, [rows]);
  const [known, setKnown] = useState<KnownModel | null>(null);
  const mounted = useMountedRef();

  useEffect(() => {
    setKnown(null);
    if (!active || !load) return;
    let current = true;
    void load().then(({ keys, channels, colors }) => {
      if (current && mounted.current) setKnown({ keys: new Set(keys), channels: new Set(channels), colors });
    });
    return () => { current = false; };
  }, [active, load, mounted]);
  return known;
}
