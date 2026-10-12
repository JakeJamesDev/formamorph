import { useState } from 'react';
import { ChipOptionsDialog } from './ChipOptionsDialog';
import { promptVocabulary } from '@/lib/chipVocabulary';

const VOCABULARY = promptVocabulary([]);

/** The dev-router's Chip Options (`#dev?modal=chipOptions`): the production dialog on a canned Entities chip. */
export function DevChipOptions({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [token, setToken] = useState('<ENTITIES|markdown|header="Entities">');
  return (
    <ChipOptionsDialog open={open} onOpenChange={onOpenChange} token={token} vocab={VOCABULARY} editable
      update={(change) => setToken(change)} />
  );
}
