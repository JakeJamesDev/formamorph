import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChangelogBody, FullChangelogLink } from '@/components/ChangelogUi';
import { useSettings } from '@/contexts/SettingsContext';
import type { UpdateChannel } from '@/contexts/settingsDefaults';
import type { UpdateState } from '@/lib/updates/updateState';
import { updateDialogTitle } from '@/lib/updates/updateDialogTitle';

/** The update popout reached by clicking the footer version number. Shows the release channel selector plus,
 *  depending on phase, an available-update view (new version + notes + Download), a download view (same notes,
 *  Close only) or an up-to-date view (current notes + Check for updates). Download/apply are driven by the
 *  parent (per-platform). */
export function UpdateDialog({ open, onOpenChange, state, onCheck, onDownload }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  state: UpdateState;
  onCheck: () => void;
  onDownload: () => void;
}) {
  const { setUpdateChannel } = useSettings();
  const available = state.phase === 'available';
  const inFlight = state.phase === 'downloading' || state.phase === 'downloaded';
  const checking = state.phase === 'checking';
  const title = updateDialogTitle(state);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="flex items-center justify-between text-label">
          <span className="text-muted-foreground">Release channel</span>
          <Select value={state.channel} onValueChange={(v) => setUpdateChannel(v as UpdateChannel)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stable">Stable</SelectItem>
              <SelectItem value="prerelease">Pre-release</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.phase === 'error' ? (
          <p className="text-label text-destructive">{state.error}</p>
        ) : (
          <ChangelogBody
            text={state.changelog}
            placeholder="No release notes"
            currentVersion={state.currentVersion}
            updateVersion={available || inFlight ? state.latestVersion : undefined}
          />
        )}

        <DialogFooter className="items-center">
          <FullChangelogLink />
          {available ? (
            <>
              <Button variant="outline" className="sm:ml-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={onDownload}>Download</Button>
            </>
          ) : inFlight ? (
            <Button variant="outline" className="sm:ml-auto" onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <Button className="sm:ml-auto" onClick={onCheck} disabled={checking}>{checking ? 'Checking…' : 'Check for updates'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
