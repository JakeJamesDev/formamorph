import type { DictionarySelectionItem } from './dictionarySelection';
import { locationForPersonaPick, withoutPersona, type PersonaPickContext } from './personaPick';
import type { PersonaRef } from '@/types';

/** Choices retained for one visit to Enter World. */
export interface EntryDraft {
  traitIds: string[];
  locationId: string | null;
  /** The player picked the location in this step, so no persona pick moves it. */
  locationChosen: boolean;
  entityIds: Set<string>;
  dictionaryItems: DictionarySelectionItem[];
  persona: PersonaRef;
  traitSection: number;
}

export const emptyEntryDraft = (): EntryDraft => ({
  traitIds: [], locationId: null, locationChosen: false, entityIds: new Set(), dictionaryItems: [],
  persona: { source: 'none' }, traitSection: 0,
});

/** The draft after a persona pick: one entity fills one role, and a world persona preselects its location. */
export function withPersonaPick(draft: EntryDraft, ref: PersonaRef, context: PersonaPickContext): EntryDraft {
  return {
    ...draft,
    persona: ref,
    entityIds: withoutPersona(draft.entityIds, ref),
    locationId: locationForPersonaPick({ ref, current: draft.locationId, locationChosen: draft.locationChosen, ...context }),
  };
}

export const withLocationPick = (draft: EntryDraft, locationId: string | null): EntryDraft =>
  ({ ...draft, locationId, locationChosen: true });
