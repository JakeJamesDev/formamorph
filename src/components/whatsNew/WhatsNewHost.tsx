import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import bundledSummary from 'virtual:whats-new-summary';
import { APP_VERSION } from '@/lib/version';
import { useSettings } from '@/contexts/SettingsContext';
import { useUpdateChecker, type UpdateChecker } from '@/hooks/useUpdateChecker';
import { updateBridge } from '@/lib/updates/updateBridge';
import { isUpdatePending, type UpdateState } from '@/lib/updates/updateState';
import { checkForUpdate, releaseBodies } from '@/services/UpdateService';
import { pickSummary } from '@/lib/whatsNew/summarySource';
import type { ReleaseSummary } from '@/lib/whatsNew/releaseSummary';
import { useDevRoute } from '@/lib/devRouter';
import { useMountedRef } from '@/lib/useMountedRef';
import { WHATS_NEW_DEV_STATES, type WhatsNewDevState as DevState } from './whatsNewDevStates';
import { WhatsNewContext, applyLabel } from './whatsNewContext';
import { WhatsNewDialog, type RecentChanges, type SummaryState, type WhatsNewTab, type WhatsNewUpdate } from './WhatsNewDialog';

/** How long What's New waits for the GitHub release before it falls back. */
const SUMMARY_TIMEOUT_MS = 4000;

interface HostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  /** Tests shorten the GitHub wait. */
  summaryTimeoutMs?: number;
}

/** What's New for the main menu: one dialog every footer version button opens. `open` is the caller's, so
 *  startup prompts can wait on it. */
export function WhatsNewHost(props: HostProps) {
  return updateBridge() ? <BridgeHost {...props} /> : <WebHost {...props} />;
}

function BridgeHost(props: HostProps) {
  const { updateChannel, setUpdateChannel } = useSettings();
  const checker = useUpdateChecker(updateChannel);
  const { state, check, download } = checker;
  const { onOpenChange } = props;
  const update = useMemo<WhatsNewUpdate>(() => ({
    state,
    applyLabel: applyLabel(),
    onCheck: check,
    onDownload: () => { download(); onOpenChange(false); },
    onChannelChange: setUpdateChannel,
  }), [state, check, download, onOpenChange, setUpdateChannel]);
  const recent: RecentChanges = { text: state.changelog, loading: false, updateVersion: isUpdatePending(state.phase) ? state.latestVersion : undefined };
  return <HostCore {...props} checker={checker} update={update} recent={recent} />;
}

function WebHost(props: HostProps) {
  const [recent, setRecent] = useState<RecentChanges>({ loading: false });
  const started = useRef(false);
  const mounted = useMountedRef();
  // The web build fetches the notes on first open, never on load.
  useEffect(() => {
    if (!props.open || started.current) return;
    started.current = true;
    setRecent({ loading: true });
    void checkForUpdate('stable').then((res) => {
      if (!mounted.current) return;
      setRecent({
        loading: false,
        text: res.success ? (res.result?.changelog ?? '') : '',
        updateVersion: res.success && res.result?.available ? res.result.latestVersion : undefined,
      });
    });
  }, [props.open, mounted]);
  return <HostCore {...props} checker={null} update={null} recent={recent} />;
}

interface DevOverride {
  summary: SummaryState;
  preview: ReleaseSummary | null;
  recent: RecentChanges;
  update: WhatsNewUpdate | null;
}

function HostCore({ open, onOpenChange, children, summaryTimeoutMs = SUMMARY_TIMEOUT_MS, checker, update, recent }: HostProps & {
  checker: UpdateChecker | null;
  update: WhatsNewUpdate | null;
  recent: RecentChanges;
}) {
  const [summary, setSummary] = useState<SummaryState>({ status: 'loading' });
  const [tab, setTab] = useState<WhatsNewTab>('new');
  const [dev, setDev] = useState<DevOverride | null>(null);
  const [fetchedPreview, setFetchedPreview] = useState<ReleaseSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const resolving = useRef(false);
  const mounted = useMountedRef();
  const devRoute = useDevRoute();

  // The newest available release is the one Download installs. Its body comes from the live list, then the
  // cache, never the bundle, and the link shows only when it renders.
  const available = update?.state.phase === 'available' ? update.state.latestVersion ?? null : null;
  const previewVersion = open && !dev ? available : null;
  useEffect(() => {
    setFetchedPreview(null);
    if (!previewVersion) return;
    let stale = false;
    void releaseBodies(previewVersion, summaryTimeoutMs).then(({ live, cached }) => {
      if (stale || !mounted.current) return;
      setFetchedPreview(pickSummary({ github: live, cache: cached, bundled: null }, previewVersion));
    });
    return () => { stale = true; };
  }, [previewVersion, summaryTimeoutMs, mounted]);
  const preview = dev ? dev.preview : fetchedPreview;
  useEffect(() => { if (!preview) setPreviewing(false); }, [preview]);

  // The summary resolves once, on first open: GitHub, then the cached release, then the bundled file.
  useEffect(() => {
    if (!open || resolving.current) return;
    resolving.current = true;
    void releaseBodies(APP_VERSION, summaryTimeoutMs).then(({ live, cached }) => {
      if (!mounted.current) return;
      const picked = pickSummary({ github: live, cache: cached, bundled: bundledSummary }, APP_VERSION);
      if (picked) setSummary({ status: 'ready', summary: picked });
      else {
        setSummary({ status: 'none' });
        setTab('recent');
      }
    });
  }, [open, summaryTimeoutMs, mounted]);

  // DEV: `#dev?modal=whatsNew&tab=web|upToDate|update` opens on the seed summary and a canned update state.
  // A plain DEV branch, so the build drops the seed import.
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'whatsNew') {
      const state = (WHATS_NEW_DEV_STATES as readonly string[]).includes(devRoute.tab ?? '') ? devRoute.tab as DevState : 'web';
      Promise.all([
        import('../../../docs/whats-new/3.7.0.md?raw'),
        import('@/lib/devChangelogSample'),
      ]).then(([seed, sample]) => {
        if (!mounted.current) return;
        const picked = pickSummary({ github: null, cache: null, bundled: seed.default }, '3.7.0');
        // The canned update is v3.8.0; its preview reuses the seed under that title.
        const next = pickSummary({ github: seed.default.replace('v3.7.0', 'v3.8.0'), cache: null, bundled: null }, '3.8.0');
        setDev({
          summary: picked ? { status: 'ready', summary: picked } : { status: 'none' },
          preview: state === 'update' ? next : null,
          recent: { loading: false, text: sample.DEV_CHANGELOG_SAMPLE, updateVersion: state === 'update' ? '2.13.0' : undefined },
          update: state === 'web' ? null : devUpdate(state),
        });
        setTab('new');
        onOpenChange(true);
      }).catch((e: unknown) => console.error('whatsNew dev route', e));
    }
  }, [devRoute?.modal, devRoute?.tab, mounted, onOpenChange]);

  const openWhatsNew = useCallback(() => onOpenChange(true), [onOpenChange]);
  const context = useMemo(() => ({ openWhatsNew, checker }), [openWhatsNew, checker]);

  return (
    <WhatsNewContext.Provider value={context}>
      {children}
      <WhatsNewDialog
        open={open}
        onOpenChange={onOpenChange}
        version={APP_VERSION}
        summary={dev?.summary ?? summary}
        recent={dev?.recent ?? recent}
        update={dev ? dev.update : update}
        tab={tab}
        onTabChange={setTab}
        preview={preview}
        previewing={previewing}
        onPreviewingChange={setPreviewing}
      />
    </WhatsNewContext.Provider>
  );
}

/** A canned bridge build for the dev route; its buttons do nothing. */
function devUpdate(state: Exclude<DevState, 'web'>): WhatsNewUpdate {
  const updateState: UpdateState = state === 'update'
    ? { phase: 'available', currentVersion: APP_VERSION, channel: 'stable', latestVersion: 'v3.8.0' }
    : { phase: 'up-to-date', currentVersion: APP_VERSION, channel: 'stable' };
  const noop = () => {};
  return { state: updateState, applyLabel: 'Update & Restart', onCheck: noop, onDownload: noop, onChannelChange: noop };
}
