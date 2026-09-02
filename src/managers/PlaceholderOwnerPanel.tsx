import { BookOpen, ExternalLink, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import type { PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import type { Placeholder } from '@/types';

/**
 * What the Placeholders tab shows for a selected owner node. The node is read off an entity or book, so
 * there is nothing to edit here: the panel names the owner and opens it where it is edited, which is also
 * where its Placeholders section lives.
 */
const PlaceholderOwnerPanel = ({ owner, placeholders, onOpen }: {
  owner: PlaceholderOwnerRef;
  placeholders: Placeholder[];
  onOpen: () => void;
}) => {
  const noun = owner.kind === 'entity' ? 'entity' : 'dictionary';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-label font-medium">
        {owner.kind === 'entity' ? <User className="h-4 w-4 shrink-0" /> : <BookOpen className="h-4 w-4 shrink-0" />}
        <PlaceholderText text={owner.name} placeholders={placeholders} />
      </div>
      <p className="text-helper text-muted-foreground">
        These placeholders belong to this {noun}. Elsewhere in the world they read as{' '}
        <PlaceholderText text={owner.name} placeholders={placeholders} />{OWNER_NAME_SEPARATOR}Name. Drag one to the top of the
        list to share it with the whole world, or drag a shared one here to make it this {noun}&apos;s own.
      </p>
      <Button variant="outline" size="sm" onClick={onOpen}>
        <ExternalLink className="mr-2 h-4 w-4" />
        Open {noun === 'entity' ? 'Entity' : 'Dictionary'}
      </Button>
    </div>
  );
};

export default PlaceholderOwnerPanel;
