import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LOCAL_MODELS, VRAM_TIERS, formatModelSize, formatReleased, formatDownloads, repoOf, tierForVram, type LocalModelInfo, type VramTier } from '@/lib/localModels';
import { useCatalogDownloads } from '@/lib/useCatalogDownloads';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useVramStats, resolveOwnVram } from '@/lib/useVramStats';
import type { LocalLlmState } from '@/lib/imageGen/desktop';
import { EngineStatusLine, GpuMemoryBox } from '@/components/LocalModelStatus';
import {
  listLocalInstalled,
  listLocalPartials,
  discardLocalPartial,
  loadLocalModel,
  stopLocalLlm,
  downloadLocalModel,
  cancelLocalDownload,
  deleteLocalModel,
  subscribeLocalDownload,
  DOWNLOAD_PAUSED,
  type LocalDownloadProgress,
  type LocalInstalledModel,
} from '@/lib/imageGen/desktop';

/** Catalog display name keyed by GGUF filename, for labeling installed files we recognize. */
const CATALOG_BY_FILE = new Map(LOCAL_MODELS.map((m) => [m.fileName, m.name]));

/** localStorage key for the user's manual ordering of the Installed list (filenames, in order). */
const INSTALLED_ORDER_KEY = 'formamorph:installedModelOrder';

/** Sort installed models by the saved manual order; unranked (new) files keep their input order at the end. */
function applyInstalledOrder(list: LocalInstalledModel[]): LocalInstalledModel[] {
  let order: string[] = [];
  try { order = JSON.parse(localStorage.getItem(INSTALLED_ORDER_KEY) || '[]'); } catch { /* ignore */ }
  const rank = (f: string) => { const i = order.indexOf(f); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return [...list].sort((a, b) => rank(a.fileName) - rank(b.fileName));
}

/** A reorderable Installed-list row: grip handle · name · size · load/unload · delete. */
function InstalledRow({ item, engine, busyFile, onLoad, onUnload, onDelete }: {
  item: LocalInstalledModel;
  engine: LocalLlmState;
  busyFile: string | null;
  onLoad: (fileName: string) => void;
  onUnload: () => void;
  onDelete: (item: LocalInstalledModel, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.fileName });
  // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined };
  const known = CATALOG_BY_FILE.get(item.fileName);
  const name = known ?? item.fileName.replace(/\.gguf$/i, '');
  const isLoaded = engine.status === 'ready' && engine.modelId === item.fileName;
  const isLoading = engine.status === 'loading' && engine.modelId === item.fileName;
  const engineBusy = engine.status === 'loading'; // any load/unload in flight
  const rowBusy = busyFile === item.fileName;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <span {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none px-1 text-muted-foreground" aria-label="Reorder">
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-grow">
        <div className="flex items-center gap-2 truncate text-sm font-medium">
          {name}
          {isLoaded && <span className="rounded bg-success px-1.5 py-0.5 text-xs text-success-foreground">Loaded</span>}
        </div>
        {known && <div className="truncate text-xs text-muted-foreground">{item.fileName}</div>}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatModelSize(item.size)}</span>
      {/* One fixed-width toggle so Load / Unload / Loading… never change the row's button size. */}
      <Button
        size="sm"
        variant={isLoaded ? 'secondary' : 'default'}
        className="w-24 shrink-0"
        onClick={isLoaded ? onUnload : () => onLoad(item.fileName)}
        disabled={engineBusy || rowBusy}
      >
        {isLoading ? 'Loading…' : isLoaded ? 'Unload' : 'Load'}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 text-destructive hover:text-destructive/80"
        onClick={() => onDelete(item, name)}
        disabled={rowBusy}
        aria-label="Delete model"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Desktop-only local model manager. Two tabs: Installed (every GGUF in the models folder — reorderable,
 * loadable, deletable) and Recommended (a curated catalog grouped by VRAM tier, with resumable downloads).
 * A freshly downloaded model auto-loads, and the default endpoint points at it.
 */
export function LocalModelModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const engine = useLocalLlmStatus();
  // Desktop reads VRAM over the IPC bridge (no helper URL). Only poll while the popup is open.
  const vram = useVramStats('', { enabled: open });
  const [view, setView] = useState<'installed' | 'recommended'>('installed');
  const [installed, setInstalled] = useState<LocalInstalledModel[]>([]);
  // Paused/interrupted downloads: target filename → bytes already on disk.
  const [partials, setPartials] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<LocalDownloadProgress | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<VramTier>('tier8');
  const [confirmDelete, setConfirmDelete] = useState<{ fileName: string; name: string } | null>(null);
  const autoedRef = useRef(false);

  const installedNames = useMemo(() => new Set(installed.map((i) => i.fileName)), [installed]);

  const refresh = () => {
    listLocalInstalled().then((list) => setInstalled(applyInstalledOrder(list))).catch(() => { /* ignore */ });
    listLocalPartials()
      .then((ps) => setPartials(Object.fromEntries(ps.map((p) => [p.fileName, p.received]))))
      .catch(() => { /* ignore */ });
  };

  useEffect(() => {
    if (open) { refresh(); setError(null); } else { autoedRef.current = false; }
  }, [open]);

  // Auto-select the tab for the detected GPU once per open.
  useEffect(() => {
    if (!open || autoedRef.current) return;
    const total = vram.status === 'online' ? vram.gpus[0]?.totalMB : null;
    if (total) { setTier(tierForVram(total)); autoedRef.current = true; }
  }, [open, vram]);

  useEffect(() => subscribeLocalDownload((p) => {
    setProgress(p.done ? null : p);
    if (p.done) refresh();
  }), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setInstalled((prev) => {
      const oldI = prev.findIndex((i) => i.fileName === active.id);
      const newI = prev.findIndex((i) => i.fileName === over.id);
      if (oldI === -1 || newI === -1) return prev;
      const next = arrayMove(prev, oldI, newI);
      localStorage.setItem(INSTALLED_ORDER_KEY, JSON.stringify(next.map((i) => i.fileName)));
      return next;
    });
  };

  const downloading = progress !== null;

  const startDownload = async (m: LocalModelInfo) => {
    setError(null);
    // Seed the bar at the resume point so a resumed download doesn't flash back to 0%.
    setProgress({ fileName: m.fileName, received: partials[m.fileName] ?? 0, total: m.sizeBytes, done: false });
    try {
      await downloadLocalModel({ url: m.url, fileName: m.fileName });
      refresh();
    } catch (e) {
      // A pause isn't an error — just refresh so the row shows its resumable partial.
      if ((e as Error).message.includes(DOWNLOAD_PAUSED)) refresh();
      else setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const discardPartial = async (m: LocalModelInfo) => {
    setBusyFile(m.fileName);
    try { await discardLocalPartial(m.fileName); refresh(); } finally { setBusyFile(null); }
  };

  const load = async (fileName: string) => {
    setBusyFile(fileName);
    setError(null);
    try { await loadLocalModel(fileName); } catch (e) { setError((e as Error).message); } finally { setBusyFile(null); }
  };

  const unload = async () => {
    setError(null);
    try { await stopLocalLlm(); } catch (e) { setError((e as Error).message); }
  };

  // Delete always confirms first; the main process unloads the model first if it's the loaded one.
  const runDelete = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    if (!target) return;
    setBusyFile(target.fileName);
    try { await deleteLocalModel(target.fileName); refresh(); } finally { setBusyFile(null); }
  };

  const models = LOCAL_MODELS.filter((m) => m.tier === tier);
  const liveDownloads = useCatalogDownloads();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[820px] max-h-[92dvh] w-[min(96vw,760px)] max-w-none flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Local model</DialogTitle>
          <DialogDescription>
            Download a model to run Formamorph fully offline — no endpoint setup. Files are saved next to the app.
          </DialogDescription>
        </DialogHeader>

        {/* Engine status + GPU memory (shared with the endpoint panel). */}
        <EngineStatusLine engine={engine} className="shrink-0" />
        <GpuMemoryBox stats={vram} className="shrink-0" {...resolveOwnVram(vram, engine.engineVramMB)} />

        {/* Top-level view: what's installed vs. what we suggest. */}
        <ToggleGroup
          type="single"
          value={view}
          // A single ToggleGroup clears its value when the active item is clicked again; one of the two
          // views is always showing, so an empty result is ignored rather than stored.
          onValueChange={(v) => { if (v) setView(v as 'installed' | 'recommended'); }}
          className="shrink-0 grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="installed">Installed</ToggleGroupItem>
          <ToggleGroupItem value="recommended">Recommended</ToggleGroupItem>
        </ToggleGroup>

        {error && <div className="shrink-0 text-xs text-destructive">{error}</div>}

        {view === 'installed' ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2">
            {installed.length === 0 ? (
              <div className="pt-8 text-center text-sm text-muted-foreground">
                No models installed. Grab one from the Recommended tab, or drop a `.gguf` into the models folder.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                // Lock drags to the vertical axis and clamp them to this scroll frame; never auto-scroll the
                // page/window (that's the runaway "infinite scroll"). Mirrors the world/dictionary lists.
                modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                autoScroll={{
                  canScroll: (el) =>
                    el !== document.scrollingElement &&
                    el !== document.body &&
                    el !== document.documentElement,
                }}
              >
                <SortableContext items={installed.map((i) => i.fileName)} strategy={verticalListSortingStrategy}>
                  {installed.map((item) => (
                    <InstalledRow
                      key={item.fileName}
                      item={item}
                      engine={engine}
                      busyFile={busyFile}
                      onLoad={load}
                      onUnload={unload}
                      onDelete={(it, name) => setConfirmDelete({ fileName: it.fileName, name })}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* VRAM tier tabs (auto-selected from the GPU). */}
            <ToggleGroup
              type="single"
              value={tier}
              // A single ToggleGroup clears its value when the active item is clicked again; a tier is always
              // selected, so an empty result is ignored rather than stored.
              onValueChange={(v) => { if (v) setTier(v as VramTier); }}
              className="shrink-0 grid w-full grid-cols-4"
            >
              {VRAM_TIERS.map((t) => <ToggleGroupItem key={t.value} value={t.value} className="text-xs">{t.label}</ToggleGroupItem>)}
            </ToggleGroup>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3">
              {models.map((m) => {
                const isInstalled = installedNames.has(m.fileName);
                const isLoaded = engine.status === 'ready' && engine.modelId === m.fileName;
                const isLoading = engine.status === 'loading' && engine.modelId === m.fileName;
                const thisDownloading = downloading && progress?.fileName === m.fileName;
                const busy = busyFile === m.fileName;
                const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0;
                const partialBytes = partials[m.fileName];
                const hasPartial = partialBytes !== undefined && !isInstalled;
                const partialPct = hasPartial ? Math.round((partialBytes / m.sizeBytes) * 100) : 0;
                const downloadsLabel = `${formatDownloads(liveDownloads[repoOf(m)] ?? m.downloads)} downloads`;

                return (
                  <div key={m.id} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {m.name} <span className="text-xs text-muted-foreground">{m.params} · {m.quant} · {formatModelSize(m.sizeBytes)}</span>
                          {m.reasoning && <span className="ml-1.5 rounded bg-info/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-info">Reasoning</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.note}</div>
                        <div className="text-xs text-muted-foreground">License: {m.license}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">Released {formatReleased(m.released)}</span>
                        {isLoaded && <span className="rounded bg-success px-2 py-0.5 text-xs text-success-foreground">Loaded</span>}
                      </div>
                    </div>

                    {thisDownloading ? (
                      <div className="space-y-1">
                        <Progress value={pct} />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatModelSize(progress.received)} / {formatModelSize(progress.total || m.sizeBytes)} ({pct}%)</span>
                          <Button size="sm" variant="ghost" onClick={() => cancelLocalDownload()}>Pause</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isInstalled ? (
                          <>
                            {/* One fixed-width toggle so Load / Unload / Loading… stay the same size. */}
                            <Button
                              size="sm"
                              variant={isLoaded ? 'secondary' : 'default'}
                              className="w-24 shrink-0"
                              onClick={isLoaded ? () => unload() : () => load(m.fileName)}
                              disabled={isLoading || busy}
                            >
                              {isLoading ? 'Loading…' : isLoaded ? 'Unload' : 'Load'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmDelete({ fileName: m.fileName, name: m.name })} disabled={busy || isLoading}>Delete</Button>
                          </>
                        ) : hasPartial ? (
                          <>
                            <Button size="sm" onClick={() => startDownload(m)} disabled={downloading}>
                              Resume ({partialPct}%)
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => discardPartial(m)} disabled={busy || downloading}>Discard</Button>
                            <span className="text-xs text-muted-foreground">
                              {formatModelSize(partialBytes)} / {formatModelSize(m.sizeBytes)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => startDownload(m)} disabled={downloading}>
                              Download ({formatModelSize(m.sizeBytes)})
                            </Button>
                            <span className="text-xs text-muted-foreground">{downloadsLabel}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={`Delete ${confirmDelete?.name ?? 'this model'}?`}
        description="This removes the model file from disk. You can download it again later."
        onConfirm={runDelete}
      />
    </Dialog>
  );
}
