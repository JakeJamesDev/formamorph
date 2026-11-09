import { useCallback, useMemo } from "react";
import { buildMorphGroups, resolveMorphAlias, type MorphSource } from "./bodyMorphs";
import { useBodyMorphSources, useOwnerMorphSources, type MorphOwner } from "./useBodyMorphNames";
import { useKnownMorphKeys } from "./useKnownMorphKeys";
import type { ColorChannel } from "@/types";

/** The picker's empty text when the owner's models offer nothing to bind; undefined otherwise. */
const ownerEmptyText = (
  owner: MorphOwner | undefined, sources: readonly MorphSource[], hasAvatar: boolean,
): string | undefined => {
  if (!owner || sources.length) return undefined;
  const hasModel = !!owner.model?.data;
  if (hasModel && hasAvatar) return "Neither this entity's 3D model nor its Avatar has sliders";
  if (hasModel) return "This entity's 3D model has no body sliders";
  if (hasAvatar) return "This entity's Avatar has no sliders";
  return "Pick an Avatar or add a 3D model to bind this entity's sliders.";
};

/** A new color row's start when the known model has no color of its own for the channel. */
const FALLBACK_COLOR = "#ffffff";

/**
 * The shared slider picker behind a stat's and a trait's Body Sliders and Colors: the owner's model's sliders,
 * or for a world row every model's, loaded when the picker opens. `keyOf` maps a name to the key of the model
 * the rows play on, null where it lacks one; it passes names through until that model loads, and loads only
 * while `active`. `lacksChannel` is true only once that model loaded without the channel.
 */
export function useSliderPicker(owner: MorphOwner | undefined, active: boolean) {
  const worldMorphs = useBodyMorphSources();
  const ownerMorphs = useOwnerMorphSources(owner);
  const { sources, loading, load } = owner ? ownerMorphs : worldMorphs;
  const groups = useMemo(() => buildMorphGroups(sources), [sources]);
  const known = useKnownMorphKeys(owner, active);
  const knownKeys = known?.keys;
  const keyOf = useCallback(
    (name: string): string | null => (knownKeys ? resolveMorphAlias(name, (key) => knownKeys.has(key)) : name),
    [knownKeys],
  );
  const lacksChannel = (channel: ColorChannel) => !!known && !known.channels.has(channel);
  const seedColor = (channel: ColorChannel) => known?.colors[channel] ?? FALLBACK_COLOR;
  return { groups, loading, load, emptyText: ownerEmptyText(owner, sources, ownerMorphs.avatarNamed), keyOf, lacksChannel, seedColor };
}
