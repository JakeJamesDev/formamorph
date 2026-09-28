import { useState, type ReactNode } from 'react';
import { ChevronRight, FilePlus, FolderPlus, LayoutTemplate } from 'lucide-react';
import { ListMenuRow } from '@/components/ListToolbar';
import { useListAdd } from '@/components/listToolbarHooks';
import { MENU_ROW } from '@/components/menuRow';
import { DrillSlide, type SlideFrom } from '@/components/DrillSlide';
import { BearerList } from '@/managers/BearerPicker';
import { bearerChoices } from '@/lib/bearerChoices';
import type { Entity, EntityGroup } from '@/types';

/** What the + menu's drill-in adds to an entity. */
export type OwnedKind = 'trait' | 'group';

const TO_ENTITY_LABEL: Record<OwnedKind, string> = { trait: 'Add Trait to Entity', group: 'Add Group to Entity' };

/**
 * The Traits tab's + menu: world adds, the drill-in to an entity, and the world's one-of system nodes.
 * Lives inside a `ListSearchToolbar` menu, so each add names its item from the search text. The drill-in's
 * level is menu state: closing the menu unmounts it and the next open starts at the top.
 */
export function TraitsAddMenu({
  advanced, entities, entityGroups, hasBlueprints,
  onAddGroup, onAddTrait, onAddToEntity, onAddBlueprints,
}: {
  advanced: boolean;
  entities: Entity[];
  entityGroups: EntityGroup[];
  hasBlueprints: boolean;
  onAddGroup: (typed: string) => void;
  onAddTrait: (typed: string) => void;
  onAddToEntity: (kind: OwnedKind, entityId: string, typed: string) => void;
  onAddBlueprints: () => void;
}) {
  const { add } = useListAdd();
  const [drilled, setDrilled] = useState<OwnedKind | null>(null);
  const [from, setFrom] = useState<SlideFrom>(null);
  const drill = (kind: OwnedKind | null) => { setDrilled(kind); setFrom(kind ? 'right' : 'left'); };
  // A drill-in row: its label heads the entity list it opens in place of the menu.
  const drillRow = (icon: ReactNode, kind: OwnedKind) => entities.length > 0 && (
    <button type="button" className={MENU_ROW} onClick={() => drill(kind)}>
      {icon} <span className="flex-1">{TO_ENTITY_LABEL[kind]}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
    </button>
  );
  return (
    <DrillSlide key={drilled ?? ''} from={from}>
      {drilled ? (
        <BearerList
          choices={bearerChoices(entityGroups, entities)}
          label="Entities"
          onPick={(id) => add((typed) => onAddToEntity(drilled, id, typed))}
          back={{ label: TO_ENTITY_LABEL[drilled], onBack: () => drill(null) }}
        />
      ) : (
        <>
          {advanced && <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={onAddGroup} />}
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Trait" onAdd={onAddTrait} />
          {advanced && drillRow(<FolderPlus className="h-4 w-4" />, 'group')}
          {advanced && drillRow(<FilePlus className="h-4 w-4" />, 'trait')}
          {advanced && !hasBlueprints
            && <ListMenuRow icon={<LayoutTemplate className="h-4 w-4" />} label="Add Blueprints Group" onAdd={onAddBlueprints} />}
        </>
      )}
    </DrillSlide>
  );
}
