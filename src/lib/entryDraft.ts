import type { DictionarySelectionItem } from './dictionarySelection';
import type { PersonaRef } from '@/types';

/** Choices retained for one visit to Enter World. */
export interface EntryDraft {
  traitIds: string[];
  locationId: string | null;
  entityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  persona: PersonaRef;
  traitSection: number;
}

export const emptyEntryDraft = (): EntryDraft => ({
  traitIds: [], locationId: null, entityIds: new Set(), dictionaryItems: [], persona: { source: 'none' }, traitSection: 0,
});
