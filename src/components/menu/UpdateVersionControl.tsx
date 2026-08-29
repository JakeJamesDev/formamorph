import { useState } from 'react';
import { APP_VERSION } from '@/lib/version';
import { BUILD_TAG } from '@/lib/buildInfo';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatModelSize } from '@/lib/localModels';
import { useSettings } from '@/contexts/SettingsContext';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';
import { UpdateDialog } from '@/components/modals/UpdateDialog';
import { Tip } from '@/components/ui/tooltip';

/** Desktop-only footer version line: the version number opens the update dialog, gains a " — Update
 *  Available!" tag when a newer release exists, and shows download progress → an "Update & Restart" button
 *  underneath. Mounted only under `isDesktop()` so the web build never checks for or shows updates. */
export function UpdateVersionControl() {
  const { updateChannel } = useSettings();
  const { state, check, download, applyAndRestart } = useUpdateChecker(updateChannel);
  const [dialogOpen, setDialogOpen] = useState(false);
  const updateReady = state.phase === 'available' || state.phase === 'downloaded' || state.phase === 'downloading';

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
            {formatModelSize(state.bytesReceived ?? 0)} / {formatModelSize(state.bytesTotal ?? 0)} ({state.downloadPct ?? 0}%)
          </div>
        </div>
      )}

      {state.phase === 'downloaded' && (
        <Button size="sm" variant="outline" className="h-6 px-2 text-meta" onClick={applyAndRestart}>
          Update &amp; Restart
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
