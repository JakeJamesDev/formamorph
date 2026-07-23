import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Save, Upload } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import EntityFields from '@/managers/EntityFields';
import PlaceholderEditor from '@/managers/PlaceholderEditor';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import { exportEntityCard } from '@/lib/entityFile';
import { downloadBlob } from '@/lib/downloadBlob';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity, Placeholder } from '@/types';

/**
 * Edit a single library character in place, bound to ISOLATED state (never the world store). Opens on an
 * existing `entityId` (loaded from storage) or a `draft` (a brand-new character not yet stored). Download
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
  const [tab, setTab] = useState<'entity' | 'placeholders'>('entity');
  const [showUnsaved, setShowUnsaved] = useState(false);
  const baselineRef = useRef('');
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

  const hasUnsavedChanges = entity != null && JSON.stringify(entity) !== baselineRef.current;

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

  const handleDownload = async () => {
    if (!entity) return;
    try {
      const blob = await exportEntityCard(entity);
      downloadBlob(blob, `${entity.name || 'Character'}.webp`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const attemptClose = () => { if (hasUnsavedChanges) setShowUnsaved(true); else onClose(); };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) attemptClose(); }}>
        <DialogContent className="max-w-[800px] w-[95vw] h-[85dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex-row items-center gap-3">
            <DialogTitle className="truncate flex-1">{entity?.name || 'Character'}</DialogTitle>
            {entity && (
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'entity' | 'placeholders')}>
                <TabsList>
                  <TabsTrigger value="entity">Character</TabsTrigger>
                  <TabsTrigger value="placeholders">Placeholders</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="flex-1" />
          </DialogHeader>
          {!entity ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              {tab === 'entity' ? (
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4">
                    <EntityFields value={entity} onChange={handleChange} placeholders={entity.placeholders ?? []} />
                  </div>
                </ScrollArea>
              ) : (
                <PlaceholderStoreProvider value={phStore}>
                  <PlaceholderEditor />
                </PlaceholderStoreProvider>
              )}
              <div className="px-4 py-3 border-t shrink-0 flex justify-between gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                <div className="flex gap-2">
                  {onPublish && (
                    // Publishes what's on screen, saved or not — the same thing Save would write.
                    <Button variant="outline" size="sm" onClick={() => entity && onPublish(entity)}>
                      <Upload className="h-4 w-4 mr-2" /> Publish
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges}>
                    <Save className="h-4 w-4 mr-2" /> Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showUnsaved}
        onOpenChange={setShowUnsaved}
        onSave={async () => { if (await handleSave()) onClose(); }}
        onExit={onClose}
      />
    </>
  );
};

export default EntityEditorModal;
