import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { ScrollArea } from '@/components/ui/scroll-area';
import EditorModalShell from './EditorModalShell';
import EntityFields from '@/managers/EntityFields';
import { TagsField } from '@/components/TagsField';
import PlaceholderEditor from '@/managers/PlaceholderEditor';
import PlaceholderPaletteBar from '@/components/prompt/PlaceholderPaletteBar';
import { ChipInsertTargetProvider } from '@/components/prompt/ChipInsertTarget';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { exportEntityCard } from '@/lib/entityFile';
import { downloadBlob } from '@/lib/downloadBlob';
import { memoStringify } from '@/lib/memoStringify';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, Placeholder } from '@/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'entity', label: 'Character' },
  { value: 'placeholders', label: 'Placeholders' },
];

type EntityTab = (typeof TABS)[number]['value'];

/**
 * Edit a single library character in place, bound to ISOLATED state (never the world store). Opens on an
 * existing `entityId` (loaded from storage) or a `draft` (a brand-new character not yet stored). Export
 * exports a `.webp` card; Save writes to `EntityStorageService` — a draft isn't persisted until then.
 * `onPublish` (when the user is signed in) hands the character up to the publish dialog.
 */
const EntityEditorModal = ({ entityId, draft, onClose, onPublish }: {
  entityId: string | null;
  draft?: Entity | null;
  onClose: () => void;
  onPublish?: (entity: Entity) => void;
}) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  // Opens on Character rather than Overview: tags are the thing you set once, the descriptions are
  // what you come back to edit.
  const [tab, setTab] = useState<EntityTab>('entity');
  const baselineRef = useRef('');
  // Reuses cached serialization for the entity's unchanged base64 image/model on each keystroke; matches
  // the JSON.stringify baseline byte-for-byte.
  const stringifyCache = useRef(new WeakMap<object, string>());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isOpen = entityId !== null || !!draft;

  // Seed from the draft, or load the character from storage; clear when closed.
  useEffect(() => {
    if (draft) { setEntity(draft); baselineRef.current = JSON.stringify(draft); return; }
    if (entityId === null) { setEntity(null); return; }
    let cancelled = false;
    EntityStorageService.getEntityData(entityId)
      .then((e) => {
        if (cancelled) return;
        setEntity(e);
        baselineRef.current = JSON.stringify(e);
      })
      .catch(() => { if (!cancelled) { toast.error('Could not load character.'); onCloseRef.current(); } });
    return () => { cancelled = true; };
  }, [entityId, draft]);

  const hasUnsavedChanges = entity != null && memoStringify(entity, stringifyCache.current) !== baselineRef.current;

  const handleChange = (field: string, value: unknown) => {
    setEntity((prev) => (prev ? ({ ...prev, [field]: value } as Entity) : prev));
  };

  // Isolated placeholder store backed by the character's own `placeholders` field (empty ⇒ undefined).
  const phStore = useMemo(() => placeholderStore(entity?.placeholders ?? [], (action: SetStateAction<Placeholder[]>) =>
    setEntity((prev) => {
      if (!prev) return prev;
      const cur = prev.placeholders ?? [];
      const next = typeof action === 'function' ? action(cur) : action;
      return { ...prev, placeholders: next.length ? next : undefined };
    })), [entity?.placeholders]);

  // Returns whether the save succeeded, so a save-and-exit caller only closes on success.
  const handleSave = async (): Promise<boolean> => {
    if (!entity) return true;
    const id = entityId ?? entity.id;
    const normalized: Entity = { ...entity, id };
    try {
      // A save means this copy diverged from whatever it was downloaded from; the store read-merges the rest.
      await EntityStorageService.storeEntity({
        id, name: normalized.name, data: normalized, dirty: true, editedAt: new Date().toISOString(),
      });
      setEntity(normalized);
      baselineRef.current = JSON.stringify(normalized);
      toast.success('Character saved!');
      return true;
    } catch {
      toast.error('Could not save character.');
      return false;
    }
  };

  const handleExport = async () => {
    if (!entity) return;
    try {
      const blob = await exportEntityCard(entity);
      downloadBlob(blob, `${entity.name || 'Character'}.webp`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <EditorModalShell
      open={isOpen}
      title={entity?.name || 'Character'}
      contentClassName="max-w-[800px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden"
      loading={!entity}
      tabs={TABS}
      tab={tab}
      onTabChange={(v) => setTab(v as EntityTab)}
      hasUnsavedChanges={hasUnsavedChanges}
      onSave={handleSave}
      onClose={onClose}
      onExport={handleExport}
      onPublish={onPublish && entity ? () => onPublish(entity) : undefined}
    >
      {entity && tab === 'overview' ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <TagsField values={entity.tags} onChange={(tags) => handleChange('tags', tags)} />
          </div>
        </ScrollArea>
      ) : entity && tab === 'entity' ? (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <ChipInsertTargetProvider>
              <PlaceholderPaletteBar placeholders={entity.placeholders ?? []} />
              <EntityFields value={entity} onChange={handleChange} placeholders={entity.placeholders ?? []} />
            </ChipInsertTargetProvider>
          </div>
        </ScrollArea>
      ) : (
        <PlaceholderStoreProvider value={phStore}>
          <PlaceholderEditor />
        </PlaceholderStoreProvider>
      )}
    </EditorModalShell>
  );
};

export default EntityEditorModal;
