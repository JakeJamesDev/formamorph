import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LOCAL_MODELS, formatModelSize, tierForVram, type LocalModelInfo, type VramTier,
} from '@/lib/localModels';
import { useVramStats } from '@/lib/useVramStats';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import type { AiBlocker, AiMode } from '@/lib/useAiReachable';
import {
  downloadLocalModel, cancelLocalDownload, subscribeLocalDownload, DOWNLOAD_PAUSED,
  type LocalDownloadProgress,
} from '@/lib/imageGen/desktop';

/** Why the gate opened: after the first-run intro (skippable) or because they tried to play (not). */
export type GateReason = 'firstRun' | 'play';

/** Pick the catalog's suggestion for a tier: the largest model that still fits it reads as the best default. */
function recommendFor(tier: VramTier): LocalModelInfo | null {
  const inTier = LOCAL_MODELS.filter((m) => m.tier === tier);
  return inTier.reduce<LocalModelInfo | null>((best, m) => (!best || m.sizeBytes > best.sizeBytes ? m : best), null);
}

/**
 * The "your AI isn't set up yet" gate. On the bundled desktop engine it offers a one-click download sized to
 * the detected GPU (full tier list behind "Show all"); on any custom endpoint it points at Settings instead,
 * since we can't fix someone else's server for them. A download runs in the background — the gate keeps
 * showing progress and calls `onReady` the moment the engine comes up, so a queued launch resumes itself.
 */
export function AiSetupGate({ open, reason, mode, blocker, onOpenChange, onOpenSettings, onReady }: {
  open: boolean;
  reason: GateReason;
  mode: AiMode;
  blocker: AiBlocker | null;
  onOpenChange: (v: boolean) => void;
  onOpenSettings: () => void;
  /** Fired when the engine becomes ready while the gate is open (download finished + model loaded). */
  onReady: () => void;
}) {
  const engine = useLocalLlmStatus();
  const vram = useVramStats('', { enabled: open && mode === 'local' });
  const [tier, setTier] = useState<VramTier>('tier8');
  const [showAll, setShowAll] = useState(false);
  const [progress, setProgress] = useState<LocalDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tieredRef = useRef(false);

  // Size the recommendation to the detected GPU, once per open.
  useEffect(() => {
    if (!open) { tieredRef.current = false; return; }
    if (tieredRef.current) return;
    const total = vram.status === 'online' ? vram.gpus[0]?.totalMB : null;
    if (total) { setTier(tierForVram(total)); tieredRef.current = true; }
  }, [open, vram]);

  useEffect(() => subscribeLocalDownload((p) => setProgress(p.done ? null : p)), []);

  // The whole point of the gate: once the engine is up, let the caller resume whatever it was blocking.
  useEffect(() => {
    if (open && engine.status === 'ready') onReady();
  }, [open, engine.status, onReady]);

  const recommended = useMemo(() => recommendFor(tier), [tier]);
  const downloading = progress !== null;
  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0;

  const startDownload = async (m: LocalModelInfo) => {
    setError(null);
    setProgress({ fileName: m.fileName, received: 0, total: m.sizeBytes, done: false });
    try {
      await downloadLocalModel({ url: m.url, fileName: m.fileName });
    } catch (e) {
      // A pause is a choice, not a failure.
      if (!(e as Error).message.includes(DOWNLOAD_PAUSED)) setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const custom = mode === 'custom';
  const title = custom
    ? 'Can’t reach your endpoint'
    : blocker === 'engineDown'
    ? 'Your model didn’t load'
    : 'Set up your AI';
  const description = custom
    ? 'Formamorph couldn’t get a response from your custom endpoint. Check that the server is running and the URL is right.'
    : blocker === 'engineDown'
    ? 'A model is installed but the engine couldn’t load it — it may not fit in VRAM at the current settings.'
    : 'Formamorph runs its AI on your own machine. Download a model to start playing — no account, no endpoint setup.';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && reason === 'firstRun') onOpenChange(false); }}>
      <DialogContent
        className="w-[min(96vw,560px)] max-w-none"
        // At the play gate there's no "play anyway" — closing it would just resume into a broken turn.
        // A download in flight is the same: closing loses the progress view they need.
        hideClose={reason === 'play' || downloading}
        onInteractOutside={(e) => { if (reason === 'play' || downloading) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (reason === 'play' || downloading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {downloading ? (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatModelSize(progress.received)} / {formatModelSize(progress.total)} ({pct}%)
              </span>
              <Button size="sm" variant="ghost" onClick={() => cancelLocalDownload()}>Pause</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can keep browsing while this downloads — the game starts on its own once it’s ready.
            </p>
          </div>
        ) : custom || blocker === 'engineDown' ? null : (
          <div className="space-y-3">
            {recommended && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="font-medium">
                  {recommended.name}{' '}
                  <span className="text-xs text-muted-foreground">
                    {recommended.params} · {recommended.quant} · {formatModelSize(recommended.sizeBytes)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{recommended.note}</p>
                <Button onClick={() => startDownload(recommended)}>
                  Download ({formatModelSize(recommended.sizeBytes)})
                </Button>
              </div>
            )}
            {!showAll ? (
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setShowAll(true)}>
                Show all models
              </Button>
            ) : (
              <div className="space-y-2">
                {LOCAL_MODELS.filter((m) => m.id !== recommended?.id).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.params} · {formatModelSize(m.sizeBytes)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => startDownload(m)}>
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-start">
          <Button variant="outline" onClick={onOpenSettings}>Open Settings</Button>
          {/* Only the first-run prompt is skippable — they can look around before committing to a download. */}
          {reason === 'firstRun' && !downloading && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Later</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
