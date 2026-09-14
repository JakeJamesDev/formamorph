/**
 * One run of a world's missing-source check.
 *
 * Runs only when the author asks for one, and takes its two requests as ports, so the order it asks them
 * in — and what it refuses to conclude when one fails — is settled here rather than inside a React hook.
 */
import type { DependencyRow } from '@/lib/worldDependencies';
import type { SourceCheckRecord } from '@/lib/sourceCheckStore';
import type { SourceCheckStatus, SourceCopy } from '@/lib/sourceChecks';

/** The two requests a check makes. */
export interface SourceCheckPorts {
  /** What a world listing requires today, each source resolved or reported gone. */
  dependencies(worldSourceId: string): Promise<DependencyRow[]>;
  /** Ask about one listing directly. */
  source(listingId: string): Promise<SourceCheckStatus>;
}

/** Every source `copies` follow, each named once, in the order the copies name them. */
const sourceIds = (copies: readonly SourceCopy[]): string[] => [...new Set(copies.map((c) => c.sourceId))];

/** A record saying only that this run reached nothing. */
const allUnavailable = (ids: string[], required: string[], checkedAt: string): SourceCheckRecord => ({
  checkedAt,
  results: Object.fromEntries(ids.map((id) => [id, 'unavailable' as const])),
  required,
});

/**
 * Check every source this world's copies follow.
 *
 * A world published as a listing is asked about its own listing first. That listing is what declares which
 * sources are required, and a required source may be unlisted — invisible to everyone but its author
 * through a direct request. So when the world's listing cannot be read, the run concludes nothing at all:
 * every source reads unreachable, which reports the failure without ever claiming something was deleted.
 *
 * With the listing readable, its required set carries the server's own answer per source, and everything
 * else the copies follow is public and is asked about directly.
 *
 * @param copies - The world's linked copies
 * @param worldSourceId - The world's own listing, where it has one
 * @param ports - The two requests to make
 * @param heldRequired - The required set the last check recorded, used when this one cannot read it
 * @returns What to record for this world
 */
export async function runSourceCheck(
  copies: readonly SourceCopy[],
  worldSourceId: string | null | undefined,
  ports: SourceCheckPorts,
  heldRequired: readonly string[] = [],
): Promise<SourceCheckRecord> {
  const checkedAt = new Date().toISOString();
  const ids = sourceIds(copies);
  if (ids.length === 0) return { checkedAt, results: {}, required: [] };

  const results: Record<string, SourceCheckStatus> = {};
  let required: string[] = [];

  if (worldSourceId) {
    const listing = await ports.source(worldSourceId);
    if (listing !== 'ok') return allUnavailable(ids, [...heldRequired], checkedAt);
    try {
      const rows = await ports.dependencies(worldSourceId);
      required = rows.map((row) => row.id).filter(Boolean);
      for (const row of rows) {
        if (ids.includes(row.id)) results[row.id] = row.status;
      }
    } catch {
      return allUnavailable(ids, [...heldRequired], checkedAt);
    }
  }

  const remaining = ids.filter((id) => !(id in results));
  const answers = await Promise.all(remaining.map((id) => ports.source(id)));
  remaining.forEach((id, index) => { results[id] = answers[index]; });

  return { checkedAt, results, required };
}
