/** The model behind `default`, as the last reachability probe read it. Capability records key on it. */
import { useSyncExternalStore } from 'react';

/** The configured name that lets the server pick its loaded model. */
export const SERVER_PICKS_MODEL = 'default';

/** The model a capability answer describes. */
export interface ServedModel {
  readonly id: string;
  /** False where the id is only the fallback name, which any loaded model may answer to. */
  readonly named: boolean;
  /** True where the server itself named the model behind `default`. */
  readonly fromServer: boolean;
}

// `url|configured` → the real name, or null where the server named none.
const served = new Map<string, string | null>();
const listeners = new Set<() => void>();
let version = 0;

const key = (url: string, model: string) => `${url}|${model}`;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/** Records what one reachability probe read. A null `real` falls back to the configured name. */
export function recordServedModel(url: string, model: string, real: string | null): void {
  if (model !== SERVER_PICKS_MODEL) return;
  const k = key(url, model);
  if (served.has(k) && served.get(k) === real) return;
  served.set(k, real);
  notify();
}

/** Whether a probe has read the served model for this pair, or none is needed. The bundled engine reports over IPC. */
export function servedModelKnown(url: string, model: string, localEngine = false): boolean {
  return localEngine || model !== SERVER_PICKS_MODEL || served.has(key(url, model));
}

/** The model this endpoint serves for the configured name: an explicit name is its own id. */
export function servedModel(url: string, model: string, localEngine = false): ServedModel {
  if (localEngine) return { id: model, named: false, fromServer: false };
  if (model !== SERVER_PICKS_MODEL) return { id: model, named: true, fromServer: false };
  const real = served.get(key(url, model));
  return real ? { id: real, named: true, fromServer: true } : { id: model, named: false, fromServer: false };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** A number that changes whenever a probe reads a different served model, to re-render on. */
export function useServedModelVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

/** Test-only: forget every served model. */
export function resetServedModels(): void {
  served.clear();
  notify();
}
