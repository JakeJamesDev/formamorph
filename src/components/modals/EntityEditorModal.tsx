import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Save } from 'lucide-react';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import EntityFields from '@/managers/EntityFields';
import { exportEntityCard } from '@/lib/entityFile';
import EntityStorageService from '@/services/EntityStorageService';
import type { Entity } from '@/types';

/**
 * Edit a single library character in place, bound to ISOLATED state (never the world store). Open ⇔
 * `entityId !== null`; Download exports a `.webp` card; Save writes back to `EntityStorageService`.
 */
const EntityEditorModal = ({ entityId, onClose }: { entityId: string | null; onClose: () => void }) => {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const baselineRef = useRef('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Load the character when opened; clear when closed.
  useEffect(() => {
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
  }, [entityId]);

  const dirty = entity != null && JSON.stringify(entity) !== baselineRef.current;

  const handleChange = (field: string, value: unknown) => {
    setEntity((prev) => (prev ? ({ ...prev, [field]: value } as Entity) : prev));
  };

  const handleSave = async () => {
    if (entityId === null || !entity) return;
    const normalized: Entity = { ...entity, id: entityId };
    try {
      await EntityStorageService.storeEntity({ id: entityId, name: normalized.name, data: normalized });
      setEntity(normalized);
      baselineRef.current = JSON.stringify(normalized);
      toast.dark('Character saved!');
    } catch {
      toast.error('Could not save character.');
    }
  };

  const handleDownload = async () => {
    if (!entity) return;
    try {
      const blob = await exportEntityCard(entity);
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${entity.name || 'Character'}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const attemptClose = () => { if (dirty) setShowUnsaved(true); else onClose(); };

  return (
    <>
      <Dialog open={entityId !== null} onOpenChange={(open) => { if (!open) attemptClose(); }}>
        <DialogContent className="max-w-[800px] w-[95vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="truncate">{entity?.name || 'Character'}</DialogTitle>
          </DialogHeader>
          {!entity ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                  <EntityFields value={entity} onChange={handleChange} />
                </div>
              </ScrollArea>
              <div className="px-4 py-3 border-t shrink-0 flex justify-between">
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showUnsaved}
        onOpenChange={setShowUnsaved}
        onSave={async () => { await handleSave(); onClose(); }}
        onExit={onClose}
      />
    </>
  );
};

export default EntityEditorModal;
