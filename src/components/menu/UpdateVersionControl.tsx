import { useState } from 'react';
import { APP_VERSION } from '@/lib/version';
import { BUILD_TAG } from '@/lib/buildInfo';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatModelSize } from '@/lib/localModels';
import { useSettings } from '@/contexts/SettingsContext';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';
import { UpdateDialog } from '@/components/modals/UpdateDialog';
import { updateBridge } from '@/lib/updates/updateBridge';
import { Tip } from '@/components/ui/tooltip';

/** Footer version line for every build that can install an update: the version number opens the update
 *  dialog, gains a " — Update Available!" tag when a newer release exists, and shows download progress →
 *  an apply button underneath. Mounted only where a bridge exists, so the browser never checks for or
 *  shows updates. */
export function UpdateVersionControl() {
  const { updateChannel } = useSettings();
  const { state, check, download, applyUpdate } = useUpdateChecker(updateChannel);
  const [dialogOpen, setDialogOpen] = useState(false);
  const updateReady = state.phase === 'available' || state.phase === 'downloaded' || state.phase === 'downloading';
  // Android hands the file to the system installer and the player confirms there, so nothing restarts on
  // this button's say-so. The desktop shell swaps the build and relaunches itself.
  const applyLabel = updateBridge()?.kind === 'android' ? 'Install' : 'Update & Restart';

  return (
    <div className="flex flex-col items-start gap-1">
      <Tip tip="Check for updates">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="text-meta text-muted-foreground/60 select-none cursor-pointer hover:text-muted-foreground transition-colors"
        >
          v{APP_VERSION}{BUILD_TAG && ` · ${BUILD_TAG}`}
          {updateReady && <span className="text-info"> — Update Available!</span>}
        </button>
      </Tip>

      {state.phase === 'downloading' && (
        <div className="w-44 space-y-0.5">
          <Progress value={state.downloadPct ?? 0} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {/* A chunked response reports no length. Counting up alone beats a total that is a lie. */}
            {formatModelSize(state.bytesReceived ?? 0)}
            {(state.bytesTotal ?? 0) > 0 && ` / ${formatModelSize(state.bytesTotal ?? 0)} (${state.downloadPct ?? 0}%)`}
          </div>
        </div>
      )}

      {state.phase === 'downloaded' && (
        <Button size="sm" variant="outline" className="h-6 px-2 text-meta" onClick={applyUpdate}>
          {applyLabel}
        </Button>
      )}

      <UpdateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        state={state}
        onCheck={check}
        onDownload={() => { download(); setDialogOpen(false); }}
      />
    </div>
  );
}
