import { useCallback, useEffect, useRef, useState } from 'react';
import { isEmbeddingModelCached, isEmbeddingModelReady, loadEmbeddingModel, type EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';
import { useMountedRef } from '@/lib/useMountedRef';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';

/** The embedding model is loaded or cached on the device. */
const modelOnDevice = async () => isEmbeddingModelReady() || isEmbeddingModelCached();

/** What the offer card shows: the offer itself, or the download that Turn On started. */
export type OfferCard = 'offer' | 'download';

/** The Semantic Search switch: its state, and the one download it starts. */
export interface SemanticSearch {
  /** The switch is on: the source is on, or its model is downloading. */
  readonly on: boolean;
  readonly downloading: boolean;
  readonly progress: EmbeddingLoadProgress | null;
  /** The message of the last failed download; none after a retry starts or the switch goes off. */
  readonly error: string | null;
  /** Any flip of the switch answers the offer. */
  setOn: (on: boolean) => void;
  /** The card at the top of the help window, or null while none shows. */
  readonly card: OfferCard | null;
  /** Turn On, and Retry on the card: the switch goes on, and the card follows the download. */
  turnOn: () => void;
  /** No Thanks: the offer is answered and the card never returns. */
  noThanks: () => void;
  /** Hides the card of a failed download. */
  dismiss: () => void;
}

/** A switch that is off and idle, with no card. For surfaces that draw no offer, and for tests. */
export const IDLE_SEMANTIC_SEARCH: SemanticSearch = {
  on: false, downloading: false, progress: null, error: null, card: null,
  setOn: () => {}, turnOn: () => {}, noThanks: () => {}, dismiss: () => {},
};

/**
 * Held above the settings dialog, so closing it keeps a download. The source goes on only when the model is
 * on the device: a question asked during the download uses the other sources, and a failed download leaves
 * the source off. While `open`, a model that is already on the device turns the source on with no card.
 */
export function useSemanticSearch(settings: HelpSettings, change: (next: HelpSettingsChange) => void, open = true): SemanticSearch {
  const mounted = useMountedRef();
  const attempt = useRef(0);
  const loading = useRef<Promise<void> | null>(null);
  const onProgress = useRef<(next: EmbeddingLoadProgress) => void>(() => {});
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<EmbeddingLoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The card started this download, so the card follows it. */
  const [fromCard, setFromCard] = useState(false);
  /** The model is known to be off the device, so the offer can show without flashing for a cached model. */
  const [probed, setProbed] = useState(false);

  const start = useCallback((on: boolean, viaCard: boolean) => {
    const mine = ++attempt.current;
    const current = () => mounted.current && attempt.current === mine;
    setError(null);
    setProgress(null);
    setFromCard(on && viaCard);
    if (!on) {
      setDownloading(false);
      change({ semanticOffer: 'decided', sources: { semantic: false } });
      return;
    }
    change({ semanticOffer: 'decided' });
    setDownloading(true);
    void (async () => {
      try {
        if (!(await modelOnDevice())) {
          onProgress.current = (next) => { if (current()) setProgress(next); };
          // A switch off and on again joins the download in flight.
          loading.current ??= loadEmbeddingModel((next) => onProgress.current(next)).finally(() => { loading.current = null; });
          await loading.current;
        }
        if (!current()) return;
        change({ sources: { semantic: true } });
      } catch (failure) {
        if (current()) setError(failure instanceof Error ? failure.message : 'The download failed');
      } finally {
        if (current()) {
          setDownloading(false);
          setProgress(null);
        }
      }
    })();
  }, [change, mounted]);

  const setOn = useCallback((on: boolean) => start(on, false), [start]);
  const turnOn = useCallback(() => start(true, true), [start]);
  const noThanks = useCallback(() => change({ semanticOffer: 'decided' }), [change]);
  const dismiss = useCallback(() => setFromCard(false), []);

  // A new open probes again, since another feature may have cached the model while the window was closed.
  useEffect(() => {
    if (!open) setProbed(false);
  }, [open]);

  const undecided = settings.semanticOffer === 'undecided';
  const sourceOn = settings.sources.semantic;
  // A model on the device turns the source on and answers the offer, with no card.
  useEffect(() => {
    if (!open || !undecided || sourceOn || downloading) return;
    let live = true;
    void (async () => {
      let onDevice = false;
      try {
        onDevice = await modelOnDevice();
      } catch {
        // An unreadable cache reads as no model.
      }
      if (!live || !mounted.current) return;
      if (!onDevice) setProbed(true);
      else change({ semanticOffer: 'decided', sources: { semantic: true } });
    })();
    return () => { live = false; };
  }, [open, undecided, sourceOn, downloading, change, mounted]);

  let card: OfferCard | null = null;
  if (fromCard && (downloading || error !== null)) card = 'download';
  else if (undecided && probed && !sourceOn && !downloading) card = 'offer';

  return { on: sourceOn || downloading, downloading, progress, error, setOn, card, turnOn, noThanks, dismiss };
}
