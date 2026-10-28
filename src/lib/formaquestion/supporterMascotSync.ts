/**
 * Keeps the Supporter mascots of the help settings in step with the Supporter content installed for the
 * signed-in account. A ready snapshot decides: an installed Mascot item gets its preset, rebuilt on a new
 * revision; a preset whose item is gone is dropped, and the Default takes over. A preset held for another
 * account drops at once, whatever the snapshot, so it never shows while that account is away.
 */
import type { SupporterContent } from '@/lib/supporterContent/supporterContent';
import { reconcileSupporterMascots, type MascotPreset, type MascotPresetStore } from './mascotPresets';
import { supporterMascotFromContent } from './supporterMascot';

export interface SupporterMascotSyncDeps {
  readonly content: Pick<SupporterContent, 'subscribe' | 'getSnapshot' | 'readItem'>;
  /** The signed-in account, or null when signed out. */
  readonly accountId: () => string | null;
  readonly readStore: () => MascotPresetStore;
  readonly writeStore: (store: MascotPresetStore) => void;
}

export function createSupporterMascotSync(deps: SupporterMascotSyncDeps) {
  const heldPresets = (): MascotPreset[] => deps.readStore().mascots.filter((mascot) => mascot.supporter);

  /** The presets of the installed items. A rebuild that fails keeps the preset held for the item. */
  const installedPresets = async (account: string | null): Promise<MascotPreset[]> => {
    const byListing = new Map(heldPresets().flatMap((mascot) => (mascot.supporter ? [[mascot.supporter.listingId, mascot] as const] : [])));
    const presets: MascotPreset[] = [];
    for (const item of deps.content.getSnapshot().installed) {
      if (item.kind !== 'mascot') continue;
      const held = byListing.get(item.id);
      // Signed out, the module still serves the last account's items inside its window; their presets stay.
      const kept = held && (account === null || held.supporter?.accountId === account) ? held : undefined;
      const current = kept?.supporter?.revision === item.revision;
      const rebuilt = current || account === null ? null : await rebuild(item.id, item.revision, account);
      const preset = rebuilt ?? kept;
      if (preset) presets.push(preset);
    }
    return presets;
  };

  const rebuild = async (listingId: string, revision: number, accountId: string): Promise<MascotPreset | null> => {
    try {
      const content = await deps.content.readItem(listingId);
      return content === null ? null : supporterMascotFromContent({ listingId, revision, accountId }, content);
    } catch (error: unknown) {
      console.error('Could not read a Supporter Mascot:', error);
      return null;
    }
  };

  const once = async () => {
    const account = deps.accountId();
    const presets = deps.content.getSnapshot().status === 'ready'
      ? await installedPresets(account)
      : heldPresets().filter((mascot) => account === null || mascot.supporter?.accountId === account);
    const store = deps.readStore();
    const next = reconcileSupporterMascots(store, presets);
    if (next !== store) deps.writeStore(next);
  };

  let running: Promise<void> | null = null;
  let again = false;

  /** Brings the store in step with the module now. A call during a run joins it and runs it once more. Never rejects. */
  const sync = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          await once();
        } catch (error: unknown) {
          console.error('Could not sync the Supporter Mascots:', error);
        }
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

export type SupporterMascotSync = ReturnType<typeof createSupporterMascotSync>;
