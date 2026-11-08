import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCudaStatus } from '@/components/modals/CudaEngineRow';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { formatModelSize } from '@/lib/localModels';

/** Set once the CUDA offer has been answered, on this device only, so it never shows again. */
export const CUDA_PROMPT_SEEN_KEY = 'FORMAMORPH_cudaPromptSeen';

const promptSeen = (): boolean => {
  try { return localStorage.getItem(CUDA_PROMPT_SEEN_KEY) !== null; } catch { return false; }
};
const markPromptSeen = () => {
  try { localStorage.setItem(CUDA_PROMPT_SEEN_KEY, '1'); } catch { /* the notice still closes for this session */ }
};

interface CudaNoticeProps {
  /** Both zips, summed. */
  downloadBytes: number;
  onDownload: () => void;
  onDismiss: () => void;
}

/** The card that offers the CUDA engine. Bottom-right and non-modal, so the menu stays usable. */
export function CudaNotice({ downloadBytes, onDownload, onDismiss }: CudaNoticeProps) {
  return (
    <div
      role="region"
      aria-label="CUDA Engine"
      className="fixed bottom-4 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-lg border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-label font-medium">Faster Engine for Your NVIDIA Card</p>
          <p className="text-helper text-muted-foreground">
            Download the CUDA engine (about {formatModelSize(downloadBytes)}) to run your model faster. You can also get it later in Local Model settings.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>Not Now</Button>
        <Button size="sm" onClick={onDownload}>Download</Button>
      </div>
    </div>
  );
}

const OPEN_MODAL = '[role="dialog"]:not([aria-modal="false"]):not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"])';

/** True while any modal dialog is open anywhere in the document, wherever its state lives. */
function useModalOpen(): boolean {
  const [open, setOpen] = useState(() => document.querySelector(OPEN_MODAL) !== null);
  useEffect(() => {
    const check = () => setOpen(document.querySelector(OPEN_MODAL) !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'aria-modal', 'role'] });
    return () => observer.disconnect();
  }, []);
  return open;
}

/**
 * Offers the CUDA engine once per device: the first time the built-in engine starts on a card that can
 * run it, with no CUDA install. The card stays back while `held` is set (intro, first-run step) or a modal dialog is open.
 */
export function CudaNoticeHost({ held }: { held: boolean }) {
  const modalOpen = useModalOpen();
  const status = useCudaStatus();
  const engine = useLocalLlmStatus();
  const [armed, setArmed] = useState(false);
  const [answered, setAnswered] = useState(promptSeen);

  const offerable = !!status && status.nvidia && status.support?.supported === true && status.state === 'not-installed';
  const engineStarted = engine.status === 'loading' || engine.status === 'ready';

  useEffect(() => {
    if (!armed && !answered && offerable && engineStarted) setArmed(true);
  }, [armed, answered, offerable, engineStarted]);

  const answer = () => { markPromptSeen(); setAnswered(true); };

  const bridge = window.formamorphDesktop?.cuda;
  if (!armed || answered || held || modalOpen || !offerable || !bridge || !status) return null;
  return (
    <CudaNotice
      downloadBytes={status.downloadBytes}
      onDismiss={answer}
      onDownload={() => { answer(); bridge.install().catch(() => { /* the pushed status shows the result in the engine row */ }); }}
    />
  );
}
