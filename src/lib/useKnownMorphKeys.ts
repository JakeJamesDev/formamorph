import { useEffect, useMemo, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { customPersonaEntity } from "./blueprints";
import { loadVrmLook } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import { worldStartPersona } from "./personaPick";
import { playedVrmPick, type PlayedVrmAs } from "./vrmResolver";
import ModelStorageService from "@/services/ModelStorageService";
import type { RowModel, RowModels } from "./useRowModels";
import type { ColorChannel, Entity, VrmPick, WorldOverview } from "@/types";

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

/** An embedded model's cache key: its length and both ends, rather than a second copy of the whole payload. */
const dataKey = (kind: string, data: string) => `${kind}:${data.length}:${data.slice(0, 128)}:${data.slice(-128)}`;

/** The Avatar a new game of this world shows for the player, when the world fixes one: its Starts On persona's,
 *  else its Custom Persona's. Undefined when the player's own default decides. */
export function worldPlayerVrmPick(
  overview: Pick<WorldOverview, "vrmStore" | "startPersona" | "legacyVrmFallback"> | undefined,
  entities: readonly Entity[],
): Exclude<VrmPick, { kind: "default" }> | undefined {
  const start = worldStartPersona(overview);
  if (!start) return undefined;
  const entity = start.source === "world" ? entities.find((e) => e.id === start.entityId) : undefined;
  const played: PlayedVrmAs = entity ? { source: "world", entity } : { source: "none" };
  const pick = playedVrmPick({
    store: overview?.vrmStore, played, customPersona: customPersonaEntity(entities), legacyFallback: overview?.legacyVrmFallback,
  });
  return pick && pick.kind !== "default" ? pick : undefined;
}

/** A loader for the offer of the model `pick` names, or undefined when it names none. */
function pickLoader(pick: Exclude<VrmPick, { kind: "default" }>, overview: Pick<WorldOverview, "vrmStore"> | undefined) {
  if (pick.kind === "world") {
    const data = overview?.vrmStore?.[pick.id]?.file.data;
    return data ? () => cached(dataKey("world", data), () => vrmOffer(data)) : undefined;
  }
  return libraryLoader(pick.id);
}

/** A loader for a library Avatar's offer. */
const libraryLoader = (id: string) => () => cached(`library:${id}`, async () => {
  const { blob } = await ModelStorageService.getModelData(id);
  const url = URL.createObjectURL(blob);
  try {
    return await vrmOffer(url);
  } finally {
    URL.revokeObjectURL(url);
  }
});

/** Several models as one offer: every key and channel any carries; a later model's color wins. */
const mergeOffers = (offers: ModelOffer[]): ModelOffer => ({
  keys: [...new Set(offers.flatMap((offer) => offer.keys))],
  channels: [...new Set(offers.flatMap((offer) => offer.channels))],
  colors: Object.assign({}, ...offers.map((offer) => offer.colors)) as ModelOffer["colors"],
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
 * row's `rows`, else the world's player Avatar. A key or channel counts when any model carries it. Null while
 * loading, or when no model is known. Loads only when `active`.
 */
export function useKnownMorphKeys(rows: RowModels | undefined, active: boolean): KnownModel | null {
  const world = useGameDataOptional();
  const overview = world?.worldOverview;
  const entities = world?.entities;
  const load = useMemo(() => {
    if (rows) {
      if (rows.resolving || !rows.models.length) return undefined;
      const loaders = rows.models.map(rowLoader);
      return () => Promise.all(loaders.map((loader) => loader())).then(mergeOffers);
    }
    const pick = worldPlayerVrmPick(overview, entities ?? []);
    return pick ? pickLoader(pick, overview) : undefined;
  }, [rows, overview, entities]);
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
