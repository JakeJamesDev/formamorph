import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LOCAL_MODELS, VRAM_TIERS, formatModelSize, tierForVram, type LocalModelInfo, type VramTier } from '@/lib/localModels';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useVramStats } from '@/lib/useVramStats';
import VramReadout from '@/components/game/VramReadout';
import {
  listLocalModels,
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
} from '@/lib/imageGen/desktop';

/**
 * Desktop-only local model manager: download a curated GGUF from Hugging Face (with progress), or load /
 * delete an already-installed one. Models are grouped by the VRAM tier they fit; the tab auto-selects
 * from the detected GPU. A freshly downloaded model auto-loads, and the default endpoint points at it.
 */
export function LocalModelModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const engine = useLocalLlmStatus();
  // Desktop reads VRAM over the IPC bridge (no helper URL). Only poll while the popup is open.
  const vram = useVramStats('', { enabled: open });
  const [installed, setInstalled] = useState<string[]>([]);
  // Paused/interrupted downloads: target filename → bytes already on disk.
  const [partials, setPartials] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<LocalDownloadProgress | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<VramTier>('tier8');
  const autoedRef = useRef(false);

  const refresh = () => {
    listLocalModels().then(setInstalled).catch(() => { /* ignore */ });
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

  const load = async (m: LocalModelInfo) => {
    setBusyFile(m.fileName);
    setError(null);
    try { await loadLocalModel(m.fileName); } catch (e) { setError((e as Error).message); } finally { setBusyFile(null); }
  };

  const unload = async () => {
    setError(null);
    try { await stopLocalLlm(); } catch (e) { setError((e as Error).message); }
  };

  const remove = async (m: LocalModelInfo) => {
    setBusyFile(m.fileName);
    try { await deleteLocalModel(m.fileName); refresh(); } finally { setBusyFile(null); }
  };

  const models = LOCAL_MODELS.filter((m) => m.tier === tier);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,760px)] max-w-none h-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Local model</DialogTitle>
          <DialogDescription>
            Download a model to run Formamorph fully offline — no endpoint setup. Files are saved next to the app.
          </DialogDescription>
        </DialogHeader>

        {/* Engine status line */}
        <div className="shrink-0 text-xs text-muted-foreground">
          Engine:{' '}
          {engine.status === 'ready' ? <span className="text-success">ready — {engine.modelId}</span>
            : engine.status === 'loading' ? <span className="text-warning">loading {engine.modelId}…</span>
            : engine.status === 'error' ? <span className="text-destructive">error: {engine.error}</span>
            : 'no model loaded'}
        </div>

        {/* GPU memory — helps judge which tier fits. */}
        <div className="shrink-0 rounded-md border border-border p-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">GPU memory</div>
          <VramReadout stats={vram} />
        </div>

        {/* VRAM tier tabs (auto-selected from the GPU). */}
        <Tabs value={tier} onValueChange={(v) => setTier(v as VramTier)} className="shrink-0">
          <TabsList className="grid w-full grid-cols-4">
            {VRAM_TIERS.map((t) => <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {error && <div className="shrink-0 text-xs text-destructive">{error}</div>}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {models.map((m) => {
            const isInstalled = installed.includes(m.fileName);
            const isLoaded = engine.status === 'ready' && engine.modelId === m.fileName;
            const isLoading = engine.status === 'loading' && engine.modelId === m.fileName;
            const thisDownloading = downloading && progress?.fileName === m.fileName;
            const busy = busyFile === m.fileName;
            const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0;
            const partialBytes = partials[m.fileName];
            const hasPartial = partialBytes !== undefined && !isInstalled;
            const partialPct = hasPartial ? Math.round((partialBytes / m.sizeBytes) * 100) : 0;

            return (
              <div key={m.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {m.name} <span className="text-xs text-muted-foreground">{m.params} · {m.quant} · {formatModelSize(m.sizeBytes)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{m.note}</div>
                    <div className="text-xs text-muted-foreground">License: {m.license}</div>
                  </div>
                  {isLoaded && <span className="shrink-0 rounded bg-success px-2 py-0.5 text-xs text-success-foreground">Loaded</span>}
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
                        {isLoaded ? (
                          <Button size="sm" variant="secondary" onClick={() => unload()}>Unload</Button>
                        ) : (
                          <Button size="sm" onClick={() => load(m)} disabled={isLoading || busy}>
                            {isLoading ? 'Loading…' : 'Load'}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => remove(m)} disabled={busy || isLoading}>Delete</Button>
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
                      <Button size="sm" onClick={() => startDownload(m)} disabled={downloading}>
                        Download ({formatModelSize(m.sizeBytes)})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
