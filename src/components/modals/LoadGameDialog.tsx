import { randomUUID } from "@/lib/uuid";
import { downloadUrl } from "@/lib/downloadBlob";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Download, Import, Loader2, X, GripVertical, Folder, ChevronLeft } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  getAllSaveRecords, deleteSaveRecord, putSaveRecord, migrateLegacySaves, getOrder, setOrder,
} from './dbUtils';
import { downloadSaveFile, terminateWorker as terminateDownloadWorker } from '../../lib/saveDownloadWorkerUtils';
import { APP_VERSION, isSaveEnvelope, migrateSave, SAVE_FILE_KIND } from '../../lib/version';
import { cn } from "@/lib/utils";
import { useClosingSnapshot } from "@/lib/useClosingSnapshot";
import WorldStorageService from '../../services/WorldStorageService';
import {
  groupSaves, mergeOrder, folderRefFor, FOLDER_ORDER_KEY, type SaveMeta, type SaveFolder, type WorldRef,
} from '../../lib/saveOrdering';
import type { SaveRecord } from "@/types";

const formatGameTime = (time: number) => {
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  return `${hours}h ${minutes}m`;
};

const formatStamp = (ms: number) => (ms ? new Date(ms).toLocaleString() : '');

/** SaveMeta enriched with the raw record + display bits, so the row can render and export without a re-read. */
export interface SaveRow extends SaveMeta {
  gameTime: number;
  isAutosave?: boolean;
  record: SaveRecord;
}

const recordToRow = (r: SaveRecord): SaveRow => ({
  id: r.id,
  name: r.name,
  worldId: r.worldId,
  worldName: r.currentState?.worldName ?? null,
  timestamp: r.currentState?.timestamp ? Date.parse(r.currentState.timestamp) : 0,
  gameTime: r.currentState?.gameTime ?? 0,
  isAutosave: r.isAutosave,
  record: r,
});

// --- One save row (draggable) --------------------------------------------------------------------

function SortableSaveRow({ row, disabled, busy, onLoad, onDownload, onDelete }: {
  row: SaveRow;
  disabled: boolean;
  busy: boolean;
  onLoad: (row: SaveRow) => void;
  onDownload: (row: SaveRow) => void;
  onDelete: (row: SaveRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  // Translate only (not Transform): a sortable's transform includes a scale to morph the dragged row to the
  // target slot's size, which visibly resizes it when rows differ in height. Translation keeps its own size.
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 w-full rounded-md border border-input bg-background pr-1 text-left text-sm transition-colors",
        disabled ? "pointer-events-none opacity-50" : "hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {/* Drag handle — far left */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-1 py-2 text-muted-foreground shrink-0 self-stretch flex items-center"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      {/* Details — middle column grows, wraps, and loads on click */}
      <div
        role="button"
        tabIndex={0}
        className="flex-1 min-w-0 py-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={() => onLoad(row)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLoad(row); } }}
      >
        <div className="break-words font-medium">
          {row.name}
          {row.isAutosave && (
            <span className="relative -top-[2px] ml-2 inline-block rounded bg-info/15 px-1.5 py-px align-middle text-[10px] font-semibold uppercase leading-none tracking-wide text-info">
              Auto
            </span>
          )}
        </div>
        <div className="text-xs opacity-70">
          {formatStamp(row.timestamp)} - Game Time: {formatGameTime(row.gameTime)}
        </div>
      </div>

      {/* Download then Delete — right-anchored */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        disabled={busy}
        title="Download save"
        onClick={(e) => { e.stopPropagation(); onDownload(row); }}
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0 text-destructive"
        title="Delete save"
        onClick={(e) => { e.stopPropagation(); onDelete(row); }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// --- One folder row ------------------------------------------------------------------------------

function FolderRowBody({ folder, pinned }: { folder: SaveFolder; pinned: boolean }) {
  return (
    <>
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="break-words font-medium">
          {folder.worldName}{pinned && <span className="ml-2 text-xs text-muted-foreground">(current)</span>}
        </div>
        <div className="text-xs opacity-70">
          {folder.saves.length} save{folder.saves.length === 1 ? '' : 's'}
          {folder.lastPlayed > 0 && <> · Last played {formatStamp(folder.lastPlayed)}</>}
        </div>
      </div>
    </>
  );
}

/** The current world's folder: always first, not draggable (no handle). */
function PinnedFolderRow({ folder, onOpen }: { folder: SaveFolder; onOpen: (f: SaveFolder) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-sm cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onOpen(folder)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(folder); } }}
    >
      <FolderRowBody folder={folder} pinned />
    </div>
  );
}

function SortableFolderRow({ folder, onOpen }: { folder: SaveFolder; onOpen: (f: SaveFolder) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.key });
  // Translate only (not Transform): a sortable's transform includes a scale to morph the dragged row to the
  // target slot's size, which visibly resizes it when rows differ in height. Translation keeps its own size.
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 w-full rounded-md border border-input bg-background pr-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-1 py-2 text-muted-foreground shrink-0 self-stretch flex items-center"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 flex-1 min-w-0 py-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={() => onOpen(folder)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(folder); } }}
      >
        <FolderRowBody folder={folder} pinned={false} />
      </div>
    </div>
  );
}

/**
 * The Load Game dialog: per-world save folders with a root/folder breadcrumb, drag-reorder, import, and
 * per-save download/delete. Shared by the in-game menu and the main menu.
 *
 * - `current` set (in-game): that world's folder is pinned first; loading another *installed* world confirms
 *   and switches; loading an *uninstalled* world's save warns and loads in place (`onLoad` with no worldId).
 * - `current` omitted (main menu — no world loaded): root lists every world with saves; loading an installed
 *   world's save cold-starts it (`onLoad` with its worldId, no confirm); an uninstalled world is blocked.
 */
export function LoadGameDialog({ open, onOpenChange, current, onLoad, title, onPickSave, topSlot }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: { id: string; name: string };
  onLoad: (saveId: string, targetWorldId?: string) => Promise<unknown> | void;
  /** Dialog title; defaults to "Load Game". */
  title?: string;
  /** Pick mode (Save dialog): clicking a save row calls this with the row instead of loading it, and the
   *  cross-world/blocked-load confirms never fire. */
  onPickSave?: (row: SaveRow) => void;
  /** Extra content rendered at the top of the body — used by the Save dialog for its name input + Save button. */
  topSlot?: React.ReactNode;
}) {
  const coldStart = !current;

  const [records, setRecords] = React.useState<SaveRecord[]>([]);
  const [worlds, setWorlds] = React.useState<WorldRef[]>([]);
  const [folderOrder, setFolderOrder] = React.useState<string[]>([]);
  const [saveOrderByKey, setSaveOrderByKey] = React.useState<Record<string, string[]>>({});
  const [activeKey, setActiveKey] = React.useState<string>(current ? current.id : '');

  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState('');
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadingSaveName, setDownloadingSaveName] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<SaveRow | null>(null);
  // In-game cross-world confirm. `targetWorldId` set ⇒ installed world, we'll switch; absent ⇒ warn + load in place.
  const [pendingLoad, setPendingLoad] = React.useState<{ row: SaveRow; targetWorldId?: string } | null>(null);
  const [blockedLoad, setBlockedLoad] = React.useState<SaveRow | null>(null); // cold-start orphan (world not installed)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => () => { terminateDownloadWorker(); }, []);

  const loadData = React.useCallback(async () => {
    try {
      // One-time: fold any ancient localStorage saves into the legacy store first.
      const staleKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('FORMAMORPH_save_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || 'null');
            const name = key.replace('FORMAMORPH_save_', '');
            await putSaveRecord({ ...(data as object), id: randomUUID(), name } as SaveRecord);
            staleKeys.push(key);
          } catch (error) {
            console.error('Error migrating save:', error);
          }
        }
      }
      staleKeys.forEach(key => localStorage.removeItem(key));

      const worldMeta = await WorldStorageService.getWorldMetadata();
      const worldRefs: WorldRef[] = worldMeta.map(w => ({ id: String(w.id), name: w.name }));
      const nameToId = new Map(worldRefs.map(w => [w.name, w.id] as const));
      await migrateLegacySaves(name => nameToId.get(name ?? ''));

      const all = await getAllSaveRecords();
      setWorlds(worldRefs);
      setRecords(all);
      setFolderOrder(await getOrder(FOLDER_ORDER_KEY));
    } catch (error) {
      console.error('Error loading saves:', error);
      setRecords([]);
    }
  }, []);

  // (Re)load whenever the dialog opens; reset the view (current world's folder in-game, else root).
  React.useEffect(() => {
    if (open) { void loadData(); setActiveKey(current ? current.id : ''); }
  }, [open, current, loadData]);

  // Lazily load a folder's persisted save order the first time it's viewed (drag persists it; this reads it back).
  React.useEffect(() => {
    if (!activeKey || saveOrderByKey[activeKey] !== undefined) return;
    let cancelled = false;
    void getOrder(activeKey).then((ids) => {
      if (!cancelled) setSaveOrderByKey((prev) => (prev[activeKey] !== undefined ? prev : { ...prev, [activeKey]: ids }));
    });
    return () => { cancelled = true; };
  }, [activeKey, saveOrderByKey]);

  const nameToId = React.useMemo(() => new Map(worlds.map(w => [w.name, w.id])), [worlds]);
  const idToName = React.useMemo(() => new Map(worlds.map(w => [w.id, w.name])), [worlds]);

  const folders = React.useMemo(() => groupSaves(records.map(recordToRow), worlds, current), [records, worlds, current]);
  const currentFolder = current ? folders.find(f => f.key === current.id) : undefined;
  const listFolders = React.useMemo(
    () => mergeOrder(folders.filter(f => f.saves.length > 0 && (!current || f.key !== current.id)), f => f.key, f => f.lastPlayed, folderOrder),
    [folders, current, folderOrder],
  );
  const activeFolder = folders.find(f => f.key === activeKey);
  const activeSaves = React.useMemo(
    () => (activeFolder ? mergeOrder(activeFolder.saves as SaveRow[], s => s.id, s => s.timestamp, saveOrderByKey[activeFolder.key] ?? []) : []),
    [activeFolder, saveOrderByKey],
  );

  const atRoot = activeKey === '';
  // In pick mode (the Save dialog) hide the autosave slot — it can't be manually overwritten.
  const shownSaves = onPickSave ? activeSaves.filter((s) => !s.isAutosave) : activeSaves;

  const doLoad = async (row: SaveRow, targetWorldId?: string) => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Loading save file. Please wait...');
      await new Promise(resolve => setTimeout(resolve, 100));
      await onLoad(row.id, targetWorldId);
      onOpenChange(false);
    } catch (error) {
      console.error('Error loading game:', error);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const requestLoad = (row: SaveRow) => {
    const ref = folderRefFor(row, nameToId, idToName);
    if (current && ref.key === current.id) { void doLoad(row); return; } // same current world → load directly
    const installedId = ref.worldId && worlds.some(w => w.id === ref.worldId) ? ref.worldId : undefined;
    if (coldStart) {
      // No current world to fall back into: an installed world cold-starts; an orphan can't be loaded.
      if (installedId) void doLoad(row, installedId);
      else setBlockedLoad(row);
    } else {
      // In-game: installed → switch confirm; orphan (no installedId) → warn + load in place.
      setPendingLoad({ row, targetWorldId: installedId });
    }
  };

  const doDownload = async (row: SaveRow) => {
    try {
      setIsDownloading(true);
      setDownloadingSaveName(row.name);
      setLoadingMessage(`Preparing ${row.name} for download...`);
      // Strip device-local fields from the export: the record id and the autosave marker (a downloaded
      // autosave re-imports as an ordinary manual save).
      const { id: _id, isAutosave: _auto, ...fileData } = row.record;
      const { dataUrl, fileName } = await downloadSaveFile({ formamorphKind: SAVE_FILE_KIND, ...fileData }) as { dataUrl: string; fileName: string };
      downloadUrl(dataUrl, `${fileName}.json`);
    } catch (error) {
      console.error('Error downloading save:', error);
    } finally {
      setIsDownloading(false);
      setDownloadingSaveName('');
      setLoadingMessage('');
    }
  };

  const doDelete = async (row: SaveRow) => {
    try {
      await deleteSaveRecord(row.id);
      setRecords(prev => prev.filter(r => r.id !== row.id));
    } catch (error) {
      console.error('Error deleting save:', error);
    }
  };

  const handleSaveDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !activeFolder) return;
    const ids = activeSaves.map(s => s.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    setSaveOrderByKey(prev => ({ ...prev, [activeFolder.key]: next }));
    void setOrder(activeFolder.key, next);
  };

  const handleFolderDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const keys = listFolders.map(f => f.key);
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(keys, from, to);
    setFolderOrder(next);
    void setOrder(FOLDER_ORDER_KEY, next);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const save = JSON.parse(text) as SaveRecord & { version?: string | number };
      if (isSaveEnvelope(save)) {
        // migrateSave is idempotent and now also hoists the canonical history + strips snapshot copies for
        // string-version saves, so run it for every envelope, not just numeric-legacy ones.
        const migrated = migrateSave(save);
        Object.assign(save, migrated, { version: APP_VERSION });
      }
      const worldName = save.currentState?.worldName ?? null;
      const record: SaveRecord = {
        ...save,
        id: randomUUID(),
        name: save.name ?? 'Imported save',
        worldId: save.worldId ?? nameToId.get(worldName ?? ''),
      };
      await putSaveRecord(record);
      await loadData();
      setActiveKey(folderRefFor(recordToRow(record), nameToId, idToName).key);
    } catch (error) {
      console.error('Error uploading save:', error);
    }
  };

  const busy = isLoading || isDownloading;
  const rootEmpty = atRoot && !currentFolder && listFolders.length === 0;
  // Hold the blocked save's world name while its "not installed" dialog fades out (blockedLoad nulls on close).
  const shownBlocked = useClosingSnapshot(!!blockedLoad, blockedLoad);

  return (
    <>
      {/* In-game cross-world confirm. Installed world → switch; uninstalled → warn it loads in place. */}
      <ConfirmDialog
        open={!!pendingLoad}
        onOpenChange={(o) => { if (!o) setPendingLoad(null); }}
        title={pendingLoad?.targetWorldId ? 'Switch worlds and load?' : 'Load a save from another world?'}
        description={pendingLoad?.targetWorldId
          ? `This save belongs to “${pendingLoad?.row.worldName ?? 'another world'}”. Loading it switches to that world and leaves your current game — unsaved progress will be lost.`
          : `This save belongs to “${pendingLoad?.row.worldName ?? 'another world'}”, which isn't installed. It will load into your current world (“${current?.name ?? ''}”) and may not behave as intended. Your current game will be replaced — unsaved progress will be lost.`}
        onConfirm={() => { const p = pendingLoad; setPendingLoad(null); if (p) void doLoad(p.row, p.targetWorldId); }}
      />

      {/* Cold-start block: the save's world isn't installed, so there's nothing to load it into. */}
      <Dialog open={!!blockedLoad} onOpenChange={(o) => { if (!o) setBlockedLoad(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>World not installed</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This save belongs to “{shownBlocked?.worldName ?? 'a world'}”, which is not installed. Import or
            download that world first to play its saves. You can still download or delete this save.
          </p>
          <DialogFooter>
            <Button onClick={() => setBlockedLoad(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title="Delete save"
        description={`Delete “${pendingDelete?.name}”? This can't be undone.`}
        onConfirm={() => { const row = pendingDelete; setPendingDelete(null); if (row) void doDelete(row); }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] max-h-[90dvh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{title ?? 'Load Game'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col py-4">
            {topSlot && <div className="mb-3">{topSlot}</div>}
            <div className="mb-3">
              <input
                type="file"
                id="save-upload"
                className="hidden"
                accept=".json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); e.target.value = ''; }}
              />
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => document.getElementById('save-upload')?.click()}
              >
                <Import className="h-4 w-4" />
                <span>Import</span>
              </Button>
            </div>

            <div className="mb-3 flex items-center">
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2" disabled={atRoot} onClick={() => setActiveKey('')}>
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
              <div className="flex-1 text-center text-sm font-medium truncate px-2">
                {atRoot ? 'Saves' : `Saves / ${activeFolder?.worldName ?? ''}`}
              </div>
              <div className="w-[68px] shrink-0" aria-hidden />
            </div>

            <ScrollArea className="max-h-[60dvh]">
              <div className="space-y-2 p-1">
                {atRoot ? (
                  <>
                    {currentFolder && <PinnedFolderRow folder={currentFolder} onOpen={(f) => setActiveKey(f.key)} />}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleFolderDragEnd}
                      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                    >
                      <SortableContext items={listFolders.map(f => f.key)} strategy={verticalListSortingStrategy}>
                        {listFolders.map(f => (
                          <SortableFolderRow key={f.key} folder={f} onOpen={(x) => setActiveKey(x.key)} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSaveDragEnd}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                  >
                    <SortableContext items={shownSaves.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {shownSaves.map(row => (
                        <SortableSaveRow
                          key={row.id}
                          row={row}
                          disabled={isLoading}
                          busy={busy}
                          onLoad={onPickSave ?? requestLoad}
                          onDownload={(r) => void doDownload(r)}
                          onDelete={(r) => setPendingDelete(r)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {busy && (
                  <div className="text-center py-4 flex flex-col items-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <div className="text-sm">{loadingMessage || 'Processing...'}</div>
                    <div className="text-xs text-warning max-w-xs">
                      {isDownloading
                        ? `Please wait while the save file "${downloadingSaveName}" is being prepared for download. For large save files, this may take a moment.`
                        : 'Please wait while the save file is being processed. For large save files, this may take a moment. Do not attempt to load another save until this process completes.'}
                    </div>
                  </div>
                )}

                {!busy && rootEmpty && (
                  <div className="text-center py-6 opacity-70 text-sm">No saved games found.</div>
                )}
                {!busy && !atRoot && shownSaves.length === 0 && (
                  <div className="text-center py-6 opacity-70 text-sm">No saves for this world yet.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
