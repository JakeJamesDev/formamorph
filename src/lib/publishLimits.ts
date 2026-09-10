import { KIND_LABELS, type CatalogKind } from '@/lib/catalogKinds';

/**
 * The one place the client states a publish limit. Mirrors the server's per-kind content caps, so the
 * client never refuses what the server would accept and never accepts what the server would refuse.
 */
export const PUBLISH_LIMITS: Record<CatalogKind, number> = {
  world: 100 * 1024 * 1024,
  entity: 25 * 1024 * 1024,
  dictionary: 5 * 1024 * 1024,
  model: 64 * 1024 * 1024,
};

/** The server's own measure: the UTF-8 byte length of the content's compact JSON serialization. */
export function measurePublishBytes(content: unknown): number {
  return new TextEncoder().encode(JSON.stringify(content)).length;
}

export type PublishSizeBand = 'green' | 'amber' | 'red';

/** Where bytes sit against a kind's limit: the band to color it, and the ratio to fill it, clamped so an
 *  over-limit item never overflows the bar. */
export function publishSizeBand(bytes: number, limit: number): { band: PublishSizeBand; ratio: number } {
  const ratio = limit > 0 ? bytes / limit : 0;
  const band: PublishSizeBand = ratio >= 0.9 ? 'red' : ratio >= 0.6 ? 'amber' : 'green';
  return { band, ratio: Math.min(ratio, 1) };
}

/** "12.4 MB", "100 MB" — 1024-based, one decimal, a whole number bare, so it agrees with the server's own "100MB" wording. */
export function formatPublishBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** The refusal message: kind label, its size, and its limit — "World is 105.3 MB, over the 100 MB publish limit." */
export function publishLimitRefusal(kind: CatalogKind, bytes: number): string {
  return `${KIND_LABELS[kind].one} is ${formatPublishBytes(bytes)}, over the ${formatPublishBytes(PUBLISH_LIMITS[kind])} publish limit.`;
}
