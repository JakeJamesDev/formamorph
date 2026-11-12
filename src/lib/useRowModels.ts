import { useEffect, useMemo, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { customPersonaEntity } from "./blueprints";
import { readUserDefaultAvatar } from "./defaultAvatar";
import { offeredPersonas, worldAllowedPersonas } from "./personaPick";
import { useMountedRef } from "./useMountedRef";
import { playedVrmPick, resolveOwnPick, type VrmSource } from "./vrmResolver";
import ModelStorageService from "@/services/ModelStorageService";
import type { Entity, MediaAsset, VrmPick, WorldOverview, WorldVrmStore } from "@/types";

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
  /** A world row's models: the Avatars its playable personas show. */
  world?: true;
}

/** A library Avatar's id and display name, newest first. */
type LibraryNames = ReadonlyMap<string, string>;

/** What a pick reads to resolve on this device. */
interface RowContext {
  store: WorldVrmStore | undefined;
  library: LibraryNames | undefined;
  deviceDefault: string | undefined;
}

/** The row model for a resolved source; none when the world store lacks its file. */
function avatarRowModel(source: VrmSource, ctx: RowContext): RowModel | undefined {
  if (source.kind === "world") {
    const vrm = ctx.store?.[source.id];
    return vrm?.file.data ? { kind: "world", name: vrm.name, data: vrm.file.data } : undefined;
  }
  if (source.kind === "library") return { kind: "library", id: source.id, name: ctx.library?.get(source.id) ?? "" };
  return undefined;
}

const resolveOn = (pick: VrmPick | undefined, ctx: RowContext) =>
  resolveOwnPick(pick, { store: ctx.store, libraryIds: ctx.library && new Set(ctx.library.keys()), deviceDefault: ctx.deviceDefault });

/** The owner's 3D model, then the Avatar its pick resolves to. Undefined while the library is unread. */
export function ownerRowModels(owner: MorphOwner, ctx: RowContext): RowModel[] | undefined {
  const models: RowModel[] = [];
  const data = owner.model?.data;
  if (data) models.push({ kind: "model", heading: owner.name, model: { ...owner.model, data } });
  const source = resolveOn(owner.vrmPick, ctx);
  if (source?.kind === "pending") return undefined;
  const avatar = source && avatarRowModel(source, ctx);
  if (avatar) models.push(avatar);
  return models;
}

/** The world as the pickers read it. */
export interface WorldRowSource {
  overview: Pick<WorldOverview, "vrmStore" | "allowedPersonas" | "legacyVrmFallback"> | undefined;
  entities: readonly Entity[];
}

/**
 * The picks a new game of the world can be played with, one per persona Enter World offers under Allowed
 * Personas. A library persona or None plays as the Custom Persona's pick, so one entry stands for them. Starts On
 * only guides the player, so it never narrows the set.
 */
export function playablePicks({ overview, entities }: WorldRowSource): (VrmPick | undefined)[] {
  const customPersona = customPersonaEntity(entities);
  const world = entities.filter((entity) => entity.persona === true);
  const offer = offeredPersonas(worldAllowedPersonas(overview), { world, library: [], custom: customPersona });
  const base = { store: overview?.vrmStore, customPersona, legacyFallback: overview?.legacyVrmFallback };
  const picks = offer.world.map((entity) => playedVrmPick({ ...base, played: { source: "world", entity } }));
  if (offer.none) picks.push(playedVrmPick({ ...base, played: { source: "none" } }));
  return picks;
}

/** Every playable persona's Avatar once, in persona order. Undefined while the library is unread. */
export function worldRowModels(picks: readonly (VrmPick | undefined)[], ctx: RowContext): RowModel[] | undefined {
  const sources = picks.map((pick) => resolveOn(pick, ctx));
  if (sources.some((source) => source?.kind === "pending")) return undefined;
  const seen = new Set<string>();
  const models: RowModel[] = [];
  for (const source of sources) {
    if (!source || source.kind === "pending") continue;
    const key = `${source.kind}:${source.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const avatar = avatarRowModel(source, ctx);
    if (avatar) models.push(avatar);
  }
  return models;
}

/** A pick that reads the library to resolve. */
const readsLibrary = (pick: VrmPick | undefined) => pick?.kind === "default" || pick?.kind === "library";

/**
 * The lookup behind a stat's and a trait's Sliders picker, Colors and "Not on this model" mark: the models the
 * rows play on. An owned row plays on its owner's 3D model and the Avatar its pick resolves to on this device.
 * A world row (no owner) plays on each playable persona's Avatar. Undefined off a world.
 */
export function useRowModels(owner: MorphOwner | undefined): RowModels | undefined {
  const world = useGameDataOptional();
  const overview = world?.worldOverview;
  const entities = world?.entities;
  const store = overview?.vrmStore;
  const isWorldRow = !owner;
  const picks = useMemo(
    () => (isWorldRow && overview ? playablePicks({ overview, entities: entities ?? [] }) : []),
    [isWorldRow, overview, entities],
  );
  const needsLibrary = owner ? readsLibrary(owner.vrmPick) : picks.some(readsLibrary);
  const library = useLibraryNames(needsLibrary);
  const deviceDefault = useMemo(readUserDefaultAvatar, []);
  const name = owner?.name;
  const model = owner?.model;
  const pick = owner?.vrmPick;
  const pickKind = pick?.kind;
  const pickId = pick && pick.kind !== "default" ? pick.id : undefined;
  return useMemo(() => {
    if (name === undefined) {
      if (!overview) return undefined;
      const models = worldRowModels(picks, { store, library, deviceDefault });
      return models ? { models, resolving: false, world: true } : { models: [], resolving: true, world: true };
    }
    const models = ownerRowModels({ name, model, vrmPick: pick }, { store, library, deviceDefault });
    return models ? { models, resolving: false } : { models: [], resolving: true };
    // The pick's kind and id name its Avatar; the object around them may be rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, model, pickKind, pickId, picks, overview, store, library, deviceDefault]);
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
