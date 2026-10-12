import { useState } from 'react';
import { ChipOptionsDialog } from './ChipOptionsDialog';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';

const VOCABULARY = promptVocabulary([]);

/** The dev-router's Chip Options (`#dev?modal=chipOptions`): the production dialog on a canned Entities chip,
 *  reading the Settings sample scene as Settings does outside a world. */
export function DevChipOptions({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [token, setToken] = useState('<ENTITIES|markdown|header="Entities">');
  return (
    <ChipOptionsDialog open={open} onOpenChange={onOpenChange} token={token} vocab={VOCABULARY} editable
      reads={SAMPLE_PREVIEW_VALUES} update={(change) => setToken(change)} />
  );
}
