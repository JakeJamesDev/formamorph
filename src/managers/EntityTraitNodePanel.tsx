import { ExternalLink, User } from 'lucide-react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import type { Entity } from '@/types';
import { ListDetailFirstRow } from '@/components/ui/list-detail';

/** The Traits tab's panel for an entity node: the entity's name and a way to its editor. Its traits sit in
 *  the tree beside it, so the panel doesn't repeat them. */
export const EntityTraitNodePanel = ({ entity, onOpenEntity }: { entity: Entity; onOpenEntity: () => void }) => {
  const { placeholders } = useGameData();
  return (
    <div className="space-y-4">
      <ListDetailFirstRow align="center">
        <div className="flex items-center gap-2 text-label font-medium">
          <User className="h-4 w-4 shrink-0" aria-hidden />
          <PlaceholderText text={entity.name} placeholders={placeholders} />
        </div>
      </ListDetailFirstRow>
      <Button variant="outline" size="sm" onClick={onOpenEntity}>
        <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
        Open Entity
      </Button>
    </div>
  );
};
