/**
 * The JSON file worker's operations, kept pure so they run and test without a worker around them.
 */
import { measurePublishBytes } from './publishLimits';

export type JsonFileOp =
  | { op: 'serialize'; value: unknown; space?: number; mime?: string }
  | { op: 'parse'; text: string }
  | { op: 'measure'; value: unknown };

/** Run one request. */
export function runJsonFileOp(request: JsonFileOp): unknown {
  switch (request.op) {
    case 'parse':
      return JSON.parse(request.text);
    case 'measure':
      return measurePublishBytes(request.value);
    case 'serialize':
      // A Blob is structured-cloneable, so the serialized bytes come back without ever becoming a JS string
      // on the main thread.
      return new Blob([JSON.stringify(request.value, null, request.space)], {
        type: request.mime || 'application/json',
      });
  }
}
