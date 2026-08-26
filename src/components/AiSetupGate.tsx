import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  LOCAL_MODELS, formatModelSize, tierForVram, type LocalModelInfo, type VramTier,
} from '@/lib/localModels';
import { useVramStats } from '@/lib/useVramStats';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useSettings } from '@/contexts/SettingsContext';
import { isCrossOriginEmbed, isLocalEndpoint, openInOwnTab, shouldOfferPopOut } from '@/lib/localNetworkEmbed';
import type { AiBlocker, AiMode } from '@/lib/useAiReachable';
import {
  downloadLocalModel, cancelLocalDownload, subscribeLocalDownload, DOWNLOAD_PAUSED,
  type LocalDownloadProgress,
} from '@/lib/imageGen/desktop';

/** Why the gate opened: after the first-run intro, or on entering a world with the AI unreachable. Both are
 *  dismissible — the gate warns, it doesn't trap. A failed turn is recoverable; a modal with no exit isn't. */
export type GateReason = 'firstRun' | 'play';

/** How often the gate re-probes a custom endpoint. Tuned to human scale — starting a server takes seconds. */
const ENDPOINT_POLL_MS = 3000;

/** The catalog is ordered best-first within each tier by screen ranking (see localModels.ts), so the tier's
 *  first entry is its recommended pick. (Was "largest that fits" — size is a poor proxy for quality; it would
 *  push the untested 70B in No-Limit over the top-scoring 31B.) */
function recommendFor(tier: VramTier): LocalModelInfo | null {
  return LOCAL_MODELS.find((m) => m.tier === tier) ?? null;
}

/**
 * The "your AI isn't set up yet" gate. On the bundled desktop engine it offers a one-click download sized to
 * the detected GPU (full tier list behind "Show all"); on any custom endpoint it points at Settings instead,
 * since we can't fix someone else's server for them. A download runs in the background — the gate keeps
 * showing progress and calls `onReady` the moment the engine comes up, so a queued launch resumes itself.
 */
export function AiSetupGate({ open, reason, mode, blocker, reachable, recheck, onOpenChange, onOpenSettings, onReady }: {
  open: boolean;
  reason: GateReason;
  mode: AiMode;
  blocker: AiBlocker | null;
  /** Live reachability from `useAiReachable` — drives the custom endpoint's auto-resume. */
  reachable: boolean | null;
  /** Re-probe the configured AI. Polled while the gate is open, and behind the "Try again" button. */
  recheck: () => void;
  onOpenChange: (v: boolean) => void;
  onOpenSettings: () => void;
  /** Fired when the engine becomes ready while the gate is open (download finished + model loaded). */
  onReady: () => void;
}) {
  const engine = useLocalLlmStatus();
  // Read from context rather than taken as a prop: it must be the exact URL the probe used, and a
  // caller passing its own copy is how the two would drift apart.
  const { activeEndpointUrl } = useSettings();
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
  // Local only — the bundled engine can be running even when the user is pointed at a custom endpoint,
  // and that says nothing about whether *their* endpoint answers.
  useEffect(() => {
    if (open && mode === 'local' && engine.status === 'ready') onReady();
  }, [open, mode, engine.status, onReady]);

  // A custom endpoint has no status to subscribe to, so poll it while the gate is up. This is what lets
  // "start LM Studio, come back" resolve itself, matching how the local engine already self-heals.
  useEffect(() => {
    if (!open || mode !== 'custom') return;
    const id = setInterval(recheck, ENDPOINT_POLL_MS);
    return () => clearInterval(id);
  }, [open, mode, recheck]);

  useEffect(() => {
    if (open && mode === 'custom' && reachable === true) onReady();
  }, [open, mode, reachable, onReady]);

  const recommended = useMemo(() => recommendFor(tier), [tier]);
  const downloading = progress !== null;
  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0;

  const startDownload = async (m: LocalModelInfo) => {
    setError(null);
    setProgress({ fileName: m.fileName, received: 0, total: m.sizeBytes, done: false });
    try {
      // Always loads on finish, whatever the auto-load setting says: the gate resolves on the engine
      // reaching ready, so a download that didn't load would leave it waiting forever.
      await downloadLocalModel({ url: m.url, fileName: m.fileName });
    } catch (e) {
      // A pause is a choice, not a failure.
      if (!(e as Error).message.includes(DOWNLOAD_PAUSED)) setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const custom = mode === 'custom';

  // An embedded page can't reach the player's own machine unless the embedding site delegates the
  // browser's local-network permission — and itch's game frame doesn't. The probe can't see that (the
  // denial is an opaque TypeError), so the situation is what names it: inside a frame, pointed at a
  // local address, and not answering. Same failure, a truer explanation and a remedy that works.
  const embedBlocked = useMemo(() => shouldOfferPopOut({
    embedded: isCrossOriginEmbed(),
    localEndpoint: isLocalEndpoint(activeEndpointUrl),
    probeFailed: custom && blocker === 'unreachable',
  }), [activeEndpointUrl, custom, blocker]);

  const title = blocker === 'unknownModel'
    ? 'No model loaded on your server'
    : embedBlocked
    ? 'This site’s embed is blocking your server'
    : custom
    ? 'Can’t reach your endpoint'
    : blocker === 'engineDown'
    ? 'Your model didn’t load'
    : 'Set up your AI';
  const description = blocker === 'unknownModel'
    ? 'Your endpoint is answering, but it has no model loaded and doesn’t recognize the model name Formamorph is set to ask for — so every turn would fail. Load a model, or set the model name to one your server lists.'
    : embedBlocked
    ? 'Formamorph is running inside another site’s page, and browsers don’t let an embedded page reach servers on your machine or local network. Open it in its own tab and your browser will ask your permission instead.'
    : custom
    ? 'Formamorph couldn’t get a response from your custom endpoint. Check that the server is running and the URL is right.'
    : blocker === 'engineDown'
    ? 'A model is installed but the engine couldn’t load it — it may not fit in VRAM at the current settings.'
    : 'Formamorph runs its AI on your own machine. Download a model to start playing — no account, no endpoint setup.';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !downloading) onOpenChange(false); }}>
      <DialogContent
        className="w-[min(96vw,560px)] max-w-none"
        // Dismissible in both reasons: the gate is a warning, not a cell. Only a download in flight holds it
        // open, since closing would lose the progress view they need.
        hideClose={downloading}
        onInteractOutside={(e) => { if (downloading) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (downloading) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-helper text-destructive">{error}</p>}

        {downloading ? (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex items-center justify-between text-meta text-muted-foreground">
              <span>
                {formatModelSize(progress.received)} / {formatModelSize(progress.total)} ({pct}%)
              </span>
              <Button size="sm" variant="ghost" onClick={() => cancelLocalDownload()}>Pause</Button>
            </div>
            <p className="text-helper text-muted-foreground">
              You can keep browsing while this downloads — the game starts on its own once it’s ready.
            </p>
          </div>
        ) : blocker === 'unknownModel' ? (
          <p className="text-helper text-muted-foreground">
            Load a model in LM Studio and this continues on its own — no need to reload.
          </p>
        ) : embedBlocked ? (
          <p className="text-helper text-muted-foreground">
            It’s the same game at the same address, so your saves and settings come with you — allow the
            prompt when it appears. If the new tab still can’t connect, check that your server is running
            and that the Endpoint URL is right.
          </p>
        ) : custom ? (
          <p className="text-helper text-muted-foreground">
            Start your server and this will continue on its own — no need to reload.
          </p>
        ) : blocker === 'engineDown' ? null : (
          <div className="space-y-3">
            {recommended && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="font-medium">
                  {recommended.name}{' '}
                  <span className="text-meta text-muted-foreground">
                    {recommended.params} · {recommended.quant} · {formatModelSize(recommended.sizeBytes)}
                  </span>
                </div>
                <p className="text-helper text-muted-foreground">{recommended.note}</p>
                <Button onClick={() => startDownload(recommended)}>
                  Download ({formatModelSize(recommended.sizeBytes)})
                </Button>
              </div>
            )}
            {!showAll ? (
              <Button variant="link" className="h-auto p-0 text-helper" onClick={() => setShowAll(true)}>
                Show all models
              </Button>
            ) : (
              <div className="space-y-2">
                {LOCAL_MODELS.filter((m) => m.id !== recommended?.id).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div className="min-w-0">
                      <div className="truncate text-label font-medium">{m.name}</div>
                      <div className="text-meta text-muted-foreground">{m.params} · {formatModelSize(m.sizeBytes)}</div>
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
          {/* Same origin, so the new tab carries the same saves and settings — and is the top-level page
              the browser will offer its local-network prompt for. */}
          {embedBlocked && <Button onClick={openInOwnTab}>Open in a New Tab</Button>}
          {/* The poll gets there on its own; this is for people who'd rather not wait for the next tick. */}
          {custom && (
            <Button variant={embedBlocked ? 'outline' : 'default'} onClick={recheck} disabled={reachable === null}>
              {reachable === null ? 'Checking…' : 'Try again'}
            </Button>
          )}
          <Button variant="outline" onClick={onOpenSettings}>Open Settings</Button>
          {/* Always skippable: at first run they can look around before committing to a download; in a world
              they can read and explore, and the turn simply fails until the AI answers. */}
          {!downloading && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {reason === 'play' ? 'Continue anyway' : 'Later'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
