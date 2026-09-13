import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';
import { LINK_EXPLANATIONS, type LibraryKind } from '@/lib/librarySources';

const COPY = {
  entity: { title: 'Import Entity', confirm: 'Add Entity' },
  dictionary: { title: 'Import Dictionary', confirm: 'Add Dictionary' },
} as const;

/**
 * Review a file about to become world content: what it is called, and whether it arrives through the
 * library or on its own.
 *
 * With the link kept, the file becomes a library item the author owns and the world holds a linked copy of
 * it. Without it, the world holds the only copy.
 */
const ImportContentModal = ({ kind, name, onCancel, onConfirm }: {
  /** Which library the file belongs to, or null while nothing is under review. */
  kind: LibraryKind | null;
  /** The content's own name, as the file gives it. */
  name: string;
  onCancel: () => void;
  onConfirm: (link: boolean) => void;
}) => {
  const [link, setLink] = useState(true);

  // Each file is reviewed on its own terms, so the choice starts checked again for the next one.
  useEffect(() => { if (kind) setLink(true); }, [kind]);

  if (!kind) return null;
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{COPY[kind].title}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={link} onCheckedChange={(v) => setLink(v === true)} className="shrink-0" />
            <span>Link through my library</span>
          </label>
          <Meta as="p">{link ? LINK_EXPLANATIONS.own : LINK_EXPLANATIONS.independent}</Meta>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onConfirm(link)}>{COPY[kind].confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportContentModal;
