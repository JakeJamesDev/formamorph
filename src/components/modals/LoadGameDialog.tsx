import { randomUUID } from "@/lib/uuid";
import { downloadBlob } from "@/lib/downloadBlob";
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Import, Loader2, X, GripVertical, Folder, FolderOpen, ChevronLeft } from "lucide-react";
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
import { serializeJsonBlob, terminateWorker as terminateExportWorker } from '../../lib/jsonFileWorkerUtils';
import { APP_VERSION, isSaveEnvelope, migrateSave, SAVE_FILE_KIND } from '../../lib/version';
import { cn } from "@/lib/utils";
import { useClosingSnapshot } from "@/lib/useClosingSnapshot";
import { filesFrom, importSummaryToast } from "@/lib/importFiles";
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

function SortableSaveRow({ row, disabled, busy, onLoad, onExport, onDelete }: {
  row: SaveRow;
  disabled: boolean;
  busy: boolean;
  onLoad: (row: SaveRow) => void;
  onExport: (row: SaveRow) => void;
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
        "flex items-center gap-1 w-full rounded-md border border-input bg-background pr-1 text-left text-label transition-colors",
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
        <div className="text-meta opacity-70">
          {formatStamp(row.timestamp)} - Game Time: {formatGameTime(row.gameTime)}
        </div>
      </div>

      {/* Export then Delete — right-anchored */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        disabled={busy}
        title="Export save"
        onClick={(e) => { e.stopPropagation(); onExport(row); }}
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
          {folder.worldName}{pinned && <span className="ml-2 text-meta text-muted-foreground">(current)</span>}
        </div>
        <div className="text-meta opacity-70">
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
      className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-left text-label cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
      className="flex items-center gap-1 w-full rounded-md border border-input bg-background pr-3 text-left text-label transition-colors hover:bg-accent hover:text-accent-foreground"
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
 * per-save export/delete. Shared by the in-game menu and the main menu.
 *
 * - `current` set (in-game): that world's folder is pinned first; loading another *installed* world confirms
 *   and switches; loading an *uninstalled* world's save warns and loads in place (`onLoad` with no worldId).
 * - `current` omitted (main menu — no world loaded): root lists every world with saves; loading an installed
 *   world's save cold-starts it (`onLoad` with its worldId, no confirm); an uninstalled world is blocked.
 */
export function LoadGameDialog({ open, onOpenChange, current, onLoad, title, icon, onPickSave, topSlot }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: { id: string; name: string };
  onLoad: (saveId: string, targetWorldId?: string) => Promise<unknown> | void;
  /** Dialog title; defaults to "Load Game". */
  title?: string;
  /** Icon beside the title, matching the menu item that opened this; defaults to the Load Game folder. */
  icon?: React.ReactNode;
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
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingSaveName, setExportingSaveName] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<SaveRow | null>(null);
  // In-game cross-world confirm. `targetWorldId` set ⇒ installed world, we'll switch; absent ⇒ warn + load in place.
  const [pendingLoad, setPendingLoad] = React.useState<{ row: SaveRow; targetWorldId?: string } | null>(null);
  const [blockedLoad, setBlockedLoad] = React.useState<SaveRow | null>(null); // cold-start orphan (world not installed)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  React.useEffect(() => () => { terminateExportWorker(); }, []);

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

  const doExport = async (row: SaveRow) => {
    try {
      setIsExporting(true);
      setExportingSaveName(row.name);
      setLoadingMessage(`Preparing ${row.name} for export...`);
      // Strip device-local fields from the export: the record id and the autosave marker (an exported
      // autosave re-imports as an ordinary manual save).
      const { id: _id, isAutosave: _auto, ...fileData } = row.record;
      const blob = await serializeJsonBlob({ formamorphKind: SAVE_FILE_KIND, ...fileData }, 2);
      downloadBlob(blob, `${fileData.name || 'save'}.json`);
    } catch (error) {
      console.error('Error exporting save:', error);
    } finally {
      setIsExporting(false);
      setExportingSaveName('');
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

  const handleImport = async (files: File[]) => {
    let ok = 0, skipped = 0;
    let lastKey: string | null = null;
    for (const file of files) {
      try {
        const save = JSON.parse(await file.text()) as SaveRecord & { version?: string | number };
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
          isAutosave: undefined, // an imported save is always a manual one, never the auto slot
        };
        await putSaveRecord(record);
        lastKey = folderRefFor(recordToRow(record), nameToId, idToName).key;
        ok++;
      } catch (error) {
        console.error('Error uploading save:', file.name, error);
        skipped++;
      }
    }
    if (ok) { await loadData(); if (lastKey) setActiveKey(lastKey); }
    if (ok || skipped) importSummaryToast(ok, skipped, { one: 'save', many: 'saves' });
  };

  const busy = isLoading || isExporting;
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
          <DialogDescription className="py-2">
            This save belongs to “{shownBlocked?.worldName ?? 'a world'}”, which is not installed. Import or
            download that world first to play its saves. You can still export or delete this save.
          </DialogDescription>
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
        <DialogContent className="sm:max-w-[560px] max-h-[90dvh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {icon ?? <FolderOpen className="h-4 w-4" />} {title ?? 'Load Game'}
            </DialogTitle>
            <DialogDescription className="sr-only">Load a saved game, import a save file, or manage this world&apos;s saves.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col py-4">
            {topSlot && <div className="mb-3">{topSlot}</div>}
            <div className="mb-3">
              <input
                type="file"
                id="save-upload"
                className="hidden"
                accept=".json"
                multiple
                onChange={(e) => { const f = filesFrom(e); if (f.length) void handleImport(f); }}
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
              <div className="flex-1 text-center text-label font-medium truncate px-2">
                {atRoot ? 'Saves' : `Saves / ${activeFolder?.worldName ?? ''}`}
              </div>
              <div className="w-[68px] shrink-0" aria-hidden />
            </div>

            {/* Native scroll (not ScrollArea): a bare `max-h` gives ScrollArea's `h-full` viewport no definite
                height to resolve against, so it sizes to content and clips with no scroll. `overflow-y-auto`
                treats `max-h` as a real scroll boundary and stays the dnd autoscroll ancestor. */}
            <div className="max-h-[60dvh] overflow-y-auto">
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
                          onExport={(r) => void doExport(r)}
                          onDelete={(r) => setPendingDelete(r)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {busy && (
                  <div className="text-center py-4 flex flex-col items-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <div className="text-label">{loadingMessage || 'Processing...'}</div>
                    <div className="text-meta text-warning max-w-xs">
                      {isExporting
                        ? `Please wait while the save file "${exportingSaveName}" is being prepared for export. For large save files, this may take a moment.`
                        : 'Please wait while the save file is being processed. For large save files, this may take a moment. Do not attempt to load another save until this process completes.'}
                    </div>
                  </div>
                )}

                {!busy && rootEmpty && (
                  <div className="text-center py-6 opacity-70 text-label">No saved games found.</div>
                )}
                {!busy && !atRoot && shownSaves.length === 0 && (
                  <div className="text-center py-6 opacity-70 text-label">No saves for this world yet.</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
