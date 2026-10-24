import { useState } from 'react';
import { CodeRenameDialog } from '@/components/editor/CodeRenameOffer';
import { ReplaceAllConfirm } from '@/components/editor/EditorFindBar';
import { ChangedElsewhereDialog } from '@/components/editor/ChangedElsewhereDialog';
import { ReplaceImageDialog } from '@/managers/ImageTagsField';
import { DeleteVrmConfirm } from '@/managers/AvatarStore';
import type { CodeRenamePlan } from '@/lib/statCodeRename';
import type { Entity } from '@/types';

const swatch = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${color}"/></svg>`)}`;
const IMAGES = [swatch('#7c9a6b'), swatch('#9a6b7c')];

const AVATAR_USERS: Entity[] = [{ id: 'dev-wren', name: 'Wren' }, { id: 'dev-marsh', name: 'Marsh Warden' }];

const PLAN: CodeRenamePlan = {
  root: 'stats',
  oldName: 'Hunger',
  newName: 'Appetite',
  edits: [
    { home: { kind: 'stat', statId: 'dev-stamina' }, name: 'Stamina', scripts: {} },
    { home: { kind: 'stat', statId: 'dev-mood' }, name: 'Mood', scripts: {} },
  ],
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
  if (modal === 'savedElsewhere' || modal === 'deletedElsewhere') {
    return <ChangedElsewhereDialog change={modal === 'savedElsewhere' ? 'saved' : 'deleted'} onLeave={close} onKeepMine={close} />;
  }
  if (modal === 'deleteWorldAvatar') {
    return <DeleteVrmConfirm open name="Fen Walker" users={AVATAR_USERS} onConfirm={close} onOpenChange={(open) => { if (!open) close(); }} />;
  }
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
