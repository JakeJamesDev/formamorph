import { useCallback, useMemo } from "react";
import { buildMorphGroups, resolveMorphAlias, type MorphSource } from "./bodyMorphs";
import { useRowMorphSources } from "./useBodyMorphNames";
import { useKnownMorphKeys } from "./useKnownMorphKeys";
import { useRowModels, type MorphOwner, type RowModel, type RowModels } from "./useRowModels";
import type { ColorChannel } from "@/types";

/** The Appearance tab's hint when a row has no model to play on. */
export const NO_MODEL_HINT = "Set an Avatar or 3D model on the Profile tab to bind sliders";

/** The hint on a world row, which has no Profile tab: no playable persona resolves to an Avatar. */
export const WORLD_NO_MODEL_HINT = "Give a playable persona an Avatar, or add one to your library, to bind sliders";

/** The Preview button's hint on an entity's row with a 3D model and no Avatar. */
export const NO_AVATAR_PREVIEW_HINT = "Set an Avatar on the Profile tab to preview";

/** The Avatars a row plays on, which the Preview can show. */
export type RowAvatar = Extract<RowModel, { kind: "world" | "library" }>;

const NO_AVATARS: readonly RowAvatar[] = [];

/** The picker's empty text when the row's models offer nothing to bind; undefined otherwise. */
const emptyText = (rows: RowModels | undefined, sources: readonly MorphSource[]): string | undefined => {
  if (!rows || sources.length) return undefined;
  if (rows.world) return rows.models.length ? "The Avatars players can use have no sliders" : "No sliders to bind";
  const hasModel = rows.models.some((row) => row.kind === "model");
  const hasAvatar = rows.models.some((row) => row.kind !== "model");
  if (hasModel && hasAvatar) return "Neither this entity's 3D model nor its Avatar has sliders";
  if (hasModel) return "This entity's 3D model has no body sliders";
  if (hasAvatar) return "This entity's Avatar has no sliders";
  // The Appearance tab's hint says why.
  return "No sliders to bind";
};

/** A new color row's start when the known model has no color of its own for the channel. */
const FALLBACK_COLOR = "#ffffff";

/**
 * The shared slider picker behind a stat's and a trait's Sliders and Colors: the models `useRowModels` names
 * for an owned row, or for a world row its playable personas' Avatars, loaded when the picker opens. `keyOf` maps a name to the
 * key of the models the rows play on, null where none has it; it passes names through until they load, and
 * loads only while `active`. `lacksChannel` is true only once they loaded without the channel. `noModelHint`
 * is set once a row resolves to no model. `avatars` lists the Avatars among the models, empty while they resolve.
 */
export function useSliderPicker(owner: MorphOwner | undefined, active: boolean) {
  const rows = useRowModels(owner);
  const { sources, loading, load } = useRowMorphSources(rows);
  const groups = useMemo(() => buildMorphGroups(sources), [sources]);
  const known = useKnownMorphKeys(rows, active);
  const knownKeys = known?.keys;
  const keyOf = useCallback(
    (name: string): string | null => (knownKeys ? resolveMorphAlias(name, (key) => knownKeys.has(key)) : name),
    [knownKeys],
  );
  const lacksChannel = (channel: ColorChannel) => !!known && !known.channels.has(channel);
  const seedColor = (channel: ColorChannel) => known?.colors[channel] ?? FALLBACK_COLOR;
  const noModelHint = rows && !rows.resolving && !rows.models.length ? (rows.world ? WORLD_NO_MODEL_HINT : NO_MODEL_HINT) : undefined;
  const models = rows?.models;
  const avatars = useMemo(
    () => models?.filter((row): row is RowAvatar => row.kind !== "model") ?? NO_AVATARS,
    [models],
  );
  // A world row's models are all Avatars, so only an owner's 3D model alone leaves the Preview a hint of its own.
  const noAvatarHint = rows && !rows.resolving && !noModelHint && !avatars.length ? NO_AVATAR_PREVIEW_HINT : undefined;
  return { groups, loading, load, emptyText: emptyText(rows, sources), keyOf, lacksChannel, seedColor, noModelHint, avatars, noAvatarHint };
}
