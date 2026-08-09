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
import { Section, RowLabel, CheckRow, HintInfo } from '@/components/SettingsRows';
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
  subscribeLocalMove,
  localModelLocations,
  setLocalModelLocations,
  pickLocalModelFolder,
  localModelFreeSpace,
  countMovableModels,
  moveLocalModels,
  cancelLocalModelMove,
  DOWNLOAD_PAUSED,
  type LocalDownloadProgress,
  type LocalInstalledModel,
  type LocalModelLocations,
  type LocalMoveProgress,
  type LocalMoveResult,
} from '@/lib/imageGen/desktop';

/** Catalog display name keyed by GGUF filename, for labeling installed files we recognize. */
const CATALOG_BY_FILE = new Map(LOCAL_MODELS.map((m) => [m.fileName, m.name]));

/** localStorage key for the user's manual ordering of the Installed list (model refs, in order). */
const INSTALLED_ORDER_KEY = 'formamorph:installedModelOrder';

/** Sort installed models by the saved manual order; unranked (new) files keep their input order at the end. */
function applyInstalledOrder(list: LocalInstalledModel[]): LocalInstalledModel[] {
  let order: string[] = [];
  try { order = JSON.parse(localStorage.getItem(INSTALLED_ORDER_KEY) || '[]'); } catch { /* ignore */ }
  const rank = (id: string) => { const i = order.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
}

/** A reorderable Installed-list row: grip handle · name · size · load/unload · delete. Models found in the
 *  user's external folder show where they came from and can't be deleted from here — they're another app's. */
function InstalledRow({ item, engine, busyFile, onLoad, onUnload, onDelete }: {
  item: LocalInstalledModel;
  engine: LocalLlmState;
  busyFile: string | null;
  onLoad: (id: string) => void;
  onUnload: () => void;
  onDelete: (item: LocalInstalledModel, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined };
  const known = CATALOG_BY_FILE.get(item.fileName);
  const name = known ?? item.fileName.replace(/\.gguf$/i, '');
  // Match on path, not filename: two searched folders can hold the same GGUF name.
  const isThis = engine.modelPath === item.path;
  const isLoaded = engine.status === 'ready' && isThis;
  const isLoading = engine.status === 'loading' && isThis;
  const engineBusy = engine.status === 'loading'; // any load/unload in flight
  const rowBusy = busyFile === item.id;
  const external = item.source === 'external';

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <span {...attributes} {...listeners} className="shrink-0 cursor-grab touch-none px-1 text-muted-foreground" aria-label="Reorder">
        <GripVertical className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-grow">
        <div className="flex items-center gap-2 truncate text-label font-medium">
          {name}
          {isLoaded && <span className="rounded bg-success px-1.5 py-0.5 text-meta text-success-foreground">Loaded</span>}
        </div>
        {known && <div className="truncate text-meta text-muted-foreground">{item.fileName}</div>}
        {external && (
          <div className="truncate text-meta text-muted-foreground" title={item.path}>
            {item.subpath ? `From ${item.subpath}` : 'From your other folder'}
          </div>
        )}
      </div>
      <span className="shrink-0 text-meta tabular-nums text-muted-foreground">{formatModelSize(item.size)}</span>
      {/* One fixed-width toggle so Load / Unload / Loading… never change the row's button size. */}
      <Button
        size="sm"
        variant={isLoaded ? 'secondary' : 'default'}
        className="w-24 shrink-0"
        onClick={isLoaded ? onUnload : () => onLoad(item.id)}
        disabled={engineBusy || rowBusy}
      >
        {isLoading ? 'Loading…' : isLoaded ? 'Unload' : 'Load'}
      </Button>
      {/* External models belong to whichever app downloaded them — we never delete those. The spacer keeps
          every row's Load button in the same column. */}
      {external ? (
        <span className="h-9 w-9 shrink-0" aria-hidden />
      ) : (
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
      )}
    </div>
  );
}

/** Top-level view of the local model manager. */
type ModelView = 'installed' | 'recommended' | 'options';

/** The move-on-folder-change flow, in the one state it's currently in. */
type MoveFlow =
  | { phase: 'confirm'; from: string; to: string; count: number; bytes: number; freeBytes: number | null }
  | { phase: 'moving'; from: string; to: string; progress: LocalMoveProgress | null }
  | { phase: 'result'; from: string; result: LocalMoveResult };

/**
 * Changing the download folder offers to bring the models along. The old folder stops being searched
 * either way, so the result panel is the only record of anything left behind — it names each file and
 * why it stayed, and can copy the paths out.
 */
function MoveModelsDialog({ flow, onMove, onSkip, onCancel, onDone }: {
  flow: MoveFlow | null;
  onMove: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!flow) return null;

  const copyPaths = (from: string, result: LocalMoveResult) => {
    const text = result.skipped.map((s) => `${from}${'\\'}${s.file} — ${s.reason}`).join('\n');
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => { /* ignore */ });
  };

  return (
    <Dialog open onOpenChange={() => { if (flow.phase === 'result') onDone(); }}>
      <DialogContent className="w-[min(94vw,520px)] max-w-none">
        {flow.phase === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Move your models?</DialogTitle>
              <DialogDescription>
                {flow.count === 1 ? '1 model' : `${flow.count} models`} ({formatModelSize(flow.bytes)}) are in your
                old download folder. Moving them can take a while for large files on another drive.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-meta">
              <div className="truncate font-mono text-muted-foreground" title={flow.from}>From {flow.from}</div>
              <div className="truncate font-mono text-muted-foreground" title={flow.to}>To {flow.to}</div>
              <p className="text-warning">
                The old folder is no longer searched, so anything left there won&apos;t appear in your model list.
              </p>
              {flow.freeBytes !== null && flow.freeBytes < flow.bytes && (
                <p className="text-destructive">
                  The new folder only has {formatModelSize(flow.freeBytes)} free — not enough for all of them.
                  Files that don&apos;t fit will be reported and left where they are.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onSkip}>Leave Them</Button>
              <Button onClick={onMove}>Move</Button>
            </div>
          </>
        )}

        {flow.phase === 'moving' && (
          <>
            <DialogHeader>
              <DialogTitle>Moving models…</DialogTitle>
              <DialogDescription>
                Your models are being copied to the new folder. Nothing is deleted until each copy finishes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Progress value={flow.progress?.totalBytes ? Math.round((flow.progress.movedBytes / flow.progress.totalBytes) * 100) : 0} />
              <div className="flex items-center justify-between text-meta text-muted-foreground">
                <span className="truncate">{flow.progress?.file ?? 'Starting…'}</span>
                {flow.progress && (
                  <span className="shrink-0 tabular-nums">
                    {formatModelSize(flow.progress.movedBytes)} / {formatModelSize(flow.progress.totalBytes)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
            </div>
          </>
        )}

        {flow.phase === 'result' && (
          <>
            <DialogHeader>
              <DialogTitle>{flow.result.canceled ? 'Move canceled' : 'Move complete'}</DialogTitle>
              <DialogDescription>
                Moved {flow.result.moved.length} of {flow.result.moved.length + flow.result.skipped.length}.
              </DialogDescription>
            </DialogHeader>
            {flow.result.skipped.length > 0 && (
              <div className="space-y-2 text-meta">
                <div>
                  Still in <span className="font-mono">{flow.from}</span>, which is no longer searched:
                </div>
                <ScrollArea className="max-h-40">
                  <ul className="space-y-1">
                    {flow.result.skipped.map((s) => (
                      <li key={s.file} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{s.file}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {flow.result.skipped.length > 0 && (
                <Button variant="outline" onClick={() => copyPaths(flow.from, flow.result)}>
                  {copied ? 'Copied' : 'Copy Paths'}
                </Button>
              )}
              <Button onClick={onDone}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Options tab: where models are downloaded to, and one optional extra folder to search so a library
 * downloaded for another app shows up without copying it. Subfolder search is on by default because LM
 * Studio nests models as publisher/repo/file.
 */
function SearchLocations({ locations, onChange, onChangeDownloadDir }: {
  locations: LocalModelLocations | null;
  onChange: (opts: { externalDir: string | null; searchSubfolders: boolean }) => void;
  onChangeDownloadDir: (dir: string | null) => void;
}) {
  if (!locations) return null;
  const {
    rootDir, defaultDir, isDefaultDir, downloadDirMissing, freeBytes,
    externalDir, searchSubfolders, externalMissing, lmStudioDir,
  } = locations;

  return (
    <div className="grid gap-6 py-4 pr-2">
      <Section title="Download Folder" hint="Where models you download are saved.">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
          <RowLabel top>Folder</RowLabel>
          <div className="space-y-2">
            {/* The path gets its own line above the buttons: these run long, and truncating one to make
                room for controls hides the part that identifies the folder. */}
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-grow truncate font-mono text-meta" title={rootDir}>{rootDir}</span>
              {freeBytes !== null && (
                <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                  {formatModelSize(freeBytes)} free
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const dir = await pickLocalModelFolder('Choose where to download models');
                  if (dir && dir !== rootDir) onChangeDownloadDir(dir);
                }}
              >
                Change…
              </Button>
              {!isDefaultDir && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChangeDownloadDir(null)}>
                  Use Default
                </Button>
              )}
            </div>
            {downloadDirMissing && (
              <p className="text-helper text-destructive">
                That folder isn&apos;t available right now — downloads are paused until it&apos;s back or you choose another.
              </p>
            )}
            {!isDefaultDir && (
              <p className="text-helper text-muted-foreground">
                Models live outside the app folder now, so copying the app folder won&apos;t bring them along.
                The default is <span className="font-mono">{defaultDir}</span>.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Additional Search Folder" hint="Already have models for another app? Point us at them and they'll show up in your list.">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-start gap-4">
          <RowLabel
            top
            info={<HintInfo>{'Models found in this folder are **read-only**.\n\n- They can be loaded like any other model\n- They are never deleted from here — they belong to whichever app downloaded them\n- Downloads always land in your download folder, not this one'}</HintInfo>}
          >
            Folder
          </RowLabel>
          <div className="space-y-2">
            <div className="min-w-0 truncate text-meta" title={externalDir ?? undefined}>
              {externalDir
                ? <span className="font-mono">{externalDir}</span>
                : <span className="text-muted-foreground">Not set</span>}
            </div>
            <div className="flex items-center gap-2">
              {!externalDir && lmStudioDir && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ externalDir: lmStudioDir, searchSubfolders: true })}
                >
                  Use LM Studio
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const dir = await pickLocalModelFolder('Choose a folder to search for models');
                  if (dir) onChange({ externalDir: dir, searchSubfolders });
                }}
              >
                Browse…
              </Button>
              {externalDir && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ externalDir: null, searchSubfolders })}
                >
                  <X className="mr-1 h-3.5 w-3.5" />Clear
                </Button>
              )}
            </div>
            {externalMissing && (
              <p className="text-helper text-warning">
                That folder isn&apos;t available right now — its models are hidden until it&apos;s back.
              </p>
            )}
          </div>
        </div>

        {externalDir && (
          <CheckRow
            label="Search Subfolders"
            htmlFor="modelSearchSubfolders"
            checked={searchSubfolders}
            onChange={(v) => onChange({ externalDir, searchSubfolders: v })}
            hint="Look inside folders within that folder. Needed for LM Studio, which files models under a publisher and a repository."
          />
        )}
      </Section>
    </div>
  );
}

/**
 * Desktop-only local model manager. Three tabs: Installed (every GGUF in the searched folders —
 * reorderable, loadable, deletable), Recommended (a curated catalog grouped by VRAM tier, with resumable
 * downloads), and Options (which folders are downloaded to and searched).
 * A freshly downloaded model auto-loads, and the default endpoint points at it.
 */
export function LocalModelModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const engine = useLocalLlmStatus();
  // Desktop reads VRAM over the IPC bridge (no helper URL). Only poll while the popup is open.
  const vram = useVramStats('', { enabled: open });
  const [view, setView] = useState<ModelView>('installed');
  const [installed, setInstalled] = useState<LocalInstalledModel[]>([]);
  // Paused/interrupted downloads: target filename → bytes already on disk.
  const [partials, setPartials] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<LocalDownloadProgress | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<VramTier>('tier8');
  const [confirmDelete, setConfirmDelete] = useState<{ fileName: string; name: string } | null>(null);
  const [locations, setLocations] = useState<LocalModelLocations | null>(null);
  const [moveFlow, setMoveFlow] = useState<MoveFlow | null>(null);
  const [spaceWarning, setSpaceWarning] = useState<{ model: LocalModelInfo; needed: number; free: number } | null>(null);
  const autoedRef = useRef(false);

  const installedNames = useMemo(
    () => new Set(installed.filter((i) => i.source === 'root').map((i) => i.fileName)),
    [installed],
  );

  const refresh = () => {
    localModelLocations().then(setLocations).catch(() => { /* ignore */ });
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

  useEffect(() => subscribeLocalMove((p) => {
    setMoveFlow((prev) => (prev?.phase === 'moving' ? { ...prev, progress: p } : prev));
  }), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setInstalled((prev) => {
      const oldI = prev.findIndex((i) => i.id === active.id);
      const newI = prev.findIndex((i) => i.id === over.id);
      if (oldI === -1 || newI === -1) return prev;
      const next = arrayMove(prev, oldI, newI);
      localStorage.setItem(INSTALLED_ORDER_KEY, JSON.stringify(next.map((i) => i.id)));
      return next;
    });
  };

  const downloading = progress !== null;

  const startDownload = async (m: LocalModelInfo, force = false) => {
    setError(null);
    // Warn (don't block) when the model won't fit — the figure can be stale on a network share, and a
    // resumed download only needs what's left. Failing 7 GB in is worse than a question up front.
    if (!force) {
      const needed = m.sizeBytes - (partials[m.fileName] ?? 0);
      const free = await localModelFreeSpace().catch(() => null);
      if (free !== null && free < needed) {
        setSpaceWarning({ model: m, needed, free });
        return;
      }
    }
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

  const load = async (ref: string) => {
    setBusyFile(ref);
    setError(null);
    try { await loadLocalModel(ref); } catch (e) { setError((e as Error).message); } finally { setBusyFile(null); }
  };

  // Changing where we search re-lists immediately so the effect is visible in the same panel.
  const changeLocations = async (opts: Partial<{ downloadDir: string | null; externalDir: string | null; searchSubfolders: boolean }>) => {
    setError(null);
    try {
      setLocations(await setLocalModelLocations(opts));
      listLocalInstalled().then((list) => setInstalled(applyInstalledOrder(list))).catch(() => { /* ignore */ });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Point downloads somewhere else, then offer to bring the existing models along. The setting changes
  // either way — the old folder stops being searched, which is what makes the move worth offering.
  const changeDownloadDir = async (dir: string | null) => {
    const from = locations?.rootDir;
    setError(null);
    try {
      const next = await setLocalModelLocations({ downloadDir: dir });
      setLocations(next);
      listLocalInstalled().then((list) => setInstalled(applyInstalledOrder(list))).catch(() => { /* ignore */ });
      if (!from || from === next.rootDir) return;
      const { count, bytes } = await countMovableModels(from);
      if (count > 0) {
        setMoveFlow({ phase: 'confirm', from, to: next.rootDir, count, bytes, freeBytes: next.freeBytes });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runMove = async () => {
    if (moveFlow?.phase !== 'confirm') return;
    const { from, to } = moveFlow;
    setMoveFlow({ phase: 'moving', from, to, progress: null });
    try {
      const result = await moveLocalModels({ from, to });
      setMoveFlow({ phase: 'result', from, result });
    } catch (e) {
      setError((e as Error).message);
      setMoveFlow(null);
    }
    refresh();
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
            Download a model to run Formamorph fully offline — no endpoint setup. Options sets where models
            are saved and which folders are searched.
          </DialogDescription>
        </DialogHeader>

        {/* Engine status + GPU memory (shared with the endpoint panel). */}
        <EngineStatusLine engine={engine} className="shrink-0" />
        <GpuMemoryBox stats={vram} className="shrink-0" {...resolveOwnVram(vram, engine.engineVramMB)} />

        {/* Top-level view: what's installed, what we suggest, and where all of it lives. */}
        <ToggleGroup
          type="single"
          value={view}
          // A single ToggleGroup clears its value when the active item is clicked again; one of the
          // views is always showing, so an empty result is ignored rather than stored.
          onValueChange={(v) => { if (v) setView(v as ModelView); }}
          className="shrink-0 grid w-full grid-cols-3"
        >
          <ToggleGroupItem value="installed">Installed</ToggleGroupItem>
          <ToggleGroupItem value="recommended">Recommended</ToggleGroupItem>
          <ToggleGroupItem value="options">Options</ToggleGroupItem>
        </ToggleGroup>

        {error && <div className="shrink-0 text-meta text-destructive">{error}</div>}

        {view === 'options' ? (
          <ScrollArea className="min-h-0 flex-1">
            <SearchLocations locations={locations} onChange={changeLocations} onChangeDownloadDir={changeDownloadDir} />
          </ScrollArea>
        ) : view === 'installed' ? (
          <>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-2">
            {installed.length === 0 ? (
              <div className="pt-8 text-center text-helper text-muted-foreground">
                No models installed. Grab one from the Recommended tab, drop a `.gguf` into your download
                folder, or point us at a folder you already keep models in from the Options tab.
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
                <SortableContext items={installed.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {installed.map((item) => (
                    <InstalledRow
                      key={item.id}
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
          </>
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
              {VRAM_TIERS.map((t) => <ToggleGroupItem key={t.value} value={t.value} className="text-meta">{t.label}</ToggleGroupItem>)}
            </ToggleGroup>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3">
              {models.map((m) => {
                // Root-folder only: this tab manages our own downloads, and its Load/Delete work on refs
                // that resolve there. A catalog model that exists only in the external folder still shows
                // on the Installed tab.
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
                          {m.name} <span className="text-meta text-muted-foreground">{m.params} · {m.quant} · {formatModelSize(m.sizeBytes)}</span>
                          {m.reasoning && <span className="ml-1.5 rounded bg-info/15 px-1.5 py-0.5 align-middle text-[10px] font-medium text-info">Reasoning</span>}
                        </div>
                        <div className="text-meta text-muted-foreground">{m.note}</div>
                        <div className="text-meta text-muted-foreground">License: {m.license}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-meta text-muted-foreground">Released {formatReleased(m.released)}</span>
                        {isLoaded && <span className="rounded bg-success px-2 py-0.5 text-meta text-success-foreground">Loaded</span>}
                      </div>
                    </div>

                    {thisDownloading ? (
                      <div className="space-y-1">
                        <Progress value={pct} />
                        <div className="flex items-center justify-between text-meta text-muted-foreground">
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
                            <span className="text-meta text-muted-foreground">
                              {formatModelSize(partialBytes)} / {formatModelSize(m.sizeBytes)}
                            </span>
                          </>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => startDownload(m)} disabled={downloading}>
                              Download ({formatModelSize(m.sizeBytes)})
                            </Button>
                            <span className="text-meta text-muted-foreground">{downloadsLabel}</span>
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

      <ConfirmDialog
        open={spaceWarning !== null}
        onOpenChange={(o) => { if (!o) setSpaceWarning(null); }}
        title="Not enough room?"
        description={spaceWarning
          ? `${spaceWarning.model.name} needs ${formatModelSize(spaceWarning.needed)}, but the download folder only has ${formatModelSize(spaceWarning.free)} free. You can download anyway — it will stop if it runs out.`
          : ''}
        onConfirm={() => {
          const pending = spaceWarning;
          setSpaceWarning(null);
          if (pending) startDownload(pending.model, true);
        }}
      />

      <MoveModelsDialog
        flow={moveFlow}
        onMove={runMove}
        onSkip={() => setMoveFlow(null)}
        onCancel={() => { cancelLocalModelMove().catch(() => { /* ignore */ }); }}
        onDone={() => setMoveFlow(null)}
      />
    </Dialog>
  );
}
