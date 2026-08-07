import { useCallback, useEffect, useRef, useState } from 'react';
import { probeEndpoint, type EndpointProbe } from './useAiReachable';
import { endpointSignature } from './promptEndpoints';

/**
 * Reachability of ONE named endpoint, independent of whichever endpoint the app is currently pointed at.
 * `useAiReachable` answers "can the app serve a turn"; this answers "is that other endpoint up", which is
 * what a prompt routed away from the active preset needs.
 */
export interface EndpointReachable {
  /** Probe outcome, or null while it is still being determined (or when disabled). */
  status: EndpointProbe | null;
  checking: boolean;
  /** Discard the cached answer and probe again. */
  recheck: () => void;
}

/** Session cache of settled probe outcomes, keyed `endpoint|model`. Two prompts routed to the same preset
 *  share one answer, so paging through the prompt list doesn't re-probe the same server. */
const settled = new Map<string, EndpointProbe>();
/** In-flight probes by signature, so concurrently-mounted badges for one target issue a single request. */
const inflight = new Map<string, Promise<EndpointProbe>>();

/** Probe `sig`, reusing a settled answer or joining an in-flight one. `force` discards both first. */
function probeShared(sig: string, url: string, apiToken: string, model: string, force: boolean): Promise<EndpointProbe> {
  if (force) {
    settled.delete(sig);
    inflight.delete(sig);
  } else {
    const cached = settled.get(sig);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(sig);
    if (pending) return pending;
  }
  const run = probeEndpoint(url, apiToken, model)
    .then((result) => {
      settled.set(sig, result);
      return result;
    })
    .finally(() => { inflight.delete(sig); });
  inflight.set(sig, run);
  return run;
}

/** Test-only: forget every cached and in-flight probe. */
export function resetEndpointReachableCache(): void {
  settled.clear();
  inflight.clear();
}

/**
 * Probe `url`/`model` once per session and report whether it answered. Pass `enabled: false` for a target
 * that needs no badge (an unpinned prompt, which follows the active endpoint) — nothing is requested then.
 */
export function useEndpointReachable(
  url: string,
  apiToken: string,
  model: string,
  enabled = true,
): EndpointReachable {
  const sig = endpointSignature(url, model);
  const active = enabled && !!url;
  const [status, setStatus] = useState<EndpointProbe | null>(() => (active ? settled.get(sig) ?? null : null));
  const [checking, setChecking] = useState(false);
  // Identifies the target the latest probe was for, so a slow answer for a since-abandoned target
  // (switching prompt tabs mid-probe) can't land on the current one.
  const currentSig = useRef(sig);
  currentSig.current = active ? sig : '';

  useEffect(() => {
    if (!active) {
      setStatus(null);
      setChecking(false);
      return;
    }
    const cached = settled.get(sig);
    if (cached) {
      setStatus(cached);
      setChecking(false);
      return;
    }
    setStatus(null);
    setChecking(true);
    probeShared(sig, url, apiToken, model, false).then((result) => {
      if (currentSig.current !== sig) return;
      setStatus(result);
      setChecking(false);
    });
  }, [sig, url, apiToken, model, active]);

  // Imperative rather than a nonce in the effect's deps: a nonce would stay raised, so any later re-run
  // (switching prompt tabs and back) would force a needless re-probe.
  const recheck = useCallback(() => {
    if (!active) return;
    setChecking(true);
    probeShared(sig, url, apiToken, model, true).then((result) => {
      if (currentSig.current !== sig) return;
      setStatus(result);
      setChecking(false);
    });
  }, [sig, url, apiToken, model, active]);

  return { status, checking, recheck };
}
