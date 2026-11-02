import { Hint } from '@/components/ui/typography';

/** Shared empty-state hint for the World Editor's list/tree tabs (stats, entities, locations, traits,
 *  dictionaries). Reads "No NOUN yet. Use the + button to ACTION." One place so every tab reads the same. */
export function EmptyListHint({ noun, action = 'add one' }: { noun: string; action?: string }) {
  return <Hint className="p-2">No {noun} yet. Use the + button to {action}.</Hint>;
}
