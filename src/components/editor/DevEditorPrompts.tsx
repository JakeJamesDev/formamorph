import { useState } from 'react';
import { CodeRenameDialog } from '@/components/editor/CodeRenameOffer';
import { ReplaceAllConfirm } from '@/components/editor/EditorFindBar';
import { ReplaceImageDialog } from '@/managers/ImageTagsField';
import type { CodeRenamePlan } from '@/lib/statCodeRename';

const swatch = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${color}"/></svg>`)}`;
const IMAGES = [swatch('#7c9a6b'), swatch('#9a6b7c')];

const PLAN: CodeRenamePlan = {
  root: 'stats',
  oldName: 'Hunger',
  newName: 'Appetite',
  edits: [{ id: 'dev-stamina', name: 'Stamina', boxes: {} }, { id: 'dev-mood', name: 'Mood', boxes: {} }],
  references: 3,
};

/** DEV: the questions an edit asks partway through, raised on canned text. Every answer closes it and writes nothing. */
export function DevEditorPrompts({ modal }: { modal: string | undefined }) {
  const [done, setDone] = useState(false);
  const [slot, setSlot] = useState(0);
  const close = () => setDone(true);
  if (done) return null;
  if (modal === 'imageReplace') {
    return <ReplaceImageDialog open images={IMAGES} slot={slot} onSlotChange={setSlot} idPrefix="dev-image" onClose={close} />;
  }
  if (modal === 'codeRename') return <CodeRenameDialog open plan={PLAN} onApply={close} onSettle={close} />;
  if (modal === 'replaceAll') {
    return (
      <ReplaceAllConfirm
        open onOpenChange={(open) => { if (!open) close(); }}
        count={23} fields={9} skipped={0} missingChip="a chip" onConfirm={close}
      />
    );
  }
  return null;
}
