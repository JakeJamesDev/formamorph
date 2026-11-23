import { useEffect, useState } from 'react';
import { CodeRenameDialog } from '@/components/editor/CodeRenameOffer';
import { ReplaceAllConfirm } from '@/components/editor/EditorFindBar';
import { ChangedElsewhereDialog } from '@/components/editor/ChangedElsewhereDialog';
import { ReplaceImageDialog } from '@/managers/ImageTagsField';
import { DeleteVrmConfirm } from '@/managers/AvatarStore';
import { DeleteMediaConfirm } from '@/managers/MediaPicker';
import { AppearancePreviewDialog } from '@/components/editor/AppearancePreviewDialog';
import { WeatherMaskEditor } from '@/managers/weatherMaskEditor/WeatherMaskEditor';
import type { RowAvatar } from '@/lib/useSliderPicker';
import ModelStorageService from '@/services/ModelStorageService';
import { useMountedRef } from '@/lib/useMountedRef';
import { DEFAULT_AVATAR_URL } from '@/lib/defaultAvatar';
import type { CodeRenamePlan } from '@/lib/statCodeRename';
import { statLookRows, type TraitLookRows } from '@/lib/appearancePreview';
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

// A Layer rename where another Layered Image shares the name: two sure references and three to pick.
const SPLICE = { from: 0, to: 0, insert: '' };
const LAYER_PLAN: CodeRenamePlan = {
  root: 'layers',
  oldName: 'Hat',
  newName: 'Helmet',
  edits: [
    { home: { kind: 'stat', statId: 'dev-stamina' }, name: 'Stamina', scripts: {} },
    { home: { kind: 'world' }, name: 'World', scripts: { b: '' } },
  ],
  references: 2,
  pickBoxes: [
    { home: { kind: 'entityTrait', entityId: 'dev-wren', traitId: 'dev-rain' }, name: 'Caught in Rain', entity: 'Wren', id: 'a', code: '', sure: [], unsure: [
      { id: '1', text: 'persona.layers.Hat', line: 4, splice: SPLICE },
    ] },
    { home: { kind: 'world' }, name: 'World', scriptNumber: 2, id: 'b', code: '', sure: [], unsure: [
      { id: '2', text: 'guard.layers.Hat', line: 12, splice: SPLICE },
      { id: '3', text: 'entities.Marsh.layers.Hat', line: 15, splice: SPLICE },
    ] },
  ],
};

// An Elf-style trait: pointed ears where the Avatar has them, and silver hair.
const PREVIEW_ROWS: TraitLookRows = { morphPins: [{ name: 'Ear Shape', value: 1 }], colorPins: [{ channel: 'hair', color: '#c8ccd8' }] };

// A Fatness-style stat from 0 to 100: a thicker body and warmer skin at Max.
const STAT_PREVIEW_ROWS: TraitLookRows = statLookRows({
  morphBindings: [{ name: 'Thickness' }], colorBindings: [{ channel: 'skin', color: '#e89a7a' }],
});

/** The library's first Avatar and the bundled one, or the bundled one twice. `stat` previews a stat in place of a trait. */
function DevAppearancePreview({ onClose, stat }: { onClose: () => void; stat: boolean }) {
  const [avatars, setAvatars] = useState<RowAvatar[]>();
  const mounted = useMountedRef();
  useEffect(() => {
    void ModelStorageService.getModelMetadata()
      .catch(() => [])
      .then((models) => {
        if (!mounted.current) return;
        const first: RowAvatar[] = models.slice(0, 1).map((m) => ({ kind: 'library', id: m.id, name: m.name }));
        // Two Avatars always, so the Avatar choice shows on an empty library too.
        const bundled: RowAvatar[] = [
          { kind: 'world', name: 'Default Avatar', data: DEFAULT_AVATAR_URL },
          { kind: 'world', name: 'Default Avatar Again', data: DEFAULT_AVATAR_URL },
        ];
        setAvatars([...first, ...bundled].slice(0, 2));
      });
  }, [mounted]);
  if (!avatars) return null;
  return stat
    ? <AppearancePreviewDialog name="Fatness" avatars={avatars} rows={STAT_PREVIEW_ROWS} stat={{ min: 0, max: 100 }} onSave={() => {}} onClose={onClose} />
    : <AppearancePreviewDialog name="Elf" avatars={avatars} rows={PREVIEW_ROWS} onSave={() => {}} onClose={onClose} />;
}

/** A room with a tall window, for the brush editor's route. */
const MASK_ROOM = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#6b5844"/><rect y="700" width="1600" height="200" fill="#4a3a2c"/><rect x="560" y="140" width="480" height="460" fill="#7d8fa3" stroke="#3b2f25" stroke-width="24"/><path d="M800 140v460M560 370h480" stroke="#3b2f25" stroke-width="14"/></svg>')}`;

/** The window of `MASK_ROOM` as a white-on-black PNG, the mask `tab=edit` opens on. */
function windowMask(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 450;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#000';
  context.fillRect(0, 0, 800, 450);
  context.fillStyle = '#fff';
  context.fillRect(286, 76, 228, 218);
  return canvas.toDataURL('image/png');
}

/** DEV: the questions an edit asks partway through, raised on canned text. Every answer closes it and writes nothing.
 *  `codeRename` with `fixture=layers` shows a Layer rename with references to pick. */
export function DevEditorPrompts({ modal, fixture, tab }: { modal: string | undefined; fixture?: string; tab?: string }) {
  const [done, setDone] = useState(false);
  const [slot, setSlot] = useState(0);
  const close = () => setDone(true);
  if (done) return null;
  if (modal === 'imageReplace') {
    return <ReplaceImageDialog open images={IMAGES} slot={slot} onSlotChange={setSlot} idPrefix="dev-image" onClose={close} />;
  }
  if (modal === 'weatherMaskEditor') {
    const edit = tab === 'edit';
    return <WeatherMaskEditor open picture={MASK_ROOM} mask={edit ? windowMask() : undefined} sharedCount={edit ? 3 : 1} onSave={close} onClose={close} />;
  }
  if (modal === 'appearancePreview' || modal === 'statAppearancePreview') return <DevAppearancePreview onClose={close} stat={modal === 'statAppearancePreview'} />;
  if (modal === 'codeRename') return <CodeRenameDialog open plan={fixture === 'layers' ? LAYER_PLAN : PLAN} onApply={close} onSettle={close} />;
  if (modal === 'savedElsewhere' || modal === 'deletedElsewhere') {
    return <ChangedElsewhereDialog change={modal === 'savedElsewhere' ? 'saved' : 'deleted'} onLeave={close} onKeepMine={close} />;
  }
  if (modal === 'deleteWorldAvatar') {
    return <DeleteVrmConfirm open name="Fen Walker" users={AVATAR_USERS} onConfirm={close} onOpenChange={(open) => { if (!open) close(); }} />;
  }
  if (modal === 'deleteMediaEntry') {
    return (
      <DeleteMediaConfirm
        open name="knight_portrait" uses={['Wren, Image 1', 'Marsh Warden, Image 2', 'Old Keep, Image 1']}
        onConfirm={close} onOpenChange={(open) => { if (!open) close(); }}
      />
    );
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
