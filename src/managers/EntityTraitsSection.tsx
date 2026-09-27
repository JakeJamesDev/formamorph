import { ExternalLink, Folder, Plus, User } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Hint } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { randomUUID } from '@/lib/uuid';
import { buildTraitTree, flattenTraitTree } from '@/lib/traitTree';
import { addOwnedGroup, addOwnedTrait } from '@/lib/ownedTraits';
import type { Entity } from '@/types';

/**
 * An entity's own traits and groups as a list, with adds. A row, and a new item, open in the Traits tab
 * through `onOpen`. Groups are Advanced only, as they are on the Traits tab.
 */
const EntityTraitsSection = ({ entity, onOpen }: { entity: Entity; onOpen: (id: string) => void }) => {
  const { editEntity, placeholders } = useGameData();
  const { advanced } = useEditorMode();
  const rows = flattenTraitTree(buildTraitTree(entity.traitGroups ?? [], entity.traits ?? []));

  const add = (addItem: typeof addOwnedTrait) => {
    const id = randomUUID();
    editEntity(entity.id, (e) => addItem(e, id));
    onOpen(id);
  };

  return (
    <div className="space-y-2">
      <Label>Traits</Label>
      {rows.length === 0 ? (
        <Hint>Add a trait to give this entity a node on the <strong>Traits</strong> tab</Hint>
      ) : (
        <ul className="space-y-1" aria-label="Owned Traits">
          {rows.map((row) => (
            <li key={row.id} style={{ paddingLeft: row.depth * TREE_INDENT }}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-label hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => onOpen(row.id)}
              >
                {row.group && <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className={row.group ? 'min-w-0 truncate font-medium' : 'min-w-0 truncate'}>
                  <PlaceholderText text={row.group?.name ?? row.leaf?.name ?? ''} placeholders={placeholders} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => add(addOwnedTrait)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />Add Trait
        </Button>
        {advanced && (
          <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => add(addOwnedGroup)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />Add Group
          </Button>
        )}
      </div>
    </div>
  );
};

/** The Traits tab's panel for an entity node: the entity's name, a way to its editor, and its traits. */
export const EntityTraitNodePanel = ({ entity, onOpen, onOpenEntity }: {
  entity: Entity;
  onOpen: (id: string) => void;
  onOpenEntity: () => void;
}) => {
  const { placeholders } = useGameData();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-label font-medium">
        <User className="h-4 w-4 shrink-0" aria-hidden />
        <PlaceholderText text={entity.name} placeholders={placeholders} />
      </div>
      <Button variant="outline" size="sm" onClick={onOpenEntity}>
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
        Open Entity
      </Button>
      <EntityTraitsSection entity={entity} onOpen={onOpen} />
    </div>
  );
};

export default EntityTraitsSection;
