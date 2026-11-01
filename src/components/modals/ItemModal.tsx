import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Meta } from '@/components/ui/typography';
import { EntityCardBody, EntityDescription } from '../game/EntityCard';

/** An Item Copy's popup: its image beside its description. `name`, `image`, `description` and `facts` are what
 *  the player may see of the copy, so an unidentified copy stays on its unidentified face. */
export function ItemModal({ id, name, image, description, facts, isOpen, onOpenChange }: {
  id: string;
  name: string;
  image?: string;
  description: string;
  /** Short lines under the description: State, count, uses left. */
  facts: readonly string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        surface="item"
        aria-describedby={undefined}
        // With no picture, a short window holds the text.
        className={image ? 'sm:max-w-[800px] lg:max-w-[1040px] h-[90dvh] flex flex-col' : 'sm:max-w-[520px] h-[40dvh] flex flex-col'}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <EntityCardBody entity={{ id, name, images: image ? [{ data: image }] : undefined }} sideBySide>
          <EntityDescription text={description} />
          {facts.length > 0 && (
            <ul>{facts.map((fact) => <li key={fact}><Meta>{fact}</Meta></li>)}</ul>
          )}
        </EntityCardBody>
      </DialogContent>
    </Dialog>
  );
}
