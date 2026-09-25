import type { Dictionary } from '@/types';
import { chipValues } from '@/lib/chipValues/chipValues';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { flattenEnabledBookEntries } from '@/lib/dictionaryUtils';

/** An entity as a Tool reads it. Blank text reads as an empty string. */
export interface ToolEntity {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly type: string;
  readonly pronouns: string;
  /** The full AI description. */
  readonly description: string;
  readonly summary: string;
}

/** A location as a Tool reads it. */
export interface ToolLocation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly summary: string;
}

/** An enabled dictionary entry as a Tool reads it. */
export interface ToolDictionaryEntry {
  readonly id: string;
  readonly name: string;
  readonly keys: readonly string[];
  readonly value: string;
}

/** The world a Tool searches. In play, entities include the runtime characters the playthrough discovered. */
export interface ToolWorld {
  readonly entities: readonly ToolEntity[];
  readonly locations: readonly ToolLocation[];
  readonly dictionary: readonly ToolDictionaryEntry[];
}

/** The current scene as a Tool reads it. People are named, not numbered. */
export interface ToolScene {
  readonly location: { readonly id: string; readonly name: string } | null;
  /** Who is at the location. */
  readonly present: readonly string[];
  /** Who has taken part in the scene, named or not. */
  readonly inScene: readonly string[];
  /** Each stat's current value by name. */
  readonly stats: Readonly<Record<string, number>>;
  /** The traits in force, by name. */
  readonly traits: readonly string[];
  readonly persona: string | null;
  readonly notes: string;
  readonly time: { readonly elapsed: number } | null;
}

/** What every Tool call in one turn reads. Built once, frozen, and never read back from React or storage. */
export interface ToolSnapshot {
  readonly world: ToolWorld;
  readonly scene: ToolScene;
  /** Each scene chip's value, as a prompt renders it. */
  readonly chips: Readonly<Record<string, string>>;
  /** Placeholder resolution for chips a Template body carries. */
  readonly resolve: (text: string) => string;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** The Tool Snapshot of `scene`, with the world's enabled dictionary entries. The scene's own lore is the
 *  turn's activated entries, so the whole dictionary comes in beside it. */
export function buildToolSnapshot(scene: ChipScene, dictionaries: readonly Dictionary[]): ToolSnapshot {
  const { resolve } = scene;
  const text = (value: string | undefined) => (value ? resolve(value) : '');
  const nameOf = new Map(scene.entities.map((e) => [e.id, e.name]));
  const names = (ids: readonly string[]) => ids.flatMap((id) => nameOf.get(id) ?? []);

  const world: ToolWorld = {
    entities: scene.entities.map((e) => ({
      id: e.id, name: e.name, aliases: [...(e.aliases ?? [])], type: e.type ?? '', pronouns: e.pronouns ?? '',
      description: text(e.aiDescription), summary: text(e.aiSummary),
    })),
    locations: scene.locations.map((l) => ({
      id: l.id, name: l.name, description: text(l.aiDescription), summary: text(l.aiSummary),
    })),
    dictionary: flattenEnabledBookEntries([...dictionaries])
      .filter((entry) => entry.enabled !== false)
      .map((entry) => ({ id: entry.id, name: entry.name, keys: [...(entry.key ?? [])], value: text(entry.value) })),
  };

  const sceneData: ToolScene = {
    location: scene.location ? { id: scene.location.id, name: scene.location.name } : null,
    present: names(scene.presentIds),
    inScene: [...names(scene.inSceneIds), ...(scene.inSceneNames ?? [])],
    stats: Object.fromEntries(scene.stats.map((s) => [s.name, s.value])),
    traits: scene.traits.map((t) => t.name),
    persona: scene.persona?.entity.name ?? null,
    notes: scene.notes,
    time: scene.time ? { elapsed: scene.time.elapsed } : null,
  };

  return Object.freeze({
    world: deepFreeze(world), scene: deepFreeze(sceneData), chips: Object.freeze(chipValues(scene)), resolve,
  });
}
