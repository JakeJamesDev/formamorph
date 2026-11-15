/**
 * Character Mentions on this device: picks a model (Q40), keeps its files cached through the Coref Model Store,
 * loads it into the Coref Host, and reads finished passages. One controller per app; the UI and the turn
 * runner read its state.
 */
import type { CorefCluster, CorefDevice, CorefModelFiles } from './corefClient';
import { entrySize, parseCorefManifest, type CorefManifest, type CorefManifestEntry, type CorefModelId } from './corefManifest';
import {
  downloadEntry, isEntryCached, pruneCache, readEntryFiles, type CorefDownloadProgress, type CorefStoreDeps,
} from './corefModelStore';
import { readPassageMentions, type MentionCast, type MentionReading, type MentionSceneContext } from './mentionReading';
import type { CharacterMentionsModel } from '@/contexts/settingsDefaults';
import { PROBE_PASSAGE } from './probePassage';

export type CorefModelChoice = CharacterMentionsModel;

/** The settings the device follows. `blocked` is a non-English AI Language: the feature stops but keeps its files. */
export interface CharacterMentionsSettings {
  enabled: boolean;
  choice: CorefModelChoice;
  blocked: boolean;
}

/** The probe limit for the big model on a 300-token passage (Q19). */
export const PROBE_LIMIT_MS = 300;

export type CharacterMentionsStatus = 'off' | 'downloading' | 'ready' | 'error';

export interface CharacterMentionsState {
  status: CharacterMentionsStatus;
  /** Bytes of the running download; null while preparing or between downloads. */
  progress: CorefDownloadProgress | null;
  error: string | null;
  /** The model that reads passages once ready. */
  model: CorefModelId | null;
  version: number | null;
}

/** The host the controller loads models into; the worker client in the app, a fake in tests. */
export interface CorefHostPort {
  load(files: CorefModelFiles, device: CorefDevice): Promise<void>;
  resolve(text: string): Promise<CorefCluster[]>;
  dispose(): Promise<void>;
}

export interface CharacterMentionsDeps {
  manifestUrl: string;
  store: CorefStoreDeps;
  host: CorefHostPort;
  hasWebGpu: () => Promise<boolean>;
  now: () => number;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

/** What this device keeps between sessions: the loaded entry and the probe verdict. */
const ACTIVE_KEY = 'FORMAMORPH_corefActive';
const PROBE_KEY = 'FORMAMORPH_corefProbe';

interface ProbeRecord {
  bigVersion: number;
  passed: boolean;
}

/** One finished passage's reading, with the model that made it. */
export interface PassageReading {
  model: CorefModelId;
  version: number;
  reading: MentionReading;
  /** The host's clusters, as character spans, and the entity each one's vote named. */
  clusters: CorefCluster[];
  clusterEntities: (string | null)[];
}

export interface CharacterMentions {
  getState(): CharacterMentionsState;
  subscribe(listener: () => void): () => void;
  /** Bring the device in line with the settings. */
  sync(settings: CharacterMentionsSettings): void;
  /** Run the last sync again after an error. */
  retry(): void;
  /** Forget the probe verdict, so the next Auto sync probes again. */
  forgetProbe(): void;
  /** The download size of what Auto or the choice would fetch first, in bytes; null when the manifest is unreachable. */
  plannedSize(choice: CorefModelChoice): Promise<number | null>;
  /** The reading of one finished passage, or null when the feature is not ready. */
  readPassage(text: string, cast: MentionCast, scene: MentionSceneContext): Promise<PassageReading | null>;
}

const OFF: CharacterMentionsState = { status: 'off', progress: null, error: null, model: null, version: null };

class Superseded extends Error {}

/** The entry a choice downloads first, and whether the probe must run on it (Q40). */
function firstPick(list: CorefManifest, choice: CorefModelChoice, gpu: boolean, probe: ProbeRecord | null): { entry: CorefManifestEntry; probe: boolean } {
  if (choice !== 'auto') {
    const entry = list[choice];
    if (!entry) throw new Error('That model is not available yet');
    return { entry, probe: false };
  }
  const { big, small } = list;
  if (!big || !gpu || !small) {
    const entry = (gpu ? big : undefined) ?? small ?? big;
    if (!entry) throw new Error('No model is available yet');
    return { entry, probe: false };
  }
  if (probe?.bigVersion === big.version) return { entry: probe.passed ? big : small, probe: false };
  return { entry: big, probe: true };
}

export function createCharacterMentions(deps: CharacterMentionsDeps): CharacterMentions {
  let state = OFF;
  const listeners = new Set<() => void>();
  let generation = 0;
  let abort: AbortController | null = null;
  let last: CharacterMentionsSettings | null = null;
  let loaded: CorefManifestEntry | null = null;
  let manifestCache: Promise<CorefManifest> | null = null;
  // Runs one after another, so two loads never share the worker.
  let queue: Promise<void> = Promise.resolve();

  const set = (next: Partial<CharacterMentionsState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const readJson = <T>(key: string): T | null => {
    try {
      const raw = deps.storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  const writeJson = (key: string, value: unknown) => {
    try {
      deps.storage.setItem(key, JSON.stringify(value));
    } catch { /* storage full or blocked: the next session decides again */ }
  };
  const remove = (key: string) => {
    try {
      deps.storage.removeItem(key);
    } catch { /* blocked storage holds nothing to remove */ }
  };

  const fetchManifest = async (signal?: AbortSignal): Promise<CorefManifest> => {
    const response = await deps.store.fetch(deps.manifestUrl, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not reach the model list (error ${response.status})`);
    return parseCorefManifest(await response.json(), new URL(deps.manifestUrl, globalThis.location?.href).href);
  };
  const manifest = (signal?: AbortSignal): Promise<CorefManifest> => {
    manifestCache ??= fetchManifest(signal).catch((error: unknown) => {
      manifestCache = null;
      throw error;
    });
    return manifestCache;
  };

  const unload = async () => {
    if (!loaded) return;
    loaded = null;
    await deps.host.dispose().catch(() => {});
  };

  const run = async (gen: number, choice: CorefModelChoice) => {
    const signal = abort?.signal;
    const check = () => {
      if (gen !== generation) throw new Superseded();
    };
    const gpu = await deps.hasWebGpu();
    check();
    const load = async (entry: CorefManifestEntry) => {
      const files = await readEntryFiles(entry, deps.store);
      check();
      await deps.host.load(files, gpu ? 'webgpu' : 'wasm');
      loaded = entry;
      check();
    };
    const same = (a: CorefManifestEntry | null, b: CorefManifestEntry) => a?.model === b.model && a.version === b.version;

    // Start from the cache when the last entry still suits the choice, so a session opens without the network.
    const active = readJson<CorefManifestEntry>(ACTIVE_KEY);
    const probe = readJson<ProbeRecord>(PROBE_KEY);
    const autoModel = probe ? (probe.passed ? 'big' : 'small') : gpu ? null : 'small';
    const suits = (model: CorefModelId) => choice === model || (choice === 'auto' && autoModel === model);
    const cached = active && suits(active.model) && (same(loaded, active) || (await isEntryCached(active, deps.store))) ? active : null;
    if (cached) {
      check();
      if (!same(loaded, cached)) await load(cached);
      set({ status: 'ready', progress: null, error: null, model: cached.model, version: cached.version });
    }
    const fetchEntry = async (entry: CorefManifestEntry) => {
      await downloadEntry(entry, deps.store, (progress) => {
        if (!cached && gen === generation) set({ progress });
      }, signal);
      check();
      // The load and the probe follow; the row reads "Preparing…" until ready.
      if (!cached) set({ progress: null });
    };

    try {
      manifestCache = null;
      const list = await manifest(signal);
      check();
      const pick = firstPick(list, choice, gpu, probe);
      let target = pick.entry;
      if (pick.probe) {
        // The probe needs the big model on the device (Q40).
        await fetchEntry(target);
        await load(target);
        await deps.host.resolve(PROBE_PASSAGE); // the first run compiles the graphs
        check();
        const start = deps.now();
        await deps.host.resolve(PROBE_PASSAGE);
        const passed = deps.now() - start < PROBE_LIMIT_MS;
        check();
        writeJson(PROBE_KEY, { bigVersion: target.version, passed } satisfies ProbeRecord);
        if (!passed) target = list.small!;
      }
      if (!same(loaded, target)) {
        await fetchEntry(target);
        await load(target);
      }
      writeJson(ACTIVE_KEY, target);
      await pruneCache(target, deps.store);
      check();
      set({ status: 'ready', progress: null, error: null, model: target.model, version: target.version });
    } catch (error) {
      if (!cached || error instanceof Superseded) throw error;
      // A failed update, or no network, keeps the cached model reading (US52).
      console.warn('Character Mentions kept the cached model', error);
      if (!same(loaded, cached)) await load(cached);
    }
  };

  const sync: CharacterMentions['sync'] = (settings) => {
    const previous = last;
    last = settings;
    const gen = ++generation;
    abort?.abort();
    abort = new AbortController();
    if (!settings.enabled || settings.blocked) {
      set(OFF);
      // Turning it off deletes the files; a delete an earlier session never finished runs at this start.
      const removeFiles = !settings.enabled && (!!previous?.enabled || readJson(ACTIVE_KEY) !== null);
      queue = queue.then(async () => {
        if (gen !== generation) return;
        await unload();
        if (removeFiles) {
          remove(ACTIVE_KEY);
          await pruneCache(null, deps.store).catch(() => {});
        }
      });
      return;
    }
    if (state.status !== 'ready') set({ status: 'downloading', progress: null, error: null });
    queue = queue.then(() => run(gen, settings.choice)).catch((error: unknown) => {
      if (gen !== generation || error instanceof Superseded) return;
      set({ status: 'error', progress: null, error: error instanceof Error ? error.message : String(error) });
    });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sync,
    retry() {
      if (last) sync(last);
    },
    forgetProbe() {
      remove(PROBE_KEY);
    },
    async plannedSize(choice) {
      try {
        return entrySize(firstPick(await manifest(), choice, await deps.hasWebGpu(), readJson<ProbeRecord>(PROBE_KEY)).entry);
      } catch {
        return null;
      }
    },
    async readPassage(text, cast, scene) {
      const entry = loaded;
      if (state.status !== 'ready' || !entry) return null;
      const clusters = await deps.host.resolve(text);
      const { reading, clusterEntities } = readPassageMentions(text, clusters, cast, scene);
      return { model: entry.model, version: entry.version, reading, clusters, clusterEntities };
    },
  };
}
