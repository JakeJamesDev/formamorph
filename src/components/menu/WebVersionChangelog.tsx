import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChangelogBody, FullChangelogLink } from '@/components/ChangelogUi';
import { APP_VERSION } from '@/lib/version';
import { BUILD_TAG } from '@/lib/buildInfo';
import { checkForUpdate } from '@/services/UpdateService';

/** Web footer version: there's no self-update, but clicking still shows the latest release's notes. Fetches
 *  lazily on first open (never on load / on a timer, unlike the desktop checker) and links to the full wiki
 *  changelog. Mounted only on the web build; desktop uses UpdateVersionControl. */
export function WebVersionChangelog() {
  const [open, setOpen] = useState(false);
  const [changelog, setChangelog] = useState<string | null>(null); // null until first fetch resolves
  const [updateVersion, setUpdateVersion] = useState<string | undefined>(); // newest version, if an update exists
  const [loading, setLoading] = useState(false);

  const openDialog = () => {
    setOpen(true);
    if (changelog === null && !loading) {
      setLoading(true);
      void checkForUpdate('stable').then((res) => {
        setChangelog(res.success ? (res.result?.changelog ?? '') : '');
        setUpdateVersion(res.success && res.result?.available ? res.result.latestVersion : undefined);
        setLoading(false);
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="text-xs text-muted-foreground/60 select-none cursor-pointer hover:text-muted-foreground transition-colors"
        title="What’s new"
      >
        v{APP_VERSION}{BUILD_TAG && ` · ${BUILD_TAG}`}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} hideClose className="max-w-3xl">
          <DialogHeader><DialogTitle>What’s new</DialogTitle></DialogHeader>
          <ChangelogBody
            text={loading ? undefined : (changelog ?? undefined)}
            placeholder={loading ? 'Loading release notes…' : 'No release notes available.'}
            currentVersion={APP_VERSION}
            updateVersion={updateVersion}
          />
          <div className="flex items-center justify-between gap-2">
            <FullChangelogLink />
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
