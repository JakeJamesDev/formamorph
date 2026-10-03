import type { ChatMessage, Dictionary, Entity, Placeholder } from '@/types';
import { chipValues } from '@/lib/chipValues/chipValues';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { sampleChipScene, sampleDictionaries } from '@/lib/chipValues/sampleScene';
import { enabledBooks } from '@/lib/dictionaryUtils';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { parseTurns } from '@/lib/turnBanding';
import { diaryHoldsMemory, parseTurnContent, serializeTurnContent } from '@/lib/turnDigest';
import { applyMemoryOverrides, type MemoryOverrides } from '@/lib/memoryOverrides';
import { vectorKey } from '@/lib/memoryRelevance';

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
  /** The entity's own placeholders, name to resolved text. */
  readonly placeholders: PlaceholderValues;
}

/** Placeholder name to the text this playthrough resolved for it. */
export type PlaceholderValues = Readonly<Record<string, string>>;

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
  /** The book's own placeholders, name to resolved text. */
  readonly placeholders: PlaceholderValues;
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

/** One committed turn's memories as recall searches them. */
export interface ToolMemory {
  /** The turn's 1-based place among the committed turns. */
  readonly turn: number;
  /** The digest after the player's Memory Manager edits; empty when the turn has none or it was deleted. */
  readonly digest: string;
  readonly diaries: readonly { readonly character: string; readonly text: string }[];
}

/** Recall's meaning match, while Semantic Memory is on. */
export interface ToolMeaning {
  /** The query's vector; null when the model is not loaded or the embed fails. */
  readonly embed: (text: string) => Promise<Float32Array | null>;
  /** Cached vectors by `vectorKey`. */
  readonly vectors: ReadonlyMap<string, Float32Array>;
  /** Whether diary entries match by meaning: Diary Recall is on. */
  readonly diaries: boolean;
}

/** The playthrough memory a snapshot reads. */
export interface ToolMemorySource {
  /** The committed history, so a rolled-back turn is already gone. */
  readonly history: readonly ChatMessage[];
  readonly overrides: MemoryOverrides | null;
  /** How many of the newest turns the narration prompt carries in full. */
  readonly verbatimFloor: number;
  /** No meaning match means recall matches by words only. */
  readonly meaning?: ToolMeaning | null;
}

/** What every Tool call in one turn reads. Built once, frozen, and never read back from React or storage. */
export interface ToolSnapshot {
  readonly world: ToolWorld;
  readonly scene: ToolScene;
  /** Each scene chip's value, as a prompt renders it. */
  readonly chips: Readonly<Record<string, string>>;
  /** Placeholder resolution for chips a Template body carries. */
  readonly resolve: (text: string) => string;
  /** The world's shared placeholders, name to resolved text. */
  readonly placeholders: PlaceholderValues;
  /** The turns older than the verbatim floor that hold a digest or a diary entry, oldest first. */
  readonly memories: readonly ToolMemory[];
  /** Recall's meaning match, holding only the memory list's cached vectors. */
  readonly meaning: ToolMeaning | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Each top-level placeholder's chip as `read` renders it, by name. The first of a repeated name keeps it. */
function placeholderValues(list: readonly Placeholder[] | undefined, read: (chip: string) => string): Record<string, string> {
  const out = new Map<string, string>();
  for (const ph of list ?? []) {
    if (ph.ownerId || !ph.name.trim() || out.has(ph.name)) continue;
    out.set(ph.name, read(encodePlaceholderToken({ id: ph.id, mode: 'world', placementId: ph.id })));
  }
  // fromEntries keeps a `__proto__` name as a plain key.
  return Object.fromEntries(out);
}

/** Digests through the override layer and diaries that hold a memory, outside the verbatim floor. No notes. */
function toolMemories({ history, overrides, verbatimFloor }: ToolMemorySource): ToolMemory[] {
  const turns = applyMemoryOverrides(parseTurns([...history]), overrides);
  return turns.slice(0, Math.max(0, turns.length - verbatimFloor)).flatMap((t, i) => {
    const diaries = Object.entries(parseTurnContent(history[t.index].content)?.diaries ?? {})
      .flatMap(([character, text]) => (typeof text === 'string' ? [{ character: character.trim(), text: text.trim() }] : []))
      .filter((d) => d.text && diaryHoldsMemory(d.text));
    const digest = t.summary?.trim() ?? '';
    return digest || diaries.length ? [{ turn: i + 1, digest, diaries }] : [];
  });
}

/** `meaning` with the cached vectors of `memories`' texts copied out, so later cache writes miss the turn. */
function toolMeaning(meaning: ToolMeaning, memories: readonly ToolMemory[]): ToolMeaning {
  const keys = memories.flatMap(({ digest, diaries }) => [digest, ...diaries.map((d) => d.text)]).filter(Boolean).map(vectorKey);
  const vectors = new Map(keys.flatMap((key) => {
    const vec = meaning.vectors.get(key);
    return vec ? [[key, vec] as const] : [];
  }));
  return Object.freeze({ ...meaning, vectors });
}

/** The Tool Snapshot of `scene`, with the world's enabled dictionary entries. The scene's own lore is the
 *  turn's activated entries, so the whole dictionary comes in beside it. No `memory` means no memories. */
export function buildToolSnapshot(scene: ChipScene, dictionaries: readonly Dictionary[], memory: ToolMemorySource | null = null): ToolSnapshot {
  const { resolve } = scene;
  const resolveEntity = scene.resolveEntity ?? ((_entity: Entity, value: string) => resolve(value));
  const text = (value: string | undefined) => (value ? resolve(value) : '');
  const memories = memory ? toolMemories(memory) : [];
  const nameOf = new Map(scene.entities.map((e) => [e.id, e.name]));
  const names = (ids: readonly string[]) => ids.flatMap((id) => nameOf.get(id) ?? []);

  const world: ToolWorld = {
    entities: scene.entities.map((e) => ({
      id: e.id, name: e.name, aliases: [...(e.aliases ?? [])], type: e.type ?? '', pronouns: e.pronouns ?? '',
      description: text(e.aiDescription), summary: text(e.aiSummary),
      placeholders: placeholderValues(e.placeholders, (chip) => resolveEntity(e, chip)),
    })),
    locations: scene.locations.map((l) => ({
      id: l.id, name: l.name, description: text(l.aiDescription), summary: text(l.aiSummary),
    })),
    dictionary: enabledBooks(dictionaries).flatMap((book) => {
      const own = placeholderValues(book.placeholders, resolve);
      return (book.entries ?? []).filter((entry) => entry.enabled !== false).map((entry) => ({
        id: entry.id, name: entry.name, keys: [...(entry.key ?? [])], value: text(entry.value), placeholders: own,
      }));
    }),
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
    placeholders: Object.freeze(placeholderValues(scene.placeholders, resolve)),
    memories: deepFreeze(memories),
    meaning: memory?.meaning ? toolMeaning(memory.meaning, memories) : null,
  });
}

/** The sample world's past turns: each one a digest, some with a diary entry. */
function sampleHistory(): ChatMessage[] {
  const turns: { summary: string; diaries?: Record<string, string> }[] = [
    { summary: 'Wren sold Bell a lantern of salt glass at the Landing.' },
    { summary: 'Harrow warned Wren that the Long Ebb would strand the boats.', diaries: { Bell: 'Wren asked a fair price for the lantern. I owe Wren a favor.' } },
    { summary: 'A gull stole bread from the Boathouse.', diaries: { Wren: 'nothing notable' } },
  ];
  return turns.flatMap(({ summary, diaries }, i) => [
    { role: 'user', content: 'Look around.' },
    { role: 'assistant', content: serializeTurnContent({ narration: '', choices: [], stat_changes: [], turnId: `sample-${i + 1}`, summary, diaries }) },
  ]);
}

/** The Tool Snapshot of the sample world, for trying a Tool with no world open. */
export const sampleToolSnapshot = (): ToolSnapshot =>
  buildToolSnapshot(sampleChipScene(), sampleDictionaries(), { history: sampleHistory(), overrides: null, verbatimFloor: 0 });

/** The Chip Scene of no world: nowhere, nobody, nothing written. */
const EMPTY_SCENE: ChipScene = {
  overview: '', stats: [], traits: [], traitGroups: [], persona: null, location: null, locations: [], connections: [], entities: [],
  presentIds: [], inSceneIds: [], lore: [], notes: '', time: null, resolve: (text) => text,
};

/** The Tool Snapshot of no world: what a Tool reads when no world is open. Every lookup returns its empty result. */
export const emptyToolSnapshot = (): ToolSnapshot => buildToolSnapshot(EMPTY_SCENE, []);
