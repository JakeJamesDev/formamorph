import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Hint, FieldError } from '@/components/ui/typography';
import { Row } from '@/components/SettingsRows';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { rowCopy } from './settingsRowCopy';
import { formatModelSize } from '@/lib/localModels';
import { useMountedRef } from '@/lib/useMountedRef';
import type { CudaInstallError, CudaStatus, CudaSupport, LocalLlmState } from '@/lib/imageGen/desktop';

export const CUDA_EULA_URL = 'https://docs.nvidia.com/cuda/eula/index.html';
export const NVIDIA_DRIVERS_URL = 'https://www.nvidia.com/en-us/drivers/';

const LINK = 'text-primary hover:underline';

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>{children}</a>;
}

/** Live CUDA install status: read once on mount, then from pushed changes. Null off desktop. */
export function useCudaStatus(): CudaStatus | null {
  const [status, setStatus] = useState<CudaStatus | null>(null);
  useEffect(() => {
    const bridge = window.formamorphDesktop?.cuda;
    if (!bridge) return;
    let active = true;
    bridge.status().then((s) => { if (active) setStatus(s); }).catch(() => { /* leave the row hidden */ });
    const unsubscribe = bridge.onStatus((s) => { if (active) setStatus(s); });
    return () => { active = false; unsubscribe(); };
  }, []);
  return status;
}

function UnsupportedReason({ support }: { support: CudaSupport | null }) {
  if (support && !support.supported && support.reason === 'driver-too-old') {
    return (
      <Hint>
        Your NVIDIA driver is too old for CUDA. Update it to version {support.driverFloor} or later.{' '}
        <ExternalLink href={NVIDIA_DRIVERS_URL}>Get the Latest Driver</ExternalLink>
      </Hint>
    );
  }
  if (support && !support.supported && support.reason === 'card-too-old') {
    return <Hint>Your {support.cardName ?? 'graphics card'} is too old for CUDA.</Hint>;
  }
  return <Hint>Couldn’t read your NVIDIA driver details, so CUDA isn’t available.</Hint>;
}

function InstallError({ error }: { error: CudaInstallError }) {
  if (error.kind === 'no-space') {
    return (
      <FieldError>
        Not enough free space. CUDA needs {formatModelSize(error.neededBytes)}, and the drive has {formatModelSize(error.freeBytes)} free.
      </FieldError>
    );
  }
  if (error.kind === 'digest') return <FieldError>The download was damaged, so it was deleted. Download it again.</FieldError>;
  return <FieldError>The download failed ({error.message}). Check your connection, then try again.</FieldError>;
}

const PHASE_TEXT = { verify: 'Checking the files…', unpack: 'Installing…' } as const;
const UPDATING_TEXT = 'CUDA needs new files for this version. The engine uses Vulkan until they’re installed.';

/**
 * The Local Model panel's CUDA row, on machines whose nvidia-smi lists an NVIDIA card. Download, progress,
 * Cancel (which keeps the partials for a resume) and Remove, which asks first when the engine runs.
 * `status` comes from the panel's `useCudaStatus`.
 */
export function CudaEngineRow({ engine, status }: { engine: LocalLlmState; status: CudaStatus | null }) {
  const mounted = useMountedRef();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const bridge = window.formamorphDesktop?.cuda;
  if (!status?.nvidia || !bridge) return null;

  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    try { await call(); } catch { /* the pushed status shows the result */ } finally { if (mounted.current) setBusy(false); }
  };
  const engineRuns = engine.status === 'ready' || engine.status === 'loading';
  const onRemove = () => (engineRuns ? setConfirmRemove(true) : void run(bridge.remove));

  let body: ReactNode;
  if (status.state === 'unsupported') {
    body = (
      <div className="grid gap-2">
        <UnsupportedReason support={status.support} />
        {status.hasFiles && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
          </div>
        )}
      </div>
    );
  } else if (status.state === 'downloading') {
    const pct = status.total ? Math.round((status.received / status.total) * 100) : 0;
    body = (
      <div className="grid gap-2">
        <Progress value={status.phase === 'download' ? pct : 100} aria-label="CUDA download" />
        <div className="flex items-center justify-between gap-3">
          <Hint>
            {status.phase === 'download'
              ? `${formatModelSize(status.received)} of ${formatModelSize(status.total)}`
              : PHASE_TEXT[status.phase]}
          </Hint>
          {status.phase === 'download' && (
            <Button type="button" variant="outline" size="sm" onClick={() => void bridge.cancel()}>Cancel</Button>
          )}
        </div>
        {status.replacing && <Hint>{UPDATING_TEXT}</Hint>}
      </div>
    );
  } else if (status.state === 'installed') {
    body = (
      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <Hint>Installed</Hint>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
        </div>
        {status.failedLastTime && (
          <div className="flex items-center gap-3">
            <Hint>CUDA couldn’t load a model last time.</Hint>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(bridge.retry)}>Retry CUDA</Button>
          </div>
        )}
        {/* A driver rollback after the install: the files stay, and the reason still shows. */}
        {status.support && !status.support.supported && <UnsupportedReason support={status.support} />}
      </div>
    );
  } else {
    const resume = status.partialBytes > 0;
    body = (
      <div className="grid gap-2">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(bridge.install)}>
            {resume ? 'Resume Download' : `Download (${formatModelSize(status.downloadBytes)})`}
          </Button>
          {resume && <Hint>{formatModelSize(status.partialBytes)} of {formatModelSize(status.downloadBytes)} downloaded</Hint>}
        </div>
        {status.state === 'stale' && <Hint>{UPDATING_TEXT}</Hint>}
        {status.error && <InstallError error={status.error} />}
      </div>
    );
  }

  // The description sits between the control and the license line, so the row's own hint slot stays empty.
  const { hint: description, ...copy } = rowCopy('localCuda');
  return (
    <Row {...copy}>
      <div className="grid gap-1">
        {body}
        <Hint>{description}</Hint>
        <Hint>
          These are NVIDIA’s CUDA libraries, under NVIDIA’s license. <ExternalLink href={CUDA_EULA_URL}>CUDA EULA</ExternalLink>
        </Hint>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove CUDA?"
        description="This stops the engine and unloads your model. You can load it again afterward."
        confirmLabel="Remove"
        destructive
        onConfirm={() => void run(bridge.remove)}
      />
    </Row>
  );
}
