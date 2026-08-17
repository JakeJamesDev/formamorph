/**
 * What the Triggers tab needs before it can show a semantic score: does this world have an embedding index,
 * and — only if the author asked for one — a vector for the text they pasted.
 *
 * The index is whatever the semantic-lore drainer already cached while the world was played; the Bench never
 * builds one. So the toggle is enabled by a cache read and nothing more, and while it is off no model is
 * opened and no text is embedded.
 */
import { useEffect, useMemo, useState } from 'react';
import { getVectors } from '@/lib/embeddingCache';
import { embedTexts, isEmbeddingModelReady, loadEmbeddingModel } from '@/lib/embeddingWorkerClient';
import { semanticIndexKeys, type SemanticInput } from './semantic';
import { scannedEntries, type TriggerWorld } from './triggers';

/** How still things go before a cache probe or an embed is worth starting — the tracer's own debounce, so
 *  the scores land with the run they belong to rather than one keystroke behind it. */
const SEMANTIC_DEBOUNCE_MS = 250;

/** Vector keys are `model:hash`, so a newline is the one thing that can't appear inside one. */
const KEY_SEP = '\n';

/**
 * Where a semantic run has got to. `unavailable` is the state the toggle is disabled in — this world has
 * nothing cached to score against; `waiting` is on-but-nothing-pasted.
 */
export type SemanticStatus = 'checking' | 'unavailable' | 'off' | 'waiting' | 'loading' | 'ready' | 'error';

export interface TriggerSemantics {
  status: SemanticStatus;
  /** Whether an index exists for this world — what the toggle is enabled by. */
  available: boolean;
  /** The vectors to trace with, present only while they belong to the text on screen. */
  input?: SemanticInput;
}

/**
 * The semantic input for `text`, or the reason there isn't one. `active` is whether the Triggers tab is on
 * screen at all — nothing here runs behind a closed Bench; `enabled` is the author's toggle.
 */
export function useTriggerSemantics(
  active: boolean,
  enabled: boolean,
  world: TriggerWorld,
  text: string,
  delayMs = SEMANTIC_DEBOUNCE_MS,
): TriggerSemantics {
  // Keyed by content rather than by world identity: an edit elsewhere in the editor moves the world object
  // every keystroke, and re-reading the same vectors for it would be a database round-trip per pause. Behind
  // a closed tab it isn't computed at all — hashing a whole dictionary per keystroke to answer a question
  // nobody is asking is the kind of background cost this instrument exists to expose.
  const indexKey = useMemo(
    () => (active ? semanticIndexKeys(scannedEntries(world), world.placeholders ?? []).join(KEY_SEP) : ''),
    [active, world],
  );
  const keys = useMemo(() => (indexKey ? indexKey.split(KEY_SEP) : []), [indexKey]);

  const [index, setIndex] = useState<{ key: string; vectors: Map<string, Float32Array> } | null>(null);
  const [run, setRun] = useState<{ key: string; text: string; input: SemanticInput } | null>(null);
  // Keyed to the attempt that failed, like `run`: a failure that outlived its own input would report "could
  // not be reached" over text that is right then being embedded successfully.
  const [failed, setFailed] = useState<{ key: string; text: string } | null>(null);

  // The probe: a read of the cache, never a write and never an embed, so it is safe to run with the toggle off
  // — which it has to be, since its answer is what decides whether the toggle can be turned on at all.
  useEffect(() => {
    if (!active) return;
    if (keys.length === 0) {
      setIndex({ key: indexKey, vectors: new Map() });
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      getVectors(keys)
        .then((vectors) => { if (live) setIndex({ key: indexKey, vectors }); })
        // A cache that won't open is a world with no index as far as the toggle is concerned.
        .catch(() => { if (live) setIndex({ key: indexKey, vectors: new Map() }); });
    }, delayMs);
    return () => { live = false; clearTimeout(timer); };
  }, [active, indexKey, keys, delayMs]);

  const probed = index?.key === indexKey;
  const vectors = probed ? index.vectors : undefined;
  const available = !!vectors && vectors.size > 0;
  const query = text.trim();

  // The one thing here that computes rather than reads. Guarded on `enabled` at the top: with the toggle off
  // the model is never opened, so an author who never asks for semantics never pays for it.
  useEffect(() => {
    if (!active || !enabled || !vectors || vectors.size === 0 || !query) return;
    if (run?.text === text && run.key === indexKey) return; // already embedded, whatever moved beneath it
    let live = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!isEmbeddingModelReady()) await loadEmbeddingModel();
          const [queryVec] = await embedTexts([text]);
          if (!live) return;
          setRun({ key: indexKey, text, input: { queryVec, vectors } });
          setFailed(null);
        } catch {
          // The model failed to open or the embed threw: the rest of the tab is unaffected, so the tracer
          // keeps its keyword answer and the row above it says why there are no scores.
          if (live) setFailed({ key: indexKey, text });
        }
      })();
    }, delayMs);
    return () => { live = false; clearTimeout(timer); };
  }, [active, enabled, vectors, query, text, indexKey, delayMs, run]);

  // A vector belongs to one text and one index. Anything else and there is no input at all — showing the last
  // run's scores beside newly pasted text would be the one dishonest thing this instrument could do.
  const input = enabled && available && run?.text === text && run.key === indexKey ? run.input : undefined;

  const stillFailing = failed?.text === text && failed.key === indexKey;
  const status: SemanticStatus = !probed ? 'checking'
    : !available ? 'unavailable'
      : !enabled ? 'off'
        : !query ? 'waiting'
          : stillFailing ? 'error'
            : input ? 'ready' : 'loading';

  return { status, available, input };
}
