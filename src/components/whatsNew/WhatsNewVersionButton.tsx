import { APP_VERSION } from '@/lib/version';
import { BUILD_TAG } from '@/lib/buildInfo';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { formatModelSize } from '@/lib/localModels';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { isUpdatePending } from '@/lib/updates/updateState';
import { applyLabel, useWhatsNew } from './whatsNewContext';

/** The footer version text. It opens What's New; on a build with an update bridge it also carries the
 *  "Update Available" tag, the download progress and the apply button. */
export function WhatsNewVersionButton() {
  const { openWhatsNew, checker } = useWhatsNew();
  const state = checker?.state;
  const updateReady = state ? isUpdatePending(state.phase) : false;

  return (
    <div className="flex flex-col items-start gap-1">
      <Tip tip="What’s New">
        <button
          type="button"
          onClick={openWhatsNew}
          {...targetAttribute('mainMenu', 'app-version')}
          className="text-meta text-muted-foreground/60 select-none cursor-pointer hover:text-muted-foreground transition-colors"
        >
          v{APP_VERSION}{BUILD_TAG && ` · ${BUILD_TAG}`}
          {updateReady && <span className="text-info"> · Update Available</span>}
        </button>
      </Tip>

      {state?.phase === 'downloading' && (
        <div className="w-44 space-y-0.5">
          <Progress value={state.downloadPct ?? 0} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {/* A chunked response reports no length, so the count runs up alone. */}
            {formatModelSize(state.bytesReceived ?? 0)}
            {(state.bytesTotal ?? 0) > 0 && ` / ${formatModelSize(state.bytesTotal ?? 0)} (${state.downloadPct ?? 0}%)`}
          </div>
        </div>
      )}

      {state?.phase === 'downloaded' && checker && (
        <Button size="sm" variant="outline" className="h-6 px-2 text-meta" onClick={checker.applyUpdate}>
          {applyLabel()}
        </Button>
      )}
    </div>
  );
}
