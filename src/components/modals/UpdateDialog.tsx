import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { useSettings } from '@/contexts/SettingsContext';
import type { UpdateChannel } from '@/contexts/settingsDefaults';
import type { UpdateState } from '@/lib/updates/updateState';

/** The update popout reached by clicking the footer version number. Shows the release channel selector plus,
 *  depending on state, either an available-update view (new version + notes + Download) or an up-to-date view
 *  (current notes + Check for updates). Download/apply are driven by the parent (per-platform). */
export function UpdateDialog({ open, onOpenChange, state, onCheck, onDownload }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  state: UpdateState;
  onCheck: () => void;
  onDownload: () => void;
}) {
  const { setUpdateChannel } = useSettings();
  const available = state.phase === 'available';
  const checking = state.phase === 'checking';
  const title = available
    ? `Update available — ${state.latestVersion}`
    : state.phase === 'error'
      ? 'Couldn’t check for updates'
      : 'You’re up to date';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="flex items-center justify-between text-sm">
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
          <p className="text-sm text-destructive">{state.error}</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
            {state.changelog
              ? <MarkdownRenderer text={state.changelog} />
              : <span className="text-muted-foreground">No release notes.</span>}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {available ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={onDownload}>Download</Button>
            </>
          ) : (
            <Button onClick={onCheck} disabled={checking}>{checking ? 'Checking…' : 'Check for updates'}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
