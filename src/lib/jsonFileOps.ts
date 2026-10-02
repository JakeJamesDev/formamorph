/**
 * The JSON file worker's operations, kept pure so they run and test without a worker around them.
 */
import { measurePublishBytes } from './publishLimits';
import { indexBackup } from './backupIndex';
import { restoreBackup, type RestoreRequest } from './backupRestore';

export type JsonFileOp =
  | { op: 'serialize'; value: unknown; space?: number; mime?: string; splitDepth?: number }
  | { op: 'parse'; text: string }
  | { op: 'measure'; value: unknown }
  | { op: 'indexBackup'; file: Blob }
  | { op: 'restoreBackup'; request: RestoreRequest };

/** Values `JSON.stringify` drops from an object and writes as `null` in an array. */
const isDropped = (value: unknown) =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol';

const isContainer = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && typeof (value as { toJSON?: unknown }).toJSON !== 'function';

/**
 * Compact JSON for `value` as string parts whose join equals `JSON.stringify(value)`. Containers above
 * `depth` are opened and each child is stringified on its own, so the whole never becomes one string and
 * can pass V8's maximum string length.
 */
export function jsonParts(value: unknown, depth: number, out: string[] = []): string[] {
  if (depth <= 0 || !isContainer(value)) {
    out.push(JSON.stringify(value) ?? 'null');
    return out;
  }
  if (Array.isArray(value)) {
    out.push('[');
    for (let i = 0; i < value.length; i++) {
      if (i) out.push(',');
      jsonParts(isDropped(value[i]) ? null : value[i], depth - 1, out);
    }
    out.push(']');
    return out;
  }
  out.push('{');
  let first = true;
  for (const [key, item] of Object.entries(value)) {
    if (isDropped(item)) continue;
    out.push(`${first ? '' : ','}${JSON.stringify(key)}:`);
    first = false;
    jsonParts(item, depth - 1, out);
  }
  out.push('}');
  return out;
}

/** Run one request. Most ops are synchronous; the backup ops return a promise, and `restoreBackup`
 *  reports image progress through `onProgress`. */
export function runJsonFileOp(request: JsonFileOp, onProgress?: (progress: unknown) => void): unknown {
  switch (request.op) {
    case 'parse':
      return JSON.parse(request.text);
    case 'measure':
      return measurePublishBytes(request.value);
    case 'indexBackup':
      return indexBackup(request.file);
    case 'restoreBackup':
      return restoreBackup(request.request, onProgress);
    case 'serialize': {
      // A Blob is structured-cloneable, so the serialized bytes come back without ever becoming a JS string
      // on the main thread.
      const parts = request.splitDepth
        ? jsonParts(request.value, request.splitDepth)
        : [JSON.stringify(request.value, null, request.space)];
      return new Blob(parts, { type: request.mime || 'application/json' });
    }
  }
}
