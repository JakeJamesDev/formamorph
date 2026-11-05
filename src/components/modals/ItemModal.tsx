import { Dialog, DialogContent, DialogHeader, DialogTitle, dialogTitleControl } from '@/components/ui/dialog';
import { ItemRowArt } from '@/components/ItemIconArt';
import { Meta } from '@/components/ui/typography';
import type { ShownItemIcon } from '@/lib/itemIcons';
import { EntityCardBody, EntityDescription } from '../game/EntityCard';

/** An Item Copy's popup: its image beside its description. `name`, `icon`, `image`, `description` and `facts` are what
 *  the player may see of the copy, so an unidentified copy stays on its unidentified face. */
export function ItemModal({ id, name, icon, image, description, facts, isOpen, onOpenChange }: {
  id: string;
  name: string;
  /** The header draws only a catalog icon, since the body already draws the image. */
  icon: ShownItemIcon;
  image?: string;
  description: string;
  /** Short text beside the name: State, count, uses left. */
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
          <div className="flex flex-wrap items-center justify-center gap-x-2 pr-8 sm:justify-start">
            {icon.kind === 'icon' && <span className={dialogTitleControl}><ItemRowArt shown={icon} /></span>}
            <DialogTitle>{name}</DialogTitle>
            {facts.map((fact) => <Meta key={fact}>{fact}</Meta>)}
          </div>
        </DialogHeader>
        <EntityCardBody entity={{ id, name, images: image ? [{ data: image }] : undefined }} sideBySide>
          <EntityDescription text={description} />
        </EntityCardBody>
      </DialogContent>
    </Dialog>
  );
}
