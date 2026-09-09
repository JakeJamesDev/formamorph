import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { PlaceholderStoreProvider, usePlaceholderStoreOptional, type PlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { useEditorMode } from '@/lib/editorMode';
import { cn } from '@/lib/utils';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import type { PlaceholderHome } from '@/lib/placeholderHomes';
import PlaceholderEditor from './PlaceholderEditor';

/** The world store narrowed to one owner's list: the same reads and writes, a list that draws only that
 *  owner's rows, and a create that lands there. */
const scopedStore = (store: PlaceholderStore, scope: PlaceholderHome): PlaceholderStore =>
  ({ ...store, scope, addPlaceholder: (p) => store.addPlaceholder(p, scope) });

/**
 * The Placeholders section of an entity or dictionary panel: the same editor the Placeholders tab and the
 * library modals mount, bound to this one owner's list. A placeholder made here belongs to the owner and
 * reads `Owner › Name` everywhere else in the world. Advanced mode only, like the tab itself, and only
 * where a world store is bound — a library modal has its own Placeholders tab instead.
 */
const ScopedPlaceholdersSection = ({ kind, ownerId, fill = false }: {
  kind: 'entity' | 'dictionary';
  ownerId: string;
  /** The host is a tab that already names this section: the label goes, and the editor takes the panel's
   *  remaining height instead of sitting in a fixed box. */
  fill?: boolean;
}) => {
  const { advanced } = useEditorMode();
  const store = usePlaceholderStoreOptional();
  const home = useMemo((): PlaceholderHome => ({ kind, ownerId }), [kind, ownerId]);
  const scoped = useMemo(() => (store?.lists ? scopedStore(store, home) : null), [store, home]);
  if (!advanced || !scoped) return null;
  return (
    <div className="space-y-2">
      {!fill && <Label>Placeholders</Label>}
      <p className="text-helper text-muted-foreground">
        Placeholders of this {kind}&apos;s own. Elsewhere in the world they read as {'{'}Name{OWNER_NAME_SEPARATOR}Placeholder{'}'}.
      </p>
      <div className={cn(
        'flex flex-col overflow-hidden rounded-md border',
        fill ? 'h-[calc(100vh-20rem)] min-h-[20rem]' : 'h-[26rem]',
      )}>
        <PlaceholderStoreProvider value={scoped}>
          <PlaceholderEditor />
        </PlaceholderStoreProvider>
      </div>
    </div>
  );
};

export default ScopedPlaceholdersSection;
