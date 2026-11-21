// One Layered Image as the editor holds it: its entry, its writes, Preview As and the reads that follow from them.

import { useMemo, useState } from 'react';
import type { RuleHost } from '@/components/editor/ImageRuleCog';
import { useGameData } from '@/contexts/GameDataContext';
import { useRuleSource } from '@/contexts/RuleSourceContext';
import { useImageFacts, type ImageFacts } from '@/lib/imageFacts';
import {
  layeredSizeMismatches, OUTSIDE_PLAY, resolveLayered, shownVariant, type LayerReads, type LayeredPicture, type SizeMismatch,
} from '@/lib/layeredImages';
import { layeredEntry, mediaEntry } from '@/lib/mediaList';
import { ruleStates } from '@/lib/traitGates';
import type { LayeredMediaEntry, MediaLayer, MediaList, TraitRequirementRow } from '@/types';
import { useMediaStep } from './useMediaItemActions';

/** Preview As's value for the picture outside play. */
export const DEFAULT_LOOK = ':default';

/** One Layered Image as the editor reads and writes it. Every write is one History Step. */
export interface Rig {
  entry: LayeredMediaEntry;
  list: MediaList | undefined;
  write: (label: string, next: LayeredMediaEntry, added?: MediaList) => void;
  /** Preview As: an entity id, or DEFAULT_LOOK. */
  as: string;
  setAs: (id: string) => void;
  reads: LayerReads;
  /** The rule host a Variant's cog and summary read: the previewed entity, else none in particular. */
  host: RuleHost;
  selectedId: string | undefined;
  select: (layerId: string) => void;
  /** The selected Layer, or the top one. */
  layer: MediaLayer | undefined;
  facts: ReadonlyMap<string, ImageFacts>;
  mismatches: SizeMismatch[];
  /** Each image entry's data, by id. */
  dataOf: (mediaId: string) => string | undefined;
  /** An opacity being dragged, shown before it is written. */
  draft: { layerId: string; opacity: number } | null;
  setDraft: (draft: { layerId: string; opacity: number } | null) => void;
}

/** The rig named `entryId`, or undefined once it is gone. */
export function useRig(entryId: string): Rig | undefined {
  const { worldOverview, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const entry = layeredEntry(list, entryId);
  const step = useMediaStep();
  const source = useRuleSource();
  const [as, setAs] = useState(DEFAULT_LOOK);
  const [selectedId, select] = useState<string>();
  const [draft, setDraft] = useState<Rig['draft']>(null);
  const gateInput = source?.gateInput;
  const reads = useMemo<LayerReads>(
    () => (as !== DEFAULT_LOOK && gateInput ? { statesOf: (rows: TraitRequirementRow[]) => ruleStates(gateInput, as, rows) } : OUTSIDE_PLAY),
    [as, gateInput],
  );
  const host = useMemo<RuleHost>(() => ({ kind: 'entity', id: as === DEFAULT_LOOK ? '' : as }), [as]);
  const dataOf = (mediaId: string) => mediaEntry(list, mediaId, 'image')?.data;
  const srcs = entry ? entry.layers.flatMap((l) => l.variants.flatMap((v) => dataOf(v.mediaId) ?? [])) : [];
  const facts = useImageFacts(srcs);
  if (!entry) return undefined;
  const write = (label: string, next: LayeredMediaEntry, added: MediaList = {}) =>
    void step(label, () => addMedia({ ...added, [next.id]: next }));
  const layer = entry.layers.find((l) => l.id === selectedId) ?? entry.layers.at(-1);
  const mismatches = layeredSizeMismatches(entry, list, (id) => {
    const data = dataOf(id);
    return data ? facts.get(data)?.size : undefined;
  });
  return { entry, list, write, as, setAs, reads, host, selectedId, select, layer, facts, mismatches, dataOf, draft, setDraft };
}

/** The rig's picture under Preview As, without the Layers in `hidden`, at any dragged opacity. */
export function rigPicture(rig: Rig, hidden?: ReadonlySet<string>): LayeredPicture | undefined {
  const picture = resolveLayered(rig.entry, rig.list, rig.reads);
  if (!picture || (!hidden?.size && !rig.draft)) return picture;
  return {
    ...picture,
    layers: picture.layers.map((l) => {
      const opacity = draftOpacity(rig, l.id) ?? l.opacity;
      const { data: _shown, ...rest } = l;
      return { ...(hidden?.has(l.id) ? rest : l), opacity };
    }),
  };
}

/** The opacity being dragged on Layer `layerId`, or undefined. */
export const draftOpacity = (rig: Rig, layerId: string): number | undefined =>
  (rig.draft?.layerId === layerId ? rig.draft.opacity : undefined);

/** A Media List entry's name, or "Unnamed". */
export const entryName = (rig: Rig, mediaId: string): string => rig.list?.[mediaId]?.name || 'Unnamed';

/** The name of the Variant a Layer shows now, or "Nothing". */
export function shownName(rig: Rig, layer: MediaLayer): string {
  const shown = layer.variants[shownVariant(layer, rig.list, rig.reads)];
  return shown ? entryName(rig, shown.mediaId) : 'Nothing';
}

/** Whether any Variant of `layer` differs in size from the canvas. */
export const layerMismatched = (rig: Rig, layer: MediaLayer): boolean => rig.mismatches.some((m) => m.layerId === layer.id);

/** The rig's Layer names, top first, for the pane's summary line. */
export const layerNames = (entry: LayeredMediaEntry): string => [...entry.layers].reverse().map((l) => l.name).join(' · ');
