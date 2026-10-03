import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { SUPPORTER_LABELS, supporterTenure } from '@/lib/supporterFlair';
import { useMountedRef } from '@/lib/useMountedRef';
import { PatreonError, PatreonService, type PatreonStatus } from '@/services/PatreonService';

/** The project's Patreon page. */
export const PATREON_PAGE_URL = 'https://www.patreon.com/JakeJamesNSFW';

/** The Supporters wall. Absolute, so the app's Settings tab reaches it too. */
export const SUPPORTERS_WALL_URL = 'https://formamorph.ai/supporters';

/** What the server's callback redirect carried back: the `patreon` result and, for `confirm`, its one-shot token. */
export interface PatreonReturn {
  result: string;
  token: string | null;
}

const MESSAGES = {
  taken: 'That Patreon account is linked to another Formamorph account. Unlink it there, then try again.',
  denied: 'You didn’t approve the request on Patreon. Select Link Patreon to try again.',
  expired: 'The link request expired. Select Link Patreon to start again.',
  failed: 'Patreon didn’t answer. Try again in a moment.',
} as const;

type Notice = { kind: 'success' | 'error'; text: string } | null;

/** The message of a caught error, or `fallback` when it carries none. */
const errorText = (failure: unknown, fallback: string): string =>
  failure instanceof Error && failure.message ? failure.message : fallback;

/** What a failed confirm says. The two codes the server uses for a refused or taken link get this section's own copy. */
const confirmFailure = (failure: unknown): string => {
  if (failure instanceof PatreonError && failure.code === 'PATREON_TAKEN') return MESSAGES.taken;
  if (failure instanceof PatreonError && failure.code === 'PATREON_CONFIRM_REFUSED') return MESSAGES.expired;
  return failure instanceof PatreonError ? failure.message : MESSAGES.failed;
};

/** The notice a redirect result states without a call, or null when the result needs one or is unknown. */
const patreonReturnNotice = (result: string): Notice =>
  result in MESSAGES ? { kind: 'error', text: MESSAGES[result as keyof typeof MESSAGES] } : null;

interface PatreonSectionProps {
  /** Sends the browser to Patreon's approval page. The site navigates; the app opens the system browser. */
  openAuthorize: (url: string) => void;
  /** What the callback redirect carried, read once by the page. */
  returned?: PatreonReturn | null;
  /** A suspended account can read its status, but the server refuses every write. */
  suspended?: boolean;
  /** Reads the status again when the window gets focus or becomes visible. For the app, where the link finishes in another window. */
  refreshOnFocus?: boolean;
  className?: string;
}

/**
 * The Patreon link: its status, the Show Supporter Flair toggle, and Unlink.
 *
 * One component for the site's account page and the app's Settings tab. It talks to the account service
 * only, so it stays inside the site bundle boundary.
 */
export function PatreonSection({ openAuthorize, returned = null, suspended = false, refreshOnFocus = false, className }: PatreonSectionProps) {
  const mounted = useMountedRef();
  // `undefined` while the first read is out, `null` when it failed.
  const [status, setStatus] = useState<PatreonStatus | null | undefined>(undefined);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The confirm token is spent on any attempt, so each read runs once even when StrictMode re-runs effects.
  const ran = useRef(-1);
  // Read by the focus listener, so a refresh never starts on top of a write in flight.
  const busyRef = useRef(false);
  busyRef.current = busy;
  // Counts status reads and writes; only the newest one may set the status.
  const latest = useRef(0);

  useEffect(() => {
    if (ran.current === attempt) return;
    ran.current = attempt;

    const settle = async () => {
      // Only the arrival read uses the redirect; a retry reads the status.
      const arrival = attempt === 0 ? returned : null;
      const held = arrival?.result === 'confirm' && arrival.token ? arrival.token : null;
      // A `confirm` with no token cannot finish a link, so it reads as an expired request.
      const stated = arrival ? patreonReturnNotice(arrival.result === 'confirm' && !held ? 'expired' : arrival.result) : null;

      const mine = ++latest.current;
      try {
        const next = held ? await PatreonService.confirm(held) : await PatreonService.getStatus();
        if (!mounted.current) return;
        if (mine === latest.current) setStatus(next);
        if (held) setNotice({ kind: 'success', text: 'Patreon is linked. You can return to the app.' });
        // A `taken`, `denied`, `expired` or `failed` redirect stored no link; its message still applies.
        if (stated) setNotice(stated);
      } catch (failure) {
        if (!mounted.current) return;
        if (!held) {
          // A newer read or write owns the status now; its answer stands.
          if (mine !== latest.current) return;
          setStatus(null);
          setNotice({ kind: 'error', text: errorText(failure, 'Could not read your Patreon status.') });
          return;
        }

        // The token is spent, so a retry cannot confirm. Show the account as it stands, with the reason.
        setNotice({ kind: 'error', text: confirmFailure(failure) });
        try {
          const current = await PatreonService.getStatus();
          if (mounted.current && mine === latest.current) setStatus(current);
        } catch {
          if (mounted.current && mine === latest.current) setStatus(null);
        }
      }
    };

    void settle();
  }, [mounted, returned, attempt]);

  useEffect(() => {
    if (!refreshOnFocus) return;

    const refresh = () => {
      if (document.visibilityState === 'hidden' || busyRef.current) return;
      const mine = ++latest.current;
      PatreonService.getStatus().then(
        (next) => {
          if (!mounted.current || mine !== latest.current) return;
          setStatus(next);
          setNotice(null);
        },
        () => { /* The next focus tries again; the last status stays on screen. */ },
      );
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refreshOnFocus, mounted]);

  /** Run one write, show its failure on the section, and adopt the status it returns. */
  const write = async (action: () => Promise<PatreonStatus>, failure: string) => {
    setNotice(null);
    setBusy(true);
    const mine = ++latest.current;
    try {
      const next = await action();
      if (mounted.current && mine === latest.current) setStatus(next);
    } catch (error) {
      if (mounted.current) setNotice({ kind: 'error', text: errorText(error, failure) });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const link = async () => {
    setNotice(null);
    setBusy(true);
    try {
      const url = await PatreonService.startLink();
      if (!mounted.current) return;
      openAuthorize(url);
      // The app stays open beside the browser. The site is leaving for Patreon, so it stays busy.
      if (refreshOnFocus) setBusy(false);
    } catch (error) {
      if (!mounted.current) return;
      setNotice({ kind: 'error', text: errorText(error, 'Could not start the link.') });
      setBusy(false);
    }
  };

  const unlink = async () => {
    setConfirmingUnlink(false);
    await write(() => PatreonService.unlink(), 'Could not unlink Patreon.');
  };

  const become = (
    <a
      href={PATREON_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-label text-primary underline underline-offset-2"
    >
      Become a Supporter
    </a>
  );

  const wall = (
    <a
      href={SUPPORTERS_WALL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-label text-primary underline underline-offset-2"
    >
      See the Supporters wall
    </a>
  );

  const unlinkButton = (
    <Button variant="outline" disabled={busy || suspended} onClick={() => setConfirmingUnlink(true)}>
      Unlink
    </Button>
  );

  const tenure = status?.linked && status.tier ? supporterTenure(status.since) : null;

  return (
    <section className={cn('space-y-3', className)}>
      <h2 className="text-title font-semibold">Patreon</h2>

      {status === undefined && <p className="text-helper text-muted-foreground">Checking your Patreon link…</p>}

      {status === null && (
        <Button
          variant="outline"
          onClick={() => { setNotice(null); setStatus(undefined); setAttempt((count) => count + 1); }}
        >
          Try Again
        </Button>
      )}

      {status && !status.linked && (
        <>
          <p className="text-helper text-muted-foreground">
            Link your Patreon account to get Supporter Flair next to your name
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || suspended} onClick={() => { void link(); }}>
              {busy ? 'Opening Patreon…' : 'Link Patreon'}
            </Button>
            {become}
          </div>
          <div>{wall}</div>
        </>
      )}

      {status?.linked && !status.tier && (
        <>
          <p className="text-body">No active membership</p>
          <div className="flex flex-wrap items-center gap-3">
            {unlinkButton}
            {become}
          </div>
          <div>{wall}</div>
        </>
      )}

      {status?.linked && status.tier && (
        <>
          <p className="text-body">
            <span className="font-semibold">{SUPPORTER_LABELS[status.tier]}</span>
            {tenure && <span className="text-muted-foreground"> · Supporting for {tenure}</span>}
          </p>
          <div className="flex items-start gap-2">
            <Checkbox
              id="patreon-show-flair"
              className="mt-0.5"
              checked={status.showFlair}
              disabled={busy || suspended}
              onCheckedChange={(next) => {
                void write(() => PatreonService.setShowFlair(next === true), 'Could not save the flair setting.');
              }}
            />
            <div>
              <label htmlFor="patreon-show-flair" className="text-label">Show Supporter Flair</label>
              <p className="text-helper text-muted-foreground">
                Shows your badge, name color, Profile Image ring, and place on the Supporters wall
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {unlinkButton}
            {wall}
          </div>
        </>
      )}

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn('text-helper', notice.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {notice.text}
        </p>
      )}

      <AlertDialog open={confirmingUnlink} onOpenChange={setConfirmingUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Patreon?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Supporter Flair disappears at once. You can link this Patreon account to another Formamorph account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void unlink(); }}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
