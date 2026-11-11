import { useEffect, useMemo, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { readUserDefaultAvatar } from "./defaultAvatar";
import { useMountedRef } from "./useMountedRef";
import { resolveOwnPick } from "./vrmResolver";
import ModelStorageService from "@/services/ModelStorageService";
import type { MediaAsset, VrmPick, WorldVrmStore } from "@/types";

/** The models an owned stat's or trait's rows play on: its owner's own. */
export interface MorphOwner {
  /** Group heading: the owner's name. */
  name: string;
  model?: Partial<MediaAsset>;
  /** The owner's Avatar pick, resolved on this device. */
  vrmPick?: VrmPick;
}

/** One model a row plays on: the owner's 3D model, a world store Avatar, or a library Avatar. */
export type RowModel =
  | { kind: "model"; heading: string; model: Partial<MediaAsset> & { data: string } }
  | { kind: "world"; name: string; data: string }
  | { kind: "library"; id: string; name: string };

/** The rows' models, or `resolving` while the library read that a pick needs still runs. */
export interface RowModels {
  models: RowModel[];
  resolving: boolean;
}

/** A library Avatar's id and display name, newest first. */
type LibraryNames = ReadonlyMap<string, string>;

/** The owner's 3D model, then the Avatar its pick resolves to. Undefined while the library is unread. */
export function ownerRowModels(
  owner: MorphOwner,
  ctx: { store: WorldVrmStore | undefined; library: LibraryNames | undefined; deviceDefault: string | undefined },
): RowModel[] | undefined {
  const models: RowModel[] = [];
  const data = owner.model?.data;
  if (data) models.push({ kind: "model", heading: owner.name, model: { ...owner.model, data } });
  const libraryIds = ctx.library && new Set(ctx.library.keys());
  const source = resolveOwnPick(owner.vrmPick, { store: ctx.store, libraryIds, deviceDefault: ctx.deviceDefault });
  if (source?.kind === "pending") return undefined;
  if (source?.kind === "world") {
    const vrm = ctx.store?.[source.id];
    if (vrm?.file.data) models.push({ kind: "world", name: vrm.name, data: vrm.file.data });
  }
  if (source?.kind === "library") models.push({ kind: "library", id: source.id, name: ctx.library?.get(source.id) ?? "" });
  return models;
}

/** A pick that reads the library to resolve. */
const readsLibrary = (pick: VrmPick | undefined) => pick?.kind === "default" || pick?.kind === "library";

/**
 * The lookup behind a stat's and a trait's Sliders picker, Colors and "Not on this model" mark: the models the
 * rows play on. An owned row plays on its owner's 3D model and the Avatar its pick resolves to on this device.
 * Undefined for a world row, which reads the world's player Avatars elsewhere.
 */
export function useRowModels(owner: MorphOwner | undefined): RowModels | undefined {
  const store = useGameDataOptional()?.worldOverview?.vrmStore;
  const needsLibrary = !!owner && readsLibrary(owner.vrmPick);
  const library = useLibraryNames(needsLibrary);
  const deviceDefault = useMemo(readUserDefaultAvatar, []);
  const name = owner?.name;
  const model = owner?.model;
  const pick = owner?.vrmPick;
  const pickKind = pick?.kind;
  const pickId = pick && pick.kind !== "default" ? pick.id : undefined;
  return useMemo(() => {
    if (name === undefined) return undefined;
    const models = ownerRowModels({ name, model, vrmPick: pick }, { store, library, deviceDefault });
    return models ? { models, resolving: false } : { models: [], resolving: true };
    // The pick's kind and id name its Avatar; the object around them may be rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, model, pickKind, pickId, store, library, deviceDefault]);
}

/** The library's Avatar names by id, read once `wanted`. An unreadable library reads as empty. */
function useLibraryNames(wanted: boolean): LibraryNames | undefined {
  const [names, setNames] = useState<LibraryNames>();
  const mounted = useMountedRef();
  useEffect(() => {
    if (!wanted || names) return;
    void ModelStorageService.getModelMetadata().catch(() => []).then((models) => {
      if (mounted.current) setNames(new Map(models.map((m) => [m.id, m.name])));
    });
  }, [wanted, names, mounted]);
  return names;
}
