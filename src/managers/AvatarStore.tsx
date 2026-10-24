import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WorldInput } from '@/components/editor/WorldField';
import { toastError } from '@/lib/linkToast';
import { blobToDataUrl } from '@/lib/imageSource';
import { useMountedRef } from '@/lib/useMountedRef';
import { fieldFrame } from '@/lib/historyField';
import { addWorldVrm, deleteWorldVrm, entitiesUsingWorldVrm, renameWorldVrm, replaceWorldVrm, vrmDisplayName } from '@/lib/worldVrmStore';
import { blobHash } from '@/lib/blobHash';
import { libraryFileName } from '@/lib/libraryVrm';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, ModelMetadata } from '@/types';
import { useMediaStep } from './useMediaItemActions';

export const VRM_STORE_HINT = 'Add Avatars to this world, then choose one for each entity';

/** An Avatar's name as a history label shows it. */
const labelName = (name: string) => name.trim() || 'Unnamed';

/** What a delete confirmation says about the entities that use the Avatar. */
export const deleteVrmDescription = (users: Entity[]): string => users.length
  ? `${users.map((entity) => entity.name || 'Unnamed').join(', ')} will show no Avatar.`
  : 'No entity uses this Avatar.';

/** The delete confirmation for one store Avatar. Its own component so the dev route can raise it. */
export const DeleteVrmConfirm = ({ name, users, open, onConfirm, onOpenChange }: {
  name: string;
  users: Entity[];
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title={`Delete ${name || 'Unnamed'}?`}
    description={deleteVrmDescription(users)}
    confirmLabel="Delete"
    destructive
    surface="deleteWorldAvatar"
    onConfirm={onConfirm}
  />
);

/**
 * The world's Avatar store writes: add, rename, replace and delete, each one labeled History Step that keeps
 * the Media tab as its Origin. Adds land after a file read and renames on blur, so both build on the store as
 * it stands then.
 */
export function useAvatarStore() {
  const { worldOverview, updateWorldOverview, entities, setEntities } = useGameData();
  const store = worldOverview.vrmStore;
  const storeRef = useRef(store);
  storeRef.current = store;
  const step = useMediaStep();
  const mounted = useMountedRef();

  const add = (name: string, file: MediaAsset, hash: string) => {
    const next = addWorldVrm(storeRef.current, name, file, hash).store;
    storeRef.current = next;
    void step(`Add Avatar: ${labelName(name)}`, () => updateWorldOverview({ vrmStore: next }));
  };

  const rename = (id: string, name: string) =>
    step(`Rename Avatar: ${labelName(name)}`, () => updateWorldOverview({ vrmStore: renameWorldVrm(storeRef.current, id, name) }));

  const replace = async (id: string, media: MediaAsset) => {
    const hash = await blobHash(await (await fetch(media.data)).blob());
    // The panel closed during the read: the pick is dropped, as an upload is.
    if (!mounted.current) return;
    const file = { ...media, type: media.type || 'model/vrm' };
    await step(`Replace Avatar: ${labelName(storeRef.current?.[id]?.name ?? '')}`, () =>
      updateWorldOverview({ vrmStore: replaceWorldVrm(storeRef.current, id, file, hash) }));
  };

  /** Deletes the Avatar, sets every pick of it to None, and clears a legacy fallback that pointed at it. */
  const remove = (id: string) => step(`Delete Avatar: ${labelName(store?.[id]?.name ?? '')}`, () => {
    const next = deleteWorldVrm(store, entities, id);
    const fallback = worldOverview.legacyVrmFallback;
    const spent = fallback?.kind === 'world' && fallback.id === id;
    updateWorldOverview({ vrmStore: next.store, ...(spent ? { legacyVrmFallback: undefined } : {}) });
    setEntities(next.entities);
  });

  return { store, entities, add, rename, replace, remove };
}

/** An Avatar's display name, committed on blur. A cleared name goes back to the stored one. */
export function AvatarNameField({ id, name, onRename }: { id: string; name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    if (!draft.trim()) setDraft(name);
    else if (draft !== name) onRename(draft);
  };
  return (
    <div {...fieldFrame('vrmStore', id, 'name')}>
      <WorldInput
        aria-label="Avatar Name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="min-w-0 text-title font-semibold"
      />
    </div>
  );
}

/** Delete with its confirm, which names the entities that use the Avatar. */
export function useAvatarDelete(onDeleted?: () => void) {
  const { store, entities, remove } = useAvatarStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const confirm = (
    <DeleteVrmConfirm
      open={!!deleting}
      name={(deleting && store?.[deleting]?.name) || ''}
      users={deleting ? entitiesUsingWorldVrm(entities, deleting) : []}
      onConfirm={() => {
        const id = deleting;
        setDeleting(null);
        if (!id) return;
        void remove(id);
        onDeleted?.();
      }}
      onOpenChange={(open) => { if (!open) setDeleting(null); }}
    />
  );
  return { ask: setDeleting, confirm };
}

/** Upload Avatar… and Copy From Library, in the Avatars section's summary. */
export function AvatarStoreControls() {
  const { add } = useAvatarStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useMountedRef();
  const [library, setLibrary] = useState<ModelMetadata[]>([]);

  useEffect(() => {
    ModelStorageService.getModelMetadata()
      .then((models) => { if (mounted.current) setLibrary(models); })
      .catch(() => { /* An unreadable library offers no copies; upload still works. */ });
  }, [mounted]);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    Promise.all([blobToDataUrl(file), blobHash(file)])
      .then(([data, hash]) => {
        if (!mounted.current) return;
        // Browsers report an empty MIME for .vrm, so the filename is the format hint.
        add(vrmDisplayName(file.name), { data, type: file.type || 'model/vrm', name: file.name, size: file.size }, hash);
      })
      .catch((error: unknown) => toastError(error, { headline: 'Error reading file. Please try again.' }));
  };

  const copyFromLibrary = async (modelId: string) => {
    const model = library.find((m) => m.id === modelId);
    if (!model) return;
    try {
      const { blob, type, hash } = await ModelStorageService.getModelData(modelId);
      const [data, fileHash] = await Promise.all([blobToDataUrl(blob), hash ?? blobHash(blob)]);
      if (!mounted.current) return;
      add(model.name, { data, type: type || 'model/vrm', name: libraryFileName(model.name, model.license), size: blob.size }, fileHash);
    } catch (error: unknown) {
      toastError(error, { headline: 'Error copying the Avatar. Please try again.' });
    }
  };

  return (
    <div className="space-y-2" {...fieldFrame('vrmStore')}>
      <Hint>{VRM_STORE_HINT}</Hint>
      <input ref={inputRef} type="file" accept=".vrm,.glb" aria-label="Avatar File" onChange={handleUpload} className="hidden" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>Upload Avatar…</Button>
        <Select value="" onValueChange={(id) => void copyFromLibrary(id)} disabled={library.length === 0}>
          <SelectTrigger aria-label="Copy From Library" className="w-64 max-w-full">
            <SelectValue placeholder="Copy From Library" />
          </SelectTrigger>
          <SelectContent>
            <SelectOptions options={library.map((m) => ({ value: m.id, label: m.name }))} />
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
