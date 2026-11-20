import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, dialogTitleRow } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hint, Meta } from '@/components/ui/typography';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChangelogBody, FullChangelogLink } from '@/components/ChangelogUi';
import type { UpdateChannel } from '@/contexts/settingsDefaults';
import { isUpdatePending, type UpdateState } from '@/lib/updates/updateState';
import type { ReleaseSummary } from '@/lib/whatsNew/releaseSummary';
import { cn } from '@/lib/utils';
import { WhatsNewSummary } from './WhatsNewTiles';

export type WhatsNewTab = 'new' | 'recent';

/** The installed version's summary: still resolving, found, or absent from every source. */
export type SummaryState = { status: 'loading' } | { status: 'ready'; summary: ReleaseSummary } | { status: 'none' };

/** Update controls on a build with an update bridge. */
export interface WhatsNewUpdate {
  state: UpdateState;
  /** The label of the footer button that installs a finished download. */
  applyLabel: string;
  onCheck: () => void;
  onDownload: () => void;
  onChannelChange: (channel: UpdateChannel) => void;
}

const tag = (v?: string) => (v ? (v.startsWith('v') ? v : `v${v}`) : '');

function UpdateBanner({ update, checkedHere, onPreview }: { update: WhatsNewUpdate; checkedHere: boolean; onPreview: (() => void) | null }) {
  const { state } = update;
  const next = tag(state.latestVersion);
  if (state.phase === 'available') {
    return (
      <div className="space-y-2 rounded-md border border-success/40 bg-success/10 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-label">{next} is ready to download.</span>
          <div className="flex items-center gap-1">
            {onPreview && <Button size="sm" variant="link" onClick={onPreview}>Preview {next}</Button>}
            <Button size="sm" onClick={update.onDownload}>Download</Button>
          </div>
        </div>
        {state.openedInBrowser && (
          <Hint>The download opened in your browser. Open the .dmg file and copy the new app over the old one.</Hint>
        )}
      </div>
    );
  }
  if (state.phase === 'downloading') return <Meta role="status">Downloading {next}…</Meta>;
  if (state.phase === 'downloaded') {
    return <Meta role="status">{next} is downloaded. Select <strong>{update.applyLabel}</strong> under the version number.</Meta>;
  }
  if (state.phase === 'error') {
    const step = state.failedStep === 'download' ? 'download the update' : state.failedStep === 'install' ? 'install the update' : 'check for updates';
    return (
      <p role="alert" className="text-label text-destructive">
        Couldn’t {step}. {state.error}
      </p>
    );
  }
  if (!checkedHere) return null;
  if (state.phase === 'checking') return <Meta role="status">Checking for updates…</Meta>;
  if (state.phase === 'up-to-date') return <Meta role="status">You’re up to date.</Meta>;
  return null;
}

function ChannelSelect({ update }: { update: WhatsNewUpdate }) {
  return (
    <div className="ml-auto flex items-center gap-2 text-label">
      <span className="text-muted-foreground">Release Channel</span>
      <Select value={update.state.channel} onValueChange={(v) => update.onChannelChange(v as UpdateChannel)}>
        <SelectTrigger aria-label="Release Channel" className="h-8 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="stable">Stable</SelectItem>
          <SelectItem value="prerelease">Pre-release</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PrimaryAction({ update, onClose, onCheck }: { update: WhatsNewUpdate | null; onClose: () => void; onCheck: () => void }) {
  if (!update || isUpdatePending(update.state.phase)) {
    return <Button variant="outline" className="sm:ml-auto" onClick={onClose}>Close</Button>;
  }
  const checking = update.state.phase === 'checking';
  return <Button className="sm:ml-auto" onClick={onCheck} disabled={checking}>{checking ? 'Checking…' : 'Check for Updates'}</Button>;
}

/** What's New: the installed version's summary, Recent Changes, and the update controls where a bridge exists. */
export function WhatsNewDialog({ open, onOpenChange, version, summary, recent, update, tab, onTabChange, preview, previewing, onPreviewingChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  summary: SummaryState;
  /** The Recent Changes markdown, bundled at build time. */
  recent: string;
  update: WhatsNewUpdate | null;
  tab: WhatsNewTab;
  onTabChange: (tab: WhatsNewTab) => void;
  /** The newest available release's summary, once it parses. Null hides the preview link. */
  preview: ReleaseSummary | null;
  previewing: boolean;
  onPreviewingChange: (previewing: boolean) => void;
}) {
  const [checkedHere, setCheckedHere] = useState(false);
  useEffect(() => { if (!open) setCheckedHere(false); }, [open]);
  const check = () => { setCheckedHere(true); update?.onCheck(); };
  const showPreview = previewing && preview !== null;
  const changeTab = (next: WhatsNewTab) => {
    if (next === 'recent') onPreviewingChange(false);
    onTabChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent surface="whatsNew" aria-describedby={undefined} className="max-w-3xl">
        <DialogHeader>
          <div className={cn(dialogTitleRow, 'gap-3')}>
            <DialogTitle>{tag(version)}</DialogTitle>
            {update && <ChannelSelect update={update} />}
          </div>
        </DialogHeader>
        {update && (
          <UpdateBanner
            update={update}
            checkedHere={checkedHere}
            onPreview={preview && !showPreview ? () => { onTabChange('new'); onPreviewingChange(true); } : null}
          />
        )}
        <Tabs value={tab} onValueChange={(v) => changeTab(v as WhatsNewTab)} className="min-w-0">
          <TabsList>
            <TabsTrigger value="new">What’s New</TabsTrigger>
            <TabsTrigger value="recent">Recent Changes</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="pt-2">
            <ScrollArea className="max-h-[60dvh]" focusable>
              {showPreview ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Meta role="status">Previewing {tag(preview.version ?? undefined)}</Meta>
                    <Button size="sm" variant="link" onClick={() => onPreviewingChange(false)}>Back to {tag(version)}</Button>
                  </div>
                  <WhatsNewSummary summary={preview} />
                </div>
              ) : summary.status === 'ready' ? (
                <WhatsNewSummary summary={summary.summary} />
              ) : (
                <Meta role="status">{summary.status === 'loading' ? 'Loading…' : 'This version has no summary.'}</Meta>
              )}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="recent" className="pt-2">
            <ChangelogBody text={recent} placeholder="There are no release notes." currentVersion={version} />
          </TabsContent>
        </Tabs>
        <DialogFooter className="items-center">
          <FullChangelogLink />
          <PrimaryAction update={update} onClose={() => onOpenChange(false)} onCheck={check} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
