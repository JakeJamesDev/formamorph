import type { ChatMessage, Dictionary } from '@/types';
import { chipValues } from '@/lib/chipValues/chipValues';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { enabledBooks } from '@/lib/dictionaryUtils';
import type { ValueLookup } from '@/lib/promptValues';
import { parseTurns } from '@/lib/turnBanding';
import { diaryHoldsMemory, parseTurnContent, turnDiaries } from '@/lib/turnDigest';
import { applyMemoryOverrides, type MemoryOverrides } from '@/lib/memoryOverrides';
import { vectorKey } from '@/lib/memoryRelevance';
import type { SandboxState } from '@/lib/statCodeTurn';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';

/** An entity as a lookup matches it. Blank text reads as an empty string. */
export interface ToolEntity {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  /** The full AI description. */
  readonly description: string;
  readonly summary: string;
}

/** A location as a lookup matches it. */
export interface ToolLocation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly summary: string;
}

/** An enabled dictionary entry as a lookup matches it. */
export interface ToolDictionaryEntry {
  readonly id: string;
  readonly name: string;
  readonly keys: readonly string[];
  readonly value: string;
}

/** The world a lookup searches. In play, entities include the runtime characters the playthrough discovered. */
export interface ToolWorld {
  readonly entities: readonly ToolEntity[];
  readonly locations: readonly ToolLocation[];
  readonly dictionary: readonly ToolDictionaryEntry[];
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
  /** The Strip Links And Images setting: recall returns digests and diary entries as plain text. */
  readonly stripMedia?: boolean;
}

/** What a Tool script reads, and the world the editor names it from. */
export interface ToolScriptSource {
  /** The script surface's state: play's as the turn left it, else the opening's. Null reads the opening of a world
   *  with nothing in it. */
  readonly state: SandboxState | null;
  /** The authored world, for the editor's names. Null with no world open. */
  readonly authored: StatCodeWorld | null;
}

/** What every Tool call in one turn reads. Built once, frozen, and never read back from React or storage. */
export interface ToolSnapshot {
  readonly world: ToolWorld;
  /** Each scene chip's value, as a prompt renders it. */
  readonly chips: ValueLookup;
  /** Placeholder resolution for chips a Template body carries. */
  readonly resolve: (text: string) => string;
  /** The turns older than the verbatim floor that hold a digest or a diary entry, oldest first. */
  readonly memories: readonly ToolMemory[];
  /** Recall's meaning match, holding only the memory list's cached vectors. */
  readonly meaning: ToolMeaning | null;
  /** Whether recall strips links and images from what it returns (see `ToolMemorySource.stripMedia`). */
  readonly stripMedia: boolean;
  /** What a script reads, through the surface without writes (Q24), and the world the editor names it from. */
  readonly script: ToolScriptSource;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Digests through the override layer and diaries that hold a memory, outside the verbatim floor. No notes. */
function toolMemories({ history, overrides, verbatimFloor }: ToolMemorySource): ToolMemory[] {
  const turns = applyMemoryOverrides(parseTurns([...history]), overrides);
  return turns.slice(0, Math.max(0, turns.length - verbatimFloor)).flatMap((t, i) => {
    const parsed = parseTurnContent(history[t.index].content);
    const diaries = Object.entries(parsed ? turnDiaries(parsed) : {})
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

/** No world: the opening of an empty one. */
const NO_WORLD_SCRIPT: ToolScriptSource = { state: null, authored: null };

/** The Tool Snapshot of `scene`, with the world's enabled dictionary entries. The scene's own lore is the
 *  turn's activated entries, so the whole dictionary comes in beside it. No `memory` means no memories. */
export function buildToolSnapshot(
  scene: ChipScene, dictionaries: readonly Dictionary[], memory: ToolMemorySource | null = null, script: ToolScriptSource = NO_WORLD_SCRIPT,
): ToolSnapshot {
  const { resolve } = scene;
  const text = (value: string | undefined) => (value ? resolve(value) : '');
  const memories = memory ? toolMemories(memory) : [];

  const world: ToolWorld = {
    entities: scene.entities.map((e) => ({
      id: e.id, name: e.name, aliases: [...(e.aliases ?? [])], description: text(e.aiDescription), summary: text(e.aiSummary),
    })),
    locations: scene.locations.map((l) => ({
      id: l.id, name: l.name, description: text(l.aiDescription), summary: text(l.aiSummary),
    })),
    dictionary: enabledBooks(dictionaries).flatMap((book) => (book.entries ?? []).filter((entry) => entry.enabled !== false)
      .map((entry) => ({ id: entry.id, name: entry.name, keys: [...(entry.key ?? [])], value: text(entry.value) }))),
  };

  return Object.freeze({
    world: deepFreeze(world), chips: chipValues(scene), resolve,
    memories: deepFreeze(memories),
    meaning: memory?.meaning ? toolMeaning(memory.meaning, memories) : null,
    stripMedia: memory?.stripMedia === true,
    script,
  });
}

/** The Chip Scene of no world: nowhere, nobody, nothing written. */
const EMPTY_SCENE: ChipScene = {
  overview: '', stats: [], traits: [], traitGroups: [], persona: null, location: null, locations: [], connections: [], entities: [],
  presentIds: [], inSceneIds: [], lore: [], notes: '', time: null, resolve: (text) => text,
};

/** The Tool Snapshot of no world: what a Tool reads when no world is open. Every lookup returns its empty result. */
export const emptyToolSnapshot = (): ToolSnapshot => buildToolSnapshot(EMPTY_SCENE, []);
