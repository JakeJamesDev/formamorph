/**
 * Keeps stored Supporter Copies in step with the Supporter content module's check. A good check keeps the
 * copies of the signed-in account whose listing is current or expired, and removes the rest, including copies
 * marked for another account. A check past the offline window removes every copy. Saves are never touched.
 */
import type { SupporterContent } from '@/lib/supporterContent/supporterContent';
import type { LibrarySupporterCopyMarker, SupporterCopyMarker } from '@/types';

/** One store that can hold copies: the worlds, or one library. */
export interface SupporterCopyHolder {
  /** Every stored record with a marker, hidden ones included. */
  list: () => Promise<readonly { id: string; supporterCopy?: SupporterCopyMarker | LibrarySupporterCopyMarker }[]>;
  remove: (id: string) => Promise<void>;
}

export interface SupporterCopySyncDeps {
  readonly content: Pick<SupporterContent, 'subscribe' | 'getSnapshot'>;
  readonly holders: readonly SupporterCopyHolder[];
}

export function createSupporterCopySync(deps: SupporterCopySyncDeps) {
  const once = async () => {
    const rule = deps.content.getSnapshot().copyRule;
    if (!rule) return;
    const stays = (marker: SupporterCopyMarker): boolean =>
      'keep' in rule && marker.accountId === rule.accountId && rule.keep.includes(marker.listingId);
    for (const holder of deps.holders) {
      try {
        for (const record of await holder.list()) {
          const marker = record.supporterCopy;
          if (!marker || stays(marker)) continue;
          // One failed removal leaves that copy for the next sync and never blocks the others.
          await holder.remove(record.id).catch((error: unknown) => console.error('Could not remove a Supporter Copy:', error));
        }
      } catch (error: unknown) {
        console.error('Could not list the Supporter Copies:', error);
      }
    }
  };

  let running: Promise<void> | null = null;
  let again = false;

  /** Brings the stores in step with the module now. A call during a run joins it and runs it once more. Never rejects. */
  const sync = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await once();
      } while (again);
    })().finally(() => { running = null; });
    return running;
  };

  return {
    sync,
    /**
     * Syncs now and on every change of the module.
     *
     * @returns The unsubscribe
     */
    start: (): (() => void) => {
      void sync();
      return deps.content.subscribe(() => void sync());
    },
  };
}
