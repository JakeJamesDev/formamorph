import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/typography';
import { Tip } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectOptions } from '@/components/SelectOptions';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WorldInput } from '@/components/editor/WorldField';
import { toastError } from '@/lib/linkToast';
import { blobToDataUrl } from '@/lib/imageSource';
import { useMountedRef } from '@/lib/useMountedRef';
import { fieldFrame } from '@/lib/historyField';
import { addWorldVrm, deleteWorldVrm, entitiesUsingWorldVrm, renameWorldVrm, vrmDisplayName } from '@/lib/worldVrmStore';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, ModelMetadata } from '@/types';

export const VRM_STORE_HINT = 'Add the Avatars this world carries. Pick one on each entity.';

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

/** One store row: its display name, committed on blur, and its delete. */
const VrmRow = ({ id, name, onRename, onDelete }: {
  id: string;
  name: string;
  onRename: (name: string) => void;
  onDelete: () => void;
}) => {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  // A cleared name goes back to the stored one.
  const commit = () => {
    if (!draft.trim()) setDraft(name);
    else if (draft !== name) onRename(draft);
  };
  return (
    <div className="flex items-center gap-2" {...fieldFrame('vrmStore', id, 'name')}>
      <WorldInput
        aria-label="Avatar Name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="min-w-0 flex-1"
      />
      <Tip tip="Delete this Avatar">
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onDelete}>Delete</Button>
      </Tip>
    </div>
  );
};

/** A library model's file name: its display name, with the extension its format calls for. */
const libraryFileName = (model: ModelMetadata) => `${model.name}.${model.license?.metaVersion === null ? 'glb' : 'vrm'}`;

/** The world's Avatar store: add by upload or library copy, rename, delete. Advanced only, in the World Overview. */
export const WorldVrmStoreSection = () => {
  const { worldOverview, updateWorldOverview, entities, setEntities } = useGameData();
  const history = useWorldHistoryMovesOptional();
  const store = worldOverview.vrmStore;
  // Adds land after a file read, so they build on the store as it stands then, not at the click.
  const storeRef = useRef(store);
  storeRef.current = store;
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useMountedRef();
  const [library, setLibrary] = useState<ModelMetadata[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    ModelStorageService.getModelMetadata()
      .then((models) => { if (mounted.current) setLibrary(models); })
      .catch(() => { /* An unreadable library offers no copies; upload still works. */ });
  }, [mounted]);

  const add = (name: string, file: MediaAsset) => {
    const next = addWorldVrm(storeRef.current, name, file).store;
    storeRef.current = next;
    updateWorldOverview({ vrmStore: next });
  };

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    blobToDataUrl(file)
      .then((data) => {
        if (!mounted.current) return;
        // Browsers report an empty MIME for .vrm, so the filename is the format hint.
        add(vrmDisplayName(file.name), { data, type: file.type || 'model/vrm', name: file.name, size: file.size });
      })
      .catch((error: unknown) => toastError(error, { headline: 'Error reading file. Please try again.' }));
  };

  const copyFromLibrary = async (modelId: string) => {
    const model = library.find((m) => m.id === modelId);
    if (!model) return;
    try {
      const { blob, type } = await ModelStorageService.getModelData(modelId);
      const data = await blobToDataUrl(blob);
      if (!mounted.current) return;
      add(model.name, { data, type: type || 'model/vrm', name: libraryFileName(model), size: blob.size });
    } catch (error) {
      toastError(error, { headline: 'Error copying the Avatar. Please try again.' });
    }
  };

  const confirmDelete = () => {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    const run = () => {
      const next = deleteWorldVrm(store, entities, id);
      const fallback = worldOverview.legacyVrmFallback;
      const spent = fallback?.kind === 'world' && fallback.id === id;
      updateWorldOverview({ vrmStore: next.store, ...(spent ? { legacyVrmFallback: undefined } : {}) });
      setEntities(next.entities);
    };
    if (history) void history.batch('Delete Avatar', run);
    else run();
  };

  const entries = Object.entries(store ?? {});
  const pending = deleting ? store?.[deleting] : undefined;

  return (
    <div className="space-y-2" {...fieldFrame('vrmStore')}>
      <Label>Avatars</Label>
      <Hint>{VRM_STORE_HINT}</Hint>
      {entries.map(([id, vrm]) => (
        <VrmRow
          key={id}
          id={id}
          name={vrm.name}
          onRename={(name) => updateWorldOverview({ vrmStore: renameWorldVrm(store, id, name) })}
          onDelete={() => setDeleting(id)}
        />
      ))}
      <input ref={inputRef} type="file" accept=".vrm,.glb" aria-label="Avatar File" onChange={handleUpload} className="hidden" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>Upload Avatar…</Button>
        <Select value="" onValueChange={(id) => void copyFromLibrary(id)} disabled={library.length === 0}>
          <SelectTrigger aria-label="Copy From Library" className="w-64 max-w-full">
            <SelectValue placeholder="Copy from library" />
          </SelectTrigger>
          <SelectContent>
            <SelectOptions options={library.map((m) => ({ value: m.id, label: m.name }))} />
          </SelectContent>
        </Select>
      </div>
      <DeleteVrmConfirm
        open={!!pending}
        name={pending?.name ?? ''}
        users={deleting ? entitiesUsingWorldVrm(entities, deleting) : []}
        onConfirm={confirmDelete}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
      />
    </div>
  );
};
