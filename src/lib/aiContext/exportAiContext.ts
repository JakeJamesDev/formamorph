import { downloadBlob } from '@/lib/downloadBlob';

/** The file name of an AI Context export, from the name of what it holds: `ai-context-<slug>.json`. */
export const aiContextFileName = (name: string): string => `ai-context-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;

/** Downloads what an AI Context viewer shows as JSON, so a bug report can carry it. */
export function exportAiContext(data: unknown, name: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), aiContextFileName(name));
}
