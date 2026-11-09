import { useCallback, useMemo } from "react";
import { buildMorphGroups, resolveMorphAlias, type MorphSource } from "./bodyMorphs";
import { useBodyMorphSources, useOwnerMorphSources, type MorphOwner } from "./useBodyMorphNames";
import { useKnownMorphKeys } from "./useKnownMorphKeys";

/** The picker's empty text when the owner's model offers nothing to bind; undefined otherwise. */
const ownerEmptyText = (owner: MorphOwner | undefined, sources: readonly MorphSource[]): string | undefined => {
  if (!owner || sources.length) return undefined;
  return owner.model?.data
    ? "This entity's 3D model has no body sliders"
    : "This entity has no 3D model. Add one to bind its body sliders.";
};

/**
 * The shared slider picker behind a stat's and a trait's Body Sliders: the owner's model's sliders, or for a
 * world row every model's, loaded when the picker opens. `keyOf` maps a name to the key of the model the rows
 * play on, null where it lacks one; it passes names through until that model loads, and loads only while
 * `active`.
 */
export function useSliderPicker(owner: MorphOwner | undefined, active: boolean) {
  const worldMorphs = useBodyMorphSources();
  const ownerMorphs = useOwnerMorphSources(owner);
  const { sources, loading, load } = owner ? ownerMorphs : worldMorphs;
  const groups = useMemo(() => buildMorphGroups(sources), [sources]);
  const knownKeys = useKnownMorphKeys(owner, active);
  const keyOf = useCallback(
    (name: string): string | null => (knownKeys ? resolveMorphAlias(name, (key) => knownKeys.has(key)) : name),
    [knownKeys],
  );
  return { groups, loading, load, emptyText: ownerEmptyText(owner, sources), keyOf };
}
