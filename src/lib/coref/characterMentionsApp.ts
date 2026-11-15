/**
 * The app's one Character Mentions controller, wired to the browser and the coref worker, and the hooks that
 * read it.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { isEnglishLanguage } from '@/lib/languages';
import { disposeCoref, loadCorefModel, resolveCoreference } from './corefClient';
import { browserStoreDeps } from './corefModelStore';
import { createCharacterMentions, type CharacterMentions, type CharacterMentionsState } from './characterMentions';

/** The published manifest (Q43). Dev reads the local one `vite.config.js` serves. */
export const COREF_MANIFEST_URL: string = import.meta.env.VITE_COREF_MANIFEST_URL
  || (import.meta.env.DEV ? '/coref-dev/manifest.json' : 'https://assets.formamorph.ai/coref/manifest.json');

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

let instance: CharacterMentions | null = null;

export function characterMentions(): CharacterMentions {
  instance ??= createCharacterMentions({
    manifestUrl: COREF_MANIFEST_URL,
    store: browserStoreDeps(),
    host: { load: loadCorefModel, resolve: resolveCoreference, dispose: disposeCoref },
    hasWebGpu,
    now: () => performance.now(),
    storage: localStorage,
  });
  return instance;
}

/** The controller's live state. */
export function useCharacterMentionsState(): CharacterMentionsState {
  const controller = characterMentions();
  return useSyncExternalStore(controller.subscribe, controller.getState);
}

/** Keeps the device in line with the Character Mentions settings and AI Language. Mounted once, at the app root. */
export function useCharacterMentionsSync(): void {
  const { characterMentions: enabled, characterMentionsModel: choice, language } = useSettings();
  const blocked = !isEnglishLanguage(language);
  useEffect(() => {
    characterMentions().sync({ enabled, choice, blocked });
  }, [enabled, choice, blocked]);
}
