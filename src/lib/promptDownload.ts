import { toast } from 'react-toastify';
import { APP_VERSION } from '@/lib/version';
import { parseSharedContent, type ImportedPreset } from '@/lib/promptPresetShare';
import type { LibraryRecord, LibraryTarget } from '@/lib/useLibraryDownload';
import type { PresetDownloadLink } from '@/lib/promptPresets';

/** The preset store as the settings context offers it: every user preset, and a way to store a download. */
export interface PresetStoreAccess {
  presets: LibraryRecord[];
  store: (id: string, imported: ImportedPreset, link: PresetDownloadLink, name: string) => void;
}

/** A prompt listing's content: the shared preset artifact, read through the share sanitizer on arrival. */
export type PromptListingContent = { id?: string } & Record<string, unknown>;

/**
 * The preset store as the community browser reaches it. Built by the app host, so the browser, which the
 * website also mounts, never imports the preset modules.
 */
export interface PromptLibrary {
  target: LibraryTarget<PromptListingContent>;
  /** The globally selected preset. */
  activeId: string;
  select: (id: string) => void;
}

/** How a prompt listing reaches the preset store, as the library download flow drives it. */
export function promptLibraryTarget(
  library: PresetStoreAccess,
  appVersion: string = APP_VERSION,
): LibraryTarget<PromptListingContent> {
  return {
    kind: 'prompt',
    records: library.presets,
    store: async (id, content, link, listingName) => {
      const parsed = parseSharedContent(content, appVersion);
      if (!parsed.ok || !parsed.preset) throw new Error(parsed.error ?? 'This listing is not a prompt preset.');
      library.store(id, parsed.preset, link, listingName);
      for (const warning of parsed.warnings) toast.warning(warning);
    },
    // The store is React state, so the browser re-renders on its own.
    refresh: () => {},
  };
}
