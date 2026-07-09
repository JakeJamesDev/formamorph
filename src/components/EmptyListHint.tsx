/** Shared empty-state hint for the World Editor's list/tree tabs (stats, entities, locations, traits,
 *  dictionaries): "No {noun} yet — use the + button to {action}." One place so every tab reads the same. */
export function EmptyListHint({ noun, action = 'add one' }: { noun: string; action?: string }) {
  return <p className="text-sm text-muted-foreground p-2">No {noun} yet — use the + button to {action}.</p>;
}
