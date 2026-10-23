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
import { blobHash } from '@/lib/blobHash';
import { libraryFileName } from '@/lib/libraryVrm';
import { readVrmMeta } from '@/lib/vrmMeta';
import { downloadBlob } from '@/lib/downloadBlob';
import { ActionIcon } from '@/lib/actionIcons';
import { ModelDetailsPanel } from '@/components/modals/ModelDetailsPanel';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, ModelMetadata, VrmLicense } from '@/types';

export const VRM_STORE_HINT = 'Add Avatars to this world, then choose one for each entity';

/** An Avatar's name as a history label shows it. */
const labelName = (name: string) => name.trim() || 'Unnamed';

/**
 * One store Avatar in the details view the library uses. The bytes are decoded only while this is mounted, and
 * Export saves them untouched under the display name, so the file's own metadata and license travel with it.
 */
const StoreVrmPreview = ({ file, name, open, onClose }: { file: MediaAsset; name: string; open: boolean; onClose: () => void }) => {
  const [url, setUrl] = useState<string | undefined>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [meta, setMeta] = useState<{ license?: VrmLicense; size?: number }>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setFailed(false);
    fetch(file.data)
      .then((r) => r.blob())
      .then(async (loaded) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(loaded);
        setUrl(objectUrl);
        const { license } = await readVrmMeta(loaded);
        if (cancelled) return;
        // Export waits for the license: it picks the file's extension.
        setMeta({ license, size: loaded.size });
        setBlob(loaded);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
      setBlob(null);
    };
  }, [file.data]);

  return (
    <ModelDetailsPanel
      open={open}
      name={name}
      url={url}
      license={meta.license}
      size={meta.size}
      failed={failed}
      onClose={onClose}
      footer={
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => { if (blob) downloadBlob(blob, libraryFileName(name.trim() || 'Avatar', meta.license)); }}
          disabled={!blob}
        >
          <ActionIcon.export className="mr-2 h-4 w-4" /> Export
        </Button>
      }
    />
  );
};

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

/** One store row: its display name, committed on blur, its preview and its delete. */
const VrmRow = ({ id, name, file, onRename, onDelete }: {
  id: string;
  name: string;
  file: MediaAsset;
  onRename: (name: string) => void;
  onDelete: () => void;
}) => {
  const [draft, setDraft] = useState(name);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Mounted on first open and kept: decoding waits for a click, and an unmount on close would cut the exit animation.
  const [previewMounted, setPreviewMounted] = useState(false);
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
      <Tip tip="Preview this Avatar">
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setPreviewMounted(true); setPreviewOpen(true); }}>
          Preview
        </Button>
      </Tip>
      {previewMounted && <StoreVrmPreview file={file} name={name} open={previewOpen} onClose={() => setPreviewOpen(false)} />}
      <Tip tip="Delete this Avatar">
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onDelete}>Delete</Button>
      </Tip>
    </div>
  );
};

/** The world's Avatar store: add by upload or library copy, rename, delete. Advanced only, in the World Overview. */
export const WorldVrmStoreSection = () => {
  const { worldOverview, updateWorldOverview, entities, setEntities } = useGameData();
  const history = useWorldHistoryMovesOptional();
  const store = worldOverview.vrmStore;
  // Adds land after a file read and renames on blur, so both build on the store as it stands then.
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

  /** Runs one write as a single History step under `label`. */
  const asStep = (label: string, run: () => void) => {
    if (history) void history.batch(label, run);
    else run();
  };

  const add = (name: string, file: MediaAsset, hash: string) => {
    const next = addWorldVrm(storeRef.current, name, file, hash).store;
    storeRef.current = next;
    asStep(`Add Avatar: ${labelName(name)}`, () => updateWorldOverview({ vrmStore: next }));
  };

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
    } catch (error) {
      toastError(error, { headline: 'Error copying the Avatar. Please try again.' });
    }
  };

  const confirmDelete = () => {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    asStep(`Delete Avatar: ${labelName(store?.[id]?.name ?? '')}`, () => {
      const next = deleteWorldVrm(store, entities, id);
      const fallback = worldOverview.legacyVrmFallback;
      const spent = fallback?.kind === 'world' && fallback.id === id;
      updateWorldOverview({ vrmStore: next.store, ...(spent ? { legacyVrmFallback: undefined } : {}) });
      setEntities(next.entities);
    });
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
          file={vrm.file}
          onRename={(name) => asStep(`Rename Avatar: ${labelName(name)}`, () => updateWorldOverview({ vrmStore: renameWorldVrm(storeRef.current, id, name) }))}
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
