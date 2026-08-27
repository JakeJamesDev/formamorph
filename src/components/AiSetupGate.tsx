import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  VRAM_TIERS, formatModelSize, groupModelsByFit, tierForVram, type LocalModelInfo, type VramTier,
} from '@/lib/localModels';
import { fmtGB, useVramStats } from '@/lib/useVramStats';
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

/** Where the local setup flow is: picking a model, fetching it, loading it, or done. */
type SetupPhase = 'choose' | 'downloading' | 'loading' | 'ready';

// One toast at a time in each role, so a dismissed gate can update its progress line in place rather than
// stacking a new toast per event. Both live in the app's shared notification region.
const PROGRESS_TOAST = 'ai-setup-progress';
const READY_TOAST = 'ai-setup-ready';

/** A model's row in the setup list: what it is, what it costs, and one line on how it writes. */
function ModelRow({ model, recommended, dimmed, onDownload }: {
  model: LocalModelInfo;
  recommended?: boolean;
  dimmed?: boolean;
  onDownload: () => void;
}) {
  return (
    <div className={cn(
      'flex items-start justify-between gap-3 rounded-md border border-border p-3',
      recommended && 'border-primary/50 bg-primary/5',
      // Dimmed, not disabled: a warning the player can overrule on their own hardware.
      dimmed && 'opacity-55',
    )}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-medium">{model.name}</span>
          {recommended && <Badge>Recommended</Badge>}
          {model.reasoning && <Badge variant="outline">Reasoning</Badge>}
        </div>
        <div className="text-meta text-muted-foreground">
          {model.params} · {model.quant} · {formatModelSize(model.sizeBytes)}
        </div>
        <p className="mt-1 text-helper text-muted-foreground">{model.note}</p>
      </div>
      <Button size="sm" variant={recommended ? 'default' : 'outline'} className="shrink-0" onClick={onDownload}>
        Download
      </Button>
    </div>
  );
}

/** One titled block of the fit-grouped list. Renders nothing when its group is empty. */
function Section({ title, helper, models, recommendedId, dimmed, onDownload }: {
  title: string;
  helper?: string;
  models: LocalModelInfo[];
  recommendedId?: string;
  dimmed?: boolean;
  onDownload: (m: LocalModelInfo) => void;
}) {
  if (models.length === 0) return null;
  return (
    <div className="space-y-2">
      <div>
        <div className="text-meta font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
        {helper && <p className="text-helper text-muted-foreground">{helper}</p>}
      </div>
      <div className="space-y-2">
        {models.map((m) => (
          <ModelRow
            key={m.id}
            model={m}
            recommended={m.id === recommendedId}
            dimmed={dimmed}
            onDownload={() => onDownload(m)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The "your AI isn't set up yet" gate. On the bundled desktop engine it walks the player from a
 * GPU-sized recommendation through the download and the weight load to a success step; on any custom
 * endpoint it points at Settings instead, since we can't fix someone else's server for them.
 *
 * Nothing here traps the player. Closing mid-flight hands the download to a toast in the app's shared
 * notification region, and a completion toast says when the engine came up.
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
  /** Fired when the player takes the success step's action, or when a custom endpoint starts answering. */
  onReady: () => void;
}) {
  const engine = useLocalLlmStatus();
  // Read from context rather than taken as a prop: it must be the exact URL the probe used, and a
  // caller passing its own copy is how the two would drift apart.
  const { activeEndpointUrl } = useSettings();
  const vram = useVramStats('', { enabled: open && mode === 'local' });
  const [tier, setTier] = useState<VramTier>('tier8');
  const [showAll, setShowAll] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('choose');
  const [picked, setPicked] = useState<LocalModelInfo | null>(null);
  const [progress, setProgress] = useState<LocalDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True between dismissing the gate mid-flight and the engine coming up: the window the toast covers.
  const [handedOff, setHandedOff] = useState(false);
  const tieredRef = useRef(false);
  const pickedRef = useRef<LocalModelInfo | null>(null);
  const progressToastRef = useRef(false);
  const wasOpenRef = useRef(false);

  // Size the recommendation to the detected GPU, once per open.
  useEffect(() => {
    if (!open) { tieredRef.current = false; return; }
    if (tieredRef.current) return;
    const total = vram.status === 'online' ? vram.gpus[0]?.totalMB : null;
    if (total) { setTier(tierForVram(total)); tieredRef.current = true; }
  }, [open, vram]);

  // Progress events are broadcast to every listener, so match them against the file this gate asked for.
  // A download started elsewhere (the model manager) adopts the gate only when it has nothing of its own.
  useEffect(() => subscribeLocalDownload((p) => {
    if (pickedRef.current && p.fileName !== pickedRef.current.fileName) return;
    if (p.done) { setProgress(null); setPhase('loading'); return; }
    setProgress(p);
    setPhase('downloading');
  }), []);

  // Once the engine is up the gate has done its job. Local gets a success step the player closes with an
  // explicit action; engine-down never runs the download flow, so it keeps resolving straight through.
  useEffect(() => {
    if (mode !== 'local' || engine.status !== 'ready') return;
    if (open && blocker === 'engineDown') { onReady(); return; }
    setPhase('ready');
  }, [open, mode, engine.status, blocker, onReady]);

  // A load that fails is the engine-down case, not a stall. Without this the loading state spins forever
  // on the exact failure the gate exists to explain.
  useEffect(() => {
    if (mode !== 'local' || engine.status !== 'error') return;
    setPhase((p) => (p === 'loading' ? 'choose' : p));
    setError(engine.error ?? 'The engine couldn’t load that model.');
  }, [mode, engine.status, engine.error]);

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

  // Reopening takes the flow back from the toasts: the dialog is the fuller view of the same state.
  useEffect(() => {
    if (open === wasOpenRef.current) return;
    wasOpenRef.current = open;
    if (!open) return;
    setHandedOff(false);
    setShowAll(false);
    setError(null);
    setPhase((p) => (p === 'ready' ? 'choose' : p));
    if (progressToastRef.current) { toast.dismiss(PROGRESS_TOAST); progressToastRef.current = false; }
    toast.dismiss(READY_TOAST);
  }, [open]);

  const groups = useMemo(() => groupModelsByFit(tier), [tier]);
  const recommended = groups.recommended;
  const pct = progress && progress.total ? Math.round((progress.received / progress.total) * 100) : 0;
  const workingName = picked?.name ?? 'your model';
  const readyName = picked?.name ?? engine.modelId ?? 'Your model';

  // Progress toast for a gate dismissed mid-flight. The app has one notification region, so the handoff
  // goes there rather than into a corner of its own.
  useEffect(() => {
    if (!handedOff || phase === 'ready') return; // the completion toast below owns the finished handoff
    if (phase === 'choose') {
      // The work stopped without finishing — a failed download, or a load the engine gave up on. Leaving
      // the toast up would claim work that ended, and hide why it ended.
      if (progressToastRef.current) { toast.dismiss(PROGRESS_TOAST); progressToastRef.current = false; }
      setHandedOff(false);
      if (error) toast.error(`Setup stopped: ${error}`);
      return;
    }
    const body = phase === 'loading' ? (
      <div>
        <div>Loading {workingName}…</div>
        <div className="text-meta text-muted-foreground">Download complete · loading into your GPU.</div>
      </div>
    ) : (
      <div>
        <div>Downloading {workingName}…</div>
        <div className="text-meta text-muted-foreground">
          {formatModelSize(progress?.received ?? 0)} / {formatModelSize(progress?.total ?? 0)} ({pct}%)
        </div>
      </div>
    );
    // The loading phase has no byte figures, so hold the bar where the download left it rather than
    // emptying it at the one moment the download succeeded. react-toastify closes a toast whose
    // controlled bar reaches 1, so full stops just short.
    const bar = phase === 'loading' ? 0.99 : Math.min(pct / 100, 0.99);
    if (progressToastRef.current) toast.update(PROGRESS_TOAST, { render: body, progress: bar });
    else {
      toast(body, { toastId: PROGRESS_TOAST, autoClose: false, progress: bar });
      progressToastRef.current = true;
    }
  }, [handedOff, phase, progress, pct, workingName, error]);

  // The engine came up while the gate was dismissed: swap the progress line for the invitation the
  // success step would have shown.
  useEffect(() => {
    if (!handedOff || phase !== 'ready') return;
    if (progressToastRef.current) { toast.dismiss(PROGRESS_TOAST); progressToastRef.current = false; }
    toast(
      <div className="space-y-2">
        <div>
          <div>Your model is ready</div>
          <div className="text-meta text-muted-foreground">{readyName} is loaded and answering.</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { toast.dismiss(READY_TOAST); onOpenSettings(); }}>
          Open Settings
        </Button>
      </div>,
      { toastId: READY_TOAST, autoClose: false },
    );
    setHandedOff(false);
  }, [handedOff, phase, readyName, onOpenSettings]);

  const startDownload = async (m: LocalModelInfo) => {
    setError(null);
    setPicked(m);
    pickedRef.current = m;
    setPhase('downloading');
    setProgress({ fileName: m.fileName, received: 0, total: m.sizeBytes, done: false });
    try {
      // Always loads on finish, whatever the auto-load setting says: the gate's success step waits on the
      // engine reaching ready, and a download that didn't load would leave it waiting forever.
      await downloadLocalModel({ url: m.url, fileName: m.fileName });
      setProgress(null);
      setPhase('loading');
    } catch (e) {
      // A pause is a choice, not a failure: it drops back to the list with the partial kept on disk.
      if (!(e as Error).message.includes(DOWNLOAD_PAUSED)) setError((e as Error).message);
      pickedRef.current = null;
      setProgress(null);
      setPhase('choose');
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

  // The download-and-load walk, which only the bundled engine has. Every other branch keeps its own copy
  // and its single remedy.
  const localFlow = !custom && !embedBlocked && blocker !== 'unknownModel' && blocker !== 'engineDown';
  const inFlow = localFlow && phase !== 'choose';

  const gpu = vram.status === 'online' ? vram.gpus[0] : undefined;
  const tierLabel = VRAM_TIERS.find((t) => t.value === tier)?.label;
  const detected = gpu?.name && gpu.totalMB ? (
    <p className="text-meta text-muted-foreground">
      Detected: {gpu.name} · {fmtGB(gpu.totalMB)} GB VRAM{tierLabel ? ` · ${tierLabel} class` : ''}
    </p>
  ) : null;

  const title = phase === 'downloading' && inFlow
    ? `Downloading ${workingName}`
    : phase === 'loading' && inFlow
    ? 'Loading your model'
    : phase === 'ready' && inFlow
    ? 'You’re ready'
    : blocker === 'unknownModel'
    ? 'No model loaded on your server'
    : embedBlocked
    ? 'This site’s embed is blocking your server'
    : custom
    ? 'Can’t reach your endpoint'
    : blocker === 'engineDown'
    ? 'Your model didn’t load'
    : 'Set up your AI';
  const description = phase === 'downloading' && inFlow
    ? 'The model saves to your models folder and loads on its own when the download finishes.'
    : phase === 'loading' && inFlow
    ? `${workingName} is loading into your GPU. This can take a minute on the first load.`
    : phase === 'ready' && inFlow
    ? `${readyName} is loaded and answering on your machine.`
    : blocker === 'unknownModel'
    ? 'Your endpoint is answering, but it has no model loaded and doesn’t recognize the model name Formamorph is set to ask for — so every turn would fail. Load a model, or set the model name to one your server lists.'
    : embedBlocked
    ? 'Formamorph is running inside another site’s page, and browsers don’t let an embedded page reach servers on your machine or local network — only a tab of its own can ask your browser for that permission.'
    : custom
    ? 'Formamorph couldn’t get a response from your custom endpoint. Check that the server is running and the URL is right.'
    : blocker === 'engineDown'
    ? 'A model is installed but the engine couldn’t load it — it may not fit in VRAM at the current settings.'
    : localFlow && showAll
    ? 'Pick a model for your machine. Bigger models write better and run slower.'
    : 'Formamorph runs its AI on your own machine. Download a model to start playing — no account, no endpoint setup.';

  /** Close the dialog, handing an in-flight download or load to the toast on the way out. */
  const dismiss = () => {
    if (phase === 'downloading' || phase === 'loading') setHandedOff(true);
    onOpenChange(false);
  };

  const expanded = localFlow && phase === 'choose' && showAll;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className={cn('w-[min(96vw,560px)] max-w-none', expanded && 'flex h-[680px] max-h-[92dvh] flex-col')}>
        <DialogHeader className={cn(expanded && 'shrink-0')}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && <p className="text-helper text-destructive">{error}</p>}

        {inFlow && phase === 'downloading' ? (
          <div className="space-y-2">
            <Progress value={pct} />
            <div className="flex items-center justify-between text-meta text-muted-foreground">
              <span>
                {formatModelSize(progress?.received ?? 0)} / {formatModelSize(progress?.total ?? 0)} ({pct}%)
              </span>
              <Button size="sm" variant="ghost" onClick={() => cancelLocalDownload()}>Pause</Button>
            </div>
            <p className="text-helper text-muted-foreground">
              You can close this window — the download keeps going, and a toast shows the progress.
            </p>
          </div>
        ) : inFlow && phase === 'loading' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <div className="text-helper text-muted-foreground">Download complete · loading weights…</div>
            </div>
            <p className="text-helper text-muted-foreground">
              You can close this window — a toast tells you when it’s ready.
            </p>
          </div>
        ) : inFlow && phase === 'ready' ? (
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="text-helper text-muted-foreground">
              Everything runs locally — no account, no internet needed during play.
            </div>
          </div>
        ) : blocker === 'unknownModel' ? (
          <p className="text-helper text-muted-foreground">
            Load a model in LM Studio and this continues on its own — no need to reload.
          </p>
        ) : embedBlocked ? (
          <p className="text-helper text-muted-foreground">
            A new tab can connect — allow the prompt when it appears — but it starts with storage of its
            own, so worlds and saves made here stay here. Export anything you want to keep and import it
            in the new tab. For regular play on a local model, the desktop app connects directly; a cloud
            endpoint works right here in the embed.
          </p>
        ) : custom ? (
          <p className="text-helper text-muted-foreground">
            Start your server and this will continue on its own — no need to reload.
          </p>
        ) : blocker === 'engineDown' ? null : !showAll ? (
          <div className="space-y-3">
            {detected}
            {recommended && (
              <ModelRow model={recommended} recommended onDownload={() => startDownload(recommended)} />
            )}
            <Button variant="link" className="h-auto p-0 text-helper" onClick={() => setShowAll(true)}>
              Show all models
            </Button>
          </div>
        ) : (
          <>
            <div className="shrink-0">{detected}</div>
            {/* Fixed-height dialog + its own scroller: the full list is taller than any viewport, and a
                dialog that grows past the screen clips its own buttons off the bottom. */}
            <ScrollArea data-testid="model-list-scroll" className="-mr-3 min-h-0 flex-1 pr-3">
              <div className="space-y-5">
                <Section
                  title="Best for Your GPU"
                  models={groups.bestFit}
                  recommendedId={recommended?.id}
                  onDownload={startDownload}
                />
                <Section
                  title="Also Fits"
                  helper="Smaller models. Faster turns, simpler writing."
                  models={groups.alsoFits}
                  onDownload={startDownload}
                />
                <Section
                  title="Too Big for Your GPU"
                  helper="These need more video memory than your GPU has. They run very slowly, if at all."
                  models={groups.tooBig}
                  dimmed
                  onDownload={startDownload}
                />
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className={cn('gap-2 sm:justify-start', expanded && 'shrink-0')}>
          {inFlow && phase === 'ready' ? (
            <>
              <Button onClick={onReady}>{reason === 'play' ? 'Continue' : 'Start Playing'}</Button>
              <Button variant="outline" onClick={onOpenSettings}>Open Settings</Button>
            </>
          ) : inFlow ? (
            <Button variant="ghost" onClick={dismiss}>Close</Button>
          ) : (
            <>
              {expanded && (
                <Button variant="link" className="h-auto p-0 text-helper" onClick={() => setShowAll(false)}>
                  Show fewer models
                </Button>
              )}
              {/* Same origin but NOT the same storage: partitioning keys the embed's data under the embedding
                  site, so the tab starts fresh — the copy above says so. The tab's value is being top-level page
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
              <Button variant="ghost" onClick={dismiss}>
                {reason === 'play' ? 'Continue anyway' : 'Later'}
              </Button>
              {localFlow && !showAll && (
                <span className="self-center text-helper text-muted-foreground">
                  You can set this up anytime in Settings → Endpoints.
                </span>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
