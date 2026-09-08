import type { DictionarySelectionItem } from './dictionarySelection';

/** Choices retained for one visit to Enter World. */
export interface EntryDraft {
  traitIds: string[];
  locationId: string | null;
  entityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  traitSection: number;
}

export const emptyEntryDraft = (): EntryDraft => ({
  traitIds: [], locationId: null, entityIds: new Set(), dictionaryItems: [], traitSection: 0,
});
